import React from "react";

interface CodeRendererProps {
  content: string;
  language?: string;
}

export const CodeRenderer: React.FC<CodeRendererProps> = ({
  content,
  language = "text",
}) => {
  return (
    <div style={{ paddingLeft: "29px", paddingTop: "4px" }}>
      <pre
        style={{
          margin: 0,
          padding: "8px",
          overflow: "auto",
          fontFamily: "var(--vscode-editor-font-family, monospace)",
          fontSize: "12px",
          background: "var(--vscode-editor-background)",
          borderRadius: "4px",
          border: "1px solid var(--vscode-widget-border, rgba(255,255,255,0.08))",
        }}
      >
        <code style={{ background: "none", padding: 0 }}>{content}</code>
      </pre>
    </div>
  );
};

export default CodeRenderer;