import { useState, useEffect, useCallback } from "react";
import { ToolAction } from "../../../../services/ResponseParser";
import { Message } from "../types";
import { CLICKABLE_TOOLS } from "../constants";

interface UseToolActionsProps {
  onSendToolRequest?: (action: ToolAction, message: Message) => void;

  parsedMessages: any[]; // Using any[] for now as ParsedMessage type is complex to import if not exported
}

export const useToolActions = ({
  onSendToolRequest,

  parsedMessages,
}: UseToolActionsProps) => {
  const [clickedActions, setClickedActions] = useState<Set<string>>(new Set());
  const [failedActions, setFailedActions] = useState<Set<string>>(new Set());
  const [clearedActions, setClearedActions] = useState<Set<string>>(new Set());

  // Listen for message to remove clicked action state
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data.command === "removeClickedAction" && event.data.actionId) {
        setClickedActions((prev) => {
          const newSet = new Set(prev);
          newSet.delete(event.data.actionId);
          return newSet;
        });
      }

      if (event.data.command === "markActionClicked" && event.data.actionId) {
        setClickedActions((prev) => new Set(prev).add(event.data.actionId));
      }

      if (event.data.command === "markActionFailed" && event.data.actionId) {
        // Mark as clicked AND failed
        setClickedActions((prev) => new Set(prev).add(event.data.actionId));
        setClickedActions((prev) => new Set(prev).add(event.data.actionId));
        setFailedActions((prev) => new Set(prev).add(event.data.actionId));
      }

      if (event.data.command === "markActionCleared" && event.data.actionId) {
        setClearedActions((prev) => new Set(prev).add(event.data.actionId));
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
    ) => {
      if (!onSendToolRequest) {
        console.warn("[useToolActions] onSendToolRequest is missing!");
        return;
      }

      if (Array.isArray(actionOrActions)) {
        // Handle Batch
        const actionsToProcess: ToolAction[] = [];

        actionOrActions.forEach((action: any) => {
          // We expect _index to be attached by ToolItem
          const idx = action._index !== undefined ? action._index : actionIndex;
          const actionId = `${message.id}-action-${idx}`;

          if (!clickedActions.has(actionId)) {
            // Optimistic update REMOVED for batch to allow sequential processing feedback
            // setClickedActions((prev) => new Set(prev).add(actionId));
            actionsToProcess.push({ ...action, actionId });
          }
        });

        if (actionsToProcess.length > 0) {
          onSendToolRequest(actionsToProcess as any, message);
        }
      } else {
        // Handle Single
        const action = actionOrActions;
        if (CLICKABLE_TOOLS.includes(action.type)) {
          // Mark as clicked
          const actionId = `${message.id}-action-${actionIndex}`;
          setClickedActions((prev) => new Set(prev).add(actionId));

          // Also attach _index for ChatPanel logic to track completion
          const actionWithId = { ...action, actionId, _index: actionIndex };
          onSendToolRequest(actionWithId, message);
        }
      }
    },
    [onSendToolRequest, clickedActions],
  );

  const handleActionClear = useCallback((actionId: string) => {
    // Notify ChatPanel/others to clear this action's context
    window.postMessage(
      {
        command: "markActionCleared",
        actionId: actionId,
      },
      "*",
    );
    // Optimistic update
    setClearedActions((prev) => new Set(prev).add(actionId));
  }, []);

  // Auto-execute tools logic REMOVED

  return {
    clickedActions,
    handleToolClick,
    failedActions,
    clearedActions,
    handleActionClear,
  };
};
