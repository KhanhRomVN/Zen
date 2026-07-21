import React, { useMemo } from "react";

// CONSTANTS
import { TOOL_ACTION_TYPES } from "../../../constants/constants";

// TYPES
import { ToolAction } from "../../../services/ResponseParser";
import { GitStatusItem } from "../../../types/tool-types";

// UTILS
import { parseGitStatusOutput } from "../../../utils/gitUtils";

// COMPONENTS
import { ToolHeader } from "./ToolHeader";
import { GitStatusBlock } from "./blocks/git_status/GitStatusBlock";

// STYLES
import "./blocks/run_command/TerminalBlock.css";

interface GitToolRendererProps {
  action: ToolAction;
  actionIndex: number;
  messageId: string;
  isActionClicked?: boolean;
  isActiveGroup?: boolean;
  isLastMessage?: boolean;
  isLastItemInList?: boolean;
  toolOutputs?: Record<string, { output: string; isError: boolean }>;
  onToolClick: (
    action: ToolAction,
    messageId: string,
    actionIndex: number,
    type: (typeof TOOL_ACTION_TYPES)[keyof typeof TOOL_ACTION_TYPES],
  ) => void;
  onConfirm?: (statusItems: GitStatusItem[]) => void;
  onCancel?: () => void;
  gitStatusItems?: GitStatusItem[];
  isProcessing?: boolean;
  isVisible?: boolean;
  branch?: string;
}

const GitToolRenderer: React.FC<GitToolRendererProps> = ({
  action,
  actionIndex,
  messageId,
  isActionClicked = false,
  isActiveGroup = false,
  isLastMessage = false,
  isLastItemInList = true,
  toolOutputs,
  onToolClick,
  onConfirm,
  onCancel,
  gitStatusItems = [],
  isProcessing = false,
  isVisible = true,
  branch,
}) => {
  const actionId = `${messageId}-action-${actionIndex}`;

  // If not visible, don't render anything
  if (!isVisible) {
    return null;
  }
  const hasOutput = toolOutputs && toolOutputs[actionId];

  // Parse git output from toolOutputs or from action params (for restored conversations)
  const parsedItems = useMemo(() => {
    if (gitStatusItems.length > 0) {
      return gitStatusItems;
    }
    // First, try to get from toolOutputs (works for active sessions)
    if (hasOutput && toolOutputs[actionId] && !toolOutputs[actionId].isError) {
      const parsed = parseGitStatusOutput(toolOutputs[actionId].output);
      if (parsed.length > 0) return parsed;
    }
    // Fallback: parse from action.params.items (restored from conversation)
    const itemsFromParams = action.params?.items;
    if (
      itemsFromParams &&
      Array.isArray(itemsFromParams) &&
      itemsFromParams.length > 0
    ) {
      return itemsFromParams;
    }
    // Last resort: try to parse from raw git output stored in action params
    const rawOutput = action.params?.raw;
    if (rawOutput && typeof rawOutput === "string") {
      const parsed = parseGitStatusOutput(rawOutput);
      if (parsed.length > 0) return parsed;
    }
    return [];
  }, [gitStatusItems, hasOutput, toolOutputs, actionId, action.params]);

  // Use parsed items instead of the prop
  const effectiveItems = parsedItems.length > 0 ? parsedItems : gitStatusItems;

  const getStatusColor = () => {
    if (hasOutput) {
      const output = toolOutputs[actionId];
      if (output.isError) return "var(--vscode-errorForeground, #f14c4c)";
      return "var(--vscode-gitDecoration-modifiedResourceForeground, #e2c08d)";
    }
    return "var(--vscode-gitDecoration-modifiedResourceForeground, #e2c08d)";
  };

  const getTitleParts = () => {
    if (hasOutput) {
      const output = toolOutputs[actionId];
      if (output.isError) return { label: "GIT STATUS", stats: "Error" };
      const totalAdded = effectiveItems.reduce(
        (sum, item) => sum + (item.added || 0),
        0,
      );
      const totalDeleted = effectiveItems.reduce(
        (sum, item) => sum + (item.deleted || 0),
        0,
      );
      return {
        label: `GIT STATUS${branch ? `(${branch})` : ""}`,
        stats: `${effectiveItems.length} changes +${totalAdded} -${totalDeleted}`,
        totalAdded,
        totalDeleted,
      };
    }
    return { label: "GIT STATUS", stats: "" };
  };

  const handleConfirm = () => {
    if (onConfirm && effectiveItems.length > 0) {
      onConfirm(effectiveItems);
    } else {
      console.warn(
        "[GitToolRenderer] Cannot confirm - no onConfirm or no items",
      );
    }
  };

  const handleCancel = () => {
    if (onCancel) {
      onCancel();
    }
  };

  return (
    <div
      className={`terminal-block git-tool ${isActiveGroup ? "active" : ""}`}
      style={{
        marginBottom: isLastItemInList ? "0" : "8px",
        backgroundColor: "transparent",
        borderRadius: "0px",
        overflow: "visible",
      }}
    >
      <ToolHeader
        title={
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "12px",
              color: "var(--vscode-editor-foreground)",
            }}
          >
            <span style={{ fontWeight: 600, opacity: 0.8 }}>
              {getTitleParts().label}
            </span>
            {getTitleParts().stats && (
              <>
                <span
                  style={{
                    fontSize: "11px",
                    opacity: 0.5,
                    marginLeft: "2px",
                  }}
                >
                  {getTitleParts()
                    .stats.replace(/\+[0-9]+/, "")
                    .replace(/ -[0-9]+/, "")
                    .trim()}
                </span>
                <span
                  style={{
                    color:
                      "var(--vscode-gitDecoration-addedResourceForeground, #3fb950)",
                    fontWeight: 600,
                    fontSize: "11px",
                  }}
                >
                  +{getTitleParts().totalAdded}
                </span>
                <span
                  style={{
                    color:
                      "var(--vscode-gitDecoration-deletedResourceForeground, #f14c4c)",
                    fontWeight: 600,
                    fontSize: "11px",
                  }}
                >
                  -{getTitleParts().totalDeleted}
                </span>
              </>
            )}
            <span
              className="codicon codicon-git-pull-request"
              style={{ fontSize: "14px", marginLeft: "2px" }}
            />
          </div>
        }
        statusColor={getStatusColor()}
        isPartial={false}
      />

      {hasOutput && (
        <div style={{ padding: "0px 12px 12px 0" }}>
          <GitStatusBlock
            statusItems={effectiveItems}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
            isProcessing={isProcessing}
          />
        </div>
      )}
    </div>
  );
};

export default GitToolRenderer;
