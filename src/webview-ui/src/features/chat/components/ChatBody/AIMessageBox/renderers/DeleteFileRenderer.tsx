import React from "react";

// CONSTANTS
import { getToolLabel } from "@/features/chat/constants/constants";

// TYPES
import {
  getDisplayPath,
  collectConvFilePaths,
  getNextUserMessage,
} from "../../../../utils/renderer-utils";
import { BaseRendererProps } from "@/features/chat/types/renderer-types";

// UTILS
import { getFilename } from "@/features/chat/utils/toolUtils";

// ICONS
import FileIcon from "@/icons/FileIcon";

// COMPONENTS
import { TagHeader } from "../TagHeader";
import ExecuteButton from "../ExecuteButton";
import ErrorBlock from "../blocks/error/ErrorBlock";

/**
 * Renderer for delete_file tool type
 */
export const DeleteFileRenderer: React.FC<BaseRendererProps> = ({
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
  const toolType = action.type;
  const actionId = `${messageId}-action-${actionIndex}`;

  const rawPath =
    action.params.file_path ||
    action.params.folder_path ||
    action.params.path ||
    getFilename(action);

  const allPaths = React.useMemo(
    () => collectConvFilePaths(allMessages || []),
    [allMessages],
  );

  const displayName = rawPath ? rawPath.split("/").pop() || rawPath : "";

  const nextUserMessage = getNextUserMessage(allMessages || [], messageId);

  const isCompleted: boolean = Boolean(
    !!isActionClicked || !!toolOutputs?.[actionId] || !!nextUserMessage,
  );

  const isError = !!toolOutputs?.[actionId]?.isError;
  const errorMessage = isError ? toolOutputs?.[actionId]?.output || "" : "";

  const statusColor = isError
    ? "var(--vscode-errorForeground, #f14c4c)"
    : isCompleted
      ? "var(--vscode-gitDecoration-deletedResourceForeground, #f85149)"
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
            <span style={{ fontWeight: 600, opacity: 0.8 }}>
              {getToolLabel("delete_file")}
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
            {isCompleted && !isError && (
              <span
                style={{
                  fontSize: "10px",
                  opacity: 0.5,
                  color: "var(--vscode-descriptionForeground)",
                }}
              >
                deleted
              </span>
            )}
          </div>
        }
        path={rawPath}
        statusColor={statusColor}
        isPartial={false}
        isError={isError}
        toolType={toolType}
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
            title="Delete File"
          />
        </div>
      )}
    </div>
  );
};
