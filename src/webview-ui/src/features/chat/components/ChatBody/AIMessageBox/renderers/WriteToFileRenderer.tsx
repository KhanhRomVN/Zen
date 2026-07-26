import React from "react";

// HOOKS
import { useSettings } from "@/context/SettingsContext";

// SERVICES
import { extensionService } from "@/services/ExtensionService";

// CONSTANTS
import {
  STREAM_BOX_HEIGHT,
  getToolLabel,
  TOOL_ACTION_TYPES,
} from "@/features/chat/constants/constants";

// TYPES
import { Diagnostic } from "@/features/chat/types/renderer-types";

// UTILS
import {
  collectConvFilePaths,
  getNextUserMessage,
} from "../../../../utils/renderer-utils";
import { getPermissionDecision } from "@/features/chat/utils/permissionUtils";

// ICONS
import FileIcon from "@/icons/FileIcon";

// COMPONENTS
import { TagHeader } from "../TagHeader";
import ExecuteButton from "../ExecuteButton";
import ErrorBlock from "../blocks/error/ErrorBlock";
import { CodeBlock } from "../blocks/code/CodeBlock";
// FileStreamingBlock removed - no longer used (isPartial is false)
import { MergedRendererProps } from "@/features/chat/types/renderer-types";

// Helper: map file extension to language for CodeBlock header
const getLanguageFromPath = (filePath: string): string | undefined => {
  const ext = filePath.split(".").pop()?.toLowerCase();
  if (!ext) return undefined;
  const extToLang: Record<string, string> = {
    ts: "typescript",
    tsx: "tsx",
    js: "javascript",
    jsx: "jsx",
    py: "python",
    java: "java",
    cpp: "cpp",
    c: "c",
    go: "go",
    rs: "rust",
    rb: "ruby",
    php: "php",
    swift: "swift",
    kt: "kotlin",
    html: "html",
    css: "css",
    scss: "scss",
    json: "json",
    yaml: "yaml",
    yml: "yml",
    xml: "xml",
    md: "markdown",
    sql: "sql",
    sh: "shell",
    bash: "shell",
    ps1: "powershell",
    dockerfile: "dockerfile",
  };
  return extToLang[ext];
};

export const WriteToFileRenderer: React.FC<MergedRendererProps> = ({
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
  const [cachedDiagnostics, setCachedDiagnostics] = React.useState<
    Diagnostic[] | null
  >(null);
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

  // Get diagnostics from toolOutputs
  const mergedDiagnostics = React.useMemo(() => {
    const shouldGetDiagnostics = isCompleted && !isPartial;

    if (!shouldGetDiagnostics) return undefined;

    const toolOutputDiagnostics = toolOutputs?.[actionId]?.diagnostics;

    if (!toolOutputDiagnostics) {
      return undefined;
    }

    const normalized = toolOutputDiagnostics.map((d: any) => {
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

    return normalized;
  }, [toolOutputs, actionId, isCompleted, isPartial]);

  // Fetch diagnostics from extension
  React.useEffect(() => {
    const shouldFetchDiagnostics = rawPath && isCompleted && !isPartial;

    if (!shouldFetchDiagnostics) return;

    const baseRequestId = `diagnostics-${actionId}`;
    let retryCount = 0;
    const maxRetries = 2;
    const retryDelay = 300;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;

    const handleMessage = (event: MessageEvent) => {
      const msg = event.data;
      if (
        msg.command === "getDiagnosticsResult" &&
        msg.requestId?.startsWith(baseRequestId)
      ) {
        if (msg.diagnostics && Array.isArray(msg.diagnostics)) {
          if (msg.diagnostics.length > 0) {
            setCachedDiagnostics(msg.diagnostics);
            window.removeEventListener("message", handleMessage);
            if (timeoutId !== null) clearTimeout(timeoutId);
          } else {
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
              setCachedDiagnostics([]);
              window.removeEventListener("message", handleMessage);
            }
          }
        }
      }
    };

    window.addEventListener("message", handleMessage);

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
  }, [rawPath, isCompleted, isPartial, actionId]);

  // Check if action has validation error
  const hasValidationError = !!action.isError;

  // Debug logs
  const permissionDecision = getPermissionDecision(
    permissionMode,
    "write_to_file",
  );

  const handleToolClickWithLog = React.useCallback(
    (e: React.MouseEvent, type: any) => {
      onToolClick(action, messageId, actionIndex, type);
    },
    [action, messageId, actionIndex, onToolClick, actionId, rawPath],
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        paddingBottom: "4px",
        marginBottom: isLastItemInList ? "0" : "2px",
      }}
    >
      <TagHeader
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
              {getToolLabel("write_to_file")}
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
        diagnostics={mergedDiagnostics}
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
      />

      {/* Show code content in approval mode — only when not completed */}
      {!isCompleted &&
        getPermissionDecision(permissionMode, "write_to_file") === "confirm" && (
          <CodeBlock
            code={action.params.content || ""}
            language={getLanguageFromPath(rawPath)}
            maxHeight="400px"
          />
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

      {/* Show error message when there's an error */}
      {!isPartial && (hasValidationError || isError) && (
        <ErrorBlock
          content={
            hasValidationError && action.errorMessage
              ? `Validation Error: ${action.errorMessage}`
              : isError && errorMessage
                ? errorMessage
                : "Unknown error occurred"
          }
          compact={true}
          maxHeight="300px"
        />
      )}

      {!shouldHideContent &&
        !isCompleted &&
        !isPartial &&
        !hasValidationError &&
        !isError &&
        getPermissionDecision(permissionMode, "write_to_file") ===
          "confirm" && (
          <ExecuteButton
            isActive={true}
            isCompleted={!!isCompleted}
            isLastMessage={!!isLastMessage}
            isLoading={false}
            title="Approve action"
            labelText="Approve"
            hasError={false}
            onExecute={handleToolClickWithLog}
          />
        )}

      {/* Show Skip button when there's an error in approve mode */}
      {!shouldHideContent &&
        !isCompleted &&
        !isPartial &&
        (hasValidationError || isError) &&
        getPermissionDecision(permissionMode, "write_to_file") ===
          "confirm" && (
          <ExecuteButton
            isActive={false}
            isCompleted={false}
            isLastMessage={!!isLastMessage}
            isLoading={false}
            title="Skip this tool due to error"
            labelText="Skip this tool because of error"
            hasError={true}
            onExecute={(e, type) => {
              // Execute with reject type to skip
              onToolClick(action, messageId, actionIndex, TOOL_ACTION_TYPES.REJECT);
            }}
          />
        )}
    </div>
  );
};
