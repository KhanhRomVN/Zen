import React from "react";
import {
  Check,
  X,
  Pencil,
  Trash2,
  Plus,
  Move,
  HelpCircle,
  FolderOpen,
} from "lucide-react";
import FileIcon from "@/icons/FileIcon";
import "./GitStatusBlock.css";
import { useI18n } from "../../../../hooks/useI18n";

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

const GitStatusBlock: React.FC<GitStatusBlockProps> = ({
  statusItems,
  onConfirm,
  onCancel,
  isProcessing = false,
}) => {
  const { t } = useI18n();
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

  const getStatusIcon = (status: string): React.ReactNode => {
    const iconMap: Record<string, React.ReactNode> = {
      M: <Pencil size={14} strokeWidth={2} />,
      MM: <Pencil size={14} strokeWidth={2} />,
      AM: <Pencil size={14} strokeWidth={2} />,
      A: <Plus size={14} strokeWidth={2} />,
      D: <Trash2 size={14} strokeWidth={2} />,
      R: <Move size={14} strokeWidth={2} />,
      C: <Move size={14} strokeWidth={2} />,
      "?": <HelpCircle size={14} strokeWidth={2} />,
      "!": <FolderOpen size={14} strokeWidth={2} />,
      U: (
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
        >
          <path d="M12 19V5" />
          <path d="M5 12l7-7 7 7" />
        </svg>
      ),
    };
    return iconMap[status] || <FolderOpen size={14} strokeWidth={2} />;
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
  const unstagedItems = statusItems.filter(
    (item) => !item.staged && !item.isUnpushedCommit,
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

  const renderItem = (item: GitStatusItem, index: number) => {
    const statusColor = getStatusColor(item.status);
    const fileName = item.path.split("/").pop() || item.path;
    const added = item.added || 0;
    const deleted = item.deleted || 0;
    const hasDiff = added > 0 || deleted > 0;

    return (
      <div
        key={index}
        className="git-status-item"
        style={{
          borderLeftColor: statusColor,
          cursor: "pointer",
        }}
        onClick={() => handleRowClick(item.path)}
        title={`Click để xem git diff của ${item.path}`}
      >
        <FileIcon
          path={item.path}
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
              📤 Chưa push ({unpushedCommits.length})
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
              ⚠️ Chưa có file nào được staged
            </div>
            <div style={{ fontSize: "12px", opacity: 0.8 }}>
              Hãy chạy{" "}
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
              để thêm file vào staging area
            </div>
          </div>
        )}

        {stagedItems.length > 0 && (
          <div className="git-status-section">
            <div className="git-status-section-title">
              {t("git.stagedChanges")}
            </div>
            {stagedItems.map((item, index) => renderItem(item, index))}
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
              ? "Đã có commit chưa push. Không có thay đổi mới để commit."
              : stagedItems.length === 0
                ? "Chưa có file nào được staged. Hãy chạy git add trước."
                : "Tạo commit message từ các file đã staged"
          }
          style={{
            background: `color-mix(in srgb, ${buttonColor} 15%, transparent)`,
            color:
              stagedItems.length === 0
                ? "var(--vscode-descriptionForeground, #8c8c8c)"
                : buttonColor,
            border: `1px solid color-mix(in srgb, ${stagedItems.length === 0 ? "var(--vscode-descriptionForeground, #8c8c8c)" : buttonColor} 30%, transparent)`,
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
          <span>
            {isProcessing ? t("chat.processing") : t("git.createCommitMessage")}
          </span>
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
            border: `1px solid color-mix(in srgb, var(--vscode-errorForeground, #ff4d4d) 30%, transparent)`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = `color-mix(in srgb, var(--vscode-errorForeground, #ff4d4d) 25%, transparent)`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = `color-mix(in srgb, var(--vscode-errorForeground, #ff4d4d) 15%, transparent)`;
          }}
        >
          <X size={14} strokeWidth={2.5} />
          <span>{t("git.cancel")}</span>
        </button>
      </div>
    </div>
  );
};

export default GitStatusBlock;
