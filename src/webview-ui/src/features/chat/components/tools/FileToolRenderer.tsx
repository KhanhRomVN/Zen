import React, { useEffect, useRef } from "react";
import { ToolAction } from "../../services/ResponseParser";
import FileIcon from "@/icons/FileIcon";
import { ToolHeader } from "./ToolHeader";
import { parseDiff } from "../../../../utils/diffUtils";
import { getFilename, getToolColor } from "../../utils/toolUtils";
import { getDisplayPath, collectConvFilePaths } from "../../utils/pathUtils";
import { extensionService } from "../../../../services/ExtensionService";
import { Message } from "../../types/message";
import ExecuteButton from "./ExecuteButton";
import { useI18n } from "../../../../hooks/useI18n";
import { useSettings } from "../../../../context/SettingsContext";
import { RichtextBlock } from "../blocks/richtext/RichtextBlock";
import FileStreamingBlock from "../blocks/file_streaming/FileStreamingBlock";
import ErrorBlock from "../blocks/error/ErrorBlock";
import { GrepBlock } from "../blocks/grep/GrepBlock";
import { getPermissionDecision } from "../../utils/permissionUtils";

// Fixed-height streaming preview box shown while write_to_file / replace_in_file is streaming.
// Auto-scrolls to bottom as new content arrives. Hidden once streaming finishes.
const STREAM_BOX_HEIGHT = 154; // px — 120 base + 2 extra lines (≈17px/line)

const StreamingPreviewBox: React.FC<{ content: string }> = ({ content }) => {
  const boxRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom whenever content grows
  useEffect(() => {
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
      {/* Blinking cursor at the end */}
      <span
        style={{
          display: "inline-block",
          width: "6px",
          height: "12px",
          background: "var(--vscode-editor-foreground)",
          marginLeft: "1px",
          verticalAlign: "middle",
          animation: "zen-cursor-blink 0.6s step-end infinite",
        }}
      />
      <style>{`
        @keyframes zen-cursor-blink {
          0%, 100% { opacity: 0.8; }
          50%       { opacity: 0; }
        }
      `}</style>
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
  toolOutputs?: Record<string, { output: string; isError: boolean }>;
  allMessages?: Message[];
  fileStatsMap: Record<string, { lines: number; loading: boolean }>;
  onToolClick: (
    action: ToolAction,
    messageId: string,
    index: number,
    type: "accept_all" | "accept_once" | "reject",
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
  const { t } = useI18n();
  const { permissionMode } = useSettings();
  const toolType = action.type;
  const toolColor = getToolColor(toolType);
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
  if (toolType === "list_files") {
    codeContent = toolOutputs?.[actionId]?.output || "";
  }

  let diffStats: { added: number; removed: number } | null = null;
  // replace_in_file diff stats are now handled by ReplaceInFileRenderer

  let linesCount =
    action.type === "write_to_file"
      ? action.params.content?.split("\n").length || 0
      : 0;

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

  const isPartial = action.isPartial;
  const isError = !!toolOutputs?.[actionId]?.isError;
  const errorMessage = isError ? toolOutputs?.[actionId]?.output || "" : "";

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

  const diagnosticCount = React.useMemo(() => {
    return 0;
  }, []);

  const nextUserMessage = allMessages
    ? allMessages
        .slice(allMessages.findIndex((m) => m.id === messageId) + 1)
        .find((m) => m.role === "user")
    : undefined;

  const isWriteOrEditTool =
    toolType === "delete_file" ||
    toolType === "delete_folder" ||
    toolType === "move_file";
  const isGrepTool = toolType === "grep";
  const isCompleted: boolean = Boolean(
    !isPartial &&
    (!!isActionClicked ||
      isError ||
      (isWriteOrEditTool
        ? !!toolOutputs?.[actionId] || !!nextUserMessage
        : (codeContent && codeContent.trim().length > 0) || !!nextUserMessage)),
  );

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
      ? t("tools.list")
      : toolType === "grep"
        ? "GREP"
        : toolType === "delete_file"
          ? t("tools.delete")
          : toolType === "delete_folder"
            ? t("tools.delete")
            : toolType === "move_file"
              ? "MOVE"
              : t("tools.read");
  // For grep tool, we'll render in the main flow with ToolHeader
  const grepCompleted =
    isGrepTool &&
    !isPartial &&
    (isActionClicked ||
      isError ||
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
      className="timeline-item"
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
                width: "100%",
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
              {isHeaderHovered && (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowRawView(!showRawView);
                  }}
                  style={{
                    marginLeft: "8px",
                    fontSize: "10px",
                    opacity: 0.6,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    fontWeight: 500,
                    textDecoration: "underline",
                    textUnderlineOffset: "2px",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = "1";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = "0.6";
                  }}
                >
                  {showRawView ? "Hide raw" : "View raw"}
                </span>
              )}
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
                width: "100%",
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
              <FileIcon
                path={rawPath}
                isFolder={
                  toolType === "list_files" || !!action.params.folder_path
                }
                style={{ width: "16px", height: "16px", cursor: "pointer" }}
              />
              <span
                style={{
                  fontWeight: 500,
                  opacity: 0.9,
                  fontFamily: "var(--vscode-editor-font-family, monospace)",
                  fontSize: "11px",
                  cursor: "pointer",
                  transition: "text-decoration 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.textDecoration = "underline";
                  e.currentTarget.style.textUnderlineOffset = "2px";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.textDecoration = "none";
                }}
              >
                {displayName}
              </span>
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
              {/* diffStats removed — replace_in_file is now handled by ReplaceInFileRenderer */}
              {linesCount > 0 && (
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
              {isHeaderHovered && (
                <span
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowRawView(!showRawView);
                  }}
                  style={{
                    marginLeft: "8px",
                    fontSize: "10px",
                    opacity: 0.6,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    fontWeight: 500,
                    textDecoration: "underline",
                    textUnderlineOffset: "2px",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = "1";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = "0.6";
                  }}
                >
                  {showRawView ? "Hide raw" : "View raw"}
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
        diffStats={undefined}
        isPartial={isPartial}
        onClick={() => {
          // replace_in_file is now handled by ReplaceInFileRenderer
          setIsCollapsed((v) => !v);
          if (rawPath && toolType !== "list_files") {
            extensionService.postMessage({
              command: "openFile",
              path: rawPath,
            });
          }
        }}
        path={rawPath}
        onPathClick={(clickedPath) => {
          // Always open file when clicking on the path itself
          extensionService.postMessage({
            command: "openFile",
            path: clickedPath,
          });
        }}
      />

      {/* Raw tool data viewer - showing raw XML without header */}
      {!isGrepTool && showRawView && (
        <div
          style={{
            marginTop: "4px",
            marginLeft: "29px",
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
              toolColor={toolColor}
              title="Approve action"
              labelText={t("tools.approve")}
              onExecute={(e, type) => {
                onToolClick(action, messageId, actionIndex, type);
              }}
            />
          </div>
        )}

      {!shouldHideContent && isError && errorMessage && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "6px",
            padding: "5px 8px",
            marginLeft: "29px",
            backgroundColor:
              "color-mix(in srgb, var(--vscode-errorForeground, #f44336) 4%, transparent)",
            border:
              "1px solid color-mix(in srgb, var(--vscode-errorForeground, #f44336) 20%, transparent)",
            borderRadius: "4px",
            marginTop: "2px",
          }}
        >
          <span
            className="codicon codicon-error"
            style={{
              fontSize: "11px",
              color: "var(--vscode-errorForeground, #f44336)",
              opacity: 0.7,
              marginTop: "1px",
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: "11px",
              color: "var(--vscode-errorForeground, #f44336)",
              opacity: 0.85,
              fontFamily: "var(--vscode-editor-font-family, monospace)",
              wordBreak: "break-word",
            }}
          >
            {errorMessage}
          </span>
        </div>
      )}

      {!shouldHideContent && toolType === "list_files" && codeContent && (
        <>
          {!isCollapsed && (
            <RichtextBlock
              content={codeContent}
              showHeader={false}
              maxHeight={300}
              defaultCollapsed={false}
              isFilePathList={true}
              basePath={action.params.path || action.params.folder_path || ""}
              onFileClick={(fullPath) =>
                extensionService.postMessage({
                  command: "openFile",
                  path: fullPath,
                })
              }
            />
          )}
        </>
      )}
      {/* Streaming preview — replace_in_file is now handled by ReplaceInFileRenderer */}

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
                marginLeft: "29px",
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
    </div>
  );
};

export default FileToolRenderer;
