import React, { useState } from "react";

// CONSTANTS
import { getToolLabel } from "@/features/chat/constants/constants";

// TYPES
import { BaseRendererProps } from "@/features/chat/types/renderer-types";

// ICONS
import { getFileIconPath } from "@/utils/fileIconMapper";

// COMPONENTS
import { TagHeader } from "../TagHeader";
import ErrorBlock from "../blocks/error/ErrorBlock";
import { ViewReplaceHistoryBlock } from "../blocks/view_replace_history/ViewReplaceHistoryBlock";

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
  const [isExpanded, setIsExpanded] = useState(false);

  const filePath = action.params.file_path || action.params.path || "";
  const outputData = toolOutputs?.[actionId];
  const isError = outputData?.isError || false;
  const isCompleted = !!outputData;

  // Parse histories from output
  let histories: any[] = [];
  let currentVersion: number | undefined;
  try {
    if (outputData?.output && typeof outputData.output === "string") {
      if (outputData.output === "No history") {
        histories = [];
      } else {
        histories = JSON.parse(outputData.output);
        // Current version là version cao nhất
        if (histories.length > 0) {
          currentVersion = Math.max(...histories.map((h: any) => h.version));
        }
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

  // Summary result for TagHeader
  const summaryResult =
    isCompleted && !isError && histories.length > 0
      ? `${histories.length} ${histories.length === 1 ? "version" : "versions"}`
      : undefined;

  const handleTagClick = () => {
    if (isCompleted && !isError && histories.length > 0) {
      setIsExpanded(!isExpanded);
    }
  };

  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        marginBottom: isLastItemInList ? "0" : "8px",
      }}
    >
      <div onClick={handleTagClick} style={{ cursor: isCompleted && !isError && histories.length > 0 ? "pointer" : "default" }}>
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
              <span style={{ fontWeight: 600, opacity: 0.8 }}>{getToolLabel("view_replace_history")}</span>
              <span style={{ display: "flex", alignItems: "center" }}>
                <img
                  src={getFileIconPath(filePath)}
                  alt=""
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
      </div>
      {isError && (
        <ErrorBlock
          content={outputData?.output || "Failed to load history"}
          showHeader={false}
          maxHeight="300px"
        />
      )}
      {isExpanded && isCompleted && !isError && histories.length > 0 && (
        <ViewReplaceHistoryBlock
          filePath={filePath}
          histories={histories}
          currentVersion={currentVersion}
        />
      )}
    </div>
  );
};
