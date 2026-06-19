import { useState, useEffect, useCallback, useRef } from "react";
import { ToolAction } from "../services/ResponseParser";
import { Message } from "../types/message";
import { CLICKABLE_TOOLS } from "../constants/constants";
import { useSettings } from "../../../context/SettingsContext";
import { getPermissionDecision } from "../hooks/useToolExecution";

interface UseToolActionsProps {
  onSendToolRequest?: (
    action: ToolAction | ToolAction[],
    message: Message,
    isAutoTrigger?: boolean,
    actionType?: "accept_all" | "accept_once" | "reject",
  ) => void;
  onToolAction?: (
    actionId: string,
    actionType: "accept_all" | "accept_once" | "reject",
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
  useEffect(() => {
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
      type: "accept_all" | "accept_once" | "reject" = "accept_once",
    ) => {
      console.log(`[useToolActions] handleToolClick called: type=${type}, actionIndex=${actionIndex}, messageId=${message.id}`);

      if (!onSendToolRequest) {
        console.warn('[useToolActions] onSendToolRequest is undefined, cannot handle click');
        return;
      }

      const actionIdBase = `${message.id}-action-`;

      if (type === "reject") {
        // 🐛 FIX: Truyền đúng _index cho action để không bị nhầm actionId
        const actions = Array.isArray(actionOrActions)
          ? actionOrActions.map((a) => ({ ...a, _index: actionIndex }))
          : [{ ...actionOrActions, _index: actionIndex }];
        console.log(`[useToolActions] REJECT: sending to onSendToolRequest with ${actions.length} actions, actionIndex=${actionIndex}, _index=${actions[0]._index}`);
        onSendToolRequest(actions as any, message, false, "reject");
        return;
      }

      if (type === "accept_all") {
        const actions = Array.isArray(actionOrActions)
          ? actionOrActions
          : [actionOrActions];
        actions.forEach((a) => onToolAction?.("", "accept_all", a.type));
      }

      if (Array.isArray(actionOrActions)) {
        // Handle Batch
        const actionsToProcess: ToolAction[] = [];

        actionOrActions.forEach((action: any) => {
          const idx = action._index !== undefined ? action._index : actionIndex;
          const actionId = `${actionIdBase}${idx}`;

          if (!clickedActions.has(actionId)) {
            actionsToProcess.push({ ...action, actionId });
          }
        });

        if (actionsToProcess.length > 0) {
          onSendToolRequest(actionsToProcess as any, message, false, type);
        }
      } else {
        // Handle Single
        const action = actionOrActions;
        if (CLICKABLE_TOOLS.includes(action.type)) {
          // Mark as clicked
          const actionId = `${actionIdBase}${actionIndex}`;
          setClickedActions((prev: Set<string>) => new Set(prev).add(actionId));

          // Also attach _index for ChatPanel logic to track completion
          const actionWithId = { ...action, actionId, _index: actionIndex };
          onSendToolRequest(actionWithId, message, false, type);
        }
      }
    },
    [onSendToolRequest, onToolAction, clickedActions],
  );

  // Auto-execute tools logic
  useEffect(() => {
    if (isRestored) return;
    if (!onSendToolRequest || parsedMessages.length === 0) return;

    // CRITICAL: Do NOT auto-trigger while the LLM is still streaming.
    // Triggering mid-stream causes the flush logic to parseAIResponse on
    // incomplete content, flushing early and skipping later actions (e.g. SEARCH).
    if (isProcessing) return;

    const lastMessage = parsedMessages[parsedMessages.length - 1];
    if (lastMessage.role !== "assistant") return;
    if (lastMessage.isCancelled) return;
    if (lastMessage.parsed && lastMessage.parsed.actions) {
      const actionsToRun: ToolAction[] = [];
      const contentBlocks = lastMessage.parsed.contentBlocks || [];
      const selectedOption = lastMessage.selectedOption;

      console.log(`[useToolActions] AUTO-TRIGGER CHECK: permissionMode=${permissionMode}, lastMessage.id=${lastMessage.id}, actions count=${lastMessage.parsed.actions.length}`);

      lastMessage.parsed.actions.forEach((action: ToolAction, idx: number) => {
        const actionId = `${lastMessage.id}-action-${idx}`;

        // Only run action if not streaming partial tool
        if (action.isPartial) {
          console.log(`[useToolActions] AUTO: action ${idx} is partial, skipping`);
          return;
        }

        // Has it completed running/cancelled?
        if (
          clickedActions.has(actionId) ||
          failedActions.has(actionId) ||
          triggeredIdsRef.current.has(actionId)
        ) {
          console.log(`[useToolActions] AUTO: action ${idx} already completed (clicked=${clickedActions.has(actionId)}, failed=${failedActions.has(actionId)}, triggered=${triggeredIdsRef.current.has(actionId)})`);
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
          console.log(`[useToolActions] AUTO: action ${idx} is blocked by preceding interaction`);
          return;
        }

        // Check if settings specify this tool runs auto or deny
        const decision = getPermissionDecision(permissionMode, action.type);
        console.log(`[useToolActions] AUTO: action ${idx} (${action.type}) decision=${decision}`);
        if (decision === "allow" || decision === "deny") {
          // Optimistic Synchronous Update
          triggeredIdsRef.current.add(actionId);
          setClickedActions((prev: Set<string>) => new Set(prev).add(actionId));
          actionsToRun.push({ ...action, actionId, _index: idx } as any);
          console.log(`[useToolActions] AUTO: action ${idx} added to actionsToRun`);
        }
      });

      if (actionsToRun.length > 0) {
        console.log(`[useToolActions] AUTO: sending ${actionsToRun.length} actions to onSendToolRequest`);
        onSendToolRequest(actionsToRun as any, lastMessage, true);
      } else {
        console.log(`[useToolActions] AUTO: no actions to run`);
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
