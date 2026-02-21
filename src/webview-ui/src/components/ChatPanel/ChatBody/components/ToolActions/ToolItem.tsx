import React from "react";
import { ToolAction } from "../../../../../services/ResponseParser";
import { formatActionForDisplay } from "../../../../../services/ResponseParser";
import {
  getToolLabel,
  getToolColor,
  getFilename,
  handleDiffClick,
} from "../../utils";
import FileIcon from "../../../../common/FileIcon";
import { CodeBlock } from "../../../../CodeBlock";
import { TerminalBlock } from "../../../../TerminalBlock";
import { RichtextBlock } from "../../../../RichtextBlock";
import { parseDiff } from "../../../../../utils/diffUtils";
import { CLICKABLE_TOOLS, MANUAL_CONFIRMATION_TOOLS } from "../../constants";
import { extensionService } from "../../../../../services/ExtensionService";

interface ToolItemProps {
  group: { action: ToolAction; index: number }[];
  messageId: string;
  clickedActions: Set<string>;
  onToolClick: (
    action: ToolAction,
    messageId: string,
    actionIndex: number,
  ) => void;
  executionState?: {
    total: number;
    completed: number;
    status: "idle" | "running" | "error" | "done";
  };
  isActiveGroup?: boolean;
  failedActions?: Set<string>;
  isLastMessage?: boolean;
  clearedActions?: Set<string>;
  onActionClear?: (actionId: string) => void;
  toolOutputs?: Record<
    string,
    { output: string; isError: boolean; terminalId?: string }
  >;
  terminalStatus?: Record<string, "busy" | "free">;
}

const ExecuteButton: React.FC<{
  isCompleted: boolean;
  isActive: boolean;
  isFailed?: boolean;
  isLastMessage?: boolean;
  onExecute: (e: React.MouseEvent) => void;
  toolColor: string;
  title: string;
  isSweepable?: boolean;
  isSwept?: boolean;
  isSkipped?: boolean; // New prop for history skipped state
  isLoading?: boolean; // New prop for loading state
  showText?: boolean; // New prop to show text label
  labelText?: string; // New prop for text label
}> = ({
  isCompleted,
  isActive,
  isFailed,
  isLastMessage,
  onExecute,
  toolColor,
  title,
  isSweepable,
  isSwept,
  isSkipped,
  isLoading,
  showText,
  labelText,
}) => {
  return (
    <button
      onClick={(e) => {
        console.log("[ExecuteButton] Clicked", {
          title,
          isLoading,
          isLastMessage,
          isCompleted,
          isActive,
          isSweepable,
        });
        e.stopPropagation();
        onExecute(e);
      }}
      disabled={false}
      style={{
        background: "transparent",
        color: "var(--vscode-editor-foreground)",
        border: "none",
        cursor: isLoading ? "wait" : "pointer",
        padding: "4px",
        borderRadius: "4px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 0.2s",
        opacity: isActive || isCompleted ? 1 : 0.6,
        fontSize: "14px",
        gap: "4px",
      }}
      className="execute-button-minimal"
      title={title}
    >
      {/* LOADING STATE */}
      {isLoading && (
        <div className="codicon codicon-loading codicon-modifier-spin" />
      )}

      {/* COMPLETED STATE: SWEEP ICON (Only if not loading) */}
      {!isLoading && isCompleted && (
        <div
          style={{
            color: isSwept
              ? "var(--vscode-descriptionForeground)"
              : "var(--vscode-testing-iconPassed)",
            opacity: isSwept ? 0.5 : 1,
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          {/* 🆕 Broom icon only if manual tool or explicitly sweepable */}
          {isLastMessage && isSweepable && (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m16 22-1-4" />
              <path d="M19 14a1 1 0 0 0 1-1v-1a2 2 0 0 0-2-2h-3a1 1 0 0 1-1-1V4a2 2 0 0 0-4 0v5a1 1 0 0 1-1 1H6a2 2 0 0 0-2 2v1a1 1 0 0 0 1 1" />
              <path d="M19 14H5l-1.973 6.767A1 1 0 0 0 4 22h16a1 1 0 0 0 .973-1.233z" />
              <path d="m8 22 1-4" />
            </svg>
          )}
        </div>
      )}

      {/* PLAY ICON FOR ACTIVE OR SKIPPED STATE */}
      {!isLoading && (isActive || isSkipped) && !isCompleted && (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z" />
        </svg>
      )}
    </button>
  );
};

const ToolItem: React.FC<ToolItemProps> = ({
  group,
  messageId,
  clickedActions,
  onToolClick,
  executionState,
  isActiveGroup,
  failedActions,
  isLastMessage,
  clearedActions,
  onActionClear,
  toolOutputs,
  terminalStatus,
}) => {
  // Local state for fuzzy match validation (for replace_in_file)
  const [fuzzyStatus, setFuzzyStatus] = React.useState<{
    status: string;
    score?: number;
    startLine?: number;
  } | null>(null);

  // Local state for file stats (line count)
  const [fileStatsMap, setFileStatsMap] = React.useState<
    Record<string, { lines: number; loading: boolean }>
  >({});

  // Track write_to_file preview
  const [isPreviewing, setIsPreviewing] = React.useState<string | null>(null);

  // Track validated/auto-run actions to prevent re-requests on prop changes
  const processedActions = React.useRef<Set<string>>(new Set());

  React.useEffect(() => {
    // Only run for replace_in_file actions
    // Track cleanup functions
    const cleanups: (() => void)[] = [];

    group.forEach((item) => {
      const { action, index } = item;
      const actionId = `${messageId}-action-${index}`;

      // [Auto-run logic]
      const isManual = MANUAL_CONFIRMATION_TOOLS.includes(action.type);
      if (
        !isManual &&
        isActiveGroup &&
        !clickedActions.has(actionId) &&
        !processedActions.current.has(actionId)
      ) {
        processedActions.current.add(actionId);
        onToolClick(action, messageId, index);
      }

      if (action.type === "replace_in_file" && action.params.diff) {
        const validationId = `${messageId}-${index}-validate`;

        // Gate: Skip if already validated
        if (processedActions.current.has(validationId)) {
          return;
        }

        const handleMessage = (event: MessageEvent) => {
          const message = event.data;
          if (
            message.command === "validateFuzzyMatchResult" &&
            message.id === validationId
          ) {
            setFuzzyStatus({
              status: message.status,
              score: message.score,
              startLine: message.startLine,
            });

            window.removeEventListener("message", handleMessage);
          }
        };

        window.addEventListener("message", handleMessage);
        cleanups.push(() =>
          window.removeEventListener("message", handleMessage),
        );

        // Mark as validated to prevent re-sending
        processedActions.current.add(validationId);

        if ((window as any).vscodeApi) {
          (window as any).vscodeApi.postMessage({
            command: "validateFuzzyMatch",
            path: action.params.path,
            diff: action.params.diff,
            id: validationId,
          });
        }
      }

      // [New] Fetch file stats for read_file
      if (action.type === "read_file" && action.params.path) {
        const path = action.params.path;
        if (!fileStatsMap[path]) {
          // We can't set state inside render loop safely if it triggers re-render,
          // but this is inside useEffect so it's fine.
          // However, setting state here might trigger re-render -> re-effect -> loop if dependencies change.
          // But `group` shouldn't change just because `fileStatsMap` changed.
          // Unless parent recreates group.

          // We'll leave fileStats logic mostly as is but fix the cleanup.

          const statId = `${messageId}-${index}-stats`;
          const handleStats = (event: MessageEvent) => {
            const message = event.data;
            if (
              message.command === "fileStatsResult" &&
              message.id === statId &&
              message.path === path
            ) {
              setFileStatsMap((prev) => ({
                ...prev,
                [path]: { lines: message.lines, loading: false },
              }));
              window.removeEventListener("message", handleStats);
            }
          };
          window.addEventListener("message", handleStats);
          cleanups.push(() =>
            window.removeEventListener("message", handleStats),
          );

          if ((window as any).vscodeApi) {
            // Use setTimeout to avoid 'setState during render' warnings if that was a concern,
            // though postMessage is async anyway.
            (window as any).vscodeApi.postMessage({
              command: "getFileStats",
              path: path,
              id: statId,
            });
          }
        }
      }
    });

    return () => {
      cleanups.forEach((c) => c());
    };

    // Handle incoming messages for stats is done via closure above,
    // but better to have a single listener if possible.
    // For simplicity given the structure, the above per-action unique ID listener works
    // but might leak if component unmounts quickly.
    // Let's rely on the cleanup logic.
    // (Actually the closure approach inside forEach is risky for cleanup if dependencies change).
    // A better approach is a single global listener effect for this component.
  }, [group, messageId]); // Keeping dependencies simple

  if (!group || group.length === 0) return null;

  const firstAction = group[0].action;
  const toolType = firstAction.type;

  if (toolType === "read_file") return null;

  const clickableTools = CLICKABLE_TOOLS;

  const toolColor = getToolColor(toolType);
  const isStyledTool =
    toolType === "replace_in_file" ||
    toolType === "write_to_file" ||
    toolType === "list_files" ||
    toolType === "run_command" ||
    toolType === "search_files" ||
    toolType === "list_terminals" ||
    toolType === "remove_terminal" ||
    toolType === "stop_terminal" ||
    toolType === "create_terminal_shell" ||
    toolType === "read_terminal_logs" ||
    toolType === "update_codebase_context";
  if (isStyledTool) {
    // 🆕 Minimalist UI for single replace_in_file/write_to_file
    if (
      group.length === 1 &&
      (toolType === "replace_in_file" || toolType === "write_to_file")
    ) {
      const item = group[0];
      const { action, index } = item;
      const actionId = `${messageId}-action-${index}`;
      const isActionClicked = clickedActions.has(actionId);
      const isActionSwept = clearedActions?.has(actionId);
      const isActionFailed = failedActions?.has(actionId);

      const isNextToExecute =
        executionState && executionState.status !== "done"
          ? executionState.completed === index
          : !isActionClicked;

      const isLoading =
        executionState?.status === "running" &&
        executionState.completed === index;

      // Calculate diff string for replace_in_file
      let codeContent = "";
      let lineHighlights: {
        startLine: number;
        endLine: number;
        type: "added" | "removed";
      }[] = [];
      const fileExt = getFilename(action).split(".").pop() || "txt";

      // Map extension to Monaco language ID for proper syntax highlighting
      const extensionToLanguage: Record<string, string> = {
        py: "python",
        js: "javascript",
        jsx: "javascript",
        ts: "typescript",
        tsx: "typescript",
        java: "java",
        c: "c",
        cpp: "cpp",
        cs: "csharp",
        go: "go",
        rs: "rust",
        php: "php",
        rb: "ruby",
        swift: "swift",
        kt: "kotlin",
        html: "html",
        css: "css",
        scss: "scss",
        json: "json",
        xml: "xml",
        yaml: "yaml",
        yml: "yaml",
        md: "markdown",
        sh: "shell",
        bash: "shell",
        sql: "sql",
      };

      const codeLanguage =
        toolType === "replace_in_file"
          ? extensionToLanguage[fileExt.toLowerCase()] || fileExt
          : "typescript";

      if (action.type === "replace_in_file" && action.params.diff) {
        const result = parseDiff(action.params.diff);
        codeContent = result.code;
        lineHighlights = result.lineHighlights;
      } else if (toolType === "write_to_file") {
        codeContent = action.params.content || "";
      }

      // Calculate stats
      let diffStats = null;
      if (action.type === "replace_in_file" && action.params.diff) {
        const result = parseDiff(action.params.diff);
        diffStats = result.stats;
      }

      const linesCount =
        action.type === "write_to_file"
          ? action.params.content?.split("\n").length || 0
          : 0;

      return (
        <CodeBlock
          code={codeContent}
          language={codeLanguage}
          maxLines={20}
          filename={action.params.path || getFilename(action)} // Full path
          startLineNumber={fuzzyStatus?.startLine} // Start line from fuzzy match (or 1 default)
          lineHighlights={
            toolType === "replace_in_file" ? lineHighlights : undefined
          }
          backgroundColor={
            toolType === "write_to_file" ? "rgba(40, 167, 69, 0.2)" : undefined
          }
          defaultCollapsed={true} // 🆕 Collapsed by default for both edit and create
          diffStats={
            toolType === "replace_in_file"
              ? diffStats || undefined
              : linesCount > 0
                ? { added: linesCount, removed: 0 } // 🆕 Show line count as diffStats for write_to_file
                : undefined
          }
          prefix={toolType === "replace_in_file" ? "Edit" : "Create"} // 🆕 Add prefix for both types
          statusColor={toolColor} // 🆕 Add status color dot
        />
      );
    }

    const terminalToolsWithBlock = ["run_command"];
    const simpleTerminalTools = [
      "list_terminals",
      "remove_terminal",
      "stop_terminal",
      "create_terminal_shell",
    ];

    // Minimalist single-line UI for simple terminal tools (no box)
    if (simpleTerminalTools.includes(toolType)) {
      return (
        <div style={{ marginBottom: "12px" }}>
          {group.map((item, idx) => {
            const { action, index } = item;
            const actionId = `${messageId}-action-${index}`;
            const isActionClicked = clickedActions.has(actionId);
            const isActionSwept = clearedActions?.has(actionId);
            const outputData = toolOutputs?.[actionId];
            const hasOutput = !!outputData;
            const isLoading = isActionClicked && !hasOutput;
            const isCompleted = hasOutput;

            if (toolType === "list_terminals") {
              return (
                <RichtextBlock
                  key={index}
                  content={outputData?.output || "No terminals listed."}
                  title={getToolLabel(toolType)}
                  statusColor={toolColor}
                  defaultCollapsed={true}
                  headerActions={
                    <ExecuteButton
                      isActive={isActiveGroup || false}
                      isCompleted={isCompleted}
                      isLastMessage={isLastMessage}
                      isSkipped={
                        !isActiveGroup && !isLastMessage && !isActionClicked
                      }
                      isLoading={isLoading}
                      isSweepable={false}
                      isSwept={isActionSwept}
                      toolColor={toolColor}
                      title={
                        isCompleted
                          ? "Clear Context (Sweep)"
                          : isLoading
                            ? "Executing..."
                            : "Execute action"
                      }
                      onExecute={() => {
                        if (isCompleted) {
                          if (onActionClear && !isActionSwept) {
                            onActionClear(actionId);
                          }
                        } else if (!isLoading) {
                          onToolClick(action, messageId, index);
                        }
                      }}
                    />
                  }
                />
              );
            }

            return (
              <div
                key={index}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "6px 10px",
                  backgroundColor: `${toolColor}08`,
                  borderRadius: "4px",
                  marginBottom: idx === group.length - 1 ? "0" : "4px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                  }}
                >
                  {/* Dot */}
                  <div
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      backgroundColor: toolColor,
                      flexShrink: 0,
                    }}
                  />

                  {/* Label */}
                  <div
                    style={{
                      fontSize: "13px",
                      color: "var(--vscode-editor-foreground)",
                      fontWeight: 600,
                    }}
                  >
                    {getToolLabel(toolType)}
                  </div>

                  {/* ID for remove/stop */}
                  {(toolType === "remove_terminal" ||
                    toolType === "stop_terminal") && (
                    <div
                      style={{
                        fontSize: "11px",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        backgroundColor: "var(--vscode-badge-background)",
                        color: "var(--vscode-badge-foreground)",
                        opacity: 0.8,
                        fontFamily: "monospace",
                      }}
                    >
                      {action.params.terminal_id}
                    </div>
                  )}
                </div>

                <ExecuteButton
                  isActive={isActiveGroup || false}
                  isCompleted={isCompleted}
                  isLastMessage={isLastMessage}
                  isSkipped={
                    !isActiveGroup && !isLastMessage && !isActionClicked
                  }
                  isLoading={isLoading}
                  isSweepable={MANUAL_CONFIRMATION_TOOLS.includes(toolType)}
                  isSwept={isActionSwept}
                  toolColor={toolColor}
                  showText={MANUAL_CONFIRMATION_TOOLS.includes(toolType)}
                  labelText="Run"
                  title={
                    isCompleted
                      ? "Clear Context (Sweep)"
                      : isLoading
                        ? "Executing..."
                        : "Execute action"
                  }
                  onExecute={() => {
                    if (isCompleted) {
                      if (onActionClear && !isActionSwept) {
                        onActionClear(actionId);
                      }
                    } else if (!isLoading) {
                      onToolClick(action, messageId, index);
                    }
                  }}
                />
              </div>
            );
          })}
        </div>
      );
    }

    if (terminalToolsWithBlock.includes(toolType)) {
      const index = group[0].index; // run_command is always size 1 now
      const action = group[0].action;
      const isLast = true; // Always last in its group

      const actionId = `${messageId}-action-${index}`;
      const outputData = toolOutputs?.[actionId];

      // Determine state for this specific action
      const isActionClicked = clickedActions.has(actionId);
      const isActionSwept = clearedActions?.has(actionId);
      const hasOutput = !!outputData;

      // Loading state: Determine based on real terminal status if available
      const terminalId =
        (outputData as any)?.terminalId || action.params.terminal_id;
      const isTerminalBusy = terminalId
        ? terminalStatus?.[terminalId] === "busy"
        : false;

      const isLoading = isActionClicked && (!hasOutput || isTerminalBusy);

      // Completed if we have output AND terminal is no longer busy
      const isCompleted = hasOutput && !isTerminalBusy;

      console.log("[ToolItem] TerminalBlock state", {
        actionId,
        isActiveGroup,
        isActionClicked,
        isLastMessage,
        isLoading,
        isCompleted,
        hasOutput,
        isTerminalBusy,
      });

      // We need to determine if THIS action is active.
      // Since we split run_command into their own groups of 1,
      // isActiveGroup passed to ToolItem should be correct for this single item.
      // But just in case, we use the props.

      return (
        <TerminalBlock
          logs={outputData?.output || ""}
          initialCommand={action.params.command}
          terminalName="Execute"
          subInfo={action.params.cwd}
          status={isTerminalBusy ? "busy" : hasOutput ? "free" : undefined}
          statusColor={toolColor}
          onInput={(data) => {
            const terminalId =
              (outputData as any)?.terminalId || action.params.terminal_id;
            if (terminalId) {
              extensionService.postMessage({
                command: "terminalInput",
                terminalId,
                data,
              });
            }
          }}
          headerActions={
            <ExecuteButton
              isActive={isActiveGroup || false}
              isCompleted={isCompleted}
              isLastMessage={isLastMessage}
              isSkipped={!isActiveGroup && !isLastMessage && !isActionClicked}
              isLoading={isLoading}
              isSweepable={true}
              isSwept={isActionSwept}
              toolColor={toolColor}
              title={
                isCompleted
                  ? "Clear Context (Sweep)"
                  : isLoading
                    ? "Executing..."
                    : "Execute action"
              }
              onExecute={() => {
                if (isCompleted) {
                  if (onActionClear && !isActionSwept) {
                    onActionClear(actionId);
                  }
                } else if (!isLoading) {
                  const actionWithTerminal = {
                    ...action,
                    params: {
                      ...action.params,
                      terminal_id:
                        (outputData as any)?.terminalId ||
                        action.params.terminal_id,
                    },
                  };
                  onToolClick(actionWithTerminal, messageId, index);
                }
              }}
            />
          }
        />
      );
    }

    return (
      <div style={{ marginBottom: "8px" }}>
        {/* Container for grouped items (now includes header) */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            backgroundColor: "var(--vscode-editor-background)",
            border: `1px solid ${toolColor}40`,
            borderRadius: "6px",
            overflow: "hidden", // Ensure children respect border radius
          }}
        >
          {/* Header: Label + Execute Button */}
          {/* Header: Dot + Action + FilePath + Execute Button */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "8px 12px",
              borderBottom: `1px solid ${toolColor}15`,
              backgroundColor: `${toolColor}08`,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
              }}
            >
              {/* Dot */}
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  backgroundColor: toolColor,
                  flexShrink: 0,
                }}
              />

              {/* Status/Label */}
              <div
                style={{
                  fontSize: "13px",
                  color: "var(--vscode-editor-foreground)",
                  fontWeight: 600,
                  fontFamily: "var(--vscode-font-family)",
                }}
              >
                {getToolLabel(toolType)}
              </div>

              {/* File/Command in Header if single item */}
              {group.length === 1 && toolType !== "list_terminals" && (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    backgroundColor: "var(--vscode-badge-background)",
                    color: "var(--vscode-badge-foreground)",
                    fontSize: "11px",
                    opacity: 0.9,
                  }}
                >
                  <FileIcon
                    path={getFilename(firstAction)}
                    isFolder={firstAction.type === "list_files"}
                    style={{ width: "14px", height: "14px" }}
                  />
                  <span
                    style={{
                      maxWidth: "150px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={
                      firstAction.params.path || firstAction.params.command
                    }
                  >
                    {getFilename(firstAction)}
                  </span>
                </div>
              )}

              {/* Item Count if multiple */}
              {group.length > 1 && (
                <span
                  style={{
                    fontSize: "11px",
                    color: "var(--vscode-descriptionForeground)",
                    backgroundColor: "var(--vscode-badge-background)",
                    padding: "1px 6px",
                    borderRadius: "10px",
                    fontWeight: 500,
                  }}
                >
                  {group.length} items
                </span>
              )}
            </div>

            {/* Execute All Button */}
            <ExecuteButton
              isCompleted={group.every((item) =>
                clickedActions.has(`${messageId}-action-${item.index}`),
              )}
              isActive={isActiveGroup || false}
              isLastMessage={isLastMessage}
              isSkipped={
                !isActiveGroup &&
                !isLastMessage &&
                !group.every((item) =>
                  clickedActions.has(`${messageId}-action-${item.index}`),
                )
              }
              isSweepable={group.some((item) =>
                MANUAL_CONFIRMATION_TOOLS.includes(item.action.type),
              )}
              isSwept={group.every((item) =>
                clearedActions?.has(`${messageId}-action-${item.index}`),
              )}
              toolColor={toolColor}
              title={
                group.every((item) =>
                  clickedActions.has(`${messageId}-action-${item.index}`),
                )
                  ? "Clear Context (Sweep)"
                  : "Execute all actions"
              }
              onExecute={(e) => {
                const isCompleted = group.every((item) =>
                  clickedActions.has(`${messageId}-action-${item.index}`),
                );

                if (isCompleted) {
                  if (!onActionClear) return;
                  group.forEach((item) => {
                    const aId = `${messageId}-action-${item.index}`;
                    if (!clearedActions?.has(aId)) {
                      onActionClear(aId);
                    }
                  });
                  return;
                }

                const unclickedItems = group.filter(
                  ({ index }) =>
                    !clickedActions.has(`${messageId}-action-${index}`),
                );
                const actionsToExecute = unclickedItems.map(
                  ({ action, index }) => ({
                    ...action,
                    _index: index,
                  }),
                );

                if (actionsToExecute.length > 0) {
                  onToolClick(actionsToExecute as any, messageId, -1);
                }
              }}
            />
          </div>

          {/* List Items */}
          {group.map((item, idx) => {
            const { action, index } = item;
            const actionId = `${messageId}-action-${index}`;
            const isLast = idx === group.length - 1;

            const isNextToExecute =
              executionState && executionState.status !== "done"
                ? executionState.completed === index
                : !clickedActions.has(actionId);

            const showExecuteButton =
              executionState &&
              executionState.status !== "idle" &&
              executionState.status !== "done"
                ? executionState.completed === index
                : !clickedActions.has(actionId);

            // Diff Stats for replace_in_file
            let diffStats = null;
            if (action.type === "replace_in_file" && action.params.diff) {
              const diffText = action.params.diff;
              let added = 0;
              let removed = 0;

              // Check for SEARCH/REPLACE blocks
              const searchPattern =
                /<<<<<<< SEARCH\s+([\s\S]*?)=======\s+([\s\S]*?)(?:>>>>>>>|>)\s*REPLACE/g;
              const matches = [...diffText.matchAll(searchPattern)];

              if (matches.length > 0) {
                matches.forEach((match) => {
                  const searchBlock = match[1] || "";
                  const replaceBlock = match[2] || "";

                  // Helper to process blocks into lines
                  const getLines = (text: string) => {
                    // Normalize line endings and split
                    return text.replace(/\r\n/g, "\n").trimEnd().split("\n");
                  };

                  const searchLines = getLines(searchBlock);
                  const replaceLines = getLines(replaceBlock);

                  // If either is completely empty (after trim), handle edge case
                  if (searchLines.length === 1 && searchLines[0] === "") {
                    // Search block was empty -> insertion
                    added +=
                      replaceBlock.trim().length > 0 ? replaceLines.length : 0;
                    return;
                  }
                  if (replaceLines.length === 1 && replaceLines[0] === "") {
                    // Replace block empty -> deletion
                    removed +=
                      searchBlock.trim().length > 0 ? searchLines.length : 0;
                    return;
                  }

                  // 1. Prefix Match
                  let prefixCount = 0;
                  const minLen = Math.min(
                    searchLines.length,
                    replaceLines.length,
                  );
                  while (
                    prefixCount < minLen &&
                    searchLines[prefixCount] === replaceLines[prefixCount]
                  ) {
                    prefixCount++;
                  }

                  // 2. Suffix Match
                  let suffixCount = 0;
                  // We can't overlap with the prefix
                  const searchRemaining = searchLines.length - prefixCount;
                  const replaceRemaining = replaceLines.length - prefixCount;
                  const minRemaining = Math.min(
                    searchRemaining,
                    replaceRemaining,
                  );

                  while (
                    suffixCount < minRemaining &&
                    searchLines[searchLines.length - 1 - suffixCount] ===
                      replaceLines[replaceLines.length - 1 - suffixCount]
                  ) {
                    suffixCount++;
                  }

                  // 3. Calculate Stats
                  removed += searchLines.length - prefixCount - suffixCount;
                  added += replaceLines.length - prefixCount - suffixCount;
                });
              } else {
                // Fallback to unified diff
                const lines = diffText.split("\n");
                lines.forEach((line: string) => {
                  if (line.startsWith("+") && !line.startsWith("+++")) added++;
                  if (line.startsWith("-") && !line.startsWith("---"))
                    removed++;
                });
              }
              diffStats = { added, removed };
            }

            if (action.type === "run_command") {
              const actionId = `${messageId}-action-${index}`;
              const outputData = toolOutputs?.[actionId];
              const isActionClicked = clickedActions.has(actionId);
              const isActionSwept = clearedActions?.has(actionId);
              const hasOutput = !!outputData;
              const isLoading = isActionClicked && !hasOutput;

              // We need to determine if THIS action is active.
              // Since we split run_command into their own groups of 1,
              // isActiveGroup passed to ToolItem should be correct for this single item.
              // But just in case, we use the props.

              return (
                <div
                  key={index}
                  style={{
                    padding: "0", // Removed padding as requested
                    borderBottom: isLast ? "none" : `1px solid ${toolColor}20`,
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <CodeBlock
                    code={action.params.command}
                    language="shell"
                    filename="terminal"
                    icon={
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="100%"
                        height="100%"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="m7 11 2-2-2-2" />
                        <path d="M11 13h4" />
                        <rect
                          width="18"
                          height="18"
                          x="3"
                          y="3"
                          rx="2"
                          ry="2"
                        />
                      </svg>
                    }
                    showCopyButton={true}
                    headerActions={
                      <ExecuteButton
                        isActive={isActiveGroup || false}
                        isCompleted={isActionClicked}
                        isLastMessage={isLastMessage}
                        isSkipped={
                          !isActiveGroup && !isLastMessage && !isActionClicked
                        }
                        isLoading={isLoading}
                        isSweepable={MANUAL_CONFIRMATION_TOOLS.includes(
                          action.type,
                        )}
                        isSwept={isActionSwept}
                        toolColor={toolColor}
                        showText={MANUAL_CONFIRMATION_TOOLS.includes(
                          action.type,
                        )}
                        labelText="Run"
                        title={
                          isActionClicked
                            ? "Clear Context (Sweep)"
                            : "Execute action"
                        }
                        onExecute={() => {
                          if (isActionClicked) {
                            if (onActionClear && !isActionSwept) {
                              onActionClear(actionId);
                            }
                          } else if (!isLoading) {
                            onToolClick(action, messageId, index);
                          }
                        }}
                      />
                    }
                  />

                  {/* Output CodeBlock */}
                  {outputData && (
                    <div style={{ padding: "0" }}>
                      <CodeBlock
                        code={outputData.output}
                        language="text" // Or try to detect? text/shell usually fine for output
                        // filename="Output" // Optional
                        maxLines={10}
                        showCopyButton={true}
                      />
                    </div>
                  )}
                </div>
              );
            }

            return (
              <div
                key={index}
                style={{
                  padding: "6px 14px",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  borderBottom: isLast ? "none" : `1px solid ${toolColor}10`,
                  minHeight: "36px",
                }}
              >
                {/* Icon */}
                <FileIcon
                  path={getFilename(action)}
                  isFolder={action.type === "list_files"}
                  isOpen={true}
                  style={{ width: "16px", height: "16px" }}
                />

                {/* Filename/Command */}
                <span
                  style={{
                    fontSize: "13px",
                    fontFamily: "monospace",
                    color: "var(--vscode-editor-foreground)",
                    flex: 1,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={action.params.path || action.params.command}
                >
                  {getFilename(action)}
                </span>

                {/* [New] Line Count for read_file */}
                {action.type === "read_file" &&
                  fileStatsMap[action.params.path]?.lines > 0 && (
                    <span
                      style={{
                        fontSize: "11px",
                        color:
                          fileStatsMap[action.params.path].lines > 1000
                            ? "#4EC9B0" // Brighter color (cyan-ish) for > 1000 lines
                            : "var(--vscode-descriptionForeground)",
                        fontWeight:
                          fileStatsMap[action.params.path].lines > 1000
                            ? 600
                            : 400,
                        marginLeft: "4px",
                        opacity:
                          fileStatsMap[action.params.path].lines > 1000
                            ? 1
                            : 0.7,
                      }}
                    >
                      {fileStatsMap[action.params.path].lines} lines
                    </span>
                  )}

                {/* [New] Line Count for write_to_file */}
                {action.type === "write_to_file" && (
                  <span
                    style={{
                      fontSize: "11px",
                      color:
                        (action.params.content?.split("\n").length || 0) > 1000
                          ? "#4EC9B0"
                          : "var(--vscode-descriptionForeground)",
                      fontWeight:
                        (action.params.content?.split("\n").length || 0) > 1000
                          ? 600
                          : 400,
                      marginLeft: "4px",
                      opacity:
                        (action.params.content?.split("\n").length || 0) > 1000
                          ? 1
                          : 0.7,
                    }}
                  >
                    {action.params.content?.split("\n").length || 0} lines
                  </span>
                )}

                {/* Open File Button for read_file */}
                {action.type === "read_file" && (
                  <button
                    onClick={() => {
                      if ((window as any).vscodeApi) {
                        (window as any).vscodeApi.postMessage({
                          command: "openFile",
                          path: action.params.path,
                        });
                      }
                    }}
                    title="Open File"
                    style={{
                      background: "none",
                      border: "none",
                      cursor: "pointer",
                      padding: "2px",
                      display: "flex",
                      alignItems: "center",
                      color: "var(--vscode-icon-foreground)",
                      opacity: 0.7,
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.opacity = "0.7")
                    }
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  </button>
                )}

                {/* [New] Eye Icon/Preview for write_to_file */}
                {action.type === "write_to_file" && (
                  <>
                    <button
                      onClick={() =>
                        setIsPreviewing(
                          isPreviewing === actionId ? null : actionId,
                        )
                      }
                      title="Preview Modification"
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: "2px",
                        display: "flex",
                        alignItems: "center",
                        color: "var(--vscode-icon-foreground)",
                        opacity: 0.7,
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.opacity = "1")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.opacity = "0.7")
                      }
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                      </svg>
                    </button>
                    {/* Preview Content */}
                    {isPreviewing === actionId && (
                      <div
                        style={{
                          position: "absolute", // Or floating via portal, but absolute in relative container works for simple
                          top: "100%",
                          right: 0,
                          zIndex: 10,
                          width: "300px", // Or max-width
                          maxHeight: "300px",
                          overflow: "auto",
                          backgroundColor: "var(--vscode-editor-background)",
                          border: "1px solid var(--vscode-widget-border)",
                          boxShadow: "0 4px 6px rgba(0,0,0,0.1)",
                          borderRadius: "4px",
                          padding: "8px",
                          whiteSpace: "pre-wrap",
                          fontFamily: "monospace",
                          fontSize: "11px",
                        }}
                      >
                        {action.params.content}
                      </div>
                    )}
                  </>
                )}

                {/* Diff Stats & Preview for replace_in_file */}
                {action.type === "replace_in_file" && (
                  <>
                    {diffStats && (
                      <div
                        style={{
                          display: "flex",
                          gap: "8px",
                          fontSize: "12px",
                          fontFamily: "monospace",
                        }}
                      >
                        <span
                          style={{
                            color:
                              "var(--vscode-gitDecoration-addedResourceForeground)",
                          }}
                        >
                          +{diffStats.added}
                        </span>
                        <span
                          style={{
                            color:
                              "var(--vscode-gitDecoration-deletedResourceForeground)",
                          }}
                        >
                          -{diffStats.removed}
                        </span>
                      </div>
                    )}
                    {/* Fuzzy Status Display */}
                    {fuzzyStatus && (
                      <div
                        style={{
                          fontSize: "11px",
                          marginLeft: "8px",
                          color:
                            fuzzyStatus.status === "exact"
                              ? "var(--vscode-testing-iconPassed)"
                              : fuzzyStatus.status === "fuzzy"
                                ? "var(--vscode-list-warningForeground)"
                                : "var(--vscode-errorForeground)",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        {fuzzyStatus.status === "exact" && <span>✓ Exact</span>}
                        {fuzzyStatus.status === "fuzzy" && (
                          <span>
                            ⚠ Fuzzy (
                            {Math.round((1 - (fuzzyStatus.score || 0)) * 100)}%)
                          </span>
                        )}
                        {fuzzyStatus.status === "none" && (
                          <span>✗ No Match</span>
                        )}
                      </div>
                    )}
                    <button
                      onClick={(e) => handleDiffClick(e, action)}
                      title="Preview Diff"
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: "2px",
                        display: "flex",
                        alignItems: "center",
                        color: "var(--vscode-icon-foreground)",
                        opacity: 0.7,
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.opacity = "1")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.opacity = "0.7")
                      }
                    >
                      {/* File Diff Icon requested by user */}
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" />
                        <path d="M9 10h6" />
                        <path d="M12 13V7" />
                        <path d="M9 17h6" />
                      </svg>
                    </button>
                  </>
                )}

                {/* Output Display for read_file, list_files, search_files */}
                {(action.type === "read_file" ||
                  action.type === "list_files" ||
                  action.type === "search_files") &&
                  toolOutputs?.[actionId] && (
                    <div
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        right: 0,
                        padding: "0",
                        borderTop: `1px solid ${toolColor}20`,
                        zIndex: 5,
                        marginTop: "4px",
                      }}
                    >
                      <CodeBlock
                        code={toolOutputs[actionId].output}
                        language={action.type === "read_file" ? "text" : "text"} // Simple text for now, could infer language from path
                        filename="Output"
                        maxLines={15}
                        showCopyButton={true}
                      />
                    </div>
                  )}

                {/* Individual Execute Button (Request #2) */}
                {clickableTools.includes(action.type) &&
                  executionState &&
                  executionState.status === "running" &&
                  // For styled tools group, we only show button if it's the NEXT one to run
                  executionState.completed === index && (
                    <button
                      onClick={() => onToolClick(action, messageId, index)}
                      className="execute-btn"
                      title="Execute this action"
                      style={{
                        background: "var(--vscode-button-background)",
                        color: "var(--vscode-button-foreground)",
                        border: "none",
                        cursor: "pointer",
                        padding: "2px 6px",
                        borderRadius: "3px",
                        fontSize: "11px",
                        display: "flex",
                        alignItems: "center",
                        marginLeft: "auto", // Push to right
                        fontWeight: 600,
                      }}
                    >
                      Run
                    </button>
                  )}

                {/* Status Indicators */}
                {clickedActions.has(actionId) &&
                  !failedActions?.has(actionId) && (
                    <div
                      style={{
                        marginLeft: "auto",
                        color: "var(--vscode-testing-iconPassed)",
                      }}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                  )}

                {/* 🆕 Failed Indicator */}
                {!clickedActions.has(actionId) &&
                  failedActions?.has(actionId) && (
                    <div
                      style={{
                        marginLeft: "auto",
                        color: "var(--vscode-errorForeground)", // Red color
                      }}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                    </div>
                  )}

                {/* Running Indicator with Controls */}
                {executionState &&
                  executionState.status === "running" &&
                  executionState.completed === index && (
                    <div
                      style={{
                        marginLeft: "auto",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "11px",
                          color: "var(--vscode-descriptionForeground)",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <span className="codicon codicon-loading codicon-modifier-spin" />
                        Running...
                      </span>

                      {/* Detach Button */}
                      <button
                        onClick={() => {
                          const vscodeApi = (window as any).vscodeApi;
                          if (vscodeApi) {
                            vscodeApi.postMessage({
                              command: "stopCommand",
                              actionId: `${messageId}-action-${index}`,
                              kill: false,
                            });
                          }
                        }}
                        title="Detach (Keep running in background)"
                        style={{
                          background:
                            "var(--vscode-button-secondaryBackground)",
                          color: "var(--vscode-button-secondaryForeground)",
                          border: "none",
                          cursor: "pointer",
                          padding: "2px 6px",
                          borderRadius: "3px",
                          fontSize: "10px",
                        }}
                      >
                        Detach
                      </button>

                      {/* Stop/Kill Button */}
                      <button
                        onClick={() => {
                          const vscodeApi = (window as any).vscodeApi;
                          if (vscodeApi) {
                            vscodeApi.postMessage({
                              command: "stopCommand",
                              actionId: `${messageId}-action-${index}`,
                              kill: true,
                            });
                          }
                        }}
                        title="Stop execution"
                        style={{
                          background:
                            "var(--vscode-button-dangerBackground, #d73a49)", // Fallback red
                          color: "var(--vscode-button-foreground)", // usually white on danger
                          border: "none",
                          cursor: "pointer",
                          padding: "2px 6px",
                          borderRadius: "3px",
                          fontSize: "10px",
                        }}
                      >
                        Stop
                      </button>
                    </div>
                  )}

                {/* Pending Indicator (if running but not this one) */}
                {executionState &&
                  executionState.status === "running" &&
                  executionState.completed < index && (
                    <div
                      style={{
                        marginLeft: "auto",
                        color: "var(--vscode-descriptionForeground)",
                        fontSize: "11px",
                        opacity: 0.7,
                      }}
                    >
                      Waiting...
                    </div>
                  )}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  // Fallback for non-styled tools (e.g. attempt_completion), treating them individually
  // Note: Grouping usually only applied to same-type. If attempt_completion logic needs grouping, we can add it.
  // Currently, we just map them individually if they fall here.
  return (
    <>
      {group.map((item, idx) => {
        const { action, index } = item;
        // ... Original rendering for non-styled ...
        return (
          <div key={index} style={{ marginBottom: "8px" }}>
            {action.type === "attempt_completion" ? (
              <div
                style={{
                  padding: "8px 0",
                  fontSize: "13px",
                  color: "var(--vscode-descriptionForeground)",
                }}
              >
                {formatActionForDisplay(action)}
              </div>
            ) : (
              <div
                style={{
                  padding: "var(--spacing-sm) var(--spacing-md)",
                  backgroundColor: "var(--secondary-bg)",
                  border: `2px solid ${toolColor}`,
                  borderRadius: "var(--border-radius-lg)",
                  cursor: clickableTools.includes(action.type)
                    ? "pointer"
                    : "default",
                  transition: "all 0.2s",
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--spacing-sm)",
                  width: "fit-content",
                }}
                onClick={() => {
                  if (clickableTools.includes(action.type)) {
                    onToolClick(action, messageId, index);
                  }
                }}
              >
                <span
                  style={{
                    fontSize: "var(--font-size-sm)",
                    color: "var(--primary-text)",
                    fontWeight: 600,
                    flex: 1,
                  }}
                >
                  {formatActionForDisplay(action)}
                </span>
                {clickableTools.includes(action.type) && (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke={toolColor}
                    strokeWidth="2"
                  >
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                )}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
};

export default ToolItem;
