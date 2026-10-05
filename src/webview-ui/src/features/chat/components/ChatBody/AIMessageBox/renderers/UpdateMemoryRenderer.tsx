import React from "react";

// CONSTANTS
import { getToolLabel } from "@/features/chat/constants/constants";

// TYPES
import type { ToolAction } from "@/features/chat/services/ResponseParser";

// ICONS
import { Brain, PenLine } from "lucide-react";

// COMPONENTS
import { TagHeader } from "../TagHeader";
import ErrorBlock from "../blocks/error/ErrorBlock";
import { CodeBlock } from "../blocks/code/CodeBlock";

interface UpdateMemoryRendererProps {
  action: ToolAction;
  actionIndex: number;
  messageId: string;
  isActionClicked: boolean;
  isActiveGroup?: boolean;
  isLastItemInList?: boolean;
  toolOutputs?: Record<string, { output: string; isError: boolean }>;
}

export const UpdateMemoryRenderer: React.FC<UpdateMemoryRendererProps> = ({
  action,
  actionIndex,
  messageId,
  isActionClicked,
  isActiveGroup,
  isLastItemInList,
  toolOutputs,
}) => {
  const actionId = `${messageId}-action-${actionIndex}`;
  const output = toolOutputs?.[actionId];
  const isError = !!output?.isError || !!action.isError;
  const isCompleted = isActionClicked || !!output;
  const errorMessage = isError
    ? output?.output || action.errorMessage || "Unknown error"
    : "";

  const oldContent = action.params.old_content ?? "";
  const newContent = action.params.new_content ?? "";

  const oldLines = String(oldContent).split("\n").filter(Boolean).length;
  const newLines = String(newContent).split("\n").filter(Boolean).length;

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
            <Brain size={13} style={{ color: "#a855f7", flexShrink: 0 }} />
            <PenLine size={12} style={{ opacity: 0.6, flexShrink: 0 }} />
            <span style={{ fontWeight: 600, opacity: 0.8 }}>
              {getToolLabel("update_memory")}
            </span>
            {(oldLines > 0 || newLines > 0) && (
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
                <span style={{ color: "var(--vscode-gitDecoration-addedResourceForeground)" }}>
                  +{newLines}
                </span>
                <span style={{ color: "var(--vscode-gitDecoration-deletedResourceForeground)" }}>
                  -{oldLines}
                </span>
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
        toolType="update_memory"
      />

      {!isCompleted && (oldContent || newContent) && (
        <CodeBlock
          code={`<<<<<<< OLD\n${oldContent}\n=======\n${newContent}\n>>>>>>> NEW`}
          language="diff"
          maxHeight="300px"
          hideHeader={true}
        />
      )}

      {isError && !isCompleted && (
        <ErrorBlock content={errorMessage} compact={true} maxHeight="300px" />
      )}
    </div>
  );
};