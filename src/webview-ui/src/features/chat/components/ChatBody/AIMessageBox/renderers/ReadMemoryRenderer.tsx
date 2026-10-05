import React from "react";

// CONSTANTS
import { getToolLabel } from "@/features/chat/constants/constants";

// TYPES
import type { ToolAction } from "@/features/chat/services/ResponseParser";

// ICONS
import { Brain } from "lucide-react";

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
}

export const ReadMemoryRenderer: React.FC<ReadMemoryRendererProps> = ({
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
  const isError = !!output?.isError;
  const isCompleted = isActionClicked || !!output;
  const content = output?.output || "";

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
            <span style={{ fontWeight: 600, opacity: 0.8 }}>
              {getToolLabel("read_memory")}
            </span>
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
      />
      {isCompleted && !isError && content && (
        <CodeBlock code={content} language="markdown" maxHeight="300px" hideHeader={true} />
      )}
    </div>
  );
};