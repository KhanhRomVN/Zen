import React, { useRef, useEffect } from "react";
import "./ThinkingBlock.css";

interface ThinkingRendererProps {
  content: string;
  maxHeight?: number | string;
  isStreaming?: boolean;
}

export const ThinkingRenderer: React.FC<ThinkingRendererProps> = ({
  content,
  maxHeight = 240,
  isStreaming = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when content updates (streaming)
  useEffect(() => {
    if (isStreaming && containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [content, isStreaming]);

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "4px",
        paddingLeft: "12px",
      }}
    >
      {/* Content container - no background, no padding, no dot, no scrollbar */}
      <div
        ref={containerRef}
        style={{
          fontFamily: "var(--vscode-editor-font-family, monospace)",
          fontSize: "12px",
          lineHeight: "1.5",
          color:
            "var(--vscode-descriptionForeground, var(--vscode-editor-foreground))",
          opacity: 0.75,
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          maxHeight:
            typeof maxHeight === "number" ? `${maxHeight}px` : maxHeight,
          overflowY: "hidden",
          padding: 0,
          border: "none",
          background: "transparent",
          outline: "none",
          flex: 1,
        }}
      >
        {content}
        {isStreaming && (
          <span
            style={{
              display: "inline-block",
              width: "6px",
              height: "12px",
              background: "var(--vscode-editor-foreground)",
              marginLeft: "2px",
              verticalAlign: "middle",
              animation: "thinking-cursor-blink 0.6s step-end infinite",
            }}
          />
        )}
      </div>

      <style>{`
        @keyframes thinking-cursor-blink {
          0%, 100% { opacity: 0.8; }
          50%       { opacity: 0; }
        }
      `}</style>
    </div>
  );
};

export default ThinkingRenderer;
