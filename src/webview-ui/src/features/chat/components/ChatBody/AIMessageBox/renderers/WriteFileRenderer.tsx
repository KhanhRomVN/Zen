import React from "react";

// HOOKS
import { useSettings } from "@/context/SettingsContext";

// SERVICES
import { extensionService } from "@/services/ExtensionService";

// CONSTANTS
import {
  STREAM_BOX_HEIGHT,
  TOOL_ACTION_TYPES,
} from "@/features/chat/constants/constants";

// TYPES

// UTILS
import {
  collectConvFilePaths,
  getNextUserMessage,
} from "../../../../utils/renderer-utils";
import { getPermissionDecision } from "@/features/chat/utils/permissionUtils";

// ICONS
import FileIcon from "@/icons/FileIcon";

// COMPONENTS
import { ToolHeader } from "../ToolHeader";
import ExecuteButton from "../ExecuteButton";
import ErrorBlock from "../blocks/error/ErrorBlock";
import FileStreamingBlock from "../blocks/file_streaming/FileStreamingBlock";
import { MergedRendererProps } from "@/features/chat/types/renderer-types";

export const WriteFileRenderer: React.FC<MergedRendererProps> = ({
  action,
  actionIndex,
  messageId,
  isActionClicked,
  isActiveGroup,
  isLastMessage,
  isLastItemInList,
  toolOutputs,
  allMessages,
  onToolClick,
  singleLineReviewActions,
  onConfirmSingleLineAction,
  onRejectSingleLineAction,
}) => {
  const [isCollapsed, setIsCollapsed] = React.useState(true);
  const [showRawView, setShowRawView] = React.useState(false);
  const { permissionMode } = useSettings();

  const actionId = `${messageId}-action-${actionIndex}`;
  const rawPath = action.params.file_path || action.params.path || "";
  const displayName = rawPath ? rawPath.split("/").pop() || rawPath : "";

  const allPaths = React.useMemo(
    () => collectConvFilePaths(allMessages || []),
    [allMessages],
  );

  const nextUserMessage = getNextUserMessage(allMessages || [], messageId);

  const isPartial = false;
  const isError = !!toolOutputs?.[actionId]?.isError;
  const errorMessage = isError ? toolOutputs?.[actionId]?.output || "" : "";

  const linesCount = action.params.content?.split("\n").length || 0;

  const isCompleted = Boolean(
    !isPartial &&
    (!!isActionClicked ||
      isError ||
      !!toolOutputs?.[actionId] ||
      !!nextUserMessage),
  );

  const shouldHideContent = false;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        paddingBottom: "4px",
        marginBottom: isLastItemInList ? "0" : "2px",
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
            <span
              style={{
                fontWeight: 600,
                opacity: 0.8,
                cursor: "pointer",
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (rawPath) {
                  const content = action.params.content || "";
                  extensionService.postMessage({
                    command: "openWriteToFile",
                    filePath: rawPath,
                    content,
                  });
                }
              }}
            >
              WRITE
            </span>
            <span
              onClick={(e) => {
                e.stopPropagation();
                if (rawPath) {
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
                isFolder={false}
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
              }}
              onClick={(e) => {
                e.stopPropagation();
                if (rawPath) {
                  const content = action.params.content || "";
                  extensionService.postMessage({
                    command: "openWriteToFile",
                    filePath: rawPath,
                    content,
                  });
                }
              }}
            >
              {displayName || (isPartial && !rawPath ? "..." : "")}
            </span>
            {linesCount > 0 && (
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
          </div>
        }
        statusColor={
          isError
            ? "var(--vscode-errorForeground)"
            : isCompleted
              ? "var(--vscode-gitDecoration-addedResourceForeground, #3fb950)"
              : isActiveGroup
                ? "var(--vscode-descriptionForeground)"
                : "var(--vscode-descriptionForeground)"
        }
        isError={isError}
        isWaitingApproval={!!isActiveGroup && !isCompleted}
        toolType="write_to_file"
        tooltipMeta={{
          lineCount: linesCount,
        }}
        isPartial={isPartial}
        onClick={() => {
          setIsCollapsed((v) => !v);
          if (rawPath) {
            extensionService.postMessage({
              command: "openFile",
              path: rawPath,
            });
          }
        }}
        path={rawPath}
        onPathClick={(clickedPath) => {
          extensionService.postMessage({
            command: "openFile",
            path: clickedPath,
          });
        }}
        onDotClick={() => {
          setShowRawView(!showRawView);
        }}
      />

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

      {/* Single-line review UI for write_to_file with content crammed into 1 line */}
      {!shouldHideContent &&
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
        getPermissionDecision(permissionMode, "write_to_file") ===
          "confirm" && (
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

      {!shouldHideContent && isError && errorMessage && (
        <ErrorBlock content={errorMessage} compact={true} maxHeight="300px" />
      )}

      {/* Streaming preview for write_to_file */}
      {!shouldHideContent &&
        isPartial &&
        (() => {
          const streamingContent = action.params.content || "";

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
        })()}
    </div>
  );
};
