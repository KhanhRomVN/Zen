import React from "react";

// SERVICES
import { extensionService } from "@/services/ExtensionService";

// CONSTANTS
import { getToolLabel } from "@/features/chat/constants/constants";

// TYPES
import type { ToolAction } from "@/features/chat/services/ResponseParser";

// UTILS
import { getNextUserMessage } from "../../../../utils/renderer-utils";

// ICONS
import { getFileIconPath } from "@/utils/fileIconMapper";

// COMPONENTS
import { TagHeader } from "../TagHeader";
import { CodeBlock } from "../blocks/code/CodeBlock";

interface ReadMemoryRendererProps {
  action: ToolAction;
  actionIndex: number;
  messageId: string;
  isActionClicked: boolean;
  isActiveGroup?: boolean;
  isLastItemInList?: boolean;
  toolOutputs?: Record<string, { output: string; isError: boolean }>;
  allMessages?: any[]; // Added for restored check
  isRestored?: boolean; // Added for restored check
}

export const ReadMemoryRenderer: React.FC<ReadMemoryRendererProps> = ({
  action,
  actionIndex,
  messageId,
  isActionClicked,
  isActiveGroup,
  isLastItemInList,
  toolOutputs,
  allMessages,
  isRestored,
}) => {
  const [memoryPath, setMemoryPath] = React.useState<string>("");

  // Resolve absolute path of memory.md asynchronously via IPC
  React.useEffect(() => {
    let cancelled = false;
    extensionService
      .getMemoryFilePath()
      .then((p) => {
        if (!cancelled && p) setMemoryPath(p);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const displayName = memoryPath
    ? memoryPath.split("/").pop() || memoryPath
    : "memory.md";

  const actionId = `${messageId}-action-${actionIndex}`;
  const output = toolOutputs?.[actionId];
  
  const nextUserMessage = getNextUserMessage(allMessages || [], messageId);
  const isError = !!output?.isError;
  const hasOutput = output && output.output && output.output.trim().length > 0;
  
  // Match ReadFileRenderer logic: Completed if clicked, error, has output, OR followed by user message
  const isCompleted = Boolean(isActionClicked || isError || hasOutput || !!nextUserMessage);
  const content = output?.output || "";

  // Calculate line count for range display (similar to ReadFileRenderer)
  let lineRangeText: string | null = null;
  if (isCompleted && content) {
    const lines = content.split("\n").length;
    lineRangeText = `0-${lines}`;
  }

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
            <span style={{ fontWeight: 600, opacity: 0.8 }}>
              {getToolLabel("read_memory")}
            </span>
            <span
              onClick={(e) => {
                e.stopPropagation();
                if (memoryPath) {
                  extensionService.postMessage({
                    command: "openFile",
                    path: memoryPath,
                  });
                }
              }}
              style={{ display: "flex", alignItems: "center" }}
            >
              <img
                src={getFileIconPath(memoryPath || "memory.md")}
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
                if (memoryPath) {
                  extensionService.postMessage({
                    command: "openFile",
                    path: memoryPath,
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
              : "var(--vscode-descriptionForeground)"
        }
        isError={isError}
        isWaitingApproval={!!isActiveGroup && !isCompleted}
        toolType="read_memory"
        tooltipMeta={{
          lineRange: lineRangeText || undefined,
        }}
        path={memoryPath}
        onPathClick={(clickedPath) => {
          extensionService.postMessage({
            command: "openFile",
            path: clickedPath,
          });
        }}
      />
    </div>
  );
};
