import React, { useState, useEffect } from "react";
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
import { ToolHeader } from "../../../../ToolHeader";
import { getFileIconPath } from "../../../../../utils/fileIconMapper";
import { RichtextBlock } from "../../../../RichtextBlock";
import { parseDiff } from "../../../../../utils/diffUtils";
import { CLICKABLE_TOOLS, MANUAL_CONFIRMATION_TOOLS } from "../../constants";
import { extensionService } from "../../../../../services/ExtensionService";
import { Message } from "../../types";
import { useProject } from "../../../../../context/ProjectContext";

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
  isLastItemInList?: boolean;
  toolOutputs?: Record<
    string,
    { output: string; isError: boolean; terminalId?: string }
  >;
  terminalStatus?: Record<string, "busy" | "free">;
  nextUserMessage?: Message;
  allMessages?: Message[];
  activeTerminalIds?: Set<string>;
  attachedTerminalIds?: Set<string>;
  conversationId?: string;
}

const ExecuteButton: React.FC<{
  isCompleted: boolean;
  isActive: boolean;
  isFailed?: boolean;
  isLastMessage?: boolean;
  onExecute: (e: React.MouseEvent) => void;
  toolColor: string;
  title: string;
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
  isSkipped,
  isLoading,
  showText,
  labelText,
}) => {
  const iconColor = isCompleted
    ? "#3fb950"
    : isFailed
      ? "var(--vscode-errorForeground)"
      : toolColor;
  const isClickable = !isLoading && (!isCompleted || isFailed || isActive);

  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        if (isClickable) onExecute(e);
      }}
      disabled={isLoading || (isCompleted && !isFailed && !isActive)}
      style={{
        background: isCompleted ? "transparent" : `${toolColor}20`,
        color: iconColor,
        border: `1px solid ${isCompleted ? "transparent" : `${toolColor}40`}`,
        cursor: isLoading ? "wait" : isClickable ? "pointer" : "default",
        padding: "4px 8px",
        borderRadius: "6px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        opacity: isSkipped ? 0.5 : 1,
        fontSize: "12px",
        gap: "6px",
        fontWeight: 600,
        height: "24px",
      }}
      className="execute-button-premium"
      title={title}
    >
      {isLoading ? (
        <div
          className="codicon codicon-loading codicon-modifier-spin"
          style={{ fontSize: "14px" }}
        />
      ) : isCompleted ? (
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
      ) : (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="currentColor"
        >
          <path d="M8 5v14l11-7z" />
        </svg>
      )}

      {(showText || labelText || (!isCompleted && !isLoading)) && (
        <span
          style={{
            fontSize: "11px",
            textTransform: "uppercase",
            letterSpacing: "0.5px",
          }}
        >
          {labelText || (isCompleted ? "Done" : "Run")}
        </span>
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
  toolOutputs,
  terminalStatus,
  nextUserMessage,
  allMessages,
  activeTerminalIds,
  attachedTerminalIds,
  conversationId,
  isLastItemInList = true,
}) => {
  // Local state for fuzzy match validation (for replace_in_file)
  const [fuzzyStatus, setFuzzyStatus] = React.useState<{
    status: string;
    score?: number;
    startLine?: number;
  } | null>(null);
  const { rootPath } = useProject();

  // Local state for file stats (line count)
  const [fileStatsMap, setFileStatsMap] = React.useState<
    Record<string, { lines: number; loading: boolean }>
  >({});

  // Track write_to_file preview
  const [isPreviewing, setIsPreviewing] = React.useState<string | null>(null);

  // Local state for ANSI terminal output from history
  const [storedOutput, setStoredOutput] = useState<string | null>(null);

  // Track validated/auto-run actions to prevent re-requests on prop changes
  const processedActions = React.useRef<Set<string>>(new Set());

  // Track collapsed state for each action
  const [collapsedActions, setCollapsedActions] = useState<Set<string>>(
    new Set(),
  );

  const toggleCollapse = (actionId: string) => {
    setCollapsedActions((prev) => {
      const next = new Set(prev);
      if (next.has(actionId)) {
        next.delete(actionId);
      } else {
        next.add(actionId);
      }
      return next;
    });
  };

  useEffect(() => {
    // Default to collapsed for certain tools (edits, creations)
    // Expand terminal-related tools by default
    const initialCollapsed = new Set<string>();
    group.forEach((item, index) => {
      const actionId = `${messageId}-action-${index}`;
      const type = item.action.type;

      // Expand run_command by default
      if (type === "run_command") {
        // Keep expanded
      } else {
        initialCollapsed.add(actionId);
      }
    });
    setCollapsedActions(initialCollapsed);
  }, [group, messageId]);

  const truncatePath = (path?: string): string => {
    if (!path) return "";
    const segments = path.split(/[/\\]/);
    if (segments.length <= 3) return path;
    const first = segments[0];
    const lastTwo = segments.slice(-2).join("/");
    return `${first}/../${lastTwo}`;
  };

  // Use effective actionId for identifying terminal output
  const runCommandAction = group.find((g) => g.action.type === "run_command");

  useEffect(() => {
    if (!nextUserMessage?.content || !runCommandAction) return;

    // Detect terminal output UUID in history
    const commandText = runCommandAction.action.params.command;
    if (!commandText) return;

    const escapeRegExp = (str: string) =>
      str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(
      `Output: \\[run_command for '${escapeRegExp(
        commandText,
      )}'.*?\\] .*?with "terminal_output-([a-f0-9-]+)"`,
    );
    const match = regex.exec(nextUserMessage.content);

    if (match && match[1]) {
      const outputUuid = match[1];
      const requestId = `read-terminal-${outputUuid}`;
      const chatUuidToUse =
        conversationId || nextUserMessage.conversationId || "";

      // Skip if already requested or already has output
      if (processedActions.current.has(requestId) || storedOutput) return;

      const handleMessage = (event: MessageEvent) => {
        const msg = event.data;
        if (
          msg.command === "readTerminalOutputResult" &&
          msg.outputUuid === outputUuid
        ) {
          if (msg.content) {
            setStoredOutput(msg.content);
          }
          window.removeEventListener("message", handleMessage);
        }
      };

      window.addEventListener("message", handleMessage);
      processedActions.current.add(requestId);
      extensionService.postMessage({
        command: "readTerminalOutput",
        chatUuid: chatUuidToUse,
        outputUuid,
        requestId,
      });

      return () => window.removeEventListener("message", handleMessage);
    }
  }, [nextUserMessage, runCommandAction, messageId, storedOutput]);

  React.useEffect(() => {
    // Only run for replace_in_file actions
    // Track cleanup functions
    const cleanups: (() => void)[] = [];

    group.forEach((item) => {
      const { action, index } = item;
      const actionId = `${messageId}-action-${index}`;

      // [Auto-run logic REMOVED - handled by useChatLLM]

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

      // [New] Fetch file stats for read_file and write_to_file
      if (
        (action.type === "read_file" || action.type === "write_to_file") &&
        action.params.path
      ) {
        const path = action.params.path;
        if (!fileStatsMap[path]) {
          // We can't set state inside render loop safely if it triggers re-render,
          // but this is inside useEffect so it's fine.
          // However, setting state here might trigger re-render -> re-effect -> loop if dependencies change.
          // But `group` shouldn't change just because `fileStatsMap` changed.
          // Unless parent recreates group.

          // We'll leave fileStats logic mostly as is but fix the cleanup.

          const statId = `${messageId}-${index}-stats`;
          if (processedActions.current.has(statId)) return;
          processedActions.current.add(statId);

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
  }, [
    group,
    messageId,
    isActiveGroup,
    clickedActions,
    onToolClick,
    fileStatsMap,
  ]); // Keeping dependencies simple

  if (!group || group.length === 0) return null;

  const firstAction = group[0].action;
  const toolType = firstAction.type;

  const clickableTools = CLICKABLE_TOOLS;

  const toolColor = getToolColor(toolType);
  const isStyledTool =
    toolType === "replace_in_file" ||
    toolType === "write_to_file" ||
    toolType === "list_files" ||
    toolType === "run_command" ||
    toolType === "search_files" ||
    toolType === "read_workspace_context" ||
    toolType === "update_workspace_context" ||
    toolType === "read_file" ||
    toolType === "get_symbol_definition" ||
    toolType === "get_references" ||
    toolType === "ask_bypass_gitignore" ||
    toolType === "get_file_outline";
  if (isStyledTool) {
    // 🆕 Minimalist UI for single replace_in_file/write_to_file
    if (
      group.length === 1 &&
      (toolType === "replace_in_file" ||
        toolType === "write_to_file" ||
        toolType === "read_file" ||
        toolType === "list_files" ||
        toolType === "search_files" ||
        toolType === "read_workspace_context" ||
        toolType === "update_workspace_context" ||
        toolType === "get_symbol_definition" ||
        toolType === "get_references" ||
        toolType === "ask_bypass_gitignore" ||
        toolType === "get_file_outline")
    ) {
      const item = group[0];
      const { action, index } = item;
      const actionId = `${messageId}-action-${index}`;
      const isActionClicked = clickedActions.has(actionId);
      const isCollapsed = collapsedActions.has(actionId);

      // Calculate code content and highlights
      let codeContent = "";
      let lineHighlights: {
        startLine: number;
        endLine: number;
        type: "added" | "removed";
      }[] = [];
      const fileExt = getFilename(action).split(".").pop() || "txt";

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

      let codeLanguage =
        toolType === "replace_in_file" ||
        toolType === "update_workspace_context"
          ? extensionToLanguage[fileExt.toLowerCase()] || fileExt
          : "typescript";

      const rawPath =
        toolType === "read_workspace_context" ||
        toolType === "update_workspace_context"
          ? "workspace.md"
          : toolType === "get_symbol_definition" ||
              toolType === "get_references"
            ? action.params.symbol
            : action.params.file_path ||
              action.params.folder_path ||
              action.params.path ||
              getFilename(action);

      if (
        (action.type === "replace_in_file" ||
          action.type === "update_workspace_context") &&
        action.params.diff
      ) {
        const result = parseDiff(action.params.diff);
        codeContent = result.code;
        lineHighlights = result.lineHighlights;
      } else if (toolType === "write_to_file") {
        codeContent = action.params.content || "";
      } else if (
        toolType === "list_files" ||
        toolType === "search_files" ||
        toolType === "read_workspace_context" ||
        toolType === "read_file" ||
        toolType === "get_symbol_definition" ||
        toolType === "get_references" ||
        toolType === "get_file_outline"
      ) {
        codeContent = toolOutputs?.[actionId]?.output || "";

        // Fallback for historical output
        if (!codeContent) {
          // 1. Search by actionId (find specific message reporting this action)
          const resultMessage = allMessages?.find((m) =>
            m.actionIds?.includes(actionId),
          );

          // 2. Identify potential output messages (skip empty/whitespace-only ones)
          const currentMsgIndex = allMessages
            ? allMessages.findIndex((m) => m.id === messageId)
            : -1;
          const nextNonEmptyUser = allMessages
            ? allMessages
                .slice(currentMsgIndex + 1)
                .find(
                  (m) =>
                    m.role === "user" &&
                    m.content &&
                    m.content.trim().length > 0,
                )
            : undefined;

          // Search by pattern across ALL non-empty messages
          const escapedPathForPattern = rawPath.replace(
            /[.*+?^${}()|[\]\\]/g,
            "\\$&",
          );
          const pattern = new RegExp(
            `\\[${toolType}\\s+for\\s+['"]?${escapedPathForPattern}['"]?\\s*\\]`,
            "i",
          );
          const patternMatch = allMessages
            ? allMessages.find(
                (m) =>
                  m.content &&
                  m.content.trim().length > 0 &&
                  pattern.test(m.content),
              )
            : undefined;

          let outputMessage = resultMessage || patternMatch || nextNonEmptyUser;

          if (outputMessage?.content) {
            const escapeRegExp = (str: string) =>
              str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const escapedPathRegex = escapeRegExp(rawPath);

            // Flexible regex: handle spaces, quotes, and optional language identifiers (e.g. ```text)
            const regexStr = `\\[${toolType}\\s+for\\s+['"]?${escapedPathRegex}['"]?\\s*\\]\\s*Result:?\\s*[\\r\\n]+\\s*\`\`\`[\\w]*[\\r\\n]+([\\s\\S]*?)[\\r\\n]+\\s*\`\`\``;
            const match = new RegExp(regexStr).exec(outputMessage.content);

            if (match && match[1]) {
              codeContent = match[1];
            } else {
              if (resultMessage && !outputMessage.content.includes("Result:")) {
                // If we found the message by ID but it doesn't have multiple blocks/formatting
                codeContent = outputMessage.content
                  .replace(/^```[\w]*\n/, "")
                  .replace(/\n```$/, "");
              }
            }
          }
        }

        codeLanguage = "text";
      }

      const isBypassTool = toolType === "ask_bypass_gitignore";

      // Calculate stats
      let diffStats = null;
      if (
        (action.type === "replace_in_file" ||
          action.type === "update_workspace_context") &&
        action.params.diff
      ) {
        const result = parseDiff(action.params.diff);
        diffStats = result.stats;
      }

      const linesCount =
        action.type === "write_to_file"
          ? action.params.content?.split("\n").length || 0
          : 0;

      const prefix =
        toolType === "replace_in_file" ||
        toolType === "update_workspace_context"
          ? "UPDATE"
          : toolType === "write_to_file"
            ? fileStatsMap[rawPath]
              ? "REWRITE"
              : "CREATE"
            : toolType === "list_files"
              ? "LIST"
              : toolType === "search_files"
                ? "SEARCH"
                : toolType === "read_workspace_context"
                  ? "READ WORKSPACE CONTEXT"
                  : toolType === "get_symbol_definition"
                    ? "FIND DEFINITION"
                    : toolType === "get_references"
                      ? "FIND REFERENCES"
                      : toolType === "get_file_outline"
                        ? "GET OUTLINE"
                        : toolType === "ask_bypass_gitignore"
                          ? "BYPASS"
                          : "READ";
      const isCompleted =
        isActionClicked || (codeContent && codeContent.trim().length > 0);

      const displayPath = truncatePath(rawPath);

      return (
        <div
          className="timeline-item"
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "0px",
            paddingLeft: "29px",
            paddingBottom: isLastItemInList
              ? isLastMessage
                ? "0px"
                : "24px"
              : "8px",
          }}
        >
          <ToolHeader
            title={
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "12px",
                  color: "var(--vscode-editor-foreground)",
                }}
              >
                <span style={{ fontWeight: 600, opacity: 0.8 }}>{prefix}</span>
                <FileIcon
                  path={rawPath}
                  isFolder={
                    toolType === "list_files" ||
                    !!action.params.folder_path ||
                    (toolType === "ask_bypass_gitignore" &&
                      (rawPath.endsWith("/") ||
                        !rawPath.split("/").pop()?.includes(".")))
                  }
                  style={{ width: "16px", height: "16px" }}
                />
                <span
                  style={{
                    fontWeight: 500,
                    opacity: 0.9,
                    fontFamily: "var(--vscode-editor-font-family, monospace)",
                    fontSize: "11px",
                    backgroundColor: "var(--vscode-badge-background)",
                    color: "var(--vscode-badge-foreground)",
                    padding: "1px 6px",
                    borderRadius: "4px",
                  }}
                >
                  {displayPath}
                </span>
                {diffStats && (
                  <span
                    style={{
                      display: "flex",
                      gap: "4px",
                      opacity: 0.7,
                      fontSize: "11px",
                      marginLeft: "4px",
                      fontWeight: 500,
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
                  </span>
                )}
                {linesCount > 0 && action.type === "write_to_file" && (
                  <span
                    style={{
                      opacity: 0.7,
                      fontSize: "11px",
                      marginLeft: "4px",
                      fontWeight: 500,
                    }}
                  >
                    +{linesCount} lines
                  </span>
                )}
              </div>
            }
            statusColor={isCompleted ? "#3fb950" : toolColor}
            diffStats={undefined}
            onClick={() => {
              extensionService.postMessage({
                command: "openFile",
                path: rawPath,
              });
            }}
          />
          {isBypassTool && !isCompleted && (
            <div style={{ marginTop: "8px", marginBottom: "8px" }}>
              <ExecuteButton
                isActive={!!isActiveGroup || (!!isLastMessage && !isCompleted)}
                isCompleted={!!isCompleted}
                isLastMessage={!!isLastMessage}
                isLoading={
                  !!processedActions.current.has(actionId) && !isCompleted
                }
                toolColor={toolColor}
                title="Approve bypass"
                labelText="Approve"
                onExecute={() => onToolClick(action, messageId, index)}
              />
            </div>
          )}
          {(toolType === "replace_in_file" ||
            toolType === "update_workspace_context" ||
            toolType === "write_to_file" ||
            ((toolType === "list_files" ||
              toolType === "search_files" ||
              toolType === "get_symbol_definition" ||
              toolType === "get_references" ||
              toolType === "get_file_outline") &&
              codeContent)) && (
            <>
              {toolType === "list_files" ||
              toolType === "search_files" ||
              toolType === "get_symbol_definition" ||
              toolType === "get_references" ||
              toolType === "get_file_outline" ? (
                <RichtextBlock
                  content={codeContent}
                  showHeader={false}
                  maxHeight={300}
                  defaultCollapsed={false}
                  isFilePathList={toolType === "list_files"}
                />
              ) : (
                <CodeBlock
                  code={codeContent}
                  language={codeLanguage}
                  maxLines={25}
                  isCollapsed={false}
                  showLineNumbers={true}
                  lineHighlights={lineHighlights}
                />
              )}
            </>
          )}
        </div>
      );
    }

    const terminalToolsWithBlock = ["run_command"];

    if (terminalToolsWithBlock.includes(toolType)) {
      const index = group[0].index; // run_command is always size 1 now
      const action = group[0].action;
      const actionId = `${messageId}-action-${index}`;
      const outputData = toolOutputs?.[actionId];
      const isCollapsed = collapsedActions.has(actionId);

      let extractedOutput: string | undefined = undefined;
      // If we don't have live output, check the next user message (historical data)
      if (!outputData?.output && nextUserMessage?.content) {
        const commandText = action.params.command;
        if (commandText) {
          const escapeRegExp = (str: string) =>
            str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
          const regexStr = `Output: \\[run_command for '${escapeRegExp(commandText)}'.*?\\][^\\n]*\\n\\s*\`\`\`\\n([\\s\\S]*?)\\n\\s*\`\`\``;
          const match = new RegExp(regexStr).exec(nextUserMessage.content);
          if (match && match[1]) {
            extractedOutput = match[1];
          }
        }
      }

      // Determine state for this specific action
      const isActionClicked = clickedActions.has(actionId);
      const hasOutput = !!outputData || !!extractedOutput;

      // Loading state: Determine based on real terminal status if available
      const terminalId =
        (outputData as any)?.terminalId || action.params.terminal_id;
      // If we just clicked but don't have a status yet, assume it's busy
      const isTerminalBusy = terminalId
        ? terminalStatus?.[terminalId] === "busy" ||
          (isActionClicked && terminalStatus?.[terminalId] === undefined)
        : isActionClicked;

      const isLoading = isActionClicked && (!hasOutput || isTerminalBusy);

      // Completed if we have output AND terminal is no longer busy
      const isCompleted = hasOutput && !isTerminalBusy;

      return (
        <div
          className="timeline-item"
          style={{ marginTop: "4px", paddingLeft: "29px" }}
        >
          {/* Dot to align with timeline axis */}
          <div
            className="timeline-dot"
            style={{
              backgroundColor:
                isTerminalBusy || (isActionClicked && !outputData)
                  ? "#e3b341" // Yellow if busy OR just started (waiting for output/busy status)
                  : isCompleted
                    ? "#3fb950"
                    : toolColor,
              top: "10px",
            }}
          />
          {/* Execute header row - inline, no complex ToolHeader */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "4px 0 6px 0",
            }}
          >
            {/* Left: label */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 700,
                  color: "var(--vscode-editor-foreground)",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                  opacity: 0.8,
                }}
              >
                EXECUTE
              </span>
              {(action.params.cwd || rootPath) && (
                <span
                  style={{
                    fontSize: "11px",
                    color: "var(--vscode-descriptionForeground)",
                    opacity: 0.6,
                    fontFamily: "var(--vscode-editor-font-family, monospace)",
                    backgroundColor: "var(--vscode-editor-background)",
                    padding: "1px 6px",
                    borderRadius: "4px",
                    border: "1px solid var(--vscode-widget-border)",
                  }}
                >
                  {truncatePath(action.params.cwd || rootPath)}
                </span>
              )}
            </div>

            {/* Right: action buttons */}
            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
              {!isTerminalBusy && (
                <ExecuteButton
                  isActive={isActiveGroup || false}
                  isCompleted={isCompleted}
                  isLastMessage={isLastMessage}
                  isSkipped={
                    !isActiveGroup && !isLastMessage && !isActionClicked
                  }
                  isLoading={isLoading}
                  toolColor={toolColor}
                  title={
                    isCompleted
                      ? "Completed"
                      : isLoading
                        ? "Executing..."
                        : "Execute action"
                  }
                  onExecute={() => {
                    if (!isCompleted && !isLoading) {
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
              )}
              {isTerminalBusy && (
                <button
                  className="stop-terminal-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    extensionService.postMessage({
                      command: "stopCommand",
                      actionId: actionId,
                      terminalId: terminalId,
                    });
                    if (terminalId) {
                      extensionService.postMessage({
                        command: "stopTerminal",
                        terminalId: terminalId,
                      });
                    }
                  }}
                  title="Finalize output, kill process and delete terminal"
                  style={{
                    background: "rgba(244, 67, 54, 0.1)",
                    border: "1px solid rgba(244, 67, 54, 0.3)",
                    cursor: "pointer",
                    color: "rgb(244, 67, 54)",
                    padding: "4px 8px",
                    borderRadius: "6px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "11px",
                    fontWeight: 600,
                    gap: "6px",
                    height: "24px",
                    textTransform: "uppercase",
                  }}
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <rect x="6" y="6" width="12" height="12" />
                  </svg>
                  FINALIZE
                </button>
              )}
            </div>
          </div>

          {/* Terminal block directly below, no gap */}
          <TerminalBlock
            logs={outputData?.output || extractedOutput || ""}
            initialCommand={action.params.command}
            cwd={action.params.cwd || rootPath}
            status={isTerminalBusy ? "busy" : hasOutput ? "free" : undefined}
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
          />
        </div>
      );
    }

    return (
      <div style={{ marginBottom: "0px" }}>
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
          {/* Header: Dot + Action + FilePath + Execute Button */}
          <ToolHeader
            title="Steps"
            subTitle={`${group.length} action${group.length > 1 ? "s" : ""}`}
            statusColor={toolColor}
            isCollapsed={false} // Group header itself not collapsed here, items are
            icon={
              <div
                className="codicon codicon-layers"
                style={{ fontSize: "14px", marginRight: "4px" }}
              />
            }
            headerActions={
              <ExecuteButton
                isActive={isActiveGroup || false}
                isCompleted={group.every((item) =>
                  clickedActions.has(`${messageId}-action-${item.index}`),
                )}
                isLastMessage={isLastMessage}
                isSkipped={
                  !isActiveGroup &&
                  !isLastMessage &&
                  !group.every((item) =>
                    clickedActions.has(`${messageId}-action-${item.index}`),
                  )
                }
                toolColor={toolColor}
                title={
                  group.every((item) =>
                    clickedActions.has(`${messageId}-action-${item.index}`),
                  )
                    ? "Completed"
                    : "Execute all actions"
                }
                onExecute={(e) => {
                  const isCompleted = group.every((item) =>
                    clickedActions.has(`${messageId}-action-${item.index}`),
                  );

                  if (isCompleted) {
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
            }
          />

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
              const isCollapsed = collapsedActions.has(actionId);
              const hasOutput = !!outputData;

              // Loading state: Determine based on real terminal status if available
              const terminalId =
                (outputData as any)?.terminalId || action.params.terminal_id;
              const isTerminalBusy = terminalId
                ? terminalStatus?.[terminalId] === "busy"
                : false;

              const isLoading =
                isActionClicked && (!hasOutput || isTerminalBusy);
              const isCompleted = hasOutput && !isTerminalBusy;

              return (
                <div
                  key={index}
                  style={{
                    padding: "0",
                    borderBottom: isLast ? "none" : `1px solid ${toolColor}20`,
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <ToolHeader
                    title="RUN"
                    subTitle={truncatePath(action.params.cwd || rootPath)}
                    statusColor={isCompleted ? "#3fb950" : toolColor}
                    isCollapsed={isCollapsed}
                    onToggleCollapse={() => toggleCollapse(actionId)}
                    icon={
                      <div
                        className="codicon codicon-terminal"
                        style={{ fontSize: "14px", marginRight: "4px" }}
                      />
                    }
                    headerActions={
                      <ExecuteButton
                        isActive={isActiveGroup || false}
                        isCompleted={isCompleted}
                        isLastMessage={isLastMessage}
                        isSkipped={
                          !isActiveGroup && !isLastMessage && !isActionClicked
                        }
                        isLoading={isLoading}
                        toolColor={toolColor}
                        title={
                          isCompleted
                            ? "Completed"
                            : isLoading
                              ? "Executing..."
                              : "Execute action"
                        }
                        onExecute={() => {
                          if (!isCompleted && !isLoading) {
                            onToolClick(action, messageId, index);
                          }
                        }}
                      />
                    }
                  />
                  {!isCollapsed && (
                    <div style={{ paddingLeft: "10px" }}>
                      <CodeBlock
                        code={action.params.command}
                        language="shell"
                        filename="command"
                        maxLines={5}
                        isCollapsed={false}
                      />
                      {outputData && (
                        <CodeBlock
                          code={outputData.output}
                          language="text"
                          filename="output"
                          maxLines={10}
                          isCollapsed={false}
                        />
                      )}
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
                        isCollapsed={false}
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
          </div>
        );
      })}
    </>
  );
};

export default ToolItem;
