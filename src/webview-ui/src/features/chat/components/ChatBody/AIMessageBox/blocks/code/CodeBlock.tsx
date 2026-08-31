import React, { useState, useRef, useEffect, useMemo } from "react";
import { getFileIconPath } from "../../../../../../../utils/fileIconMapper";
import { DiffHighlight } from "../../../../../../../utils/diffUtils";

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
  /** Optional: highlight specific lines as added/removed (1-based line numbers) */
  lineHighlights?: DiffHighlight[];
  /** Auto-scroll to the first highlighted diff line on mount */
  autoScrollToDiff?: boolean;
  /** Hide the code block header */
  hideHeader?: boolean;
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
  lineHighlights,
  autoScrollToDiff = false,
  hideHeader = false,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const bodyRef = useRef<HTMLDivElement>(null);
  const firstDiffRef = useRef<HTMLDivElement>(null);

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  // Use simple CodeBlockHeader when language is available and no diff/prefix
  const useSimpleHeader = language && !isDiffBlock && !prefix && !diffStats;

  // Build a map: line number (1-based) → highlight type
  const highlightMap = useMemo(() => {
    if (!lineHighlights || lineHighlights.length === 0) return null;
    const map = new Map<number, "added" | "removed">();
    lineHighlights.forEach((h) => {
      for (let i = h.startLine; i <= h.endLine; i++) {
        map.set(i, h.type);
      }
    });
    return map;
  }, [lineHighlights]);

  const hasHighlights = highlightMap !== null;

  // Find the first highlighted line index (0-based)
  const firstDiffLineIndex = useMemo(() => {
    if (!hasHighlights) return -1;
    const lines = code.split("\n");
    for (let i = 0; i < lines.length; i++) {
      if (highlightMap!.has(i + 1)) return i;
    }
    return -1;
  }, [code, hasHighlights, highlightMap]);

  // Auto-scroll to first diff line on mount or when highlights change
  useEffect(() => {
    if (!autoScrollToDiff || !hasHighlights || firstDiffLineIndex === -1) return;
    const timer = setTimeout(() => {
      if (firstDiffRef.current) {
        firstDiffRef.current.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [autoScrollToDiff, hasHighlights, firstDiffLineIndex]);

  // Render body: diff-highlighted lines or plain <pre><code>
  const renderBody = () => {
    if (hasHighlights && highlightMap) {
      const lines = code.split("\n");
      return (
        <div
          ref={bodyRef}
          style={{
            overflow: "auto",
            maxHeight: maxHeight,
            fontFamily: "var(--vscode-editor-font-family, monospace)",
            fontSize: "12px",
            lineHeight: "1.5",
            background: "var(--vscode-editor-background)",
          }}
        >
          {lines.map((line, index) => {
            const lineNum = index + 1;
            const highlightType = highlightMap.get(lineNum);
            const isFirstDiff = index === firstDiffLineIndex;

            let color = "var(--vscode-editor-foreground)";
            let backgroundColor = "transparent";

            if (highlightType === "added") {
              color =
                "var(--vscode-gitDecoration-addedResourceForeground, #3fb950)";
              backgroundColor =
                "color-mix(in srgb, var(--vscode-gitDecoration-addedResourceForeground, #3fb950) 10%, transparent)";
            } else if (highlightType === "removed") {
              color =
                "var(--vscode-gitDecoration-deletedResourceForeground, #f14c4c)";
              backgroundColor =
                "color-mix(in srgb, var(--vscode-gitDecoration-deletedResourceForeground, #f14c4c) 10%, transparent)";
            }

            return (
              <div
                key={index}
                ref={isFirstDiff ? firstDiffRef : undefined}
                style={{
                  padding: "0",
                  whiteSpace: enableWordWrap ? "pre-wrap" : "pre",
                  wordBreak: enableWordWrap ? "break-word" : "normal",
                  overflowWrap: enableWordWrap ? "break-word" : "normal",
                  minHeight: "20px",
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "0",
                }}
              >
                <span
                  style={{
                    flexShrink: 0,
                    width: "44px",
                    textAlign: "right",
                    opacity: 0.4,
                    fontSize: "11px",
                    userSelect: "none",
                    paddingRight: "8px",
                    background: "var(--vscode-editor-background)",
                  }}
                >
                  {lineNum}
                </span>
                <span
                  style={{
                    flex: 1,
                    color,
                    backgroundColor,
                    paddingLeft: "8px",
                    paddingRight: "8px",
                  }}
                >
                  {line}
                </span>
              </div>
            );
          })}
        </div>
      );
    }

    // Default: plain <pre><code>
    return (
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
    );
  };

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
      {!hideHeader && useSimpleHeader ? (
        <CodeBlockHeader language={language} onCopy={handleCopy} />
      ) : (
        !hideHeader &&
        language && <CodeBlockHeader language={language} onCopy={handleCopy} />
      )}
      {!isCollapsed && renderBody()}
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
