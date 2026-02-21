import React, { useState, useEffect, useRef } from "react";
import "./CodeBlock.css";
import { getFileIconPath } from "../utils/fileIconMapper";
import { useTheme } from "../context/ThemeContext";

// Helper: Map file extensions to language IDs (for Shiki)
const getLanguageFromFilename = (filename?: string): string => {
  if (!filename) return "plaintext";

  const ext = filename.split(".").pop()?.toLowerCase();
  const languageMap: Record<string, string> = {
    ts: "typescript",
    tsx: "typescript",
    js: "javascript",
    jsx: "javascript",
    py: "python",
    rs: "rust",
    go: "go",
    java: "java",
    cpp: "cpp",
    c: "c",
    cs: "csharp",
    rb: "ruby",
    php: "php",
    swift: "swift",
    kt: "kotlin",
    html: "html",
    css: "css",
    scss: "scss",
    json: "json",
    xml: "xml",
    yaml: "yaml",
    yml: "yaml",
    md: "markdown",
    sh: "shellscript",
    bash: "shellscript",
    sql: "sql",
  };

  return languageMap[ext || ""] || "plaintext";
};

// Helper: Truncate long paths intelligently
const truncatePath = (path?: string): string => {
  if (!path) return "";
  const segments = path.split(/[/\\]/);
  if (segments.length <= 3) return path;
  const first = segments[0];
  const lastTwo = segments.slice(-2).join("/");
  return `${first}/../${lastTwo}`;
};

interface CodeBlockProps {
  code: string;
  language?: string;
  filename?: string;
  maxLines?: number; // Keep for height limiting if needed
  showCopyButton?: boolean;
  icon?: React.ReactNode;
  headerActions?: React.ReactNode;
  lineHighlights?: {
    startLine: number;
    endLine: number;
    type: "added" | "removed";
  }[];
  backgroundColor?: string;
  startLineNumber?: number;
  showLineNumbers?: boolean; // 🆕 Control line number visibility
  diffStats?: {
    added: number;
    removed: number;
  };
  defaultCollapsed?: boolean;
  prefix?: string;
  statusColor?: string;
  isCollapsible?: boolean;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({
  code,
  language,
  filename,
  maxLines,
  showCopyButton = true,
  icon,
  headerActions,
  lineHighlights,
  backgroundColor,
  startLineNumber = 1,
  showLineNumbers = true,
  diffStats,
  defaultCollapsed = false,
  prefix,
  statusColor,
  isCollapsible = true,
}) => {
  const [copied, setCopied] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(
    defaultCollapsed && isCollapsible,
  );
  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef<string | null>(null);
  const { themeKind, themeId, themeVersion } = useTheme();
  const effectiveLanguage = language || getLanguageFromFilename(filename);
  const displayPath = truncatePath(filename);

  // Handle Highlighting via Extension (Shiki Backend)
  useEffect(() => {
    const vscodeApi = (window as any).vscodeApi;
    if (!vscodeApi) return;

    const requestId = `highlight-${Date.now()}-${Math.random()}`;
    requestIdRef.current = requestId;

    const handleMessage = (event: MessageEvent) => {
      const msg = event.data;
      if (
        msg.command === "highlightCodeResult" &&
        msg.requestId === requestId
      ) {
        if (msg.error) {
          setError(msg.error);
        } else {
          setHighlightedHtml(msg.html);
        }
      }
    };

    window.addEventListener("message", handleMessage);

    vscodeApi.postMessage({
      command: "highlightCode",
      code,
      language: effectiveLanguage,
      themeKind,
      themeId,
      requestId,
      lineHighlights, // 🆕 Pass highlights
      startLineNumber, // 🆕 Pass start line
      showLineNumbers, // 🆕 Pass toggle
    });

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [
    code,
    effectiveLanguage,
    themeKind,
    themeId,
    themeVersion,
    lineHighlights,
    startLineNumber,
    showLineNumbers,
  ]);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation(); // Avoid collapsing when clicking copy
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy code:", err);
    }
  };

  const getIconForLanguage = (lang: string) => {
    const extRaw = filename?.split(".").pop()?.toLowerCase();
    const ext = extRaw || "txt";
    return getFileIconPath(`file.${ext}`);
  };

  // Calculate dynamic line number width
  const lineCount = code.trim().split("\n").length;
  // Base width is number of digits + padding
  const lineNumberWidth = `${Math.max(3, lineCount.toString().length) + 1}ch`;

  return (
    <div
      className={`code-block-container shiki-mode ${isCollapsed ? "collapsed" : ""} ${!showLineNumbers ? "no-line-numbers" : ""}`}
      style={
        {
          // 🆕 Only apply backgroundColor when expanded, transparent when collapsed
          backgroundColor: isCollapsed
            ? "transparent"
            : backgroundColor || "var(--vscode-editor-background)",
          "--line-number-width": lineNumberWidth, // Pass to CSS
        } as React.CSSProperties
      }
    >
      {(filename || showCopyButton || diffStats) && (
        <>
          {isCollapsed ? (
            // 🆕 Collapsed State: Inline summary (no header wrapper, just a simple line)
            <div
              className="code-block-summary"
              onClick={() => isCollapsible && setIsCollapsed(!isCollapsed)}
              style={{
                cursor: isCollapsible ? "pointer" : "default",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 0", // 🆕 No left/right padding
                fontSize: "13px",
              }}
            >
              <span
                className="collapse-icon codicon codicon-chevron-right"
                style={{ fontSize: "12px" }}
              />
              {statusColor && (
                <span
                  className="status-dot"
                  style={{
                    backgroundColor: statusColor,
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    display: "inline-block",
                  }}
                />
              )}
              {prefix && (
                <span
                  className="header-prefix"
                  style={{
                    fontWeight: 500,
                    color: "var(--vscode-foreground)",
                  }}
                >
                  {prefix}
                </span>
              )}
              <span
                className="file-name"
                style={{
                  color: "var(--vscode-textLink-foreground)",
                  fontFamily: "var(--vscode-editor-font-family)",
                }}
              >
                {displayPath || effectiveLanguage}
              </span>
              {diffStats && (
                <span
                  className="diff-stats"
                  style={{
                    display: "flex",
                    gap: "6px",
                    fontSize: "12px",
                    fontFamily: "monospace",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      color:
                        "var(--vscode-gitDecoration-addedResourceForeground)",
                    }}
                  >
                    +{diffStats.added}
                  </span>
                  <span
                    style={{
                      color:
                        "var(--vscode-gitDecoration-deletedResourceForeground)",
                    }}
                  >
                    -{diffStats.removed}
                  </span>
                </span>
              )}
            </div>
          ) : (
            // 🆕 Expanded State: Full header with proper layout
            <div
              className="code-block-header"
              onClick={() => isCollapsible && setIsCollapsed(!isCollapsed)}
              style={{ cursor: isCollapsible ? "pointer" : "default" }}
            >
              <div className="file-info">
                {isCollapsible && (
                  <span
                    className="collapse-icon codicon codicon-chevron-down"
                    style={{ fontSize: "12px" }}
                  />
                )}
                {statusColor && (
                  <span
                    className="status-dot"
                    style={{
                      backgroundColor: statusColor,
                    }}
                  />
                )}
                {prefix && <span className="header-prefix">{prefix}</span>}
                {icon || (
                  <img
                    src={
                      filename
                        ? getFileIconPath(filename)
                        : getIconForLanguage(effectiveLanguage)
                    }
                    alt=""
                    className="file-icon"
                  />
                )}
                <span className="file-name">
                  {displayPath || effectiveLanguage}
                </span>
                {diffStats && (
                  <span
                    className="diff-stats"
                    style={{
                      display: "flex",
                      gap: "6px",
                      fontSize: "12px",
                      fontFamily: "monospace",
                      alignItems: "center",
                    }}
                  >
                    <span
                      style={{
                        color:
                          "var(--vscode-gitDecoration-addedResourceForeground)",
                      }}
                    >
                      +{diffStats.added}
                    </span>
                    <span
                      style={{
                        color:
                          "var(--vscode-gitDecoration-deletedResourceForeground)",
                      }}
                    >
                      -{diffStats.removed}
                    </span>
                  </span>
                )}
              </div>
              <div className="header-actions">
                {headerActions}
                {showCopyButton && (
                  <button
                    className="copy-button"
                    onClick={handleCopy}
                    title={copied ? "Copied!" : "Copy code"}
                  >
                    {copied ? (
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="#3fb950"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="lucide lucide-check"
                      >
                        <polyline points="20 6 9 17 4 12" />
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
                        className="lucide lucide-copy"
                      >
                        <rect
                          width="14"
                          height="14"
                          x="8"
                          y="8"
                          rx="2"
                          ry="2"
                        />
                        <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                      </svg>
                    )}
                  </button>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {!isCollapsed && (
        <div
          className="code-content-wrapper"
          style={{
            maxHeight: maxLines ? `${maxLines * 20}px` : "none",
            overflowY: "auto",
          }}
        >
          {highlightedHtml ? (
            <div
              className="shiki-highlighted"
              dangerouslySetInnerHTML={{ __html: highlightedHtml }}
            />
          ) : (
            <pre className="plaintext-fallback">
              <code>{code}</code>
            </pre>
          )}
        </div>
      )}
    </div>
  );
};
