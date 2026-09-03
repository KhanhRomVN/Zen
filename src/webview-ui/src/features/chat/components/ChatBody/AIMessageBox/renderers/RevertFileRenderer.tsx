import React from "react";

// HOOKS
import { useSettings } from "@/context/SettingsContext";

// CONSTANTS
import { getToolLabel } from "@/features/chat/constants/constants";

// TYPES
import {
  BaseRendererProps,
  DiffStats,
} from "@/features/chat/types/renderer-types";
import {
  getDisplayPath,
  collectConvFilePaths,
  getNextUserMessage,
} from "../../../../utils/renderer-utils";

// UTILS
import { calculateLineDiff, parseDiff, DiffHighlight } from "@/utils/diffUtils";
import { getPermissionDecision } from "@/features/chat/utils/permissionUtils";

// ICONS
import { getFileIconPath } from "@/utils/fileIconMapper";

// COMPONENTS
import { TagHeader } from "../TagHeader";
import ActionBar from "../ActionBar";
import ErrorBlock from "../blocks/error/ErrorBlock";
import { CodeBlock } from "../blocks/code/CodeBlock";

// SERVICES
import { extensionService } from "@/services/ExtensionService";

/**
 * Renderer for revert_file tool type
 * Shows diff stats similar to ReplaceInFileRenderer
 */
export const RevertFileRenderer: React.FC<BaseRendererProps> = ({
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
  conversationId,
}) => {
  const { permissionMode } = useSettings();
  const actionId = `${messageId}-action-${actionIndex}`;

  const rawPath = action.params.file_path || action.params.path || "";

  // State for version history
  const [versionHistory, setVersionHistory] = React.useState<any[]>([]);
  const [fullFileContent, setFullFileContent] = React.useState<string | null>(
    null,
  );

  const allPaths = React.useMemo(
    () => collectConvFilePaths(allMessages || []),
    [allMessages],
  );

  const displayName = rawPath ? rawPath.split("/").pop() || rawPath : "";

  const nextUserMessage = getNextUserMessage(allMessages || [], messageId);

  // Fetch version history for version info display
  React.useEffect(() => {
    if (!rawPath || !conversationId) return;

    const requestId = `version-history-${actionId}`;
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data;
      if (
        msg.command === "viewReplaceHistoryResult" &&
        msg.requestId === requestId
      ) {
        if (msg.error) {
          return;
        }

        try {
          // Backend returns histories directly (not in output field)
          const histories = msg.histories || [];
          setVersionHistory(histories);
        } catch (e) {}
      }
    };

    window.addEventListener("message", handleMessage);

    extensionService.postMessage({
      command: "viewReplaceHistory",
      filePath: rawPath,
      conversationId,
      requestId,
    });

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [rawPath, conversationId, actionId]);

  // Fetch full file content for approval mode diff (this will be old_content = current)
  React.useEffect(() => {
    const permissionDecision = getPermissionDecision(
      permissionMode,
      "revert_file",
    );

    if (permissionDecision !== "confirm" || !rawPath || !conversationId) {
      return;
    }

    // Get current version from history instead of file on disk
    // (file on disk might have been changed already)
    const currentVersion =
      versionHistory.length > 0
        ? versionHistory[versionHistory.length - 1].version
        : undefined;

    if (currentVersion === undefined) {
      // Fallback to disk if no history
      const requestId = `file-content-${actionId}`;
      const handleMessage = (event: MessageEvent) => {
        const msg = event.data;
        if (
          msg.command === "getFileContentResult" &&
          msg.requestId === requestId
        ) {
          if (msg.content) {
            setFullFileContent(msg.content);
            action.params.old_content = msg.content;
          }
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
    }

    // Fetch current version from history
    const requestId = `current-version-${actionId}`;
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data;
      if (
        msg.command === "getHistoryVersionResult" &&
        msg.requestId === requestId
      ) {
        if (msg.error) {
          return;
        }

        if (msg.history?.fullContent) {
          setFullFileContent(msg.history.fullContent);
          action.params.old_content = msg.history.fullContent;
        }
      }
    };

    window.addEventListener("message", handleMessage);

    extensionService.postMessage({
      command: "getHistoryVersion",
      filePath: rawPath,
      version: currentVersion,
      conversationId,
      requestId,
    });

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [permissionMode, rawPath, actionId, conversationId, versionHistory]);

  // Fetch target version content for diff (this will be new_content = reverted)
  React.useEffect(() => {
    const permissionDecision = getPermissionDecision(
      permissionMode,
      "revert_file",
    );
    const explicitVersion = action.params.version;

    // Calculate target version:
    // - If version is specified → use it
    // - If no version → auto-calculate as currentVersion - 1 (revert to previous)
    // currentVersion = highest version number, NOT length
    const currentVersion =
      versionHistory.length > 0
        ? versionHistory[versionHistory.length - 1].version
        : undefined;
    const targetVersion =
      explicitVersion !== undefined
        ? explicitVersion
        : currentVersion !== undefined && currentVersion > 0
          ? currentVersion - 1
          : undefined;

    if (
      permissionDecision !== "confirm" ||
      !rawPath ||
      !conversationId ||
      targetVersion === undefined
    ) {
      return;
    }

    const requestId = `version-content-${actionId}`;
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data;
      if (
        msg.command === "getHistoryVersionResult" &&
        msg.requestId === requestId
      ) {
        if (msg.error) {
          return;
        }

        if (msg.history?.fullContent) {
          // Store target version content as new_content for diff
          action.params.new_content = msg.history.fullContent;
          // Trigger re-render
          setFullFileContent((prev) => (prev === null ? "" : prev + " "));
        }
      }
    };

    window.addEventListener("message", handleMessage);

    extensionService.postMessage({
      command: "getHistoryVersion",
      filePath: rawPath,
      version: targetVersion,
      conversationId,
      requestId,
    });

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [
    permissionMode,
    rawPath,
    conversationId,
    action.params.version,
    actionId,
    versionHistory,
  ]);

  // Calculate diff stats using ACCURATE diff algorithm
  let diffStats: DiffStats | null = null;
  if (action.params.old_str && action.params.new_str) {
    const { additions, deletions } = calculateLineDiff(
      action.params.old_str || "",
      action.params.new_str || "",
    );
    diffStats = {
      added: additions,
      removed: deletions,
    };
  } else if (action.params.old_content && action.params.new_content) {
    const { additions, deletions } = calculateLineDiff(
      action.params.old_content || "",
      action.params.new_content || "",
    );
    diffStats = {
      added: additions,
      removed: deletions,
    };
  }

  const isCompleted: boolean = Boolean(
    !!isActionClicked || !!toolOutputs?.[actionId] || !!nextUserMessage,
  );

  const isError = !!toolOutputs?.[actionId]?.isError;
  const errorMessage = isError ? toolOutputs?.[actionId]?.output || "" : "";

  // Check if action has validation error
  const hasValidationError = !!action.isError;

  // Check diagnostics for completed revert
  const hasDiagnosticErrors = React.useMemo(() => {
    if (!isCompleted || isError) return false;
    const diagnostics = toolOutputs?.[actionId]?.diagnostics || [];
    return diagnostics.some((d: any) => d.severity === "Error");
  }, [isCompleted, isError, toolOutputs, actionId]);

  // Calculate version info
  const explicitTargetVersion = action.params.version;
  // currentVersion = highest version number in history, NOT the length
  // If we have version 0 and version 1, length = 2 but currentVersion = 1
  const currentVersion =
    versionHistory.length > 0
      ? versionHistory[versionHistory.length - 1].version
      : undefined;
  const targetVersion =
    explicitTargetVersion !== undefined
      ? explicitTargetVersion
      : currentVersion !== undefined && currentVersion > 0
        ? currentVersion - 1
        : undefined;

  const statusColor = isError
    ? "var(--vscode-errorForeground, #f14c4c)"
    : isCompleted
      ? hasDiagnosticErrors
        ? "var(--vscode-gitDecoration-modifiedResourceForeground, #e2c08d)"
        : "var(--vscode-gitDecoration-addedResourceForeground, #89d185)"
      : isActiveGroup
        ? "var(--vscode-descriptionForeground)"
        : "var(--vscode-descriptionForeground)";

  // Build diff preview data for approval mode
  const approvalDiffData = React.useMemo(() => {
    const permissionDecision = getPermissionDecision(
      permissionMode,
      "revert_file",
    );

    if (permissionDecision !== "confirm" || isCompleted) {
      return null;
    }

    // If we have old_content and new_content from backend (after revert simulation)
    const oldContent = action.params.old_content || action.params.old_str;
    const newContent = action.params.new_content || action.params.new_str;

    if (!oldContent || !newContent) {
      return null;
    }

    // Use SEARCH/REPLACE diff format for proper line-by-line comparison
    // parseDiff() expects exactly this format
    const diffText = `<<<<<<< SEARCH\n${oldContent}\n=======\n${newContent}\n>>>>>>> REPLACE`;
    const parsed = parseDiff(diffText);

    return {
      code: parsed.code,
      lineHighlights:
        parsed.lineHighlights.length > 0 ? parsed.lineHighlights : undefined,
    };
  }, [
    permissionMode,
    fullFileContent,
    action.params,
    isCompleted,
    versionHistory,
    explicitTargetVersion,
    currentVersion,
  ]);

  // Helper: get language from file path
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
                transition: "text-decoration 0.15s ease",
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
              onMouseEnter={(e) => {
                (e.target as HTMLElement).style.textDecoration = "underline";
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.textDecoration = "none";
              }}
            >
              {getToolLabel("revert_file")}
            </span>
            <img
              src={getFileIconPath(rawPath)}
              alt=""
              style={{ width: "14px", height: "14px" }}
            />
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
              {displayName || "..."}
            </span>
            {diffStats && (
              <>
                <span
                  style={{
                    color:
                      "var(--vscode-gitDecoration-addedResourceForeground, #3fb950)",
                    fontWeight: 600,
                    fontSize: "11px",
                  }}
                >
                  +{diffStats.added}
                </span>
                <span
                  style={{
                    color:
                      "var(--vscode-gitDecoration-deletedResourceForeground, #f14c4c)",
                    fontWeight: 600,
                    fontSize: "11px",
                  }}
                >
                  -{diffStats.removed}
                </span>
                {currentVersion !== undefined &&
                  targetVersion !== undefined && (
                    <span
                      style={{
                        opacity: 0.7,
                        fontSize: "10px",
                        fontWeight: 400,
                        color: "var(--vscode-descriptionForeground)",
                        marginLeft: "6px",
                      }}
                    >
                      #{currentVersion} → #{targetVersion}
                    </span>
                  )}
              </>
            )}
            {isCompleted && !isError && (
              <span
                style={{
                  fontSize: "10px",
                  opacity: 0.5,
                  color: "var(--vscode-descriptionForeground)",
                }}
              >
                reverted
              </span>
            )}
          </div>
        }
        path={rawPath}
        statusColor={statusColor}
        isPartial={false}
        isError={isError}
        isWaitingApproval={!!isActiveGroup && !isCompleted}
        toolType="revert_file"
        diffStats={undefined}
      />

      {/* Show diff in CodeBlock when approval mode — only when not completed */}
      {(() => {
        const shouldShow = !isCompleted && approvalDiffData;
        if (!shouldShow) return null;

        return (
          <CodeBlock
            code={approvalDiffData.code}
            language={getLanguageFromPath(rawPath)}
            lineHighlights={
              approvalDiffData.lineHighlights &&
              approvalDiffData.lineHighlights.length > 0
                ? approvalDiffData.lineHighlights
                : undefined
            }
            autoScrollToDiff={true}
            maxHeight="400px"
            hideHeader={true}
          />
        );
      })()}

      {isError && (
        <ErrorBlock
          content={errorMessage}
          showHeader={false}
          maxHeight="300px"
        />
      )}

      {!isCompleted &&
        !isError &&
        !hasValidationError &&
        getPermissionDecision(permissionMode, "revert_file") === "confirm" && (
          <div style={{ padding: "0 12px 8px 0" }}>
            <ActionBar
              action={action}
              messageId={messageId}
              actionIndex={actionIndex}
              hasError={hasValidationError}
              isCompleted={isCompleted}
              onAction={(e, type) =>
                onToolClick(action, messageId, actionIndex, type)
              }
            />
          </div>
        )}
      {hasValidationError && action.errorMessage && (
        <ErrorBlock
          content={`Validation Error: ${action.errorMessage}`}
          compact={true}
          maxHeight="300px"
        />
      )}
    </div>
  );
};
