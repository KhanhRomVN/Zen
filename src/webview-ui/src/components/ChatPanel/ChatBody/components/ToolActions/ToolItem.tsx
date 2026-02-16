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
  toolOutputs?: Record<string, { output: string; isError: boolean }>;
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
}) => {
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onExecute(e);
      }}
      // Logic for disabled state:
      // Enabled if Active (Play) OR Sweepable (Completed).
      // Disabled if !Active AND !Completed.
      // Also disabled if Loading.
      // Also disabled if Loading.
      disabled={
        isLoading ||
        (!isActive && !isCompleted) ||
        (isCompleted && !isLastMessage)
      }
      style={{
        background: "transparent",
        border: "none",
        cursor: isLoading ? "wait" : "pointer",
        padding: "2px",
        borderRadius: "4px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        transition: "all 0.2s",
        opacity: 1,
        color: "var(--vscode-icon-foreground)", // Ensure consistent base color
      }}
      title={title}
      onMouseEnter={(e) => {
        const svg = e.currentTarget.querySelector("svg");
        if (svg && !isLoading && !isCompleted) svg.style.stroke = toolColor;
        // For completed state, we might want to keep the success color or specific color
      }}
      onMouseLeave={(e) => {
        const svg = e.currentTarget.querySelector("svg");
        // Reset to currentColor/inherit
        if (svg) svg.style.stroke = "currentColor";
      }}
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
          {isLastMessage && (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor" // Use current color (controlled by div above)
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

      {/* ACTIVE STATE: PLAY ICON (Only if not loading and not completed) */}
      {!isLoading && isActive && !isCompleted && (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor" // Allow hover to change it
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polygon points="5 3 19 12 5 21 5 3" />
        </svg>
      )}

      {/* SKIPPED STATE: RED X (Only if not loading) */}
      {!isLoading && isSkipped && (
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--vscode-errorForeground)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
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

  // Local state for write_to_file preview
  const [isPreviewing, setIsPreviewing] = React.useState<string | null>(null);

  // Track validated actions to prevent re-requests on prop changes
  const validatedActions = React.useRef<Set<string>>(new Set());

  React.useEffect(() => {
    // Only run for replace_in_file actions
    // Track cleanup functions
    const cleanups: (() => void)[] = [];

    group.forEach((item) => {
      const { action, index } = item;
      if (action.type === "replace_in_file" && action.params.diff) {
        const validationId = `${messageId}-${index}-validate`;

        // Gate: Skip if already validated
        if (validatedActions.current.has(validationId)) {
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

            // Debug: Log fuzzyStatus
            console.log("🔍 FuzzyStatus set:", {
              status: message.status,
              startLine: message.startLine,
              validationId,
            });

            // Log details as requested (Fuzzy Logic in Webview)
            if (message.status === "fuzzy" && message.foundBlock) {
              const accuracy = (1 - message.score) * 100;
              const searchLines = message.searchBlock
                ? message.searchBlock.split(/\r?\n/).length
                : 0;
              const foundLines = message.foundBlock.split(/\r?\n/).length;

              console.group("🔍 Fuzzy Search Debug (Webview)");
              console.groupEnd();
            }

            // Remove this listener immediately after success
            window.removeEventListener("message", handleMessage);
          }
        };

        window.addEventListener("message", handleMessage);
        cleanups.push(() =>
          window.removeEventListener("message", handleMessage),
        );

        // Mark as validated to prevent re-sending
        validatedActions.current.add(validationId);

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

  const clickableTools = [
    "write_to_file",
    "replace_in_file",
    "list_files",
    "search_files",
    "execute_command",
    "update_codebase_context",
    "list_code_definition_names",
  ];

  const toolColor = getToolColor(toolType);
  const isStyledTool =
    toolType === "replace_in_file" ||
    toolType === "write_to_file" ||
    toolType === "list_files" ||
    toolType === "execute_command" ||
    toolType === "search_files" ||
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
      // Ensure we use a valid language for syntax highlighting
      // If extension is not standard, CodeBlock handles mapping, but we pass ext here
      const codeLanguage =
        toolType === "replace_in_file" ? fileExt : "typescript";

      if (action.type === "replace_in_file" && action.params.diff) {
        const diffText = action.params.diff;
        const searchPattern =
          /<<<<<<< SEARCH\s+([\s\S]*?)=======\s+([\s\S]*?)(?:>>>>>>>|>)\s*REPLACE/g;
        const matches = [...diffText.matchAll(searchPattern)];

        if (matches.length > 0) {
          // Track cumulative line offset for multiple blocks
          let cumulativeLineOffset = 0;

          matches.forEach((match, index) => {
            const searchBlock = match[1] || "";
            const replaceBlock = match[2] || "";
            // Use trimEnd() to remove the last newline so split doesn't create an empty string at the end
            const getLines = (text: string) =>
              text.replace(/\r?\n/g, "\n").trimEnd().split("\n");

            const searchLines = getLines(searchBlock);
            const replaceLines = getLines(replaceBlock);

            console.log(`🔍 [ToolItem] Block ${index} Debug:`, {
              searchBlock: JSON.stringify(searchBlock),
              replaceBlock: JSON.stringify(replaceBlock),
              searchLinesLength: searchLines.length,
              replaceLinesLength: replaceLines.length,
              searchLines: JSON.stringify(searchLines),
              replaceLines: JSON.stringify(replaceLines),
            });

            // Simple diff generation (Context + Changes)
            // But now we want CLEAN lines + Highlights
            let prefixCount = 0;
            const minLen = Math.min(searchLines.length, replaceLines.length);
            while (
              prefixCount < minLen &&
              searchLines[prefixCount] === replaceLines[prefixCount]
            ) {
              prefixCount++;
            }

            let suffixCount = 0;
            const searchRemaining = searchLines.length - prefixCount;
            const replaceRemaining = replaceLines.length - prefixCount;
            const minRemaining = Math.min(searchRemaining, replaceRemaining);
            while (
              suffixCount < minRemaining &&
              searchLines[searchLines.length - 1 - suffixCount] ===
                replaceLines[replaceLines.length - 1 - suffixCount]
            ) {
              suffixCount++;
            }

            // Construct Content Lines
            const prefixLines = searchLines.slice(0, prefixCount);
            const deletedLines = searchLines.slice(
              prefixCount,
              searchLines.length - suffixCount,
            );
            const addedLines = replaceLines.slice(
              prefixCount,
              replaceLines.length - suffixCount,
            );
            const suffixLines = searchLines.slice(
              searchLines.length - suffixCount,
            );

            // We build the code content string
            // And track line numbers for highlights
            // Note: Monaco lines are 1-based

            // Add spacer if multiple matches (though typically 1 per action in this tool usage)
            if (index > 0) {
              codeContent += "\n...\n";
            }

            // 🐛 FIX: Always calculate currentLine based on the current codeContent length for correct relative highlighting
            // The CodeBlock component renders the snippet starting at line 1, so highlights must be relative to the snippet, not the file.
            // Absolute line numbers (fuzzyStatus.startLine) are only useful if we passed startLineNumber to Monaco, which we don't yet.

            // Current block start line in the accumulated `codeContent`
            let currentLine = 1;
            if (codeContent !== "") {
              // If previous content exists, we are appending new content.
              // We use split length to determine where the new lines start RELATIVE to the snippet start.
              currentLine = codeContent.split(/\r\n|\r|\n/).length;

              // If the content doesn't end with a newline, the next append starts on the SAME line.
              // But we manually add `\n` in `blockLines.join("\n")` later.
              // And we added `\n...\n` separator which ends with newline.
              // So normally we are starting on a new line.
              if (codeContent.endsWith("\n")) {
                currentLine += 1;
              } else {
                currentLine += 1; // We implicitly add a newline when joining/appending
              }
            }

            console.log(
              `📍 Block ${index}: Relative currentLine = ${currentLine}, (Original Fuzzy Start: ${fuzzyStatus?.startLine}, Offset: ${cumulativeLineOffset})`,
            );

            // Actually simpler: build array of lines first
            const blockLines: string[] = [];

            prefixLines.forEach((l) => blockLines.push(l));

            const startDelete = currentLine + blockLines.length;
            deletedLines.forEach((l) => blockLines.push(l));
            const endDelete = currentLine + blockLines.length - 1;

            const startAdd = currentLine + blockLines.length;
            addedLines.forEach((l) => blockLines.push(l));
            const endAdd = currentLine + blockLines.length - 1;

            suffixLines.forEach((l) => blockLines.push(l));

            codeContent += blockLines.join("\n");
            // Don't add trailing newline - it causes unwanted empty line at the end

            // Update cumulative offset for next block
            // Offset = number of lines in searchBlock (original file position moves by this amount)
            cumulativeLineOffset += searchLines.length;

            if (deletedLines.length > 0) {
              lineHighlights.push({
                startLine: startDelete,
                endLine: endDelete,
                type: "removed",
              });
            }
            if (addedLines.length > 0) {
              lineHighlights.push({
                startLine: startAdd,
                endLine: endAdd,
                type: "added",
              });
            }
          });
        } else {
          // Fallback for non-standard diffs - just show raw diff
          codeContent = diffText;
          // No highlights
        }
      } else if (toolType === "write_to_file") {
        codeContent = action.params.content || "";
      }

      // Calculate stats (lifted from below)
      let diffStats = null;
      if (action.type === "replace_in_file" && action.params.diff) {
        const diffText = action.params.diff;
        let added = 0;
        let removed = 0;
        const searchPattern =
          /<<<<<<< SEARCH\s+([\s\S]*?)=======\s+([\s\S]*?)(?:>>>>>>>|>)\s*REPLACE/g;
        const matches = [...diffText.matchAll(searchPattern)];

        if (matches.length > 0) {
          matches.forEach((match) => {
            const searchBlock = match[1] || "";
            const replaceBlock = match[2] || "";
            const getLines = (text: string) =>
              text.replace(/\r?\n/g, "\n").trimEnd().split("\n");
            const searchLines = getLines(searchBlock);
            const replaceLines = getLines(replaceBlock);

            if (searchLines.length === 1 && searchLines[0] === "") {
              added += replaceBlock.trim().length > 0 ? replaceLines.length : 0;
              return;
            }
            if (replaceLines.length === 1 && replaceLines[0] === "") {
              removed += searchBlock.trim().length > 0 ? searchLines.length : 0;
              return;
            }

            let prefixCount = 0;
            const minLen = Math.min(searchLines.length, replaceLines.length);
            while (
              prefixCount < minLen &&
              searchLines[prefixCount] === replaceLines[prefixCount]
            )
              prefixCount++;

            let suffixCount = 0;
            const searchRemaining = searchLines.length - prefixCount;
            const replaceRemaining = replaceLines.length - prefixCount;
            const minRemaining = Math.min(searchRemaining, replaceRemaining);
            while (
              suffixCount < minRemaining &&
              searchLines[searchLines.length - 1 - suffixCount] ===
                replaceLines[replaceLines.length - 1 - suffixCount]
            )
              suffixCount++;

            removed += searchLines.length - prefixCount - suffixCount;
            added += replaceLines.length - prefixCount - suffixCount;
          });
        } else {
          const lines = diffText.split("\n");
          lines.forEach((line: string) => {
            if (line.startsWith("+") && !line.startsWith("+++")) added++;
            if (line.startsWith("-") && !line.startsWith("---")) removed++;
          });
        }
        diffStats = { added, removed };
      }

      const linesCount =
        action.type === "write_to_file"
          ? action.params.content?.split("\n").length || 0
          : 0;

      return (
        <div style={{ marginBottom: "8px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between", // Spread content
              padding: "4px 0", // Minimal padding
              // No background, no border
            }}
          >
            {/* Left: Dot + Title + File + Stats */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {/* Dot */}
              <div
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  backgroundColor: toolColor,
                  flexShrink: 0,
                }}
              />

              {/* Action Label */}
              <span
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "var(--vscode-editor-foreground)",
                  opacity: 0.9,
                }}
              >
                {toolType === "replace_in_file" ? "Edit" : "Create"}
              </span>

              {/* File Pill (Clean, Link-style) */}
              <div
                // No click handler as requested
                // inline hover simulation
                onMouseEnter={(e) => {
                  e.currentTarget.style.textDecoration = "underline";
                  e.currentTarget.style.color =
                    "var(--vscode-textLink-foreground)"; // or a subtly brighter color
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.textDecoration = "none";
                  e.currentTarget.style.color =
                    "var(--vscode-editor-foreground)"; // reset to default
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "0",
                  // No background, no border
                  fontSize: "13px", // Match title
                  fontWeight: 600, // Match title
                  color: "var(--vscode-editor-foreground)", // Start default
                  cursor: "pointer",
                  userSelect: "none",
                  transition: "color 0.1s",
                }}
                title={getFilename(action)}
              >
                <FileIcon
                  path={getFilename(action)}
                  style={{ width: "14px", height: "14px" }}
                />
                <span>{getFilename(action)}</span>
              </div>

              {/* Diff Stats (Edit) - MOVED HERE - REMOVED AS REQUESTED */}
              {/* Lines (Create) - MOVED HERE */}
              {linesCount > 0 && (
                <span
                  style={{
                    fontSize: "11px",
                    color: "var(--vscode-descriptionForeground)",
                    marginLeft: "4px",
                  }}
                >
                  {linesCount} lines
                </span>
              )}
            </div>

            {/* Right: Validation Status Dot Only + Action */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              {/* Validation Status (Edit) - DOT REMOVED AS REQUESTED */}

              {/* Main Action Button (Hidden checkmark/sweep if completed) */}
              <div style={{ display: "flex", alignItems: "center" }}>
                {!isActionClicked && (
                  <ExecuteButton
                    isActive={isActiveGroup || false}
                    isCompleted={isActionClicked}
                    isLastMessage={isLastMessage}
                    isSkipped={
                      !isActiveGroup && !isLastMessage && !isActionClicked
                    }
                    isSweepable={true}
                    isLoading={isLoading}
                    isSwept={isActionSwept}
                    toolColor={toolColor}
                    title={
                      isActionClicked
                        ? "Clear Context (Sweep)"
                        : "Execute command"
                    }
                    onExecute={() => {
                      if (isActionClicked) {
                        if (onActionClear && !isActionSwept) {
                          onActionClear(actionId);
                        }
                      } else {
                        onToolClick(action, messageId, index);
                      }
                    }}
                  />
                )}
              </div>
            </div>
          </div>

          {/* Always Visible CodeBlock */}
          {(toolType === "write_to_file" || toolType === "replace_in_file") && (
            <div style={{ marginTop: "6px" }}>
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
                  toolType === "write_to_file"
                    ? "rgba(40, 167, 69, 0.2)"
                    : undefined
                }
                headerActions={
                  diffStats && (
                    <div
                      style={{
                        display: "flex",
                        gap: "6px",
                        marginRight: "8px",
                        fontSize: "12px",
                        fontFamily: "monospace",
                        alignItems: "center", // Ensure vertical alignment
                        paddingTop: "1px", // Slight nudge if needed
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
                  )
                }
              />
            </div>
          )}
        </div>
      );
    }

    if (toolType === "execute_command") {
      const index = group[0].index; // execute_command is always size 1 now
      const action = group[0].action;
      const isLast = true; // Always last in its group

      const actionId = `${messageId}-action-${index}`;
      const outputData = toolOutputs?.[actionId];

      // Determine state for this specific action
      const isActionClicked = clickedActions.has(actionId);
      const isActionSwept = clearedActions?.has(actionId);
      const hasOutput = !!outputData;

      // Loading state: Clicked but no output yet (and not failed? failed not tracked deeply here)
      const isLoading = isActionClicked && !hasOutput;

      // Completed if we have output
      const isCompleted = hasOutput;

      // We need to determine if THIS action is active.
      // Since we split execute_command into their own groups of 1,
      // isActiveGroup passed to ToolItem should be correct for this single item.
      // But just in case, we use the props.

      return (
        // Container for execute_command (like grouped items)
        <div style={{ marginBottom: "8px" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              backgroundColor: "var(--vscode-editor-background)",
              border: `1px solid ${toolColor}40`,
              borderRadius: "6px",
              overflow: "hidden",
            }}
          >
            {/* Header: Label + Execute Button */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "6px 10px",
                borderBottom: `1px solid ${toolColor}20`,
                backgroundColor: `${toolColor}05`,
              }}
            >
              {/* Label */}
              <div
                style={{
                  fontSize: "13px",
                  color: "var(--vscode-descriptionForeground)",
                  fontWeight: 600,
                }}
              >
                {getToolLabel(toolType)}
              </div>

              {/* Execute Button */}
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
                      : "Execute command"
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

            {/* Content: Command CodeBlock (Removed headerActions) */}
            <div style={{ padding: "0" }}>
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
                    <rect width="18" height="18" x="3" y="3" rx="2" ry="2" />
                  </svg>
                }
                showCopyButton={true}
              />
            </div>

            {/* Output CodeBlock */}
            {outputData && (
              <div
                style={{ padding: "0", borderTop: `1px solid ${toolColor}20` }}
              >
                <CodeBlock
                  code={outputData.output}
                  language="text"
                  filename="Output"
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
                      <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" />
                      <path d="M14 2v5a1 1 0 0 0 1 1h5" />
                      <path d="m8 16 2-2-2-2" />
                      <path d="M12 18h4" />
                    </svg>
                  }
                  maxLines={10}
                  showCopyButton={true}
                />
              </div>
            )}
          </div>
        </div>
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
              {group.length === 1 && (
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
              isSweepable={true}
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

            if (action.type === "execute_command") {
              const actionId = `${messageId}-action-${index}`;
              const outputData = toolOutputs?.[actionId];

              // Determine state for this specific action
              const isActionClicked = clickedActions.has(actionId);
              const isActionSwept = clearedActions?.has(actionId);

              // We need to determine if THIS action is active.
              // Since we split execute_command into their own groups of 1,
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
                        isSweepable={true}
                        isSwept={isActionSwept}
                        toolColor={toolColor}
                        title={
                          isActionClicked
                            ? "Clear Context (Sweep)"
                            : "Execute command"
                        }
                        onExecute={() => {
                          if (isActionClicked) {
                            if (onActionClear && !isActionSwept) {
                              onActionClear(actionId);
                            }
                          } else {
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
