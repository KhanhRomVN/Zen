import React from "react";

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
import { calculateLineDiff } from "@/utils/diffUtils";

// ICONS
import FileIcon from "@/icons/FileIcon";

// COMPONENTS
import { TagHeader } from "../TagHeader";
import ExecuteButton from "../ExecuteButton";
import ErrorBlock from "../blocks/error/ErrorBlock";

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
  const actionId = `${messageId}-action-${actionIndex}`;

  const rawPath = action.params.file_path || action.params.path || "";

  const allPaths = React.useMemo(
    () => collectConvFilePaths(allMessages || []),
    [allMessages],
  );

  const displayName = rawPath ? rawPath.split("/").pop() || rawPath : "";

  const nextUserMessage = getNextUserMessage(allMessages || [], messageId);

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

  const statusColor = isError
    ? "var(--vscode-errorForeground, #f14c4c)"
    : isCompleted
      ? "var(--vscode-gitDecoration-modifiedResourceForeground, #e2c08d)"
      : "var(--vscode-textLink-foreground, #3794ff)";

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
                    command: "openReplaceInFileDiff",
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
            <FileIcon
              path={rawPath}
              isFolder={false}
              style={{ width: "14px", height: "14px" }}
            />
            <span
              style={{
                fontWeight: 500,
                opacity: 0.8,
                fontFamily: "var(--vscode-editor-font-family, monospace)",
                fontSize: "11px",
              }}
            >
              {getDisplayPath(rawPath, allPaths) || "..."}
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
        toolType="revert_file"
        diffStats={diffStats || undefined}
      />

      {isError && (
        <ErrorBlock
          content={errorMessage}
          showHeader={false}
          maxHeight="300px"
        />
      )}

      {!isCompleted && !isError && (
        <div style={{ padding: "0 12px 8px 0" }}>
          <ExecuteButton
            isCompleted={isCompleted}
            isActive={isActionClicked}
            isFailed={isError}
            isLastMessage={isLastMessage}
            onExecute={(e, type) =>
              onToolClick(action, messageId, actionIndex, type)
            }
            title="Revert File"
          />
        </div>
      )}
    </div>
  );
};
