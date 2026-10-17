import React, { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Check,
  X,
  Pencil,
  Trash2,
  Plus,
  Move,
  HelpCircle,
  FolderOpen,
} from "lucide-react";
import { getFileIconPath, getFolderIconPath } from "@/utils/fileIconMapper";
import "./GitStatusBlock.css";

export interface GitStatusItem {
  status: string;
  path: string;
  staged?: boolean;
  added?: number;
  deleted?: number;
  isUnpushedCommit?: boolean;
}

export interface GitStatusBlockProps {
  statusItems: GitStatusItem[];
  onConfirm: () => void;
  onCancel: () => void;
  isProcessing?: boolean;
}

interface TreeNode {
  name: string;
  path: string;
  children: Map<string, TreeNode>;
  item?: GitStatusItem;
}

const buildTree = (items: GitStatusItem[]): TreeNode => {
  const root: TreeNode = { name: "", path: "", children: new Map() };
  for (const item of items) {
    const parts = item.path.split("/").filter(Boolean);
    let node = root;
    parts.forEach((part, i) => {
      let child = node.children.get(part);
      if (!child) {
        child = {
          name: part,
          path: parts.slice(0, i + 1).join("/"),
          children: new Map(),
        };
        node.children.set(part, child);
      }
      if (i === parts.length - 1) child.item = item;
      node = child;
    });
  }
  return root;
};

const compactNode = (node: TreeNode): TreeNode => {
  let current = node;
  while (!current.item && current.children.size === 1) {
    const only = Array.from(current.children.values())[0];
    if (only.item) break;
    current = { ...only, name: `${current.name}/${only.name}` };
  }
  return current;
};

const sortNodes = (nodes: TreeNode[]): TreeNode[] =>
  nodes.sort((a, b) => {
    const aDir = !a.item;
    const bDir = !b.item;
    if (aDir !== bDir) return aDir ? -1 : 1;
    return a.name.localeCompare(b.name);
  });

const GitStatusBlock: React.FC<GitStatusBlockProps> = ({
  statusItems,
  onConfirm,
  onCancel,
  isProcessing = false,
}) => {
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggleDir = (dirPath: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(dirPath)) next.delete(dirPath);
      else next.add(dirPath);
      return next;
    });

  const handleRowClick = (path: string) => {
    // Send message to extension to show git diff
    const vscodeApi = (window as any).vscodeApi;
    if (vscodeApi) {
      vscodeApi.postMessage({
        command: "showGitDiff",
        filePath: path,
      });
    } else {
      console.error("[GitStatusBlock] vscodeApi not available");
    }
  };

  const getStatusColor = (status: string): string => {
    if (status === "M" || status === "MM" || status === "AM")
      return "var(--vscode-editorWarning-foreground, #d4a72c)";
    if (status === "A" || status === "R" || status === "C")
      return "var(--vscode-editorBracketHighlight-foreground2, #4ec9b0)";
    if (status === "D") return "var(--vscode-errorForeground, #f14c4c)";
    if (status === "?")
      return "var(--vscode-editorBracketHighlight-foreground1, #569cd6)";
    if (status === "U")
      return "var(--vscode-editorBracketHighlight-foreground3, #8b5cf6)";
    return "var(--vscode-foreground)";
  };

  const stagedItems = statusItems.filter(
    (item) => item.staged && !item.isUnpushedCommit,
  );
  const unpushedCommits = statusItems.filter((item) => item.isUnpushedCommit);

  // Button color based on git status
  const hasStaged = statusItems.some(
    (item) => item.staged && !item.isUnpushedCommit,
  );
  const hasUnpushed = statusItems.some((item) => item.isUnpushedCommit);
  const buttonColor = hasStaged
    ? "var(--vscode-editorBracketHighlight-foreground2, #4ec9b0)"
    : hasUnpushed
      ? "var(--vscode-editorBracketHighlight-foreground3, #8b5cf6)"
      : "var(--vscode-editorWarning-foreground, #d4a72c)";

  const renderItem = (item: GitStatusItem, key: string, depth = 0) => {
    const statusColor = getStatusColor(item.status);
    const fileName = item.path.split("/").pop() || item.path;
    const added = item.added || 0;
    const deleted = item.deleted || 0;
    const hasDiff = added > 0 || deleted > 0;

    return (
      <div
        key={key}
        className="git-status-item"
        style={{
          borderLeftColor: statusColor,
          cursor: "pointer",
          paddingLeft: 14 + depth * 14,
        }}
        onClick={() => handleRowClick(item.path)}
        title={`Click để xem git diff của ${item.path}`}
      >
        <img
          src={getFileIconPath(item.path)}
          alt=""
          style={{ width: 16, height: 16, flexShrink: 0 }}
        />
        <span className="git-status-path">{fileName}</span>
        {hasDiff && (
          <span className="git-status-diff">
            <span className="git-status-diff-added">+{added}</span>
            <span className="git-status-diff-deleted">-{deleted}</span>
          </span>
        )}
      </div>
    );
  };

  const renderNodes = (parent: TreeNode, depth: number): React.ReactNode =>
    sortNodes(Array.from(parent.children.values()).map(compactNode)).map(
      (node) => {
        if (node.item) return renderItem(node.item, node.path, depth);
        const isCollapsed = collapsed.has(node.path);
        return (
          <React.Fragment key={node.path}>
            <div
              className="git-status-item"
              style={{ paddingLeft: 14 + depth * 14 }}
              onClick={() => toggleDir(node.path)}
            >
              {isCollapsed ? (
                <ChevronRight size={14} style={{ flexShrink: 0 }} />
              ) : (
                <ChevronDown size={14} style={{ flexShrink: 0 }} />
              )}
              <img
                src={getFolderIconPath(
                  node.name.split("/").pop(),
                  !isCollapsed,
                )}
                alt=""
                style={{ width: 16, height: 16, flexShrink: 0 }}
              />
              <span className="git-status-path">{node.name}</span>
            </div>
            {!isCollapsed && renderNodes(node, depth + 1)}
          </React.Fragment>
        );
      },
    );

  return (
    <div className="git-status-block">
      <div className="git-status-body">
        {unpushedCommits.length > 0 && (
          <div className="git-status-section">
            <div
              className="git-status-section-title"
              style={{
                color:
                  "var(--vscode-editorBracketHighlight-foreground3, #8b5cf6)",
              }}
            >
              📤 Unpushed ({unpushedCommits.length})
            </div>
            {unpushedCommits.map((item, index) => {
              const commitMsg = item.path;
              const shortMsg =
                commitMsg.length > 60
                  ? commitMsg.substring(0, 60) + "..."
                  : commitMsg;
              return (
                <div
                  key={index}
                  className="git-status-item"
                  style={{
                    borderLeftColor:
                      "var(--vscode-editorBracketHighlight-foreground3, #8b5cf6)",
                    cursor: "default",
                  }}
                >
                  <span
                    style={{
                      width: 16,
                      height: 16,
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      style={{
                        color:
                          "var(--vscode-editorBracketHighlight-foreground3, #8b5cf6)",
                      }}
                    >
                      <path d="M12 19V5" />
                      <path d="M5 12l7-7 7 7" />
                    </svg>
                  </span>
                  <span
                    className="git-status-path"
                    style={{
                      fontFamily: "var(--vscode-editor-font-family, monospace)",
                      fontSize: "11px",
                      opacity: 0.85,
                    }}
                  >
                    {shortMsg}
                  </span>
                </div>
              );
            })}
          </div>
        )}

        {stagedItems.length === 0 && unpushedCommits.length === 0 && (
          <div
            style={{
              padding: "16px 14px",
              textAlign: "center",
              color: "var(--vscode-descriptionForeground, #8c8c8c)",
              fontSize: "13px",
            }}
          >
            <div style={{ fontSize: "24px", marginBottom: "8px" }}>📂</div>
            <div
              style={{
                fontWeight: 600,
                marginBottom: "4px",
                color: "var(--vscode-editorWarning-foreground, #d4a72c)",
              }}
            >
              ⚠️ No files staged
            </div>
            <div style={{ fontSize: "12px", opacity: 0.8 }}>
              Run{" "}
              <code
                style={{
                  background: "var(--vscode-textCodeBlock-background)",
                  padding: "2px 6px",
                  borderRadius: "4px",
                  fontFamily: "var(--vscode-editor-font-family, monospace)",
                }}
              >
                git add {"<file>"}
              </code>{" "}
              to add files to staging area
            </div>
          </div>
        )}

        {stagedItems.length > 0 && (
          <div className="git-status-section">
            <div className="git-status-section-title">Staged Changes</div>
            {renderNodes(buildTree(stagedItems), 0)}
          </div>
        )}
      </div>

      <div className="git-status-actions">
        <button
          className="git-status-btn git-status-btn-confirm"
          onClick={() => {
            onConfirm();
          }}
          disabled={isProcessing || stagedItems.length === 0}
          title={
            stagedItems.length === 0 && unpushedCommits.length > 0
              ? "There are unpushed commits. No new changes to commit."
              : stagedItems.length === 0
                ? "No files staged. Run git add first."
                : "Create commit message from staged files"
          }
          style={{
            background: `color-mix(in srgb, ${buttonColor} 15%, transparent)`,
            color:
              stagedItems.length === 0
                ? "var(--vscode-descriptionForeground, #8c8c8c)"
                : buttonColor,
            border: "none",
            outline: "none",
            cursor: stagedItems.length === 0 ? "not-allowed" : "pointer",
            opacity: stagedItems.length === 0 ? 0.5 : 1,
          }}
          onMouseEnter={(e) => {
            if (stagedItems.length > 0) {
              e.currentTarget.style.background = `color-mix(in srgb, ${buttonColor} 25%, transparent)`;
            }
          }}
          onMouseLeave={(e) => {
            if (stagedItems.length > 0) {
              e.currentTarget.style.background = `color-mix(in srgb, ${buttonColor} 15%, transparent)`;
            }
          }}
        >
          <Check size={14} strokeWidth={2.5} />
          <span>{isProcessing ? "Processing" : "Confirm"}</span>
        </button>
        <button
          className="git-status-btn git-status-btn-cancel"
          onClick={() => {
            onCancel();
          }}
          disabled={isProcessing}
          style={{
            background: `color-mix(in srgb, var(--vscode-errorForeground, #ff4d4d) 15%, transparent)`,
            color: "var(--vscode-errorForeground, #ff4d4d)",
            border: "none",
            outline: "none",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = `color-mix(in srgb, var(--vscode-errorForeground, #ff4d4d) 25%, transparent)`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = `color-mix(in srgb, var(--vscode-errorForeground, #ff4d4d) 15%, transparent)`;
          }}
        >
          <X size={14} strokeWidth={2.5} />
          <span>Cancel</span>
        </button>
      </div>
    </div>
  );
};

export { GitStatusBlock };
export default GitStatusBlock;
