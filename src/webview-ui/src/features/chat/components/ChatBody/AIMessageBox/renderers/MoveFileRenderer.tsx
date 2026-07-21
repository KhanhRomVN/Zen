import React from "react";

// TYPES
import { BaseRendererProps } from "@/features/chat/types/renderer-types";
import {
  getDisplayPath,
  collectConvFilePaths,
  getNextUserMessage,
} from "../../../../utils/renderer-utils";

// CONSTANTS
import { TOOL_ACTION_TYPES } from "@/features/chat/constants/constants";

// ICONS
import FileIcon from "@/icons/FileIcon";

// COMPONENTS
import { ToolHeader } from "../ToolHeader";
import ExecuteButton from "../ExecuteButton";
import ErrorBlock from "../blocks/error/ErrorBlock";

/**
 * Renderer for move_file tool type
 */
export const MoveFileRenderer: React.FC<BaseRendererProps> = ({
  action,
  actionIndex,
  messageId,
  isActionClicked,
  isLastItemInList,
  isLastMessage,
  toolOutputs,
  allMessages,
  onToolClick,
}) => {
  const actionId = `${messageId}-action-${actionIndex}`;

  const sourcePath = action.params.source_path || action.params.source || "";
  const destPath =
    action.params.destination_path || action.params.destination || "";

  const allPaths = React.useMemo(
    () => collectConvFilePaths(allMessages || []),
    [allMessages],
  );

  const nextUserMessage = getNextUserMessage(allMessages || [], messageId);

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
      <ToolHeader
        title={
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              fontSize: "12px",
              color: "var(--vscode-editor-foreground)",
            }}
          >
            {/* First row: MOVE label */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <span style={{ fontWeight: 600, opacity: 0.8 }}>MOVE</span>
              {isCompleted && !isError && (
                <span
                  style={{
                    fontSize: "10px",
                    opacity: 0.5,
                    color: "var(--vscode-descriptionForeground)",
                  }}
                >
                  moved
                </span>
              )}
            </div>

            {/* Second row: Source path with icon */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <FileIcon
                path={sourcePath}
                isFolder={false}
                style={{ width: "14px", height: "14px" }}
              />
              <span
                style={{
                  fontFamily: "var(--vscode-editor-font-family, monospace)",
                  fontSize: "11px",
                  fontWeight: 500,
                  opacity: 0.8,
                }}
              >
                {getDisplayPath(sourcePath, allPaths)}
              </span>
            </div>

            {/* Third row: Arrow + Destination path with icon */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span style={{ opacity: 0.5, fontSize: "11px" }}>→</span>
              <FileIcon
                path={destPath}
                isFolder={false}
                style={{ width: "14px", height: "14px" }}
              />
              <span
                style={{
                  fontFamily: "var(--vscode-editor-font-family, monospace)",
                  fontSize: "11px",
                  fontWeight: 500,
                  opacity: 0.8,
                }}
              >
                {getDisplayPath(destPath, allPaths)}
              </span>
            </div>
          </div>
        }
        path={sourcePath}
        statusColor={statusColor}
        isPartial={false}
        isError={isError}
        toolType="move_file"
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
            title="Move File"
          />
        </div>
      )}
    </div>
  );
};
