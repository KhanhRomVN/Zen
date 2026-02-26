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
  maxLines?: number;
  showCopyButton?: boolean; // Still useful in ToolHeader or here? User said headers/dotUI in ChatPanel.
  isCollapsed?: boolean;
  showLineNumbers?: boolean;
  startLineNumber?: number;
  lineHighlights?: {
    startLine: number;
    endLine: number;
    type: "added" | "removed";
  }[];
  backgroundColor?: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({
  code,
  language,
  filename,
  maxLines,
  isCollapsed = false,
  showLineNumbers = true,
  startLineNumber = 1,
  lineHighlights,
  backgroundColor,
}) => {
  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef<string | null>(null);
  const { themeKind, themeId, themeVersion } = useTheme();
  const effectiveLanguage = language || getLanguageFromFilename(filename);

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
      lineHighlights,
      startLineNumber,
      showLineNumbers,
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

  const lineCount = code.trim().split("\n").length;
  const lineNumberWidth = `${Math.max(3, lineCount.toString().length) + 1}ch`;

  if (isCollapsed) return null;

  return (
    <div
      className={`code-block-container shiki-mode ${!showLineNumbers ? "no-line-numbers" : ""}`}
      style={
        {
          backgroundColor: backgroundColor || "var(--vscode-editor-background)",
          "--line-number-width": lineNumberWidth,
        } as React.CSSProperties
      }
    >
      <div
        className="code-content-wrapper"
        style={{
          maxLines: maxLines ? `${maxLines * 20}px` : "none",
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
