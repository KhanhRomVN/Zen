import React, { useState } from "react";
import { getFileIconPath } from "../../../../../utils/fileIconMapper";

interface CodeBlockHeaderProps {
  language: string;
  onCopy: () => void;
}

const CodeBlockHeader: React.FC<CodeBlockHeaderProps> = ({
  language,
  onCopy,
}) => {
  const [showCopied, setShowCopied] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);

  const handleCopy = () => {
    onCopy();
    setShowCopied(true);
    setTimeout(() => setShowCopied(false), 1000);
  };

  // Map common language names to file extensions for icon lookup
  const languageToExtension: Record<string, string> = {
    javascript: "js",
    typescript: "ts",
    python: "py",
    jsx: "jsx",
    tsx: "tsx",
    java: "java",
    cpp: "cpp",
    c: "c",
    csharp: "cs",
    go: "go",
    rust: "rs",
    php: "php",
    ruby: "rb",
    swift: "swift",
    kotlin: "kt",
    html: "html",
    css: "css",
    scss: "scss",
    json: "json",
    yaml: "yaml",
    yml: "yml",
    xml: "xml",
    markdown: "md",
    sql: "sql",
    shell: "sh",
    bash: "sh",
    powershell: "ps1",
    dockerfile: "dockerfile",
  };

  const extension =
    languageToExtension[language.toLowerCase()] || language.toLowerCase();
  const iconPath = getFileIconPath(`file.${extension}`);

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "6px 6px",
        background: "var(--vscode-editor-background)",
        borderBottom:
          "1px solid var(--vscode-widget-border, rgba(255,255,255,0.08))",
        borderTopLeftRadius: "4px",
        borderTopRightRadius: "4px",
        minHeight: "32px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
        <img
          src={iconPath}
          alt={language}
          style={{ width: "16px", height: "16px" }}
        />
        <span
          style={{
            fontSize: "12px",
            color: "var(--vscode-descriptionForeground)",
            fontFamily: "var(--vscode-font-family)",
          }}
        >
          {language}
        </span>
      </div>
      <button
        onClick={handleCopy}
        style={{
          background: "transparent",
          border: "none",
          color: showCopied
            ? "var(--vscode-gitDecoration-addedResourceForeground, #3fb950)"
            : "var(--vscode-foreground)",
          cursor: "pointer",
          opacity: isHovered || showCopied ? 1 : 0,
          display: "flex",
          alignItems: "center",
          padding: "4px",
          transition: "opacity 0.2s, color 0.2s",
          visibility: "visible",
        }}
        title={showCopied ? "Copied!" : "Copy Code"}
      >
        {showCopied ? (
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
            <path d="M20 6 9 17l-5-5" />
          </svg>
        ) : (
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
            <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
            <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
          </svg>
        )}
      </button>
    </div>
  );
};

interface CodeBlockProps {
  code: string;
  language?: string;
  diffStats?: { added: number; removed: number };
  isDiffBlock?: boolean;
  prefix?: string;
  statusColor?: string;
  enableWordWrap?: boolean;
  maxHeight?: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({
  code,
  language,
  diffStats,
  isDiffBlock = false,
  prefix,
  statusColor,
  enableWordWrap = true,
  maxHeight,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(isDiffBlock);
  const [isCopied, setIsCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Use simple CodeBlockHeader when language is available and no diff/prefix
  const useSimpleHeader = language && !isDiffBlock && !prefix && !diffStats;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0px",
        marginBottom: "8px",
        border: "1px solid var(--vscode-widget-border, rgba(255,255,255,0.08))",
        borderRadius: "4px",
        overflow: "hidden",
      }}
    >
      {useSimpleHeader ? (
        <CodeBlockHeader language={language} onCopy={handleCopy} />
      ) : (
        language && <CodeBlockHeader language={language} onCopy={handleCopy} />
      )}
      {!isCollapsed && (
        <div style={{ paddingLeft: useSimpleHeader ? "0" : "0" }}>
          <pre
            style={{
              margin: 0,
              padding: "8px",
              overflow: "auto",
              fontFamily: "var(--vscode-editor-font-family, monospace)",
              fontSize: "12px",
              background: "var(--vscode-editor-background)",
              borderRadius: "0",
              whiteSpace: enableWordWrap ? "pre-wrap" : "pre",
              wordWrap: enableWordWrap ? "break-word" : "normal",
              wordBreak: enableWordWrap ? "break-word" : "normal",
              overflowWrap: enableWordWrap ? "break-word" : "normal",
              overflowX: enableWordWrap ? "hidden" : "auto",
              maxHeight: maxHeight,
            }}
          >
            <code style={{ background: "none", padding: 0 }}>{code}</code>
          </pre>
        </div>
      )}
    </div>
  );
};

// Legacy export for backward compatibility
export const CodeRenderer: React.FC<{
  content: string;
  language?: string;
}> = ({ content, language = "text" }) => {
  return <CodeBlock code={content} language={language} enableWordWrap={true} />;
};

export default CodeBlock;