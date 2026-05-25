import { useState, useEffect, useCallback, useRef } from "react";
import { ToolAction } from "../../../../services/ResponseParser";
import { Message } from "../types";
import { CLICKABLE_TOOLS } from "../constants";
import { useSettings } from "../../../../context/SettingsContext";
import { getPermissionDecision } from "../../../../hooks/useToolExecution";

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
  const triggeredIdsRef = useRef<Set<string>>(new Set());

  // Sync ref with state to catch updates from anywhere
  useEffect(() => {
    triggeredIdsRef.current = new Set([...clickedActions, ...failedActions]);
  }, [clickedActions, failedActions]);

  // Load initially clicked actions from message history
  useEffect(() => {
    const historicalClicked = new Set<string>();
    parsedMessages.forEach((msg) => {
      if (msg.clickedActions && Array.isArray(msg.clickedActions)) {
        msg.clickedActions.forEach((actionId: string) => {
          historicalClicked.add(actionId);
        });
      }
    });
    if (historicalClicked.size > 0) {
      setClickedActions((prev) => {
        const hasNew = Array.from(historicalClicked).some((id) => !prev.has(id));
        if (hasNew) {
          const next = new Set(prev);
          historicalClicked.forEach((id) => next.add(id));
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
      if (!onSendToolRequest) {
        return;
      }

      const actionIdBase = `${message.id}-action-`;

      if (type === "reject") {
        const actions = Array.isArray(actionOrActions)
          ? actionOrActions
          : [actionOrActions];
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

      lastMessage.parsed.actions.forEach((action: ToolAction, idx: number) => {
        const actionId = `${lastMessage.id}-action-${idx}`;

        // Only run action if not streaming partial tool
        if (action.isPartial) return;

        // Has it completed running/cancelled?
        if (
          clickedActions.has(actionId) ||
          failedActions.has(actionId) ||
          triggeredIdsRef.current.has(actionId)
        )
          return;

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

        if (isBlocked) return;

        // Check if settings specify this tool runs auto or deny
        const decision = getPermissionDecision(permissionMode, action.type);
        if (decision === "allow" || decision === "deny") {
          // Optimistic Synchronous Update
          triggeredIdsRef.current.add(actionId);
          setClickedActions((prev: Set<string>) => new Set(prev).add(actionId));
          actionsToRun.push({ ...action, actionId, _index: idx } as any);
        }
      });

      if (actionsToRun.length > 0) {
        onSendToolRequest(actionsToRun as any, lastMessage, true);
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
  };
};
