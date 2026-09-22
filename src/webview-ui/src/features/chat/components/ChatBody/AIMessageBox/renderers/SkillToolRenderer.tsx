import React from "react";

// CONSTANTS
import { getToolLabel } from "@/features/chat/constants/constants";

// TYPES
import { BaseRendererProps } from "@/features/chat/types/renderer-types";

// COMPONENTS
import { TagHeader } from "../TagHeader";

/**
 * Renderer dùng chung cho 4 tool liên quan tới SKILL marketplace:
 * search_skill, list_skill, read_skill, install_skill.
 * Hiển thị header (tool label + tham số chính) + khối output text, có thể collapse.
 */
export const SkillToolRenderer: React.FC<BaseRendererProps> = ({
  action,
  actionIndex,
  messageId,
  isActionClicked,
  isLastItemInList,
  toolOutputs,
}) => {
  const [isCollapsed, setIsCollapsed] = React.useState(true);
  const actionId = `${messageId}-action-${actionIndex}`;

  const toolType = action.type as
    | "search_skill"
    | "list_skill"
    | "read_skill"
    | "install_skill";

  const mainParam = action.params.search_term || action.params.slug || "";

  const isError = !!toolOutputs?.[actionId]?.isError;
  const output = toolOutputs?.[actionId]?.output || "";
  const hasResult = isActionClicked || !!toolOutputs?.[actionId];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "4px",
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
              cursor: hasResult ? "pointer" : "default",
            }}
            onClick={hasResult ? () => setIsCollapsed((v) => !v) : undefined}
          >
            <span style={{ fontWeight: 600, opacity: 0.8, flexShrink: 0 }}>
              {getToolLabel(toolType)}
            </span>
            {mainParam && (
              <span
                style={{
                  fontFamily: "var(--vscode-editor-font-family, monospace)",
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "var(--vscode-textLink-foreground)",
                  padding: "0 5px",
                  backgroundColor:
                    "color-mix(in srgb, var(--vscode-textLink-foreground) 12%, transparent)",
                  borderRadius: "3px",
                  maxWidth: "220px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  flexShrink: 1,
                }}
                title={mainParam}
              >
                {mainParam}
              </span>
            )}
            {hasResult && (
              <span
                className={`codicon codicon-chevron-${isCollapsed ? "right" : "down"}`}
                style={{
                  fontSize: "10px",
                  opacity: 0.5,
                  marginLeft: "auto",
                  flexShrink: 0,
                }}
              />
            )}
          </div>
        }
        statusColor={
          isError
            ? "var(--vscode-errorForeground)"
            : hasResult
              ? "var(--vscode-gitDecoration-addedResourceForeground, #3fb950)"
              : "var(--vscode-descriptionForeground)"
        }
        isError={isError}
        toolType={toolType}
        isPartial={false}
      />

      {hasResult && !isCollapsed && (
        <div style={{ padding: "0 12px 4px 0" }}>
          <div
            style={{
              padding: "10px 12px",
              background: "var(--vscode-editor-background, #1e1e1e)",
              borderRadius: "6px",
              border: "1px solid var(--vscode-widget-border, #454545)",
              fontFamily: "var(--vscode-editor-font-family, monospace)",
              fontSize: "12px",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              color: isError
                ? "var(--vscode-errorForeground)"
                : "var(--vscode-foreground, #cccccc)",
              maxHeight: "320px",
              overflowY: "auto",
            }}
          >
            {output || "(no output)"}
          </div>
        </div>
      )}
    </div>
  );
};