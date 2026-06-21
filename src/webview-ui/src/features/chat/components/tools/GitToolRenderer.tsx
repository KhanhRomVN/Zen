import React, { useMemo } from "react";
import { ToolHeader } from "./ToolHeader";
import { ToolAction } from "../../services/ResponseParser";
import GitStatusBlock, { GitStatusItem } from "../blocks/GitStatusBlock";
import "../blocks/TerminalBlock.css";
import { getToolColor } from "../../utils/toolUtils";

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
}

/**
 * Parse git status --porcelain output into GitStatusItem array
 */
const parseGitStatusOutput = (output: string): GitStatusItem[] => {
  if (!output || output.trim() === "") return [];

  const lines = output.split("\n").filter((line) => line.trim() !== "");
  const items: GitStatusItem[] = [];

  for (const line of lines) {
    // Git status --porcelain format:
    // "M  file.txt" - staged modified
    // " M file.txt" - unstaged modified
    // "D  file.txt" - staged deleted
    // " D file.txt" - unstaged deleted
    // "A  file.txt" - staged added
    // "?? file.txt" - untracked
    // "R  old -> new" - renamed
    // "C  old -> new" - copied
    // "MM file.txt" - modified staged and unstaged

    const trimmedLine = line.trim();
    if (trimmedLine === "") continue;

    // Extract status and path
    let status = "";
    let path = "";
    let staged = false;

    // Check for two-character status codes (first char = staged, second = unstaged)
    // e.g., "MM", "AM", "M ", " M"
    if (line.length >= 2) {
      const firstChar = line[0];
      const secondChar = line[1];
      const pathStart = line.indexOf(
        trimmedLine.split(/\s+/).slice(1).join(" "),
      );

      // Determine staged status
      if (firstChar !== " " && firstChar !== "?") {
        staged = true;
      }

      // Determine status code
      if (firstChar === " " && secondChar !== " ") {
        // Only unstaged changes
        status = secondChar;
        staged = false;
      } else if (firstChar !== " " && secondChar === " ") {
        // Only staged changes
        status = firstChar;
        staged = true;
      } else if (firstChar !== " " && secondChar !== " ") {
        // Both staged and unstaged changes
        status = firstChar;
        staged = true;
      } else if (firstChar === "?" && secondChar === "?") {
        // Untracked file
        status = "?";
        staged = false;
      } else {
        status = firstChar;
        staged = false;
      }

      // Extract path (after status code)
      const statusPattern = /^[A-Z? ]{2}\s+/;
      const match = line.match(statusPattern);
      if (match) {
        path = line.substring(match[0].length).trim();
      } else {
        // Fallback: split by whitespace
        const parts = line.split(/\s+/);
        if (parts.length >= 2) {
          path = parts.slice(1).join(" ");
        } else {
          path = line;
        }
      }

      // Handle renamed/copied files: "R  old.txt -> new.txt"
      if ((status === "R" || status === "C") && path.includes(" -> ")) {
        path = path.split(" -> ")[1] || path;
      }

      items.push({
        status: status.trim(),
        path: path.trim(),
        staged,
      });
    }
  }

  return items;
};

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
}) => {
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
