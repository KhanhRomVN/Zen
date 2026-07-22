import React from "react";

// HOOKS
import { useSettings } from "@/context/SettingsContext";

// SERVICES
import { extensionService } from "@/services/ExtensionService";

// CONSTANTS
import {
  STREAM_BOX_HEIGHT,
  TOOL_ACTION_TYPES,
  getToolLabel,
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
import { parseDiff } from "@/utils/diffUtils";

// ICONS
import FileIcon from "@/icons/FileIcon";

// COMPONENTS
import { TagHeader } from "../TagHeader";
import ExecuteButton from "../ExecuteButton";
import ErrorBlock from "../blocks/error/ErrorBlock";
// FileStreamingBlock removed - no longer used (isPartial is false)

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

  // Debug logs
  const permissionDecision = getPermissionDecision(
    permissionMode,
    "replace_in_file",
  );
  const shouldShowExecuteButton =
    !shouldHideContent &&
    !isCompleted &&
    !isPartial &&
    permissionDecision === "confirm";

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
                    command: "openReplaceInFileDiff",
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
                    command: "openReplaceInFileDiff",
                    filePath: rawPath,
                    oldContent,
                    newContent,
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

      {!shouldHideContent &&
        !isCompleted &&
        !isPartial &&
        getPermissionDecision(permissionMode, "replace_in_file") ===
          "confirm" && (
          <div style={{ marginTop: "8px", marginBottom: "8px", order: 1 }}>
            <ExecuteButton
              isActive={true}
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
    </div>
  );
};
