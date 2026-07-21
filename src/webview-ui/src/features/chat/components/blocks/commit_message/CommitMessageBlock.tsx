import React from "react";
import { Check, X } from "lucide-react";
import "./CommitMessageBlock.css";

export interface CommitMessageBlockProps {
  message: string;
  onAccept: () => void;
  onReject: () => void;
  isProcessing?: boolean;
}

const CommitMessageBlock: React.FC<CommitMessageBlockProps> = ({
  message,
  onAccept,
  onReject,
  isProcessing = false,
}) => {
  return (
    <div
      className="commit-message-block"
      style={{ padding: "0px 12px 12px 0" }}
    >
      <div className="commit-message-body">
        <pre className="commit-message-content">{message}</pre>
      </div>
      <div className="commit-message-actions">
        <button
          className="commit-message-btn commit-message-btn-accept"
          onClick={onAccept}
          disabled={isProcessing}
          style={{
            background: `color-mix(in srgb, var(--vscode-editorBracketHighlight-foreground2, #4ec9b0) 15%, transparent)`,
            color: "var(--vscode-editorBracketHighlight-foreground2, #4ec9b0)",
            border: `1px solid color-mix(in srgb, var(--vscode-editorBracketHighlight-foreground2, #4ec9b0) 30%, transparent)`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = `color-mix(in srgb, var(--vscode-editorBracketHighlight-foreground2, #4ec9b0) 25%, transparent)`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = `color-mix(in srgb, var(--vscode-editorBracketHighlight-foreground2, #4ec9b0) 15%, transparent)`;
          }}
        >
          <Check size={14} strokeWidth={2.5} />
          <span>{isProcessing ? "Processing" : "Accept"}</span>
        </button>
        <button
          className="commit-message-btn commit-message-btn-reject"
          onClick={onReject}
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
          <span>Reject</span>
        </button>
      </div>
    </div>
  );
};

export default CommitMessageBlock;
