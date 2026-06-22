import React, { useMemo } from "react";
import { ToolHeader } from "./ToolHeader";
import { ToolAction } from "../../services/ResponseParser";
import GitStatusBlock, { GitStatusItem } from "../blocks/GitStatusBlock";
import "../blocks/TerminalBlock.css";
import { getToolColor } from "../../utils/toolUtils";
import { parseGitStatusOutput } from "../../utils/parseGitStatus";

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
    type: "accept_all" | "accept_once" | "reject",
  ) => void;
  onConfirm?: (statusItems: GitStatusItem[]) => void;
  onCancel?: () => void;
  gitStatusItems?: GitStatusItem[];
  isProcessing?: boolean;
  isVisible?: boolean;
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
}) => {
  // If not visible, don't render anything
  if (!isVisible) {
    console.log("[GitToolRenderer] isVisible=false, returning null", {
      isVisible,
      gitStatusItemsLength: gitStatusItems.length,
      actionId: `${messageId}-action-${actionIndex}`,
    });
    return null;
  }
  const actionId = `${messageId}-action-${actionIndex}`;
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
    if (itemsFromParams && Array.isArray(itemsFromParams) && itemsFromParams.length > 0) {
      return itemsFromParams;
    }
    // Last resort: try to parse from raw git output stored in action params
    const rawOutput = action.params?.raw;
    if (rawOutput && typeof rawOutput === 'string') {
      const parsed = parseGitStatusOutput(rawOutput);
      if (parsed.length > 0) return parsed;
    }
    return [];
  }, [gitStatusItems, hasOutput, toolOutputs, actionId, action.params]);

  // Use parsed items instead of the prop
  const effectiveItems = parsedItems.length > 0 ? parsedItems : gitStatusItems;

  console.log("[GitToolRenderer] Rendering with isVisible=true", {
    gitStatusItemsLength: gitStatusItems.length,
    effectiveItemsLength: effectiveItems?.length || 0,
    parsedItemsLength: parsedItems.length,
  });

  const getStatusColor = () => {
    if (hasOutput) {
      const output = toolOutputs[actionId];
      if (output.isError) return "var(--vscode-errorForeground, #f14c4c)";
      return getToolColor("git_status");
    }
    return getToolColor("git_status");
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
        label: "GIT STATUS",
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
    console.log("[GitToolRenderer] handleCancel called, onCancel exists:", !!onCancel);
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
                  {getTitleParts().stats.replace(/\+[0-9]+/, "").replace(/ -[0-9]+/, "").trim()}
                </span>
                <span
                  style={{
                    color: "var(--vscode-gitDecoration-addedResourceForeground, #3fb950)",
                    fontWeight: 600,
                    fontSize: "11px",
                  }}
                >
                  +{getTitleParts().totalAdded}
                </span>
                <span
                  style={{
                    color: "var(--vscode-gitDecoration-deletedResourceForeground, #f14c4c)",
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

      {effectiveItems.length > 0 && (
        <div style={{ padding: "0px 12px 12px 29px" }}>
          <GitStatusBlock
            statusItems={effectiveItems}
            onConfirm={handleConfirm}
            onCancel={handleCancel}
            isProcessing={isProcessing}
          />
        </div>
      )}

      {effectiveItems.length === 0 && hasOutput && (
        <div style={{ padding: "0px 12px 12px 29px" }}>
          <div
            style={{
              padding: "16px",
              textAlign: "center",
              color: "var(--vscode-descriptionForeground, #8c8c8c)",
              fontSize: "13px",
            }}
          >
            <div style={{ fontSize: "24px", marginBottom: "8px" }}>📂</div>
            <div style={{ fontWeight: 600, marginBottom: "4px" }}>
              Không có thay đổi
            </div>
            <div style={{ fontSize: "12px" }}>
              Chạy{" "}
              <code
                style={{
                  background: "var(--vscode-textCodeBlock-background)",
                  padding: "2px 6px",
                  borderRadius: "4px",
                }}
              >
                git add
              </code>{" "}
              để thêm file vào staging area
            </div>
            <button
              onClick={handleCancel}
              style={{
                marginTop: "12px",
                padding: "4px 16px",
                background: "var(--vscode-button-secondaryBackground)",
                color: "var(--vscode-button-secondaryForeground)",
                border: "none",
                borderRadius: "4px",
                cursor: "pointer",
                fontSize: "12px",
              }}
            >
              Đóng
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default GitToolRenderer;
