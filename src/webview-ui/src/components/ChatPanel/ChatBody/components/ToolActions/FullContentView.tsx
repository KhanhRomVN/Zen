import React from "react";

interface FullContentViewProps {
  filePath: string;
  content: string;
  beforeContent: string | null; // null = CREATE, non-null = REWRITE
}

const getLanguage = (filePath: string): string => {
  const ext = filePath.split(".").pop()?.toLowerCase() || "";
  const map: Record<string, string> = {
    ts: "typescript",
    tsx: "tsx",
    js: "javascript",
    jsx: "jsx",
    py: "python",
    rs: "rust",
    go: "go",
    java: "java",
    c: "c",
    cpp: "cpp",
    cs: "csharp",
    css: "css",
    scss: "scss",
    html: "html",
    json: "json",
    yaml: "yaml",
    yml: "yaml",
    md: "markdown",
    sh: "bash",
    bash: "bash",
    xml: "xml",
    sql: "sql",
    php: "php",
    rb: "ruby",
    kt: "kotlin",
    swift: "swift",
    dart: "dart",
  };
  return map[ext] || "text";
};

const getBasename = (filePath: string): string => {
  return filePath.split(/[\\/]/).pop() || filePath;
};

export const FullContentView: React.FC<FullContentViewProps> = ({
  filePath,
  content,
  beforeContent,
}) => {
  const isCreate = beforeContent === null;
  const basename = getBasename(filePath);
  const _language = getLanguage(filePath); // reserved for future syntax highlighting
  const lines = content ? content.split("\n") : [];
  const lineCount = lines.length;

  const badgeStyle: React.CSSProperties = {
    display: "inline-block",
    padding: "1px 6px",
    borderRadius: "3px",
    fontSize: "10px",
    fontWeight: 700,
    letterSpacing: "0.04em",
    textTransform: "uppercase" as const,
    color: isCreate
      ? "var(--vscode-gitDecoration-addedResourceForeground)"
      : "var(--vscode-gitDecoration-modifiedResourceForeground)",
    border: `1px solid ${
      isCreate
        ? "var(--vscode-gitDecoration-addedResourceForeground)"
        : "var(--vscode-gitDecoration-modifiedResourceForeground)"
    }`,
    opacity: 0.9,
  };

  const containerStyle: React.CSSProperties = {
    borderRadius: "6px",
    overflow: "hidden",
    border: "1px solid var(--vscode-widget-border, rgba(255,255,255,0.1))",
    marginTop: "6px",
  };

  const headerStyle: React.CSSProperties = {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "6px 10px",
    background: "var(--vscode-editor-background, var(--vscode-textCodeBlock-background))",
    borderBottom: "1px solid var(--vscode-widget-border, rgba(255,255,255,0.1))",
    fontSize: "12px",
    fontFamily: "var(--vscode-editor-font-family, monospace)",
  };

  const contentAreaStyle: React.CSSProperties = {
    maxHeight: "400px",
    overflowY: "auto",
    background: "var(--vscode-editor-background, var(--vscode-textCodeBlock-background))",
  };

  const tableStyle: React.CSSProperties = {
    width: "100%",
    borderCollapse: "collapse",
    fontFamily: "var(--vscode-editor-font-family, monospace)",
    fontSize: "12px",
  };

  const lineNumCellStyle: React.CSSProperties = {
    width: "40px",
    minWidth: "40px",
    textAlign: "right",
    paddingRight: "12px",
    paddingLeft: "8px",
    color: "var(--vscode-editorLineNumber-foreground, rgba(255,255,255,0.3))",
    userSelect: "none",
    verticalAlign: "top",
    lineHeight: "1.5",
    whiteSpace: "nowrap",
  };

  const codeLineStyle: React.CSSProperties = {
    paddingLeft: "8px",
    paddingRight: "16px",
    color: "var(--vscode-editor-foreground)",
    whiteSpace: "pre",
    verticalAlign: "top",
    lineHeight: "1.5",
    wordBreak: "break-all",
  };

  if (!content) {
    return (
      <div style={containerStyle}>
        <div style={headerStyle}>
          <span style={{ color: "var(--vscode-editor-foreground)", fontWeight: 600, opacity: 0.9 }}>
            {basename}
          </span>
          <span style={badgeStyle}>{isCreate ? "CREATE" : "REWRITE"}</span>
        </div>
        <div
          style={{
            padding: "16px",
            textAlign: "center",
            color: "var(--vscode-descriptionForeground)",
            fontSize: "12px",
            fontStyle: "italic",
            background: "var(--vscode-editor-background, var(--vscode-textCodeBlock-background))",
          }}
        >
          Empty file
        </div>
      </div>
    );
  }

  return (
    <div style={containerStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <span
          style={{
            color: "var(--vscode-editor-foreground)",
            fontWeight: 600,
            opacity: 0.9,
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {basename}
        </span>
        <span
          style={{
            color: "var(--vscode-descriptionForeground)",
            fontSize: "11px",
            opacity: 0.7,
            whiteSpace: "nowrap",
          }}
        >
          {lineCount} {lineCount === 1 ? "line" : "lines"}
        </span>
        <span style={badgeStyle}>{isCreate ? "CREATE" : "REWRITE"}</span>
      </div>

      {/* Content area with line numbers */}
      <div style={contentAreaStyle}>
        <table style={tableStyle}>
          <tbody>
            {lines.map((line, idx) => (
              <tr key={idx}>
                <td style={lineNumCellStyle}>{idx + 1}</td>
                <td style={codeLineStyle}>{line}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default FullContentView;
