import React from "react";

// TYPES
import { BaseRendererProps } from "@/features/chat/types/renderer-types";

// ICONS
import FileIcon from "@/icons/FileIcon";

// COMPONENTS
import { ToolHeader } from "../ToolHeader";
import ErrorBlock from "../blocks/error/ErrorBlock";

/**
 * Renderer for view_replace_history tool type
 * Shows history of replace operations for a file
 */
export const ViewReplaceHistoryRenderer: React.FC<BaseRendererProps> = ({
  action,
  actionIndex,
  messageId,
  isLastItemInList,
  toolOutputs,
}) => {
  const actionId = `${messageId}-action-${actionIndex}`;

  const filePath = action.params.file_path || action.params.path || "";
  const outputData = toolOutputs?.[actionId];
  const isError = outputData?.isError || false;
  const isCompleted = !!outputData;

  // Parse histories from output
  let histories: any[] = [];
  try {
    if (outputData?.output && typeof outputData.output === "string") {
      if (outputData.output === "No history") {
        histories = [];
      } else {
        histories = JSON.parse(outputData.output);
      }
    }
  } catch (e) {
    // Ignore parse error - histories will remain empty array
  }

  // Determine color based on status
  const historyColor = isError
    ? "var(--vscode-errorForeground, #ff4d4d)"
    : isCompleted
      ? "var(--vscode-gitDecoration-addedResourceForeground, #3fb950)"
      : "var(--vscode-textLink-foreground, #9370db)";

  // Summary result for ToolHeader
  const summaryResult =
    isCompleted && !isError && histories.length > 0
      ? `${histories.length} ${histories.length === 1 ? "version" : "versions"}`
      : undefined;

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        marginBottom: isLastItemInList ? "0" : "8px",
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
            <span style={{ fontWeight: 600, opacity: 0.8 }}>HISTORY</span>
            <span style={{ display: "flex", alignItems: "center" }}>
              <FileIcon
                path={filePath}
                isFolder={false}
                style={{ width: "16px", height: "16px" }}
              />
            </span>
            <span
              style={{
                fontFamily: "var(--vscode-editor-font-family, monospace)",
                fontSize: "11px",
                fontWeight: 500,
                opacity: 0.9,
              }}
            >
              {filePath.split("/").pop() || filePath}
            </span>
            {summaryResult && (
              <span
                style={{
                  opacity: 0.5,
                  fontSize: "10px",
                  color: "var(--vscode-descriptionForeground)",
                }}
              >
                {summaryResult}
              </span>
            )}
          </div>
        }
        path={filePath}
        statusColor={historyColor}
        isPartial={false}
        isError={isError}
        toolType="view_replace_history"
        tooltipMeta={{
          fileCount: histories.length,
        }}
      />
      {isError && (
        <ErrorBlock
          content={outputData?.output || "Failed to load history"}
          showHeader={false}
          maxHeight="300px"
        />
      )}
    </div>
  );
};
