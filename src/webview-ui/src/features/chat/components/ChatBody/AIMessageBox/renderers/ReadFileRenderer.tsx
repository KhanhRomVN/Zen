import React from "react";

// SERVICES
import { extensionService } from "@/services/ExtensionService";

// CONSTANTS
import { getToolLabel } from "@/features/chat/constants/constants";

// TYPES
import {
  BaseRendererProps,
  Diagnostic,
} from "@/features/chat/types/renderer-types";

// UTILS
import {
  collectConvFilePaths,
  getNextUserMessage,
} from "../../../../utils/renderer-utils";

// ICONS
import FileIcon from "@/icons/FileIcon";

// COMPONENTS
import { TagHeader } from "../TagHeader";
import ErrorBlock from "../blocks/error/ErrorBlock";

export const ReadFileRenderer: React.FC<BaseRendererProps> = ({
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
  conversationId,
}) => {
  const [isCollapsed, setIsCollapsed] = React.useState(true);
  const [cachedDiagnostics, setCachedDiagnostics] = React.useState<
    Diagnostic[] | null
  >(null);

  const actionId = `${messageId}-action-${actionIndex}`;
  const rawPath =
    action.params.file_path || action.params.path || action.params.symbol || "";
  const displayName = rawPath ? rawPath.split("/").pop() || rawPath : "";

  const allPaths = React.useMemo(
    () => collectConvFilePaths(allMessages || []),
    [allMessages],
  );

  const nextUserMessage = getNextUserMessage(allMessages || [], messageId);

  const isPartial = false;
  const isError = !!toolOutputs?.[actionId]?.isError;
  const errorMessage = isError ? toolOutputs?.[actionId]?.output || "" : "";

  const outputContent = toolOutputs?.[actionId]?.output || "";
  const hasOutput = outputContent && outputContent.trim().length > 0;

  const isCompleted = Boolean(
    !isPartial &&
    (!!isActionClicked || isError || hasOutput || !!nextUserMessage),
  );

  // Calculate line range
  let lineRangeText: string | null = null;
  const startLine = action.params.start_line || action.params.startLine;
  const endLine = action.params.end_line || action.params.endLine;

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
  } else if (isCompleted && outputContent) {
    const outputLineCount = outputContent.split("\n").length;
    lineRangeText = `0-${outputLineCount}`;
  }

  // Get diagnostics from toolOutputs
  const mergedDiagnostics = React.useMemo(() => {
    const shouldGetDiagnostics = isCompleted && !isPartial;

    if (!shouldGetDiagnostics) return undefined;

    const toolOutputDiagnostics = toolOutputs?.[actionId]?.diagnostics;

    if (!toolOutputDiagnostics) {
      return undefined;
    }

    // Normalize severity
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
                  extensionService.postMessage({
                    command: "openFile",
                    path: rawPath,
                  });
                }
              }}
            >
              {getToolLabel("read_file")}
            </span>
            <span
              onClick={(e) => {
                e.stopPropagation();
                if (rawPath) {
                  extensionService.postMessage({
                    command: "openFile",
                    path: rawPath,
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
                  extensionService.postMessage({
                    command: "openFile",
                    path: rawPath,
                  });
                }
              }}
            >
              {displayName}
            </span>
            {lineRangeText && (
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
        toolType="read_file"
        tooltipMeta={{
          lineRange: lineRangeText || undefined,
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

      {isError && errorMessage && (
        <ErrorBlock content={errorMessage} compact={true} maxHeight="300px" />
      )}
    </div>
  );
};
