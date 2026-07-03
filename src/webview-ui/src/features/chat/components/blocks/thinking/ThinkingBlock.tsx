import React from "react";
import "./ThinkingBlock.css";

interface ThinkingRendererProps {
  content: string;
}

export const ThinkingRenderer: React.FC<ThinkingRendererProps> = ({
  content,
}) => {
  return (
    <div style={{ paddingBottom: "8px" }}>
      <div style={{ paddingLeft: "29px", paddingTop: "4px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            marginBottom: "6px",
          }}
        >
          <span
            style={{
              fontSize: "10px",
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase",
              color: "var(--vscode-editorBracketHighlight-foreground2, #a855f7)",
              opacity: 0.85,
            }}
          >
            Thinking
          </span>
        </div>
        <div
          style={{
            padding: "6px 10px",
            background:
              "var(--vscode-editor-background, var(--vscode-textCodeBlock-background))",
            borderRadius: "4px",
            border:
              "1px solid color-mix(in srgb, var(--vscode-editorBracketHighlight-foreground2, #a855f7) 20%, var(--vscode-widget-border, rgba(255,255,255,0.08)))",
            fontFamily: "var(--vscode-editor-font-family, monospace)",
            fontSize: "11px",
            lineHeight: "1.5",
            color:
              "var(--vscode-descriptionForeground, var(--vscode-editor-foreground))",
            opacity: 0.85,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            maxHeight: "240px",
            overflowY: "auto",
            scrollbarWidth: "thin",
            scrollbarColor:
              "var(--vscode-scrollbarSlider-background) transparent",
          }}
        >
          {content}
        </div>
      </div>
    </div>
  );
};

export default ThinkingRenderer;