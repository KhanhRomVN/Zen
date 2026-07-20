import React, { useEffect, useRef } from "react";
import { ToolAction } from "../../services/ResponseParser";
import FileIcon from "@/icons/FileIcon";
import { ToolHeader } from "./ToolHeader";
import { parseDiff, calculateLineDiff } from "../../../../utils/diffUtils";
import { getFilename } from "../../utils/toolUtils";
import { getDisplayPath, collectConvFilePaths } from "../../utils/pathUtils";
import { extensionService } from "../../../../services/ExtensionService";
import { Message } from "../../types/message";
import ExecuteButton from "./ExecuteButton";
import { useSettings } from "../../../../context/SettingsContext";
import ErrorBlock from "../blocks/error/ErrorBlock";
import { GrepBlock } from "../blocks/grep/GrepBlock";
import { TreeBlock } from "../blocks/tree/TreeBlock";
import { getPermissionDecision } from "../../utils/permissionUtils";
import { ToolOutputs } from "../../types/tool-outputs";
import FileStreamingBlock from "../blocks/file_streaming/FileStreamingBlock";

// Fixed-height streaming preview box shown while write_to_file / replace_in_file is streaming.
// Auto-scrolls to bottom as new content arrives. Hidden once streaming finishes.
const STREAM_BOX_HEIGHT = 154; // px — 120 base + 2 extra lines (≈17px/line)

const StreamingPreviewBox: React.FC<{ content: string }> = ({ content }) => {
  const boxRef = useRef<HTMLDivElement>(null);
  const streamCountRef = useRef(0);

  // Auto-scroll to bottom whenever content grows
  useEffect(() => {
    streamCountRef.current += 1;
    if (boxRef.current) {
      boxRef.current.scrollTop = boxRef.current.scrollHeight;
    }
  }, [content]);

  return (
    <div
      ref={boxRef}
      style={{
        height: `${STREAM_BOX_HEIGHT}px`,
        overflowY: "hidden", // no scrollbar visible — just auto-scroll
        overflowX: "hidden",
        background:
          "var(--vscode-editor-background, var(--vscode-textCodeBlock-background))",
        borderRadius: "4px",
        border: "1px solid var(--vscode-widget-border, rgba(255,255,255,0.08))",
        marginTop: "4px",
        padding: "6px 10px",
        fontFamily: "var(--vscode-editor-font-family, monospace)",
        fontSize: "11px",
        lineHeight: "1.5",
        color: "var(--vscode-editor-foreground)",
        whiteSpace: "pre",
        wordBreak: "break-all",
        opacity: 0.85,
        position: "relative",
        // Fade out the top so it looks like a scrolling ticker
        maskImage: "linear-gradient(to bottom, transparent 0%, black 30%)",
        WebkitMaskImage:
          "linear-gradient(to bottom, transparent 0%, black 30%)",
      }}
    >
      {content}
    </div>
  );
};

interface FileToolRendererProps {
  action: ToolAction;
  actionIndex: number;
  messageId: string;
  isActionClicked: boolean;
  isActiveGroup?: boolean;
  isLastMessage?: boolean;
  isLastItemInList?: boolean;
  toolOutputs?: ToolOutputs;
  allMessages?: Message[];
  fileStatsMap: Record<string, { lines: number; loading: boolean }>;
  onToolClick: (
    action: ToolAction,
    messageId: string,
    index: number,
    type: "accept" | "reject",
  ) => void;
  mergedItems?: { action: ToolAction; index: number }[];
  conversationId?: string;
  singleLineReviewActions?: Record<
    string,
    { action: any; actionId: string; messageId: string }
  >;
  onConfirmSingleLineAction?: (actionId: string) => void;
  onRejectSingleLineAction?: (actionId: string) => void;
}

const FileToolRenderer: React.FC<FileToolRendererProps> = ({
  action,
  actionIndex,
  messageId,
  isActionClicked,
  isActiveGroup,
  isLastMessage,
  isLastItemInList,
  toolOutputs,
  allMessages,
  fileStatsMap,
  onToolClick,
  mergedItems,
  conversationId,
  singleLineReviewActions,
  onConfirmSingleLineAction,
  onRejectSingleLineAction,
}) => {
  const [isCollapsed, setIsCollapsed] = React.useState(true);
  const [isGrepCollapsed, setIsGrepCollapsed] = React.useState(true);
  const [isSnapshotLoading, setIsSnapshotLoading] = React.useState(false);
  const [showRawView, setShowRawView] = React.useState(false);
  const [isHeaderHovered, setIsHeaderHovered] = React.useState(false);
  const [cachedDiagnostics, setCachedDiagnostics] = React.useState<Array<{
    severity: string;
    message: string;
    line: number;
    column: number;
    source?: string;
    code?: string | number;
  }> | null>(null);
  const { permissionMode } = useSettings();
  const toolType = action.type;
  const actionId = `${messageId}-action-${actionIndex}`;

  const rawPath =
    action.params.file_path ||
    action.params.symbol ||
    action.params.folder_path ||
    action.params.path ||
    getFilename(action);
  const allPaths = React.useMemo(
    () => collectConvFilePaths(allMessages || []),
    [allMessages],
  );
  // Extract only the filename (not the directory path) since full path is shown in line 2
  const displayName = rawPath ? rawPath.split("/").pop() || rawPath : "";

  // Snapshot logic moved to ReplaceInFileRenderer and WriteToFileRenderer

  // Snapshot functionality is now handled by ReplaceInFileRenderer and WriteToFileRenderer

  let codeContent = "";
  let rawTreeData: any = null; // For list_files JSON tree data

  if (toolType === "list_files" || toolType === "find_files") {
    const output = toolOutputs?.[actionId]?.output;

    // For list_files, check if we have raw JSON array (new format)
    if (toolType === "list_files" && Array.isArray(output)) {
      rawTreeData = output; // Store raw JSON for TreeBlock
      // Convert to string format for agent display (backward compatibility)
      codeContent = JSON.stringify(output, null, 2);
    } else {
      // Fallback to string format (old behavior or find_files)
      codeContent = typeof output === "string" ? output : "";
    }
  }

  let diffStats: { added: number; removed: number } | null = null;

  // Calculate diff stats for replace_in_file
  if (toolType === "replace_in_file") {
    // Try legacy diff field first
    if (action.params.diff) {
      const stats = parseDiff(action.params.diff).stats;
      diffStats = { added: stats.added, removed: stats.removed };
    }
    // Otherwise calculate from old_str and new_str
    else if (action.params.old_str && action.params.new_str) {
      const oldLines = (action.params.old_str || "").split("\n");
      const newLines = (action.params.new_str || "").split("\n");

      diffStats = {
        added: newLines.length,
        removed: oldLines.length,
      };
    }
  }

  // Calculate diff stats for revert_file - use ACCURATE diff algorithm
  if (toolType === "revert_file") {
    if (action.params.old_str && action.params.new_str) {
      // FIX: Use calculateLineDiff instead of counting all lines
      const { additions, deletions } = calculateLineDiff(
        action.params.old_str || "",
        action.params.new_str || "",
      );

      diffStats = {
        added: additions,
        removed: deletions,
      };
    } else if (action.params.old_content && action.params.new_content) {
      // FIX: Use calculateLineDiff instead of counting all lines
      const { additions, deletions } = calculateLineDiff(
        action.params.old_content || "",
        action.params.new_content || "",
      );

      diffStats = {
        added: additions,
        removed: deletions,
      };
    }
  }

  let linesCount =
    action.type === "write_to_file"
      ? action.params.content?.split("\n").length || 0
      : 0;

  // Extract line range info for read_file - will be calculated after isCompleted
  let lineRangeText: string | null = null;

  if (mergedItems && mergedItems.length > 1) {
    let totalAdded = 0,
      totalRemoved = 0,
      totalLines = 0;
    mergedItems.forEach(({ action: a }) => {
      if (a.type === "replace_in_file" && a.params.diff) {
        const s = parseDiff(a.params.diff).stats;
        totalAdded += s.added;
        totalRemoved += s.removed;
      } else if (a.type === "write_to_file") {
        totalLines += a.params.content?.split("\n").length || 0;
      }
    });
    if (totalAdded > 0 || totalRemoved > 0)
      diffStats = { added: totalAdded, removed: totalRemoved };
    if (totalLines > 0) linesCount = totalLines;
  }

  const isPartial = false; // No longer using streaming partial parsing
  const isError = !!toolOutputs?.[actionId]?.isError;
  const errorMessage = isError ? toolOutputs?.[actionId]?.output || "" : "";

  // Calculate file count for list_files (must be after isError declaration)
  let fileCount = 0;
  let folderCount = 0;
  let fileCountFromListFiles = 0;

  if (toolType === "list_files" && !isError) {
    // Priority 1: Count from raw JSON tree data (new format)
    if (rawTreeData && Array.isArray(rawTreeData)) {
      const countNodes = (nodes: any[]): { files: number; folders: number } => {
        let files = 0;
        let folders = 0;
        for (const node of nodes) {
          if (node.type === "file") {
            files++;
          } else if (node.type === "folder" || node.type === "directory") {
            folders++;
            if (node.children && Array.isArray(node.children)) {
              const childCounts = countNodes(node.children);
              files += childCounts.files;
              folders += childCounts.folders;
            }
          }
        }
        return { files, folders };
      };

      const counts = countNodes(rawTreeData);
      fileCountFromListFiles = counts.files;
      folderCount = counts.folders;
      fileCount = fileCountFromListFiles + folderCount;
    }
    // Fallback: Parse plain text format (legacy)
    else if (codeContent) {
      const lines = codeContent.split("\n").filter((line) => line.trim());

      lines.forEach((line) => {
        const trimmed = line.trim();
        if (trimmed.endsWith("/")) {
          folderCount++;
        } else if (trimmed && !trimmed.startsWith("//")) {
          fileCountFromListFiles++;
        }
      });
      fileCount = fileCountFromListFiles + folderCount;
    }
  }

  // Calculate match count for find_files
  if (toolType === "find_files" && codeContent && !isError) {
    // Extract total matches from output
    try {
      const match = codeContent.match(/Found (\d+) file\(s\)/);
      if (match) {
        fileCount = parseInt(match[1], 10);
      }
    } catch (err) {}
  }

  // ─── Thinking content ───────────────────────────────────────────────────────
  // Extract <thinking>...</thinking> or unclosed <thinking>... from the current
  // streaming message content. Only shown while the tag is open (streaming).
  // Once </thinking> is closed, the parser replaces it with __THINKING_N__ and
  // the raw content no longer contains the open tag → we show nothing.
  const thinkingContent = React.useMemo(() => {
    if (!isPartial) return null; // only relevant while streaming
    const currentMsg = allMessages?.find((m) => m.id === messageId);
    if (!currentMsg?.content) return null;
    // Match unclosed <thinking> tag (streaming, no closing tag yet)
    const unclosedMatch = /<thinking>([\s\S]*)$/i.exec(currentMsg.content);
    if (unclosedMatch) return unclosedMatch[1];
    return null;
  }, [isPartial, allMessages, messageId]);

  // Debug: log khi render với toolOutputs (chỉ log 1 lần per actionId)
  const debugLoggedRef = React.useRef(false);
  React.useEffect(() => {
    if (!debugLoggedRef.current) {
      debugLoggedRef.current = true;
    }
  }, [toolOutputs, actionId]);

  const nextUserMessage = allMessages
    ? allMessages
        .slice(allMessages.findIndex((m) => m.id === messageId) + 1)
        .find((m) => m.role === "user")
    : undefined;

  const isWriteOrEditTool =
    toolType === "delete_file" ||
    toolType === "delete_folder" ||
    toolType === "move_file" ||
    toolType === "revert_file";
  const isGrepTool = toolType === "grep";
  const isFindFilesTool = toolType === "find_files";
  const isCompleted: boolean = Boolean(
    !isPartial &&
    (!!isActionClicked ||
      isError ||
      (isWriteOrEditTool
        ? !!toolOutputs?.[actionId] || !!nextUserMessage
        : isFindFilesTool
          ? !!toolOutputs?.[actionId] || !!nextUserMessage
          : (codeContent && codeContent.trim().length > 0) ||
            !!nextUserMessage)),
  );

  // Track previous state to avoid redundant logs
  const prevDiagnosticStateRef = React.useRef<{
    isCompleted: boolean;
    isPartial: boolean | undefined;
    hasDiagnostics: boolean;
    diagnosticsCount: number;
  }>({
    isCompleted: false,
    isPartial: true,
    hasDiagnostics: false,
    diagnosticsCount: 0,
  });

  // Get diagnostics from toolOutputs ONLY (single source of truth)
  // No cache, no merge - prioritize consistency over performance
  const mergedDiagnostics = React.useMemo(() => {
    const _diagStartTime = performance.now();
    const shouldGetDiagnostics =
      (toolType === "read_file" ||
        toolType === "write_to_file" ||
        toolType === "replace_in_file") &&
      isCompleted &&
      !isPartial;

    // Get diagnostics from toolOutputs - this is the ONLY source
    const toolOutputDiagnostics = toolOutputs?.[actionId]?.diagnostics;
    const hasDiagnostics = !!toolOutputDiagnostics;
    const diagnosticsCount = toolOutputDiagnostics?.length || 0;

    // Current state
    const currentState: typeof prevDiagnosticStateRef.current = {
      isCompleted,
      isPartial,
      hasDiagnostics,
      diagnosticsCount,
    };

    // Only log when state actually changes (not on every render)
    const stateChanged =
      prevDiagnosticStateRef.current.isCompleted !== currentState.isCompleted ||
      prevDiagnosticStateRef.current.isPartial !== currentState.isPartial ||
      prevDiagnosticStateRef.current.hasDiagnostics !==
        currentState.hasDiagnostics ||
      prevDiagnosticStateRef.current.diagnosticsCount !==
        currentState.diagnosticsCount;

    if (stateChanged && shouldGetDiagnostics) {
      // Update previous state
      prevDiagnosticStateRef.current = currentState;
    }

    if (!shouldGetDiagnostics) return undefined;

    // If toolOutputs doesn't have diagnostics field at all, return undefined
    // (meaning backend hasn't sent diagnostics yet or tool doesn't support it)
    if (!toolOutputDiagnostics) {
      return undefined;
    }

    // Normalize severity to match ToolHeader expectations (capital first letter)
    const normalized = toolOutputDiagnostics.map((d) => {
      const normalizedSeverity =
        d.severity.toLowerCase() === "error"
          ? "Error"
          : d.severity.toLowerCase() === "warning"
            ? "Warning"
            : d.severity;

      return {
        ...d,
        severity: normalizedSeverity,
      };
    });

    // Always return normalized array, even if empty (empty array means no diagnostics, undefined means not loaded yet)
    return normalized;
  }, [toolOutputs, actionId, toolType, isCompleted, isPartial, rawPath]);

  // Fetch diagnostics directly from extension for read_file, write_to_file, replace_in_file
  const diagEffectCountRef = React.useRef(0);
  React.useEffect(() => {
    diagEffectCountRef.current += 1;
    const shouldFetchDiagnostics =
      (toolType === "read_file" ||
        toolType === "write_to_file" ||
        toolType === "replace_in_file") &&
      rawPath &&
      isCompleted &&
      !isPartial;

    if (!shouldFetchDiagnostics) return;

    const baseRequestId = `diagnostics-${actionId}`;
    let retryCount = 0;
    const maxRetries = 2;
    const retryDelay = 300; // ms between retries
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const handleMessage = (event: MessageEvent) => {
      const msg = event.data;
      // Match both base request and retry requests
      if (
        msg.command === "getDiagnosticsResult" &&
        msg.requestId?.startsWith(baseRequestId)
      ) {
        if (msg.diagnostics && Array.isArray(msg.diagnostics)) {
          // If we got diagnostics, use them
          if (msg.diagnostics.length > 0) {
            setCachedDiagnostics(msg.diagnostics);
            window.removeEventListener("message", handleMessage);
            if (timeoutId !== null) clearTimeout(timeoutId);
          } else {
            // If no diagnostics but we haven't exhausted retries, try again
            if (retryCount < maxRetries) {
              retryCount++;
              timeoutId = setTimeout(() => {
                extensionService.postMessage({
                  command: "getDiagnostics",
                  path: rawPath,
                  requestId: `${baseRequestId}-retry-${retryCount}`,
                });
              }, retryDelay * retryCount);
            } else {
              // No more retries, accept empty result
              setCachedDiagnostics([]);
              window.removeEventListener("message", handleMessage);
            }
          }
        }
      }
    };

    window.addEventListener("message", handleMessage);

    // Initial request with slight delay to allow language server to process
    timeoutId = setTimeout(() => {
      extensionService.postMessage({
        command: "getDiagnostics",
        path: rawPath,
        requestId: baseRequestId,
      });
    }, 200);

    return () => {
      window.removeEventListener("message", handleMessage);
      if (timeoutId !== null) clearTimeout(timeoutId);
    };
  }, [toolType, rawPath, isCompleted, isPartial, actionId]);

  // Calculate lineRangeText after isCompleted is defined
  if (toolType === "read_file") {
    const startLine = action.params.start_line || action.params.startLine;
    const endLine = action.params.end_line || action.params.endLine;

    // Priority 1: If start_line and end_line are specified, show range
    if (
      startLine !== undefined &&
      endLine !== undefined &&
      startLine > 0 &&
      endLine > 0
    ) {
      lineRangeText = `${startLine}-${endLine}`;
    } else if (startLine !== undefined && startLine > 0) {
      lineRangeText = `${startLine}+`;
    } else if (endLine !== undefined && endLine > 0) {
      lineRangeText = `1-${endLine}`;
    } else if (isCompleted) {
      // Priority 2: If no range specified but tool completed, show "0 - max_line"
      const output = toolOutputs?.[actionId]?.output || "";
      if (output && output.trim()) {
        const outputLineCount = output.split("\n").length;
        lineRangeText = `0-${outputLineCount}`;
      }
    }
  }

  // ── Auto-hide completed write/edit tools in approval mode ──
  // After user clicks "Accept" or "Reject", the tool is considered done.
  // Hide the content (buttons, code block) but keep the header visible.
  const isWriteOrEditOnly = false; // replace_in_file is now handled by ReplaceInFileRenderer
  const shouldHideContent =
    isWriteOrEditOnly &&
    isCompleted &&
    isActionClicked &&
    !isPartial &&
    !isError;

  const prefix =
    toolType === "list_files"
      ? "LIST"
      : toolType === "grep"
        ? "GREP"
        : toolType === "find_files"
          ? "FIND"
          : toolType === "delete_file"
            ? "DELETE"
            : toolType === "delete_folder"
              ? "DELETE"
              : toolType === "move_file"
                ? "MOVE"
                : toolType === "replace_in_file"
                  ? "REPLACE"
                  : toolType === "revert_file"
                    ? "REVERT"
                    : toolType === "write_to_file"
                      ? "WRITE"
                      : "READ";
  // For grep tool, we'll render in the main flow with ToolHeader
  const grepValidationError = isGrepTool
    ? action.params._validationError
    : null;
  const grepCompleted =
    isGrepTool &&
    (!isPartial || !!grepValidationError) && // Consider completed if validation failed
    (isActionClicked ||
      isError ||
      !!grepValidationError ||
      !!toolOutputs?.[actionId] ||
      !!nextUserMessage);
  const grepErrorMsg =
    isGrepTool && isError ? toolOutputs?.[actionId]?.output || "" : "";
  const grepHasResults =
    isGrepTool && toolOutputs?.[actionId]?.output
      ? toolOutputs[actionId].output.includes("<grep_results")
      : false;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        paddingBottom: "4px",
        marginBottom: "2px",
      }}
    >
      <ToolHeader
        title={
          isGrepTool ? (
            // Grep-specific header
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "12px",
                color: "var(--vscode-editor-foreground)",
                cursor: isCompleted ? "pointer" : "default",
              }}
              onMouseEnter={() => setIsHeaderHovered(true)}
              onMouseLeave={() => setIsHeaderHovered(false)}
              onClick={
                isCompleted ? () => setIsGrepCollapsed((v) => !v) : undefined
              }
            >
              <span style={{ fontWeight: 600, opacity: 0.8 }}>GREP</span>
              <span
                style={{
                  fontFamily: "var(--vscode-editor-font-family, monospace)",
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "var(--vscode-textLink-foreground)",
                  padding: "0 5px",
                  backgroundColor:
                    "color-mix(in srgb, var(--vscode-textLink-foreground) 12%, transparent)",
                  borderRadius: "3px",
                }}
              >
                {action.params.search_term || action.params.searchTerm || ""}
              </span>
              {(() => {
                const folderPath =
                  action.params.folder_path || action.params.folderPath || "";
                const filePath =
                  action.params.file_path || action.params.filePath || "";
                const targetPath = folderPath || filePath || "";
                const isFolder = !!folderPath;
                if (!targetPath) return null;
                // Show path for grep even if only 1 segment
                const segments = targetPath.split("/").filter(Boolean);
                if (segments.length === 0) return null;
                return (
                  <>
                    <span style={{ opacity: 0.4, fontSize: "11px" }}>in</span>
                    <FileIcon
                      path={targetPath}
                      isFolder={isFolder}
                      style={{ width: "14px", height: "14px" }}
                    />
                    <span
                      style={{
                        fontWeight: 500,
                        opacity: 0.8,
                        fontFamily:
                          "var(--vscode-editor-font-family, monospace)",
                        fontSize: "11px",
                      }}
                    >
                      {getDisplayPath(targetPath, allPaths) || "..."}
                    </span>
                  </>
                );
              })()}
              {isPartial && !isCompleted && (
                <span
                  style={{
                    fontSize: "10px",
                    opacity: 0.55,
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <span
                    className="codicon codicon-loading codicon-modifier-spin"
                    style={{ fontSize: "10px" }}
                  />
                  Searching...
                </span>
              )}
              {isCompleted &&
                (() => {
                  const output = toolOutputs?.[actionId]?.output || "";
                  let totalMatches = 0;
                  let fileCount = 0;
                  try {
                    const match = output.match(/total_matches="(\d+)"/);
                    if (match) totalMatches = parseInt(match[1], 10);
                    const fileMatch = output.match(/files="(\d+)"/);
                    if (fileMatch) fileCount = parseInt(fileMatch[1], 10);
                  } catch {}
                  if (totalMatches === 0 && fileCount === 0) {
                    return (
                      <span
                        style={{
                          opacity: 0.5,
                          fontSize: "10px",
                          color: "var(--vscode-descriptionForeground)",
                          fontStyle: "italic",
                        }}
                      >
                        no matches
                      </span>
                    );
                  }
                  return (
                    <span
                      style={{
                        opacity: 0.5,
                        fontSize: "10px",
                        color: "var(--vscode-descriptionForeground)",
                      }}
                    >
                      {totalMatches} {totalMatches === 1 ? "match" : "matches"}{" "}
                      in {fileCount} {fileCount === 1 ? "file" : "files"}
                    </span>
                  );
                })()}
              {isCompleted && (
                <span
                  className={`codicon codicon-chevron-${isGrepCollapsed ? "right" : "down"}`}
                  style={{ fontSize: "10px", opacity: 0.5, marginLeft: "2px" }}
                />
              )}
            </div>
          ) : isFindFilesTool ? (
            // Find Files-specific header
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                fontSize: "12px",
                color: "var(--vscode-editor-foreground)",
                cursor: isCompleted ? "pointer" : "default",
              }}
              onMouseEnter={() => setIsHeaderHovered(true)}
              onMouseLeave={() => setIsHeaderHovered(false)}
              onClick={
                isCompleted ? () => setIsCollapsed((v) => !v) : undefined
              }
            >
              {/* First row: FIND keyword and status */}
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <span style={{ fontWeight: 600, opacity: 0.8 }}>FIND</span>
                {isPartial && !isCompleted && (
                  <span
                    style={{
                      fontSize: "10px",
                      opacity: 0.55,
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <span
                      className="codicon codicon-loading codicon-modifier-spin"
                      style={{ fontSize: "10px" }}
                    />
                    Searching...
                  </span>
                )}
                {isCompleted && (
                  <>
                    <span
                      className={`codicon codicon-chevron-${isCollapsed ? "right" : "down"}`}
                      style={{ fontSize: "10px", opacity: 0.5 }}
                    />
                    <span
                      style={{
                        opacity: 0.5,
                        fontSize: "10px",
                        color: "var(--vscode-descriptionForeground)",
                      }}
                    >
                      {fileCount} {fileCount === 1 ? "file" : "files"}
                    </span>
                  </>
                )}
              </div>

              {/* Second row: file names with icons */}
              {(() => {
                const searchFileNames =
                  action.params.file_names || action.params.file_name;
                const fileNamesArray = Array.isArray(searchFileNames)
                  ? searchFileNames
                  : searchFileNames
                    ? [searchFileNames]
                    : [];

                if (fileNamesArray.length > 0) {
                  return (
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        gap: "6px",
                        alignItems: "center",
                        marginLeft: "2px",
                      }}
                    >
                      {fileNamesArray.map((fileName, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          {idx > 0 && (
                            <span style={{ opacity: 0.3, fontSize: "11px" }}>
                              |
                            </span>
                          )}
                          <FileIcon
                            path={fileName}
                            isFolder={false}
                            style={{ width: "14px", height: "14px" }}
                          />
                          <span
                            style={{
                              fontFamily:
                                "var(--vscode-editor-font-family, monospace)",
                              fontSize: "11px",
                              fontWeight: 500,
                              opacity: 0.9,
                            }}
                          >
                            {fileName}
                          </span>
                        </div>
                      ))}
                    </div>
                  );
                }
                return null;
              })()}
            </div>
          ) : (
            // Original header for non-grep tools
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "12px",
                color: "var(--vscode-editor-foreground)",
                position: "relative",
              }}
              onMouseEnter={() => setIsHeaderHovered(true)}
              onMouseLeave={() => setIsHeaderHovered(false)}
            >
              <span
                style={{
                  fontWeight: 600,
                  opacity: 0.8,
                  cursor: "pointer",
                  transition: "text-decoration 0.15s ease",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  // For replace_in_file, show diff view
                  if (toolType === "replace_in_file" && rawPath) {
                    const oldContent =
                      action.params.old_content || action.params.old_str || "";
                    const newContent =
                      action.params.new_content || action.params.new_str || "";
                    extensionService.postMessage({
                      command: "openReplaceInFileDiff",
                      filePath: rawPath,
                      oldContent,
                      newContent,
                    });
                  }
                  // For revert_file, show diff view
                  else if (toolType === "revert_file" && rawPath) {
                    const oldContent =
                      action.params.old_content || action.params.old_str || "";
                    const newContent =
                      action.params.new_content || action.params.new_str || "";
                    extensionService.postMessage({
                      command: "openReplaceInFileDiff",
                      filePath: rawPath,
                      oldContent,
                      newContent,
                    });
                  }
                  // For write_to_file, open virtual document
                  else if (toolType === "write_to_file" && rawPath) {
                    const content = action.params.content || "";
                    extensionService.postMessage({
                      command: "openWriteToFile",
                      filePath: rawPath,
                      content,
                    });
                  }
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.textDecoration = "underline";
                  e.currentTarget.style.textUnderlineOffset = "2px";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.textDecoration = "none";
                }}
              >
                {prefix}
              </span>
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  // For replace_in_file, show diff view
                  if (toolType === "replace_in_file" && rawPath) {
                    const oldContent =
                      action.params.old_content || action.params.old_str || "";
                    const newContent =
                      action.params.new_content || action.params.new_str || "";
                    extensionService.postMessage({
                      command: "openReplaceInFileDiff",
                      filePath: rawPath,
                      oldContent,
                      newContent,
                    });
                  }
                  // For revert_file, show diff view
                  else if (toolType === "revert_file" && rawPath) {
                    const oldContent =
                      action.params.old_content || action.params.old_str || "";
                    const newContent =
                      action.params.new_content || action.params.new_str || "";
                    extensionService.postMessage({
                      command: "openReplaceInFileDiff",
                      filePath: rawPath,
                      oldContent,
                      newContent,
                    });
                  }
                  // For write_to_file, open virtual document
                  else if (toolType === "write_to_file" && rawPath) {
                    const content = action.params.content || "";
                    extensionService.postMessage({
                      command: "openWriteToFile",
                      filePath: rawPath,
                      content,
                    });
                  }
                }}
                style={{ display: "flex", alignItems: "center" }}
              >
                <FileIcon
                  path={rawPath}
                  isFolder={
                    toolType === "list_files" || !!action.params.folder_path
                  }
                  style={{ width: "16px", height: "16px", cursor: "pointer" }}
                />
              </span>
              <span
                style={{
                  fontWeight: 500,
                  opacity: 0.9,
                  fontFamily: "var(--vscode-editor-font-family, monospace)",
                  fontSize: "11px",
                  cursor: "pointer",
                  transition: "text-decoration 0.15s ease",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  // For replace_in_file, show diff view
                  if (toolType === "replace_in_file" && rawPath) {
                    const oldContent =
                      action.params.old_content || action.params.old_str || "";
                    const newContent =
                      action.params.new_content || action.params.new_str || "";
                    extensionService.postMessage({
                      command: "openReplaceInFileDiff",
                      filePath: rawPath,
                      oldContent,
                      newContent,
                    });
                  }
                  // For revert_file, show diff view
                  else if (toolType === "revert_file" && rawPath) {
                    const oldContent =
                      action.params.old_content || action.params.old_str || "";
                    const newContent =
                      action.params.new_content || action.params.new_str || "";
                    extensionService.postMessage({
                      command: "openReplaceInFileDiff",
                      filePath: rawPath,
                      oldContent,
                      newContent,
                    });
                  }
                  // For write_to_file, open virtual document
                  else if (toolType === "write_to_file" && rawPath) {
                    const content = action.params.content || "";
                    extensionService.postMessage({
                      command: "openWriteToFile",
                      filePath: rawPath,
                      content,
                    });
                  }
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.textDecoration = "underline";
                  e.currentTarget.style.textUnderlineOffset = "2px";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.textDecoration = "none";
                }}
              >
                {displayName || (isPartial && !rawPath ? "..." : "")}
              </span>
              {/* Show line range for read_file inline */}
              {lineRangeText && toolType === "read_file" && (
                <span
                  style={{
                    opacity: 0.5,
                    fontSize: "10px",
                    marginLeft: "6px",
                    fontFamily: "var(--vscode-editor-font-family, monospace)",
                    color: "var(--vscode-descriptionForeground)",
                  }}
                >
                  {lineRangeText}
                </span>
              )}
              {/* Show diff stats for replace_in_file inline */}
              {diffStats &&
                (toolType === "replace_in_file" ||
                  toolType === "revert_file") &&
                (diffStats.added > 0 || diffStats.removed > 0) && (
                  <span
                    style={{
                      display: "flex",
                      gap: "6px",
                      alignItems: "center",
                      fontSize: "11px",
                      fontWeight: 500,
                      marginLeft: "6px",
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
              {/* Show line count for write_to_file inline */}
              {linesCount > 0 && toolType === "write_to_file" && (
                <span
                  style={{
                    opacity: 0.7,
                    fontSize: "11px",
                    marginLeft: "6px",
                    fontWeight: 500,
                  }}
                >
                  +{linesCount} {linesCount === 1 ? "line" : "lines"}
                </span>
              )}
              {/* Show depth, folder count, file count for list_files inline */}
              {toolType === "list_files" &&
                isCompleted &&
                !isError &&
                (() => {
                  const depth = action.params.depth;

                  // Use pre-counted values from rawTreeData (already calculated above)
                  const folderCountInline = folderCount;
                  const fileCountInline = fileCountFromListFiles;
                  const totalCount = folderCountInline + fileCountInline;

                  if (totalCount === 0) return null; // Don't show for empty folders

                  // Build combined text: "depth: 2 • 9 folders • 3 files"
                  const parts = [];

                  // Always show depth if specified
                  if (depth !== undefined && depth !== null) {
                    parts.push(`depth: ${depth}`);
                  }

                  // Always show folder count (even if 0)
                  parts.push(
                    `${folderCountInline} ${folderCountInline === 1 ? "folder" : "folders"}`,
                  );

                  // Always show file count (even if 0)
                  parts.push(
                    `${fileCountInline} ${fileCountInline === 1 ? "file" : "files"}`,
                  );

                  return (
                    <span
                      style={{
                        opacity: 0.5,
                        fontSize: "10px",
                        color: "var(--vscode-descriptionForeground)",
                      }}
                    >
                      {parts.join(" • ")}
                    </span>
                  );
                })()}
              {isPartial && (
                <span
                  style={{
                    fontSize: "10px",
                    opacity: 0.6,
                    fontStyle: "italic",
                    marginLeft: "4px",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <span
                    className="codicon codicon-loading codicon-modifier-spin"
                    style={{ fontSize: "10px" }}
                  />
                </span>
              )}
              {isSnapshotLoading && !isPartial && (
                <span
                  style={{
                    fontSize: "10px",
                    opacity: 0.5,
                    marginLeft: "4px",
                    display: "flex",
                    alignItems: "center",
                    gap: "3px",
                  }}
                >
                  <span
                    className="codicon codicon-loading codicon-modifier-spin"
                    style={{ fontSize: "10px" }}
                  />
                </span>
              )}
            </div>
          )
        }
        statusColor={
          isError
            ? "var(--vscode-errorForeground)"
            : (isCompleted as boolean)
              ? "var(--vscode-gitDecoration-addedResourceForeground, #3fb950)"
              : !!isActiveGroup
                ? "var(--vscode-descriptionForeground)" // chờ approve → xám, giống chưa tới lượt
                : "var(--vscode-descriptionForeground)"
        }
        isError={isError}
        isWaitingApproval={!!isActiveGroup && !isCompleted}
        toolType={toolType}
        tooltipMeta={(() => {
          const meta: {
            lineCount?: number;
            lineRange?: string;
            matchCount?: number;
            fileCount?: number;
          } = {};

          // Add line count for write_to_file
          if (linesCount > 0) meta.lineCount = linesCount;

          // Add line range for read_file
          if (lineRangeText) meta.lineRange = lineRangeText;

          // Add file count for list_files
          if (toolType === "list_files" && fileCount > 0) {
            meta.fileCount = fileCount;
          }

          // Add match/file count for grep
          if (isGrepTool && isCompleted) {
            const output = toolOutputs?.[actionId]?.output || "";
            try {
              const matchResult = output.match(/total_matches="(\d+)"/);
              if (matchResult) meta.matchCount = parseInt(matchResult[1], 10);
              const fileResult = output.match(/files="(\d+)"/);
              if (fileResult) meta.fileCount = parseInt(fileResult[1], 10);
            } catch {}
          }

          return meta;
        })()}
        subTitle={undefined}
        diffStats={undefined}
        isPartial={isPartial}
        diagnostics={mergedDiagnostics}
        onClick={
          // grep and find_files handle onClick in their custom title div
          isGrepTool || isFindFilesTool
            ? undefined
            : () => {
                // replace_in_file is now handled by ReplaceInFileRenderer
                setIsCollapsed((v) => !v);
                if (rawPath && toolType !== "list_files") {
                  extensionService.postMessage({
                    command: "openFile",
                    path: rawPath,
                  });
                }
              }
        }
        path={rawPath}
        onPathClick={(clickedPath) => {
          // When clicking on path (line 2), always open the actual file in editor
          // regardless of tool type (REPLACE, WRITE, READ, etc.)
          extensionService.postMessage({
            command: "openFile",
            path: clickedPath,
          });
        }}
        onDotClick={() => {
          setShowRawView(!showRawView);
        }}
      />

      {/* Raw tool data viewer - showing raw XML without header */}
      {!isGrepTool && showRawView && (
        <div
          style={{
            marginTop: "4px",
            padding: "8px 12px",
            backgroundColor:
              "var(--vscode-editor-background, var(--vscode-textCodeBlock-background))",
            border:
              "1px solid var(--vscode-widget-border, rgba(255,255,255,0.08))",
            borderRadius: "4px",
            fontFamily: "var(--vscode-editor-font-family, monospace)",
            fontSize: "11px",
            lineHeight: "1.5",
            color: "var(--vscode-editor-foreground)",
            whiteSpace: "pre-wrap",
            wordBreak: "break-all",
            overflowX: "auto",
          }}
        >
          {action.rawXml || JSON.stringify(action, null, 2)}
        </div>
      )}

      {/* Single-line review UI for write_to_file with content crammed into 1 line */}
      {!shouldHideContent &&
        toolType === "write_to_file" &&
        singleLineReviewActions?.[actionId] &&
        (() => {
          const reviewContent = action.params.content || "";
          return (
            <div
              style={{
                marginTop: "8px",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <textarea
                readOnly
                value={reviewContent}
                style={{
                  width: "100%",
                  minHeight: "200px",
                  maxHeight: "400px",
                  padding: "8px 10px",
                  fontFamily: "var(--vscode-editor-font-family, monospace)",
                  fontSize: "11px",
                  lineHeight: "1.5",
                  color: "var(--vscode-editor-foreground)",
                  backgroundColor:
                    "var(--vscode-editor-background, var(--vscode-textCodeBlock-background))",
                  border: "1.5px dashed #e5a100",
                  borderRadius: "4px",
                  resize: "vertical",
                  outline: "none",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                }}
              />
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "12px",
                }}
              >
                <span
                  style={{
                    fontSize: "11px",
                    color: "#e5a100",
                    fontWeight: 500,
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <span
                    className="codicon codicon-warning"
                    style={{ fontSize: "11px" }}
                  />
                  Nội dung file bị dồn vào 1 dòng ({reviewContent.length} ký tự)
                </span>
                <div style={{ display: "flex", gap: "8px", flexShrink: 0 }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRejectSingleLineAction?.(actionId);
                    }}
                    style={{
                      padding: "4px 12px",
                      fontSize: "11px",
                      fontWeight: 600,
                      borderRadius: "4px",
                      border:
                        "1px solid color-mix(in srgb, var(--vscode-errorForeground, #f44336) 40%, transparent)",
                      backgroundColor:
                        "color-mix(in srgb, var(--vscode-errorForeground, #f44336) 10%, transparent)",
                      color: "var(--vscode-errorForeground, #f44336)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <span
                      className="codicon codicon-close"
                      style={{ fontSize: "11px" }}
                    />
                    Từ chối
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onConfirmSingleLineAction?.(actionId);
                    }}
                    style={{
                      padding: "4px 12px",
                      fontSize: "11px",
                      fontWeight: 600,
                      borderRadius: "4px",
                      border:
                        "1px solid color-mix(in srgb, var(--vscode-gitDecoration-addedResourceForeground, #3fb950) 40%, transparent)",
                      backgroundColor:
                        "color-mix(in srgb, var(--vscode-gitDecoration-addedResourceForeground, #3fb950) 10%, transparent)",
                      color:
                        "var(--vscode-gitDecoration-addedResourceForeground, #3fb950)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <span
                      className="codicon codicon-check"
                      style={{ fontSize: "11px" }}
                    />
                    Xác nhận
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      {!shouldHideContent &&
        !isCompleted &&
        !isPartial &&
        (isActiveGroup || !isLastMessage) &&
        getPermissionDecision(permissionMode, toolType) === "prompt" && (
          <div style={{ marginTop: "8px", marginBottom: "8px", order: 1 }}>
            <ExecuteButton
              isActive={!!isActiveGroup}
              isCompleted={!!isCompleted}
              isLastMessage={!!isLastMessage}
              isLoading={false}
              title="Approve action"
              labelText="Approve"
              onExecute={(e, type) => {
                onToolClick(action, messageId, actionIndex, type);
              }}
            />
          </div>
        )}

      {!shouldHideContent && isError && errorMessage && !isGrepTool && (
        <ErrorBlock content={errorMessage} compact={true} maxHeight="300px" />
      )}

      {!shouldHideContent &&
        toolType === "list_files" &&
        codeContent &&
        !isError && (
          <>
            {!isCollapsed &&
              (() => {
                // Check if folder is empty (codeContent contains the empty folder message)
                const isEmpty = codeContent.includes(
                  "is empty (no files or folders inside)",
                );

                if (isEmpty) {
                  // Extract folder path from codeContent
                  const folderPath =
                    action.params.path || action.params.folder_path || "";
                  return (
                    <div
                      style={{
                        marginTop: "8px",
                        padding: "8px 12px",
                        backgroundColor:
                          "var(--vscode-editor-background, var(--vscode-textCodeBlock-background))",
                        border:
                          "1px solid var(--vscode-widget-border, rgba(255,255,255,0.08))",
                        borderRadius: "4px",
                        fontSize: "11px",
                        color: "var(--vscode-descriptionForeground)",
                        fontStyle: "italic",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <span
                        className="codicon codicon-info"
                        style={{ fontSize: "12px" }}
                      />
                      <span>
                        The folder{" "}
                        <code
                          style={{
                            padding: "1px 4px",
                            backgroundColor:
                              "var(--vscode-textCodeBlock-background)",
                            borderRadius: "2px",
                            fontFamily:
                              "var(--vscode-editor-font-family, monospace)",
                          }}
                        >
                          {folderPath}
                        </code>{" "}
                        is empty (no files or folders inside).
                      </span>
                    </div>
                  );
                }

                // Use TreeBlock for non-empty folders
                // If we have raw JSON tree data, use it directly
                if (rawTreeData && Array.isArray(rawTreeData)) {
                  return (
                    <TreeBlock
                      files={rawTreeData}
                      onFileClick={(fullPath) =>
                        extensionService.postMessage({
                          command: "openFile",
                          path: fullPath,
                        })
                      }
                    />
                  );
                }

                const lines = codeContent.split("\n").filter(Boolean);
                const filePaths = lines
                  .map((line) => line.trim())
                  .filter((line) => line && !line.startsWith("//"));

                // Build tree structure
                interface FileNode {
                  name: string;
                  type: "file" | "folder";
                  path: string;
                  children?: FileNode[];
                }

                const buildTree = (paths: string[]): FileNode[] => {
                  const root: FileNode = {
                    name: "",
                    type: "folder",
                    path: "",
                    children: [],
                  };

                  for (const fullPath of paths) {
                    const segments = fullPath.split("/").filter(Boolean);
                    let currentNode = root;

                    segments.forEach((segment, index) => {
                      // Determine if this is a file by checking if it has an extension
                      // Also check if it's the last segment
                      const isLastSegment = index === segments.length - 1;
                      const hasExtension = segment.includes(".");
                      const isFile = isLastSegment && hasExtension;

                      if (!currentNode.children) {
                        currentNode.children = [];
                      }

                      let childNode = currentNode.children.find(
                        (child) => child.name === segment,
                      );

                      if (!childNode) {
                        const pathSoFar = segments
                          .slice(0, index + 1)
                          .join("/");
                        childNode = {
                          name: segment,
                          type: isFile ? "file" : "folder",
                          path: pathSoFar,
                          children: isFile ? undefined : [],
                        };
                        currentNode.children.push(childNode);
                      }

                      if (!isFile) {
                        currentNode = childNode;
                      }
                    });
                  }

                  return root.children || [];
                };

                const treeData = buildTree(filePaths);

                return (
                  <TreeBlock
                    files={treeData}
                    onFileClick={(fullPath) =>
                      extensionService.postMessage({
                        command: "openFile",
                        path: fullPath,
                      })
                    }
                  />
                );
              })()}
          </>
        )}

      {/* find_files results rendering */}
      {(() => {
        const shouldRender =
          !shouldHideContent &&
          toolType === "find_files" &&
          codeContent &&
          !isError &&
          !isCollapsed;

        return shouldRender ? (
          <div
            style={{
              marginTop: "8px",
            }}
          >
            {(() => {
              // Parse file paths from output
              const lines = codeContent.split("\n");
              const filePaths: string[] = [];

              for (const line of lines) {
                // Match file path like "- src/components/file.tsx"
                if (line.startsWith("- ")) {
                  const filePath = line.substring(2).trim();
                  if (filePath) {
                    filePaths.push(filePath);
                  }
                }
              }

              if (filePaths.length === 0) {
                return (
                  <div
                    style={{
                      padding: "10px 12px",
                      backgroundColor:
                        "var(--vscode-editor-background, var(--vscode-textCodeBlock-background))",
                      border:
                        "1px solid var(--vscode-widget-border, rgba(255,255,255,0.08))",
                      borderRadius: "4px",
                      color: "var(--vscode-descriptionForeground)",
                      opacity: 0.7,
                      fontStyle: "italic",
                      fontSize: "11px",
                    }}
                  >
                    No files found matching the search criteria.
                  </div>
                );
              }

              // Convert flat list to tree structure
              interface FileNode {
                name: string;
                type: "file" | "folder";
                path: string;
                children?: FileNode[];
              }

              const buildTree = (paths: string[]): FileNode[] => {
                const root: FileNode = {
                  name: "",
                  type: "folder",
                  path: "",
                  children: [],
                };

                for (const fullPath of paths) {
                  const segments = fullPath.split("/").filter(Boolean);
                  let currentNode = root;

                  segments.forEach((segment, index) => {
                    const isFile = index === segments.length - 1;

                    if (!currentNode.children) {
                      currentNode.children = [];
                    }

                    let childNode = currentNode.children.find(
                      (child) => child.name === segment,
                    );

                    if (!childNode) {
                      const pathSoFar = segments.slice(0, index + 1).join("/");
                      childNode = {
                        name: segment,
                        type: isFile ? "file" : "folder",
                        path: pathSoFar,
                        children: isFile ? undefined : [],
                      };
                      currentNode.children.push(childNode);
                    }

                    if (!isFile) {
                      currentNode = childNode;
                    }
                  });
                }

                return root.children || [];
              };

              const treeData = buildTree(filePaths);

              return (
                <div
                  style={{
                    padding: "10px 12px",
                    backgroundColor:
                      "var(--vscode-editor-background, var(--vscode-textCodeBlock-background))",
                    border:
                      "1px solid var(--vscode-widget-border, rgba(255,255,255,0.08))",
                    borderRadius: "4px",
                    maxHeight: "400px",
                    overflowY: "auto",
                  }}
                >
                  <TreeBlock
                    files={treeData}
                    onFileClick={(path) => {
                      extensionService.postMessage({
                        command: "openFile",
                        path,
                      });
                    }}
                  />
                </div>
              );
            })()}
          </div>
        ) : null;
      })()}
      {/* Streaming preview for write_to_file and replace_in_file */}
      {(() => {
        if (
          !shouldHideContent &&
          !isGrepTool &&
          isPartial &&
          (toolType === "write_to_file" || toolType === "replace_in_file")
        ) {
          let streamingContent = "";

          if (toolType === "write_to_file") {
            streamingContent = action.params.content || "";
          } else if (toolType === "replace_in_file") {
            // For replace_in_file, show both old_str and new_str for streaming effect
            const oldStr = action.params.old_str || "";
            const newStr = action.params.new_str || "";
            const diff = action.params.diff || "";

            if (oldStr || newStr) {
              // Show diff-like format with old and new content
              streamingContent = `<<<<<<< OLD\n${oldStr}\n${newStr}`;
            } else if (diff) {
              // Fallback to legacy diff format
              streamingContent = diff;
            }
          }

          // Only show if there's actual content streaming
          if (!streamingContent || streamingContent.trim().length === 0) {
            return null;
          }

          return (
            <div style={{}}>
              <FileStreamingBlock
                content={streamingContent}
                maxHeight={STREAM_BOX_HEIGHT}
              />
            </div>
          );
        }

        return null;
      })()}

      {/* Grep tool results — rendered inside the main flow with ToolHeader */}
      {isGrepTool && (
        <>
          {/* GrepBlock renders the content; header is handled above */}
          <GrepBlock
            action={action}
            actionId={actionId}
            toolOutputs={toolOutputs}
            isPartial={!!isPartial}
            isCompleted={grepCompleted}
            isError={isError}
            errorMessage={grepErrorMsg}
            conversationId={conversationId}
            allMessages={allMessages}
            isCollapsed={isGrepCollapsed}
            onToggleCollapse={() => setIsGrepCollapsed((v) => !v)}
          />
          {/* Raw viewer for Grep tool */}
          {showRawView && (
            <div
              style={{
                marginTop: "4px",
                padding: "8px 12px",
                backgroundColor:
                  "var(--vscode-editor-background, var(--vscode-textCodeBlock-background))",
                border:
                  "1px solid var(--vscode-widget-border, rgba(255,255,255,0.08))",
                borderRadius: "4px",
                fontFamily: "var(--vscode-editor-font-family, monospace)",
                fontSize: "11px",
                lineHeight: "1.5",
                color: "var(--vscode-editor-foreground)",
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
                overflowX: "auto",
              }}
            >
              {action.rawXml || JSON.stringify(action, null, 2)}
            </div>
          )}
        </>
      )}

      {/* DEBUG: Log final state */}
      {React.useMemo(() => {
        if (
          (toolType === "read_file" ||
            toolType === "write_to_file" ||
            toolType === "replace_in_file") &&
          isCompleted &&
          !isPartial &&
          mergedDiagnostics
        ) {
        }
        return null;
      }, [mergedDiagnostics, isCompleted, isPartial, toolType, actionId])}
    </div>
  );
};

export default FileToolRenderer;
