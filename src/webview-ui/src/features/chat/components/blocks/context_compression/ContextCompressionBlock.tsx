import React from "react";
import { Check, X } from "lucide-react";
import "./ContextCompressionBlock.css";

export interface ContextCompressionBlockProps {
  summary: string;
  onAccept: () => void;
  onReject: () => void;
  isProcessing?: boolean;
}

/**
 * Context compression block - displays AI-generated conversation summary
 * User can accept to create new conversation with summary, or reject to continue
 */
const ContextCompressionBlock: React.FC<ContextCompressionBlockProps> = ({
  summary,
  onAccept,
  onReject,
  isProcessing = false,
}) => {
  return (
    <div className="context-compression-block" style={{ padding: "0px 12px 12px 29px" }}>
      <div className="context-compression-body">
        <div className="context-compression-content">
          {summary.split('\n').map((line, idx) => (
            <React.Fragment key={idx}>
              {line}
              {idx < summary.split('\n').length - 1 && <br />}
            </React.Fragment>
          ))}
        </div>
      </div>
      <div className="context-compression-actions">
        <button
          className="context-compression-btn context-compression-btn-accept"
          onClick={onAccept}
          disabled={isProcessing}
          style={{
            background: `color-mix(in srgb, var(--vscode-editorBracketHighlight-foreground2, #10b981) 15%, transparent)`,
            color: "var(--vscode-editorBracketHighlight-foreground2, #10b981)",
            border: `1px solid color-mix(in srgb, var(--vscode-editorBracketHighlight-foreground2, #10b981) 30%, transparent)`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = `color-mix(in srgb, var(--vscode-editorBracketHighlight-foreground2, #10b981) 25%, transparent)`;
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = `color-mix(in srgb, var(--vscode-editorBracketHighlight-foreground2, #10b981) 15%, transparent)`;
          }}
        >
          <Check size={14} strokeWidth={2.5} />
          <span>{isProcessing ? "Processing..." : "Xác nhận & Tạo conversation mới"}</span>
        </button>
        <button
          className="context-compression-btn context-compression-btn-reject"
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
          <span>Hủy</span>
        </button>
      </div>
    </div>
  );
};

export default ContextCompressionBlock;
