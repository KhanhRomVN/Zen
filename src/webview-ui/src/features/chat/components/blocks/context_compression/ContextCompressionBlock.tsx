import React, { useRef, useEffect } from "react";
import { Check } from "lucide-react";
import "./ContextCompressionBlock.css";

export interface ContextCompressionBlockProps {
  summary: string;
  isStreaming?: boolean;
  onConfirm: (summary: string) => void;
  onReject: () => void;
  isAccepted?: boolean;
  isRejected?: boolean;
}

/**
 * Context compression block - displays AI-generated conversation summary
 * Features:
 * - Auto-scroll during streaming (like FileStreamingBlock)
 * - Copy to clipboard
 * - Confirm to navigate home with summary in MessageInput
 * - Reject option
 */
const ContextCompressionBlock: React.FC<ContextCompressionBlockProps> = ({
  summary,
  isStreaming = false,
  onConfirm,
  onReject,
  isAccepted = false,
  isRejected = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when streaming (same as FileStreamingBlock)
  useEffect(() => {
    if (isStreaming && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [summary, isStreaming]);

  return (
    <div style={{ padding: "4px 12px 12px 0" }}>
      <div
        ref={containerRef}
        style={{
          padding: "12px 14px",
          background: "var(--vscode-editor-background, #1e1e1e)",
          borderRadius: "6px",
          border: "1px solid var(--vscode-widget-border, #454545)",
          fontFamily: "var(--vscode-editor-font-family, monospace)",
          fontSize: "13px",
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          overflowWrap: "break-word",
          color: "var(--vscode-foreground, #cccccc)",
          maxHeight: "400px",
          overflowY: "auto",
          overflowX: "hidden",
          lineHeight: "1.6",
          // Custom scrollbar styling
          scrollbarWidth: "thin",
          scrollbarColor: "var(--vscode-scrollbarSlider-background) transparent",
        }}
      >
        {summary}
        {isStreaming && (
          <span
            style={{
              display: "inline-block",
              width: "6px",
              height: "12px",
              background: "var(--vscode-editor-foreground)",
              marginLeft: "2px",
              verticalAlign: "middle",
              animation: "context-cursor-blink 0.6s step-end infinite",
            }}
          />
        )}
      </div>

      {!isStreaming && !isAccepted && !isRejected && (
        <div
          style={{
            display: "flex",
            gap: "6px",
            padding: "8px 0 4px 0",
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={() => onConfirm(summary)}
            style={{
              background: `color-mix(in srgb, var(--vscode-editorBracketHighlight-foreground2, #10b981) 15%, transparent)`,
              color: "var(--vscode-editorBracketHighlight-foreground2, #10b981)",
              border: `1px solid color-mix(in srgb, var(--vscode-editorBracketHighlight-foreground2, #10b981) 30%, transparent)`,
              padding: "4px 10px",
              borderRadius: "6px",
              fontSize: "11px",
              fontWeight: 600,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              height: "24px",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = `color-mix(in srgb, var(--vscode-editorBracketHighlight-foreground2, #10b981) 25%, transparent)`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = `color-mix(in srgb, var(--vscode-editorBracketHighlight-foreground2, #10b981) 15%, transparent)`;
            }}
          >
            <Check size={14} strokeWidth={2.5} />
            <span>Accept</span>
          </button>

          <button
            onClick={onReject}
            style={{
              background: `color-mix(in srgb, var(--vscode-errorForeground, #ff4d4d) 15%, transparent)`,
              color: "var(--vscode-errorForeground, #ff4d4d)",
              border: `1px solid color-mix(in srgb, var(--vscode-errorForeground, #ff4d4d) 30%, transparent)`,
              padding: "4px 10px",
              borderRadius: "6px",
              fontSize: "11px",
              fontWeight: 600,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              height: "24px",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = `color-mix(in srgb, var(--vscode-errorForeground, #ff4d4d) 25%, transparent)`;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = `color-mix(in srgb, var(--vscode-errorForeground, #ff4d4d) 15%, transparent)`;
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
            <span>Reject</span>
          </button>
        </div>
      )}

      <style>{`
        @keyframes context-cursor-blink {
          0%, 100% { opacity: 0.8; }
          50%       { opacity: 0; }
        }
        
        /* Webkit scrollbar styling */
        div[style*="overflowY"]::-webkit-scrollbar {
          width: 10px;
        }
        
        div[style*="overflowY"]::-webkit-scrollbar-track {
          background: transparent;
        }
        
        div[style*="overflowY"]::-webkit-scrollbar-thumb {
          background: var(--vscode-scrollbarSlider-background);
          border-radius: 5px;
        }
        
        div[style*="overflowY"]::-webkit-scrollbar-thumb:hover {
          background: var(--vscode-scrollbarSlider-hoverBackground);
        }
      `}</style>
    </div>
  );
};

export default ContextCompressionBlock;
