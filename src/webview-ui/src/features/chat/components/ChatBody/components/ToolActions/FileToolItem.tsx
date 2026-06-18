import React, { useEffect, useRef, useState } from "react";
import { ToolAction } from "../../../../services/ResponseParser";
import FileIcon from "../FileIcon";
import { RichtextBlock } from "../RichtextBlock";
import { ToolHeader } from "../ToolHeader";
import { parseDiff } from "../../../../../../utils/diffUtils";
import {
  getFilename,
  getToolColor,
  getDisplayPath,
  collectConvFilePaths,
} from "../../../../utils/utils";
import {
  extensionService,
  messageDispatcher,
} from "../../../../../../services/ExtensionService";
import { Message } from "../../../../types";
import ExecuteButton from "./ExecuteButton";
import { useI18n } from "../../../../../../hooks/useI18n";
import { useSettings } from "../../../../../../context/SettingsContext";
import { getPermissionDecision } from "../../../../hooks/useToolExecution";
import GrepBlock from "../GrepBlock";
import FilePreviewBlock from "./FilePreviewBlock";

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

interface FileToolItemProps {
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

const FileToolItem: React.FC<FileToolItemProps> = ({
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
  const [isSnapshotLoading, setIsSnapshotLoading] = React.useState(false);
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
  const displayName = rawPath ? getDisplayPath(rawPath, allPaths) : "";

  // write_to_file on a new file (CREATE) has no before-snapshot, so treat it as a plain open
  const isCreateNew = toolType === "write_to_file" && !fileStatsMap[rawPath];
  const isSnapshotTool =
    (toolType === "write_to_file" || toolType === "replace_in_file") &&
    !isCreateNew;

  // Fetch snapshot then open diff tab in VSCode editor
  const openSnapshotInEditor = React.useCallback(() => {
    if (!conversationId || !actionId || isSnapshotLoading) return;
    setIsSnapshotLoading(true);
    const requestId = `snapshot-${Date.now()}-${Math.random()}`;
    extensionService.postMessage({
      command: "getSnapshot",
      conversationId,
      actionId,
      requestId,
    });
    messageDispatcher.register(
      requestId,
      (msg) => {
        setIsSnapshotLoading(false);
        if (!msg.error) {
          extensionService.postMessage({
            command: "openSnapshotDiff",
            filePath: msg.filePath,
            operation: msg.operation,
            beforeContent: msg.beforeContent,
            afterContent: msg.afterContent,
            actionId,
          });
        } else {
          // Fallback: just open the file
          if (rawPath)
            extensionService.postMessage({
              command: "openFile",
              path: rawPath,
            });
        }
      },
      10000,
      () => {
        setIsSnapshotLoading(false);
        if (rawPath)
          extensionService.postMessage({ command: "openFile", path: rawPath });
      },
    );
  }, [conversationId, actionId, isSnapshotLoading, rawPath]);

  let codeContent = "";
  if (toolType === "list_files" || toolType === "search_files") {
    codeContent = toolOutputs?.[actionId]?.output || "";
  }

  let diffStats: { added: number; removed: number } | null = null;
  if (action.type === "replace_in_file" && action.params.diff) {
    diffStats = parseDiff(action.params.diff).stats;
  }

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

  // Count diagnostics from read_file output
  const diagnosticCount = React.useMemo(() => {
    if (toolType !== "read_file") return 0;
    const output = toolOutputs?.[actionId]?.output || "";
    const diagIdx = output.indexOf("⚠️ **Diagnostics Found:**");
    if (diagIdx === -1) return 0;
    const diagSection = output
      .slice(diagIdx + "⚠️ **Diagnostics Found:**".length)
      .trim();
    if (!diagSection) return 0;
    return diagSection.split("\n").filter((l) => l.trim().length > 0).length;
  }, [toolType, toolOutputs, actionId]);

  const nextUserMessage = allMessages
    ? allMessages
        .slice(allMessages.findIndex((m) => m.id === messageId) + 1)
        .find((m) => m.role === "user")
    : undefined;

  const isWriteOrEditTool =
    toolType === "write_to_file" ||
    toolType === "replace_in_file" ||
    toolType === "delete_file" ||
    toolType === "delete_folder";
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
  const isWriteOrEditOnly =
    toolType === "write_to_file" || toolType === "replace_in_file";
  const shouldHideContent =
    isWriteOrEditOnly && isCompleted && isActionClicked && !isPartial;

  const prefix =
    toolType === "replace_in_file"
      ? t("tools.update")
      : toolType === "write_to_file"
        ? fileStatsMap[rawPath]
          ? t("tools.rewrite")
          : t("tools.create")
        : toolType === "list_files"
          ? t("tools.list")
          : toolType === "search_files"
            ? t("tools.search")
            : toolType === "grep"
              ? "GREP"
              : toolType === "delete_file"
                ? t("tools.delete")
                : toolType === "delete_folder"
                  ? t("tools.delete")
                  : t("tools.read");

  // For grep tool, render GrepBlock component
  if (isGrepTool) {
    const grepCompleted =
      !isPartial &&
      (isActionClicked ||
        isError ||
        !!toolOutputs?.[actionId] ||
        !!nextUserMessage);
    const errorMsg = isError ? toolOutputs?.[actionId]?.output || "" : "";

    return (
      <GrepBlock
        action={action}
        actionId={actionId}
        toolOutputs={toolOutputs}
        isPartial={!!isPartial}
        isCompleted={grepCompleted}
        isError={isError}
        errorMessage={errorMsg}
        conversationId={conversationId}
        allMessages={allMessages}
      />
    );
  }

  return (
    <div
      className="timeline-item"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        paddingLeft: "29px",
        paddingBottom: isLastItemInList
          ? isLastMessage
            ? "0px"
            : "12px"
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
                toolType === "list_files" || !!action.params.folder_path
              }
              style={{ width: "16px", height: "16px" }}
            />
            <span
              style={{
                fontWeight: 500,
                opacity: 0.9,
                fontFamily: "var(--vscode-editor-font-family, monospace)",
                fontSize: "11px",
              }}
            >
              {displayName}
              {toolType === "read_file" &&
                (() => {
                  const sl = action.params.start_line;
                  const el = action.params.end_line;
                  const totalLines = fileStatsMap[rawPath]?.lines;
                  if (sl !== undefined && sl !== null && sl !== "") {
                    const start = parseInt(String(sl), 10) + 1; // convert 0-based to 1-based
                    const end =
                      el !== undefined && el !== null && el !== ""
                        ? parseInt(String(el), 10) + 1
                        : totalLines;
                    return (
                      <span
                        style={{
                          opacity: 0.55,
                          fontSize: "10px",
                          marginLeft: "2px",
                        }}
                      >
                        ({start}-{end ?? "?"})
                      </span>
                    );
                  }
                  if (totalLines) {
                    return (
                      <span
                        style={{
                          opacity: 0.55,
                          fontSize: "10px",
                          marginLeft: "2px",
                        }}
                      >
                        (1-{totalLines})
                      </span>
                    );
                  }
                  return null;
                })()}
              {toolType === "read_file" && diagnosticCount > 0 && (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "2px",
                    marginLeft: "5px",
                    padding: "0 4px",
                    backgroundColor:
                      "color-mix(in srgb, var(--vscode-errorForeground, #f14c4c) 15%, transparent)",
                    color: "var(--vscode-errorForeground, #f14c4c)",
                    borderRadius: "3px",
                    fontSize: "10px",
                    fontWeight: 600,
                    lineHeight: "16px",
                  }}
                >
                  <span
                    className="codicon codicon-error"
                    style={{ fontSize: "9px" }}
                  />
                  {diagnosticCount}
                </span>
              )}
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
          </div>
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
          if (isSnapshotTool && isCompleted && !isPartial) {
            openSnapshotInEditor();
          } else {
            setIsCollapsed((v) => !v);
            if (
              rawPath &&
              toolType !== "list_files" &&
              toolType !== "search_files"
            ) {
              extensionService.postMessage({
                command: "openFile",
                path: rawPath,
              });
            }
          }
        }}
      />

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
              onExecute={(e, type) =>
                onToolClick(action, messageId, actionIndex, type)
              }
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

      {!shouldHideContent &&
        (toolType === "list_files" || toolType === "search_files") &&
        codeContent && (
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
      {/* Streaming preview — visible while AI is still writing the file OR waiting for approval */}
      {!shouldHideContent &&
        (isPartial ||
          ((toolType === "write_to_file" || toolType === "replace_in_file") &&
            !isCompleted &&
            isActiveGroup)) &&
        (() => {
          const streamContent =
            toolType === "write_to_file"
              ? action.params.content || ""
              : action.params.diff || "";
          if (!streamContent) return null;

          const isWaitingForApproval =
            !isPartial &&
            (toolType === "write_to_file" || toolType === "replace_in_file") &&
            !isCompleted &&
            isActiveGroup;

          return (
            <FilePreviewBlock
              content={streamContent}
              isStreaming={isPartial && !isWaitingForApproval}
              maxHeight={200}
            />
          );
        })()}
    </div>
  );
};

export default FileToolItem;
