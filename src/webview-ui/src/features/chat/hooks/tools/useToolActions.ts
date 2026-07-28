import { useState, useEffect, useCallback, useRef } from "react";
import { ToolAction } from "../../services/ResponseParser";
import { Message } from "../../types/message";
import { useSettings } from "../../../../context/SettingsContext";
import { getPermissionDecision } from "./useToolExecution";
import { isToolClickable, TOOL_ACTION_TYPES } from "../../constants/constants";

interface UseToolActionsProps {
  onSendToolRequest?: (
    action: ToolAction | ToolAction[],
    message: Message,
    isAutoTrigger?: boolean,
    actionType?: (typeof TOOL_ACTION_TYPES)[keyof typeof TOOL_ACTION_TYPES],
  ) => void;
  onToolAction?: (
    actionId: string,
    actionType: (typeof TOOL_ACTION_TYPES)[keyof typeof TOOL_ACTION_TYPES],
    toolName?: string,
  ) => void;
  parsedMessages: any[];
  isProcessing?: boolean; // Prevents auto-triggering mid-stream
  isRestored?: boolean;
}

export const useToolActions = ({
  onSendToolRequest,
  onToolAction,
  parsedMessages,
  isProcessing = false,
  isRestored = false,
}: UseToolActionsProps) => {
  const { permissionMode } = useSettings();
  const [clickedActions, setClickedActions] = useState<Set<string>>(new Set());
  const [failedActions, setFailedActions] = useState<Set<string>>(new Set());
  const [rejectedActions, setRejectedActions] = useState<Set<string>>(
    new Set(),
  );
  const triggeredIdsRef = useRef<Set<string>>(new Set());

  // Sync ref with state to catch updates from anywhere
  useEffect(() => {
    triggeredIdsRef.current = new Set([...clickedActions, ...failedActions]);
  }, [clickedActions, failedActions]);

  // Load initially clicked actions from message history
  const loadHistoryPrevLengthRef = useRef(0);
  useEffect(() => {
    // Only run when parsedMessages length changes (new message added)
    const currentLength = parsedMessages.length;
    if (currentLength === loadHistoryPrevLengthRef.current) {
      return;
    }
    loadHistoryPrevLengthRef.current = currentLength;

    const historicalClicked = new Set<string>();
    const historicalRejected = new Set<string>();
    parsedMessages.forEach((msg) => {
      if (msg.clickedActions && Array.isArray(msg.clickedActions)) {
        msg.clickedActions.forEach((actionId: string) => {
          historicalClicked.add(actionId);
        });
      }
      if (msg.rejectedActions && Array.isArray(msg.rejectedActions)) {
        msg.rejectedActions.forEach((actionId: string) => {
          historicalRejected.add(actionId);
        });
      }
    });

    if (historicalClicked.size > 0) {
      setClickedActions((prev) => {
        const hasNew = Array.from(historicalClicked).some(
          (id) => !prev.has(id),
        );
        if (hasNew) {
          const next = new Set(prev);
          historicalClicked.forEach((id) => next.add(id));
          return next;
        }
        return prev;
      });
    }
    if (historicalRejected.size > 0) {
      setRejectedActions((prev) => {
        const hasNew = Array.from(historicalRejected).some(
          (id) => !prev.has(id),
        );
        if (hasNew) {
          const next = new Set(prev);
          historicalRejected.forEach((id) => next.add(id));
          return next;
        }
        return prev;
      });
    }
  }, [parsedMessages]);

  // Listen for message to remove clicked action state
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const { command, actionId } = event.data;
      if (command === "removeClickedAction" && actionId) {
        setClickedActions((prev: Set<string>) => {
          const newSet = new Set(prev);
          newSet.delete(actionId);
          triggeredIdsRef.current.delete(actionId);
          return newSet;
        });
      }

      if (command === "markActionClicked" && actionId) {
        setClickedActions((prev: Set<string>) => {
          const newSet = new Set(prev);
          newSet.add(actionId);
          triggeredIdsRef.current.add(actionId);
          return newSet;
        });
      }

      if (command === "markActionFailed" && actionId) {
        // Mark as clicked AND failed
        setClickedActions((prev: Set<string>) => {
          const newSet = new Set(prev);
          newSet.add(actionId);
          triggeredIdsRef.current.add(actionId);
          return newSet;
        });
        setFailedActions((prev: Set<string>) => new Set(prev).add(actionId));
      }

      if (command === "markActionRejected" && actionId) {
        setRejectedActions((prev: Set<string>) => new Set(prev).add(actionId));
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const handleToolClick = useCallback(
    (
      actionOrActions: ToolAction | ToolAction[],
      message: Message,
      actionIndex: number,
      type: (typeof TOOL_ACTION_TYPES)[keyof typeof TOOL_ACTION_TYPES] = TOOL_ACTION_TYPES.ACCEPT,
    ) => {
      if (!onSendToolRequest) {
        return;
      }

      const actionIdBase = `${message.id}-action-`;
      const actionId = `${actionIdBase}${actionIndex}`;

      if (type === TOOL_ACTION_TYPES.REJECT) {
        const actions = Array.isArray(actionOrActions)
          ? actionOrActions.map((a) => ({ ...a, _index: actionIndex }))
          : [{ ...actionOrActions, _index: actionIndex }];
        onSendToolRequest(
          actions as any,
          message,
          false,
          TOOL_ACTION_TYPES.REJECT,
        );
        return;
      }

      // accept_all logic removed — only accept (formerly accept_once) is kept

      if (Array.isArray(actionOrActions)) {
        // 🔧 FIX: When user clicks on a merged action group, only send the SINGLE action at actionIndex
        // This ensures approval mode requires individual approval for each merged action
        const targetAction = actionOrActions.find(
          (a: any) => (a._index !== undefined ? a._index : 0) === actionIndex,
        );

        if (!targetAction) {
          console.warn(
            `[Zen][handleToolClick] Cannot find action at index ${actionIndex}`,
            {
              actionIndex,
              availableIndices: actionOrActions.map((a: any) => a._index),
              messageId: message.id,
            },
          );
          return;
        }

        const actionId = `${actionIdBase}${actionIndex}`;

        // 🔧 FIX: Skip actions with validation errors
        if (targetAction.isError) {
          console.warn(
            `[useToolActions][handleToolClick] ❌ Blocked execution for malformed tool action (merged):`,
            {
              actionId,
              toolName: targetAction.type,
              errorCode: targetAction.errorCode,
              errorMessage: targetAction.errorMessage,
              reason:
                "Merged action - validation error detected, execution blocked",
              willCallOnSendToolRequest: false,
            },
          );
          return;
        }

        // Skip if already clicked
        if (clickedActions.has(actionId)) {
          return;
        }

        // Send ONLY this single action, not the entire merged group
        if (isToolClickable(targetAction.type)) {
          const actionToProcess = {
            ...targetAction,
            actionId,
            _index: actionIndex,
          };

          onSendToolRequest(actionToProcess, message, false, type);
        }
      } else {
        // Handle Single
        const action = actionOrActions;
        const actionId = `${actionIdBase}${actionIndex}`;

        // 🔧 FIX: Block execution if action has validation error
        if (action.isError) {
          console.warn(
            `[useToolActions][handleToolClick] ❌ Blocked execution for malformed tool action (single):`,
            {
              actionId,
              toolName: action.type,
              errorCode: action.errorCode,
              errorMessage: action.errorMessage,
              reason:
                "Single execution - validation error detected, execution blocked",
              willCallOnSendToolRequest: false,
            },
          );
          return;
        }

        if (isToolClickable(action.type)) {
          // DON'T mark as clicked here - let handleToolRequest do it
          // This prevents the "already clicked" skip logic from triggering
          // Also attach _index for ChatPanel logic to track completion
          const actionWithId = { ...action, actionId, _index: actionIndex };
          onSendToolRequest(actionWithId, message, false, type);
        }
      }
    },
    [onSendToolRequest, onToolAction, clickedActions, permissionMode],
  );

  // Auto-execute tools logic
  const prevParsedLengthRef = useRef(0);
  const prevPermissionModeRef = useRef(permissionMode);

  useEffect(() => {
    // Check if permission mode changed
    const permissionModeChanged =
      prevPermissionModeRef.current !== permissionMode;
    if (permissionModeChanged) {
      prevPermissionModeRef.current = permissionMode;
    }

    // Only run when parsedMessages actually changes (new message or new actions) OR permission mode changes
    const currentLength = parsedMessages.length;
    const lengthUnchanged = currentLength === prevParsedLengthRef.current;

    if (lengthUnchanged && !permissionModeChanged && !isProcessing) {
      // No new messages and permission unchanged, skip
      return;
    }
    prevParsedLengthRef.current = currentLength;

    // Early returns to prevent unnecessary processing
    // ALWAYS skip if restored (even if permission mode changed)
    if (isRestored || !onSendToolRequest || parsedMessages.length === 0) {
      return;
    }

    // CRITICAL: Do NOT auto-trigger while the LLM is still streaming.
    // Triggering mid-stream causes the flush logic to parseAIResponse on
    // incomplete content, flushing early and skipping later actions (e.g. SEARCH).
    if (isProcessing) {
      return;
    }

    const lastMessage = parsedMessages[parsedMessages.length - 1];
    if (lastMessage.role !== "assistant") {
      return;
    }
    if (lastMessage.isCancelled) {
      return;
    }
    if (!lastMessage.parsed || !lastMessage.parsed.actions) {
      return;
    }

    const actionsToRun: ToolAction[] = [];
    const contentBlocks = lastMessage.parsed.contentBlocks || [];
    const selectedOption = lastMessage.selectedOption;

    // Collect action IDs to mark as triggered (batch state update at the end)
    const actionsToMarkTriggered: string[] = [];

    lastMessage.parsed.actions.forEach((action: ToolAction, idx: number) => {
      const actionId = `${lastMessage.id}-action-${idx}`;

      // Handle actions with validation errors (malformed XML, missing params)
      // In APPROVAL mode: Don't auto-trigger, let user see error and click Skip
      // In FULL-ACCESS mode: Auto-reject to provide feedback to AI
      if (action.isError) {
        // 🔧 FIX: Only auto-reject in fullAccess mode
        // In approval mode, let user see the error and manually click Skip
        if (permissionMode === "fullAccess") {
          // Collect for batch update
          actionsToMarkTriggered.push(actionId);

          // Add to execution queue as REJECT action
          actionsToRun.push({
            ...action,
            actionId,
            _index: idx,
            _actionType: TOOL_ACTION_TYPES.REJECT,
          } as any);
        } else {
          // Don't add to actionsToRun - let user see error and click Skip button
        }

        return;
      }

      // Skip display-only tools - they should not be auto-executed
      if (action.type === "git_status" || action.type === "commit_message") {
        return;
      }

      // Has it completed running/cancelled?
      if (
        clickedActions.has(actionId) ||
        failedActions.has(actionId) ||
        triggeredIdsRef.current.has(actionId)
      ) {
        return;
      }

      // SEQUENTIAL BLOCK CHECK:
      // Find this action's position in contentBlocks to check for preceding unanswered questions or tools
      const actionBlockIdx = contentBlocks.findIndex(
        (b: any) => b.type === "tool" && b.actionIndex === idx,
      );

      const isBlocked =
        actionBlockIdx !== -1 &&
        contentBlocks.slice(0, actionBlockIdx).some((prevBlock: any) => {
          if (prevBlock.type === "question" && !prevBlock.optional) {
            return !selectedOption;
          }
          if (prevBlock.type === "tool") {
            const prevActionId = `${lastMessage.id}-action-${prevBlock.actionIndex}`;
            return (
              !clickedActions.has(prevActionId) &&
              !triggeredIdsRef.current.has(prevActionId)
            );
          }
          return false;
        });

      if (isBlocked) {
        return;
      }

      // Check if settings specify this tool runs auto or deny
      const decision = getPermissionDecision(permissionMode, action.type);
      if (decision === "allow" || decision === TOOL_ACTION_TYPES.REJECT) {
        // Collect for batch update
        actionsToMarkTriggered.push(actionId);
        actionsToRun.push({ ...action, actionId, _index: idx } as any);
      }
    });

    // 🔧 BATCH STATE UPDATE: Update all triggered actions at once (after loop)
    if (actionsToMarkTriggered.length > 0) {
      actionsToMarkTriggered.forEach((id) => triggeredIdsRef.current.add(id));
      setClickedActions((prev: Set<string>) => {
        const newSet = new Set(prev);
        actionsToMarkTriggered.forEach((id) => newSet.add(id));
        return newSet;
      });
    }

    if (actionsToRun.length > 0 && onSendToolRequest) {
      // Check if there are REJECT actions (malformed tools)
      const rejectActions = actionsToRun.filter(
        (a: any) => a._actionType === TOOL_ACTION_TYPES.REJECT,
      );
      const acceptActions = actionsToRun.filter(
        (a: any) => a._actionType !== TOOL_ACTION_TYPES.REJECT,
      );

      // Send REJECT actions first (to generate error feedback)
      if (rejectActions.length > 0) {
        onSendToolRequest(
          rejectActions as any,
          lastMessage,
          true,
          TOOL_ACTION_TYPES.REJECT,
        );
      }

      // Then send ACCEPT actions
      if (acceptActions.length > 0) {
        onSendToolRequest(
          acceptActions as any,
          lastMessage,
          true,
          TOOL_ACTION_TYPES.ACCEPT,
        );
      }
    }
  }, [
    parsedMessages,
    onSendToolRequest,
    clickedActions,
    failedActions,
    permissionMode,
    isProcessing,
    isRestored,
  ]);

  return {
    clickedActions,
    handleToolClick,
    failedActions,
    rejectedActions,
  };
};
