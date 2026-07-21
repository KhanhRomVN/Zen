import React, { useMemo } from "react";

// CONSTANTS
import {
  TOOL_ACTION_TYPES,
  EXECUTION_STATUS,
} from "../../../constants/constants";

// TYPES
import { ToolAction } from "../../../services/ResponseParser";
import { Message } from "../../../types/message";

// COMPONENTS
import ToolRouter from "./ToolRouter";

interface ToolActionsListProps {
  message: Message;
  items: { action: ToolAction; index: number }[];
  clickedActions: Set<string>;
  rejectedActions?: Set<string>;
  onToolClick: (
    action: ToolAction | ToolAction[],
    message: Message,
    actionIndex: number,
    type: (typeof TOOL_ACTION_TYPES)[keyof typeof TOOL_ACTION_TYPES],
  ) => void;
  isVisibleTool?: (type: string) => boolean;
  executionState?: {
    total: number;
    completed: number;
    status: (typeof EXECUTION_STATUS)[keyof typeof EXECUTION_STATUS];
  };
  failedActions?: Set<string>;
  isLastMessage?: boolean;
  toolOutputs?: Record<string, { output: string; isError: boolean }>;
  terminalStatus?: Record<string, "busy" | "free">;
  nextUserMessage?: Message;
  allMessages?: Message[];
  conversationId?: string;
  allActions?: ToolAction[];
  isBlockedByPrecedingInteraction?: boolean;
  singleLineReviewActions?: Record<
    string,
    { action: any; actionId: string; messageId: string }
  >;
  onConfirmSingleLineAction?: (actionId: string) => void;
  onRejectSingleLineAction?: (actionId: string) => void;
  onGitConfirm?: (items: any[]) => void;
  onGitCancel?: () => void;
  gitStatusItems?: any[];
  gitStatusBranch?: string;
  isGitProcessing?: boolean;
  isGitStatusVisible?: boolean;
  onBackToHome?: (summary: string) => void;
}

const ToolActionsList: React.FC<ToolActionsListProps> = ({
  message,
  items,
  clickedActions,
  rejectedActions,
  onToolClick,
  executionState,
  failedActions,
  isLastMessage,
  toolOutputs,
  terminalStatus,
  nextUserMessage,
  allMessages,
  conversationId,
  allActions,
  isBlockedByPrecedingInteraction = false,
  isVisibleTool = (type: string) => true,
  singleLineReviewActions,
  onConfirmSingleLineAction,
  onRejectSingleLineAction,
  onGitConfirm,
  onGitCancel,
  gitStatusItems,
  gitStatusBranch,
  isGitProcessing,
  isGitStatusVisible = true,
  onBackToHome,
}) => {
  // Filter out invisible tools immediately
  const visibleItems = useMemo(() => {
    return items.filter((item) => isVisibleTool(item.action.type));
  }, [items, isVisibleTool]);

  // Memoize action handlers to prevent unnecessary re-renders
  const memoizedActions = useMemo(() => {
    const MERGE_TYPES = new Set(["write_to_file", "replace_in_file"]);
    const getPath = (action: ToolAction) =>
      action.params.file_path || action.params.path || "";

    const groups: { action: ToolAction; index: number }[][] = [];
    visibleItems.forEach((item) => {
      const last = groups[groups.length - 1];
      if (
        last &&
        MERGE_TYPES.has(item.action.type) &&
        MERGE_TYPES.has(last[0].action.type) &&
        getPath(item.action) === getPath(last[0].action)
      ) {
        last.push(item);
      } else {
        groups.push([item]);
      }
    });

    return groups.map((group, groupIdx) => {
      const firstItem = group[0];
      const key = `group-${firstItem.index}`;

      let isPreviousAllDone = true;
      for (let i = 0; i < firstItem.index; i++) {
        const actionId = `${message.id}-action-${i}`;
        const hasOutput = toolOutputs && toolOutputs[actionId];
        const isClicked = clickedActions.has(actionId);

        // If there's a user message after this assistant message,
        // or a message in history containing the output of this action, it is completed.
        const hasHistoryOutput =
          !!nextUserMessage ||
          !!allMessages?.some((m) => m.actionIds?.includes(actionId));

        // Check if this action is completed (clicked, has output, or history output)
        const isCompleted = isClicked || hasOutput || hasHistoryOutput;

        if (!isCompleted) {
          const action = allActions ? allActions[i] : null;
          const isWriteTool =
            action &&
            (action.type === "write_to_file" ||
              action.type === "replace_in_file");

          if (isWriteTool && !hasHistoryOutput) {
            // Write/edit tool not yet approved → block subsequent tools
            isPreviousAllDone = false;
            break;
          }
          // For non-write tools (read, run_command, etc.), block as usual
          if (!isWriteTool) {
            isPreviousAllDone = false;
            break;
          }
        }

        // If it's a run_command, check if it's actually finished
        const action = allActions ? allActions[i] : null;
        if (action && action.type === "run_command") {
          const output = toolOutputs?.[actionId];
          const terminalId =
            (output as any)?.terminalId || action.params.terminal_id;
          if (
            terminalId &&
            terminalStatus?.[terminalId] === "busy" &&
            !hasHistoryOutput
          ) {
            isPreviousAllDone = false;
            break;
          }
        }
      }

      const isThisActionClicked = clickedActions.has(
        `${message.id}-action-${firstItem.index}`,
      );

      const isActiveGroup =
        isLastMessage &&
        isPreviousAllDone &&
        !isThisActionClicked &&
        !isBlockedByPrecedingInteraction;

      return (
        <React.Fragment key={key}>
          <ToolRouter
            group={group}
            messageId={message.id}
            clickedActions={clickedActions}
            rejectedActions={rejectedActions}
            onToolClick={(act, msgId, aIdx, type) =>
              onToolClick(act, message, aIdx, type)
            }
            executionState={executionState}
            isActiveGroup={isActiveGroup}
            failedActions={failedActions}
            isLastMessage={isLastMessage}
            isLastItemInList={groupIdx === groups.length - 1}
            toolOutputs={toolOutputs}
            terminalStatus={terminalStatus}
            nextUserMessage={nextUserMessage}
            allMessages={allMessages}
            conversationId={conversationId}
            singleLineReviewActions={singleLineReviewActions}
            onConfirmSingleLineAction={onConfirmSingleLineAction}
            onRejectSingleLineAction={onRejectSingleLineAction}
            onGitConfirm={onGitConfirm}
            onGitCancel={onGitCancel}
            gitStatusItems={gitStatusItems}
            gitStatusBranch={gitStatusBranch}
            isGitProcessing={isGitProcessing}
            isGitStatusVisible={isGitStatusVisible}
            onBackToHome={onBackToHome}
          />
        </React.Fragment>
      );
    });
  }, [
    items,
    clickedActions,
    message,
    onToolClick,
    isLastMessage,
    toolOutputs,
    terminalStatus,
    nextUserMessage,
  ]);

  if (!visibleItems || visibleItems.length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0",
      }}
    >
      {memoizedActions}
    </div>
  );
};

export default ToolActionsList;
