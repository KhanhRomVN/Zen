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
    return "var(--vscode-foreground)";
  };

  const stagedItems = statusItems.filter((item) => item.staged);
  const unstagedItems = statusItems.filter((item) => !item.staged);

  // Button color based on git status
  const buttonColor = statusItems.some((item) => item.staged)
    ? "var(--vscode-editorBracketHighlight-foreground2, #4ec9b0)"
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
        {stagedItems.length > 0 && (
          <div className="git-status-section">
            <div className="git-status-section-title">{t("git.stagedChanges")}</div>
            {stagedItems.map((item, index) => renderItem(item, index))}
          </div>
        )}

        {unstagedItems.length > 0 && (
          <div className="git-status-section">
            <div className="git-status-section-title">{t("git.unstagedChanges")}</div>
            {unstagedItems.map((item, index) => renderItem(item, index))}
          </div>
        )}
      </div>

      <div className="git-status-actions">
        <button
          className="git-status-btn git-status-btn-confirm"
          onClick={() => {
            onConfirm();
          }}
          disabled={isProcessing}
          style={{
            background: `color-mix(in srgb, ${buttonColor} 15%, transparent)`,
            color: buttonColor,
            border: `1px solid color-mix(in srgb, ${buttonColor} 30%, transparent)`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = `color-mix(in srgb, ${buttonColor} 25%, transparent)`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = `color-mix(in srgb, ${buttonColor} 15%, transparent)`;
          }}
        >
          <Check size={14} strokeWidth={2.5} />
          <span>{isProcessing ? t("chat.processing") : t("git.createCommitMessage")}</span>
        </button>
        <button
          className="git-status-btn git-status-btn-cancel"
          onClick={onCancel}
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
