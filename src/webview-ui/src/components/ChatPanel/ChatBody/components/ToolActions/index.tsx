import React, { useMemo } from "react";
import { ToolAction } from "../../../../../services/ResponseParser";
import { Message } from "../../types";
import ToolItem from "./ToolItem";

interface ToolActionsListProps {
  message: Message;
  items: { action: ToolAction; index: number }[]; // Changed from actions: ToolAction[]
  clickedActions: Set<string>;
  onToolClick: (
    action: ToolAction | ToolAction[],
    message: Message,
    actionIndex: number,
    type: "accept_all" | "accept_once" | "reject",
  ) => void;
  isVisibleTool?: (type: string) => boolean;
  executionState?: {
    total: number;
    completed: number;
    status: "idle" | "running" | "error" | "done";
  };
  failedActions?: Set<string>;
  isLastMessage?: boolean;
  toolOutputs?: Record<string, { output: string; isError: boolean }>;
  terminalStatus?: Record<string, "busy" | "free">;
  nextUserMessage?: Message;
  allMessages?: Message[];
  activeTerminalIds?: Set<string>;
  attachedTerminalIds?: Set<string>;
  conversationId?: string;
  allActions?: ToolAction[];
  isBlockedByPrecedingInteraction?: boolean;
}

const ToolActionsList: React.FC<ToolActionsListProps> = ({
  message,
  items,
  clickedActions,
  onToolClick,
  executionState,
  failedActions,
  isLastMessage,
  toolOutputs,
  terminalStatus,
  nextUserMessage,
  allMessages,
  activeTerminalIds,
  attachedTerminalIds,
  conversationId,
  allActions,
  isBlockedByPrecedingInteraction = false,
  isVisibleTool = (type: string) => true,
}) => {
  // Filter out invisible tools immediately
  const visibleItems = useMemo(() => {
    return items.filter((item) => isVisibleTool(item.action.type));
  }, [items, isVisibleTool]);

  // Memoize action handlers to prevent unnecessary re-renders
  const memoizedActions = useMemo(() => {
    const groups: { action: ToolAction; index: number }[][] = [];
    visibleItems.forEach((item) => {
      groups.push([item]);
    });

    // Calculate the first unclicked index to enforce sequential execution
    // We need to check GLOBAL order. The passed `items` might be a subset.
    // However, `clickedActions` uses global index.
    // The visual active group logic depends on "Is this the next thing to do?".
    // If we have text blocks in between, we might have multiple ToolActionsLists.
    // This component only knows about the `items` passed to it.
    // But `isActiveGroup` logic wants to know if the FIRST item of this group is the `firstUnclickedIndex`.

    // We need to know what the *global* first unclicked index is.
    // But `ToolActionsList` doesn't know about outside actions.
    // HOWEVER, `ToolItem` highlights itself if `item.index === firstUnclickedIndex`.
    // So we just need to find the global first unclicked index.

    // BUT we can't easily find "global first unclicked" just from `items` if the unclicked one is NOT in `items`.
    // Wait, `clickedActions` has keys. `message` has ID.
    // We can iterate integers from 0 until we find one not in `clickedActions`? No, we don't know total count here easily unless valid.

    // Actually, `ToolItem` logic for `isActiveGroup`:
    /*
       const isActiveGroup =
        isLastMessage &&
        firstUnclickedIndex !== -1 &&
        firstItem.index === firstUnclickedIndex;
    */

    // To calculate `firstUnclickedIndex` correctly, we ideally need the full list of actions or we just need to know if *this group* is next.
    // We can scan `items`. If there is a gap before `items[0].index`, we assume previous ones are done? No.

    // Let's pass `actions` (full list) or just calculate `firstUnclickedIndex` by scanning `items`?
    // No, if there are actions BEFORE this block that are unclicked, this block should NOT be active.

    // For now, let's assume we scan `clickedActions` against the indices present in `items`?
    // No.

    // If I split ToolActionsList, `firstUnclickedIndex` logic inside here is flawed if it only looks at `items`.
    // But wait, `ToolItem` receive `isActiveGroup` prop.
    // We should compute `firstUnclickedIndex` based on `items`? No, based on ALL actions.
    // But we don't have ALL actions here anymore.

    // Actually, we can approximate:
    // We iterate 0...infinity? No.
    // Maybe we should pass `firstUnclickedIndex` as a prop?
    // For now, I'll implement a local check: Check if `items` contains the next unclicked action.
    // But to know if it's the *absolute* next, we need to know if any smaller index is unclicked.

    // Current workaround: We assume that if we are rendering this list, we check indices.
    // But if index 0 is unclicked and this list starts at index 5, we shouldn't show active.

    // Let's look at `clickedActions`. It's a Set.
    // We can't know the lowest missing number easily without range.

    // I will try to pass `firstUnclickedIndex` from `MessageBox`?
    // Or I can just check if *any* action with index < `items[0].index` is unclicked?
    // I don't know the total number of actions in `MessageBox` here.

    // COMPROMISE: For now, I will use `items` to calculate local active.
    // BUT this means if I have: [Tool 0] (Unclicked) ... [Tool 5] (Unclicked).
    // Tool 0 is active. Tool 5 should NOT be active.
    // ToolActionsList for Tool 5 won't see Tool 0.
    // So Tool 5 might think it's active.

    // This is a UI glitch risk.
    // Fix: `MessageBox` should pass `actions` (all) or `firstUnclickedIndex`.
    // I'll stick to modifying `items` prop first. I'll rely on the `index` being correct.
    // I will simply NOT calculate `firstUnclickedIndex` locally properly if I don't have full info.
    // Wait, I can loop `0` to `items[0].index - 1`. If any is missing from `clickedActions`, then this group is NOT active.
    // Yes! `clickedActions` contains ALL clicked IDs.
    // So I can check:
    /*
       let valid = true;
       for(let i=0; i < firstItem.index; i++) {
         if (!clickedActions.has(`${message.id}-action-${i}`)) {
           valid = false; break;
         }
       }
    */
    // This assumes actions are 0-indexed and continuous. They ARE.

    let globalFirstUnclicked = -1;
    // Heuristic: check indices from 0 (we assume 0-indexed actions).
    // We can stop checking once we reach the last index of `items`.
    // Or just check strictly for determining `isActiveGroup`.

    // Let's implement the check inside the map

    return groups.map((group, groupIdx) => {
      const firstItem = group[0];
      const key = `group-${firstItem.index}`;

      // Determine if this group is the "active" one (next to execute)
      // It is active if its first item's index matches the global firstUnclickedIndex.

      // Calculate globalFirstUnclicked (lazy way: check 0..firstItem.index)
      let isPreviousAllDone = true;
      for (let i = 0; i < firstItem.index; i++) {
        const actionId = `${message.id}-action-${i}`;
        if (!clickedActions.has(actionId)) {
          isPreviousAllDone = false;
          break;
        }

        // If it's a run_command, check if it's actually finished
        const action = allActions ? allActions[i] : null;
        if (action && action.type === "run_command") {
          const output = toolOutputs?.[actionId];
          if (!output) {
            isPreviousAllDone = false;
            break;
          }
          const terminalId =
            (output as any)?.terminalId || action.params.terminal_id;
          if (terminalId && terminalStatus?.[terminalId] === "busy") {
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
          <ToolItem
            group={group}
            messageId={message.id}
            clickedActions={clickedActions}
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
            activeTerminalIds={activeTerminalIds}
            attachedTerminalIds={attachedTerminalIds}
            conversationId={conversationId}
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
    activeTerminalIds,
    nextUserMessage,
  ]);

  if (!visibleItems || visibleItems.length === 0) return null;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "4px",
      }}
    >
      {memoizedActions}
    </div>
  );
};

export default ToolActionsList;
