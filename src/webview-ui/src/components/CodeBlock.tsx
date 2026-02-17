import React, { useState, useEffect, useRef } from "react";
import "./CodeBlock.css";
import { getFileIconPath } from "../utils/fileIconMapper";

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
}) => {
  const [copied, setCopied] = useState(false);
  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef<string | null>(null);

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
      requestId,
    });

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [code, effectiveLanguage]);

  const handleCopy = async () => {
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

  return (
    <div
      className="code-block-container shiki-mode"
      style={{
        backgroundColor: backgroundColor || "var(--vscode-editor-background)",
      }}
    >
      {(filename || showCopyButton) && (
        <div className="code-block-header">
          <div className="file-info">
            {icon || (
              <img
                src={getIconForLanguage(effectiveLanguage)}
                alt=""
                className="file-icon"
              />
            )}
            <span className="file-name">
              {displayPath || effectiveLanguage}
            </span>
          </div>
          <div className="header-actions">
            {headerActions}
            {showCopyButton && (
              <button
                className="copy-button"
                onClick={handleCopy}
                title="Copy code"
              >
                {copied ? (
                  <svg viewBox="0 0 16 16" width="14" height="14">
                    <path
                      fill="currentColor"
                      d="M13.7 3.3L12.3 1.9c-.4-.4-1-.4-1.4 0L5.3 7.6 3.7 6c-.4-.4-1-.4-1.4 0L.9 7.4c-.4.4-.4 1 0 1.4l3.1 3.1c.4.4 1 .4 1.4 0l7.3-7.3c.4-.4.4-1.1 0-1.5z"
                    />
                  </svg>
                ) : (
                  <svg viewBox="0 0 16 16" width="14" height="14">
                    <path
                      fill="currentColor"
                      d="M13 1H5a2 2 0 00-2 2v1H2a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-1h1a2 2 0 002-2V3a2 2 0 00-2-2zM10 14H2V6h8v8zm4-4h-2V5a2 2 0 00-2-2H5V3h8v7z"
                    />
                  </svg>
                )}
                <span>{copied ? "Copied!" : "Copy"}</span>
              </button>
            )}
          </div>
        </div>
      )}

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
    </div>
  );
};
