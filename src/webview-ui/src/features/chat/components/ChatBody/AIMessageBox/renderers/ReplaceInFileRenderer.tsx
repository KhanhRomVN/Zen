import React from "react";

// HOOKS
import { useSettings } from "@/context/SettingsContext";

// SERVICES
import { extensionService } from "@/services/ExtensionService";

// CONSTANTS
import {
  getToolLabel,
  TOOL_ACTION_TYPES,
} from "@/features/chat/constants/constants";

// TYPES
import {
  MergedRendererProps,
  Diagnostic,
} from "@/features/chat/types/renderer-types";

// UTILS
import {
  collectConvFilePaths,
  getNextUserMessage,
} from "../../../../utils/renderer-utils";
import { getPermissionDecision } from "@/features/chat/utils/permissionUtils";
import { parseDiff, DiffHighlight } from "@/utils/diffUtils";

// ICONS
import { getFileIconPath } from "@/utils/fileIconMapper";

// COMPONENTS
import { TagHeader } from "../TagHeader";
import ActionBar from "../ActionBar";
import ErrorBlock from "../blocks/error/ErrorBlock";
import { CodeBlock } from "../blocks/code/CodeBlock";

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

export const ReplaceInFileRenderer: React.FC<MergedRendererProps> = ({
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
  mergedItems,
  conversationId,
  rejectedActions,
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

  // Use originalError if available (preserved from validation), otherwise use current output
  const errorMessage = isError
    ? toolOutputs?.[actionId]?.originalError ||
      toolOutputs?.[actionId]?.output ||
      ""
    : "";
  const diagnosticsMessage = toolOutputs?.[actionId]?.diagnosticsMessage;

  // Calculate diff stats
  let diffStats: { added: number; removed: number } | null = null;

  if (action.params.diff) {
    const stats = parseDiff(action.params.diff).stats;
    diffStats = { added: stats.added, removed: stats.removed };
  } else {
    const oldContent = action.params.old_content || action.params.old_str;
    const newContent = action.params.new_content || action.params.new_str;

    if (oldContent !== undefined && newContent !== undefined) {
      const oldLines = String(oldContent).split("\n");
      const newLines = String(newContent).split("\n");

      diffStats = {
        added: newLines.length,
        removed: oldLines.length,
      };
    } else {
      console.warn("[ReplaceInFileRenderer] No diff data available:", {
        filePath: rawPath,
        hasParams: !!action.params,
        paramKeys: Object.keys(action.params || {}),
        oldContentUndefined: oldContent === undefined,
        newContentUndefined: newContent === undefined,
      });
    }
  }

  // Handle merged items
  if (mergedItems && mergedItems.length > 1) {
    let totalAdded = 0,
      totalRemoved = 0;
    mergedItems.forEach(({ action: a }) => {
      if (a.type === "replace_in_file" && a.params.diff) {
        const s = parseDiff(a.params.diff).stats;
        totalAdded += s.added;
        totalRemoved += s.removed;
      }
    });
    if (totalAdded > 0 || totalRemoved > 0) {
      diffStats = { added: totalAdded, removed: totalRemoved };
    }
  }

  const isCompleted = Boolean(
    !isPartial &&
    (!!isActionClicked ||
      isError ||
      !!toolOutputs?.[actionId] ||
      !!nextUserMessage),
  );

  // Get version from toolOutputs - check merged items too
  const toolOutput = toolOutputs?.[actionId];
  let version = toolOutput?.version;

  // If no version found and we have merged items, check their outputs
  if (!version && mergedItems && mergedItems.length > 1) {
    for (const item of mergedItems) {
      const itemActionId = `${messageId}-action-${item.index}`;
      const itemOutput = toolOutputs?.[itemActionId];
      if (itemOutput?.version) {
        version = itemOutput.version;
        break;
      }
    }
  }

  // Get diagnostics from toolOutputs
  const mergedDiagnostics = React.useMemo(() => {
    const shouldGetDiagnostics = isCompleted && !isPartial;

    if (!shouldGetDiagnostics) return undefined;

    const toolOutputDiagnostics = toolOutputs?.[actionId]?.diagnostics;

    if (!toolOutputDiagnostics) {
      return undefined;
    }

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

  const shouldHideContent = false;

  // Check if action has validation error
  const hasValidationError = !!action.isError;

  // Check if action has been rejected (to hide error UI after rejection)
  const isRejected = rejectedActions?.has(actionId);

  // Debug logs
  const permissionDecision = getPermissionDecision(
    permissionMode,
    "replace_in_file",
  );

  // Fetch full file content for approval mode
  const [fullFileContent, setFullFileContent] = React.useState<string | null>(
    null,
  );

  React.useEffect(() => {
    if (permissionDecision !== "confirm" || !rawPath) {
      return;
    }

    const requestId = `file-content-${actionId}`;
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data;
      if (
        msg.command === "getFileContentResult" &&
        msg.requestId === requestId
      ) {
        setFullFileContent(msg.content || null);
      }
    };

    window.addEventListener("message", handleMessage);

    extensionService.postMessage({
      command: "getFileContent",
      path: rawPath,
      requestId,
    });

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [permissionDecision, rawPath, actionId]);

  // Build diff preview data for approval mode
  const approvalDiffData = React.useMemo(() => {
    if (permissionDecision !== "confirm") return null;

    // Calculate line highlights based on old/new content
    const oldContent = action.params.old_content || action.params.old_str;
    const newContent = action.params.new_content || action.params.new_str;

    if (!oldContent || !newContent) return null;

    // If we have full file content, show it with highlights
    if (fullFileContent) {
      // Find where old content appears in the file
      const fileLines = fullFileContent.split("\n");
      const oldLines = String(oldContent).trim().split("\n");
      const newLines = String(newContent).trim().split("\n");

      let startLineIndex = -1;

      // Try exact match first
      for (let i = 0; i <= fileLines.length - oldLines.length; i++) {
        let matches = true;
        for (let j = 0; j < oldLines.length; j++) {
          if (fileLines[i + j].trim() !== oldLines[j].trim()) {
            matches = false;
            break;
          }
        }
        if (matches) {
          startLineIndex = i;
          break;
        }
      }

      if (startLineIndex !== -1) {
        // Build new file content with both old and new lines for diff view
        const beforeLines = fileLines.slice(0, startLineIndex);
        const afterLines = fileLines.slice(startLineIndex + oldLines.length);

        // Merge: show old lines (removed) + new lines (added)
        const mergedLines = [
          ...beforeLines,
          ...oldLines,
          ...newLines,
          ...afterLines,
        ];
        const mergedContent = mergedLines.join("\n");

        // Build line highlights
        const lineHighlights: DiffHighlight[] = [];

        // Mark old lines as removed
        for (let i = 0; i < oldLines.length; i++) {
          lineHighlights.push({
            type: "removed",
            startLine: beforeLines.length + i + 1, // 1-based
            endLine: beforeLines.length + i + 1,
          });
        }

        // Mark new lines as added (after old lines)
        for (let i = 0; i < newLines.length; i++) {
          lineHighlights.push({
            type: "added",
            startLine: beforeLines.length + oldLines.length + i + 1, // 1-based
            endLine: beforeLines.length + oldLines.length + i + 1,
          });
        }

        return {
          code: mergedContent,
          lineHighlights,
        };
      } else {
        console.warn(
          "[ReplaceInFileRenderer] Old content not found in file, falling back to diff view",
        );
      }
    }

    // Fallback: show old/new content directly if full file not available
    const diffText =
      action.params.diff ||
      `<<<<<<< SEARCH\n${oldContent}\n=======\n${newContent}\n>>>>>>> REPLACE`;
    const parsed = parseDiff(diffText);

    return {
      code: parsed.code,
      lineHighlights: parsed.lineHighlights,
    };
  }, [
    permissionDecision,
    fullFileContent,
    action.params.old_content,
    action.params.old_str,
    action.params.new_content,
    action.params.new_str,
    action.params.diff,
  ]);

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
                  const oldContent =
                    action.params.old_content || action.params.old_str || "";
                  const newContent =
                    action.params.new_content || action.params.new_str || "";
                  extensionService.postMessage({
                    command: "openFileDiff",
                    filePath: rawPath,
                    oldContent,
                    newContent,
                  });
                }
              }}
            >
              {getToolLabel("replace_in_file")}
            </span>
            <span
              onClick={(e) => {
                e.stopPropagation();
                if (rawPath) {
                  const oldContent =
                    action.params.old_content || action.params.old_str || "";
                  const newContent =
                    action.params.new_content || action.params.new_str || "";
                  extensionService.postMessage({
                    command: "openFileDiff",
                    filePath: rawPath,
                    oldContent,
                    newContent,
                  });
                }
              }}
              style={{ display: "flex", alignItems: "center" }}
            >
              <img
                src={getFileIconPath(rawPath)}
                alt=""
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
                  const oldContent =
                    action.params.old_content || action.params.old_str || "";
                  const newContent =
                    action.params.new_content || action.params.new_str || "";
                  extensionService.postMessage({
                    command: "openFileDiff",
                    filePath: rawPath,
                    oldContent,
                    newContent,
                  });
                }
              }}
            >
              {displayName || (isPartial && !rawPath ? "..." : "")}
            </span>
            {diffStats && (diffStats.added > 0 || diffStats.removed > 0) && (
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
                {(() => {
                  return version && isCompleted ? (
                    <span
                      style={{
                        marginLeft: "6px",
                        opacity: 0.7,
                        fontSize: "10px",
                        fontWeight: 400,
                      }}
                    >
                      #{version}
                    </span>
                  ) : null;
                })()}
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
        toolType="replace_in_file"
        diffStats={undefined}
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

      {/* Show diff in CodeBlock when approval mode — only when not completed */}
      {!isCompleted && approvalDiffData && (
        <CodeBlock
          code={approvalDiffData.code}
          language={getLanguageFromPath(rawPath)}
          lineHighlights={
            approvalDiffData.lineHighlights.length > 0
              ? approvalDiffData.lineHighlights
              : undefined
          }
          autoScrollToDiff={true}
          maxHeight="400px"
          hideHeader={true}
        />
      )}

      {/* Show error message when there's an error */}
      {!isPartial && (hasValidationError || isError) && !isRejected && (
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

      {/* Show diagnostics message if present */}
      {!isPartial && isCompleted && diagnosticsMessage && (
        <div
          style={{
            padding: "8px 12px",
            fontSize: "11px",
            color: "var(--vscode-notificationsWarningIcon-foreground, #e5a100)",
            backgroundColor:
              "color-mix(in srgb, var(--vscode-notificationsWarningIcon-foreground, #e5a100) 10%, transparent)",
            border:
              "1px solid color-mix(in srgb, var(--vscode-notificationsWarningIcon-foreground, #e5a100) 30%, transparent)",
            borderRadius: "4px",
            display: "flex",
            alignItems: "flex-start",
            gap: "8px",
            lineHeight: "1.5",
          }}
        >
          <span
            className="codicon codicon-warning"
            style={{ fontSize: "12px", marginTop: "2px", flexShrink: 0 }}
          />
          <span>{diagnosticsMessage}</span>
        </div>
      )}

      {!shouldHideContent &&
        !isCompleted &&
        !isPartial &&
        getPermissionDecision(permissionMode, "replace_in_file") ===
          "confirm" && (
          <ActionBar
            action={action}
            messageId={messageId}
            actionIndex={actionIndex}
            hasError={hasValidationError || isError}
            isCompleted={isCompleted}
            onAction={(e, type) => {
              onToolClick(action, messageId, actionIndex, type);
            }}
          />
        )}
    </div>
  );
};
