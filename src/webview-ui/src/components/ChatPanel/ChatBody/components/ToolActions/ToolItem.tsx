import React, { useState, useEffect } from "react";
import { ToolAction } from "../../../../../services/ResponseParser";
import { formatActionForDisplay } from "../../../../../services/ResponseParser";
import { getToolColor } from "../../utils";
import { CLICKABLE_TOOLS } from "../../constants";
import { extensionService } from "../../../../../services/ExtensionService";
import { Message } from "../../types";
import { useProject } from "../../../../../context/ProjectContext";
import FileToolItem from "./FileToolItem";
import TerminalToolItem from "./TerminalToolItem";
import GroupedToolItem from "./GroupedToolItem";

interface ToolItemProps {
  group: { action: ToolAction; index: number }[];
  messageId: string;
  clickedActions: Set<string>;
  onToolClick: (
    action: ToolAction,
    messageId: string,
    actionIndex: number,
    type: "accept_all" | "accept_once" | "reject",
  ) => void;
  executionState?: {
    total: number;
    completed: number;
    status: "idle" | "running" | "error" | "done";
  };
  isActiveGroup?: boolean;
  failedActions?: Set<string>;
  isLastMessage?: boolean;
  isLastItemInList?: boolean;
  toolOutputs?: Record<string, { output: string; isError: boolean; terminalId?: string }>;
  terminalStatus?: Record<string, "busy" | "free">;
  nextUserMessage?: Message;
  allMessages?: Message[];
  activeTerminalIds?: Set<string>;
  attachedTerminalIds?: Set<string>;
  conversationId?: string;
}

const ToolItem: React.FC<ToolItemProps> = ({
  group, messageId, clickedActions, onToolClick, executionState,
  isActiveGroup, failedActions, isLastMessage, isLastItemInList = true,
  toolOutputs, terminalStatus, nextUserMessage, allMessages,
  activeTerminalIds, attachedTerminalIds, conversationId,
}) => {
  const { rootPath } = useProject();

  const [fuzzyStatus, setFuzzyStatus] = React.useState<{ status: string; score?: number; startLine?: number } | null>(null);
  const [fileStatsMap, setFileStatsMap] = React.useState<Record<string, { lines: number; loading: boolean }>>({});
  const [isPreviewing, setIsPreviewing] = React.useState<string | null>(null);
  const [storedOutput, setStoredOutput] = useState<string | null>(null);
  const [collapsedActions, setCollapsedActions] = useState<Set<string>>(new Set());
  const processedActions = React.useRef<Set<string>>(new Set());

  const toggleCollapse = (actionId: string) => {
    setCollapsedActions((prev) => {
      const next = new Set(prev);
      next.has(actionId) ? next.delete(actionId) : next.add(actionId);
      return next;
    });
  };

  useEffect(() => {
    const initialCollapsed = new Set<string>();
    group.forEach((item, index) => {
      const actionId = `${messageId}-action-${index}`;
      if (item.action.type !== "run_command" && !item.action.isPartial) {
        initialCollapsed.add(actionId);
      }
    });
    setCollapsedActions(initialCollapsed);
  }, [group, messageId]);

  // Fetch terminal output from history
  const runCommandAction = group.find((g) => g.action.type === "run_command");
  useEffect(() => {
    if (!nextUserMessage?.content || !runCommandAction) return;
    const commandText = runCommandAction.action.params.command;
    if (!commandText) return;

    const escaped = commandText.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = new RegExp(
      `Output: \\[run_command for '${escaped}'.*?\\] .*?with "terminal_output-([a-f0-9-]+)"`
    ).exec(nextUserMessage.content);

    if (match?.[1]) {
      const outputUuid = match[1];
      const requestId = `read-terminal-${outputUuid}`;
      if (processedActions.current.has(requestId) || storedOutput) return;

      const handleMessage = (event: MessageEvent) => {
        const msg = event.data;
        if (msg.command === "readTerminalOutputResult" && msg.outputUuid === outputUuid) {
          if (msg.content) setStoredOutput(msg.content);
          window.removeEventListener("message", handleMessage);
        }
      };
      window.addEventListener("message", handleMessage);
      processedActions.current.add(requestId);
      extensionService.postMessage({
        command: "readTerminalOutput",
        chatUuid: conversationId || nextUserMessage.conversationId || "",
        outputUuid,
        requestId,
      });
      return () => window.removeEventListener("message", handleMessage);
    }
  }, [nextUserMessage, runCommandAction, messageId, storedOutput]);

  // Validate fuzzy match & fetch file stats
  React.useEffect(() => {
    const cleanups: (() => void)[] = [];

    group.forEach((item) => {
      const { action, index } = item;
      const actionId = `${messageId}-action-${index}`;

      if (action.type === "replace_in_file" && action.params.diff) {
        const validationId = `${messageId}-${index}-validate`;
        if (processedActions.current.has(validationId)) return;

        const handleMessage = (event: MessageEvent) => {
          const msg = event.data;
          if (msg.command === "validateFuzzyMatchResult" && msg.id === validationId) {
            setFuzzyStatus({ status: msg.status, score: msg.score, startLine: msg.startLine });
            window.removeEventListener("message", handleMessage);
          }
        };
        window.addEventListener("message", handleMessage);
        cleanups.push(() => window.removeEventListener("message", handleMessage));
        processedActions.current.add(validationId);
        (window as any).vscodeApi?.postMessage({ command: "validateFuzzyMatch", path: action.params.path, diff: action.params.diff, id: validationId });
      }

      if ((action.type === "read_file" || action.type === "write_to_file") && action.params.path) {
        const path = action.params.path;
        if (fileStatsMap[path]) return;
        const statId = `${messageId}-${index}-stats`;
        if (processedActions.current.has(statId)) return;
        processedActions.current.add(statId);

        const handleStats = (event: MessageEvent) => {
          const msg = event.data;
          if (msg.command === "fileStatsResult" && msg.id === statId && msg.path === path) {
            setFileStatsMap((prev) => ({ ...prev, [path]: { lines: msg.lines, loading: false } }));
            window.removeEventListener("message", handleStats);
          }
        };
        window.addEventListener("message", handleStats);
        cleanups.push(() => window.removeEventListener("message", handleStats));
        (window as any).vscodeApi?.postMessage({ command: "getFileStats", path, id: statId });
      }
    });

    return () => cleanups.forEach((c) => c());
  }, [group, messageId, isActiveGroup, clickedActions, onToolClick, fileStatsMap]);

  if (!group || group.length === 0) return null;

  const firstAction = group[0].action;
  const toolType = firstAction.type;
  const toolColor = getToolColor(toolType);
  const clickableTools = CLICKABLE_TOOLS;

  const isSingleFileTool =
    group.length === 1 &&
    (toolType === "replace_in_file" || toolType === "write_to_file" ||
      toolType === "read_file" || toolType === "list_files" || toolType === "search_files");

  if (isSingleFileTool) {
    return (
      <FileToolItem
        action={firstAction}
        actionIndex={group[0].index}
        messageId={messageId}
        isActionClicked={clickedActions.has(`${messageId}-action-${group[0].index}`)}
        isActiveGroup={isActiveGroup}
        isLastMessage={isLastMessage}
        isLastItemInList={isLastItemInList}
        toolOutputs={toolOutputs}
        allMessages={allMessages}
        fileStatsMap={fileStatsMap}
        onToolClick={onToolClick}
      />
    );
  }

  if (toolType === "run_command") {
    return (
      <TerminalToolItem
        action={firstAction}
        actionIndex={group[0].index}
        messageId={messageId}
        isActionClicked={clickedActions.has(`${messageId}-action-${group[0].index}`)}
        isActiveGroup={isActiveGroup}
        isLastMessage={isLastMessage}
        toolOutputs={toolOutputs}
        terminalStatus={terminalStatus}
        nextUserMessage={nextUserMessage}
        rootPath={rootPath}
        onToolClick={onToolClick}
      />
    );
  }

  const isStyledTool =
    toolType === "replace_in_file" || toolType === "write_to_file" ||
    toolType === "list_files" || toolType === "search_files" || toolType === "read_file";

  if (isStyledTool) {
    return (
      <GroupedToolItem
        group={group}
        messageId={messageId}
        clickedActions={clickedActions}
        failedActions={failedActions}
        isActiveGroup={isActiveGroup}
        isLastMessage={isLastMessage}
        executionState={executionState}
        toolOutputs={toolOutputs}
        terminalStatus={terminalStatus}
        fileStatsMap={fileStatsMap}
        isPreviewing={isPreviewing}
        fuzzyStatus={fuzzyStatus}
        rootPath={rootPath}
        onToolClick={onToolClick}
        onSetIsPreviewing={setIsPreviewing}
        collapsedActions={collapsedActions}
        onToggleCollapse={toggleCollapse}
      />
    );
  }

  // Fallback for non-styled tools
  return (
    <>
      {group.map(({ action, index }) => (
        <div key={index} style={{ marginBottom: "8px" }}>
          <div
            style={{
              padding: "var(--spacing-sm) var(--spacing-md)",
              backgroundColor: "var(--secondary-bg)",
              border: `2px solid ${toolColor}`,
              borderRadius: "var(--border-radius-lg)",
              cursor: clickableTools.includes(action.type) ? "pointer" : "default",
              transition: "all 0.2s",
              display: "flex", alignItems: "center", gap: "var(--spacing-sm)", width: "fit-content",
            }}
            onClick={() => { if (clickableTools.includes(action.type)) onToolClick(action, messageId, index, "accept_once"); }}
          >
            <span style={{ fontSize: "var(--font-size-sm)", color: "var(--primary-text)", fontWeight: 600, flex: 1 }}>
              {formatActionForDisplay(action)}
            </span>
            {clickableTools.includes(action.type) && (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={toolColor} strokeWidth="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            )}
          </div>
        </div>
      ))}
    </>
  );
};

export default ToolItem;
