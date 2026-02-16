import React, { useState } from "react";
import Editor, { loader } from "@monaco-editor/react";
import "./CodeBlock.css";
import { getFileIconPath } from "../utils/fileIconMapper";

// Configure Monaco loader to use local files from the extension
// This assumes CopyWebpackPlugin copies 'node_modules/monaco-editor/min/vs' to 'dist/vs'
loader.config({
  paths: {
    vs: (window as any).__zenMonacoVsUri || "./vs",
  },
});

// Helper: Map file extensions to Monaco language IDs
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
    sh: "shell",
    bash: "shell",
    sql: "sql",
  };

  return languageMap[ext || ""] || "plaintext";
};

// Helper: Truncate long paths intelligently
const truncatePath = (path?: string): string => {
  if (!path) return "";

  const segments = path.split(/[/\\]/);

  // If path is short enough, return as-is
  if (segments.length <= 3) return path;

  // Format: first_segment/../last_two_segments
  const first = segments[0];
  const lastTwo = segments.slice(-2).join("/");

  return `${first}/../${lastTwo}`;
};

// Custom Monaco theme matching VS Code's default dark+ theme
const defineCustomTheme = (monaco: any, colors?: any, force = false) => {
  console.log(
    "[CodeBlock] defineCustomTheme called with colors:",
    colors,
    "force:",
    force,
  );

  try {
    const c = colors || {
      // Fallback colors (Dark theme defaults)
      keyword: "#C586C0",
      keywordControl: "#C586C0",
      keywordOperator: "#D4D4D4",
      storageType: "#569CD6",
      entityNameFunction: "#DCDCAA",
      metaFunctionCall: "#DCDCAA",
      entityNameType: "#4EC9B0",
      entityNameClass: "#4EC9B0",
      supportType: "#4EC9B0",
      supportClass: "#4EC9B0",
      variable: "#9CDCFE",
      variableParameter: "#9CDCFE",
      string: "#CE9178",
      stringEscape: "#D7BA7D",
      comment: "#6A9955",
      number: "#B5CEA8",
      constant: "#4FC1FF",
      punctuation: "#D4D4D4",
    };

    console.log("[CodeBlock] Using colors for theme:", c);

    const stripHash = (color: string) => color.replace("#", "");

    monaco.editor.defineTheme("vscode-dark-plus", {
      base: "vs-dark",
      inherit: true,
      rules: [
        // Keywords - cover all variants
        { token: "keyword", foreground: stripHash(c.keyword) },
        { token: "keyword.control", foreground: stripHash(c.keywordControl) },
        { token: "keyword.operator", foreground: stripHash(c.keywordOperator) },
        {
          token: "keyword.control.flow",
          foreground: stripHash(c.keywordControl),
        },
        {
          token: "keyword.control.import",
          foreground: stripHash(c.keywordControl),
        },

        // Storage/Types - Python specific
        { token: "storage", foreground: stripHash(c.storageType) },
        { token: "storage.type", foreground: stripHash(c.storageType) },
        {
          token: "storage.type.function",
          foreground: stripHash(c.keywordControl),
        }, // 'def' in Python
        {
          token: "storage.type.class",
          foreground: stripHash(c.keywordControl),
        }, // 'class' in Python

        // Functions - all variants
        {
          token: "entity.name.function",
          foreground: stripHash(c.entityNameFunction),
        },
        {
          token: "meta.function-call",
          foreground: stripHash(c.metaFunctionCall),
        },
        { token: "meta.function", foreground: stripHash(c.entityNameFunction) },
        {
          token: "support.function",
          foreground: stripHash(c.entityNameFunction),
        },

        // Types/Classes - comprehensive coverage
        { token: "entity.name.type", foreground: stripHash(c.entityNameType) },
        {
          token: "entity.name.class",
          foreground: stripHash(c.entityNameClass),
        },
        { token: "support.type", foreground: stripHash(c.supportType) },
        { token: "support.class", foreground: stripHash(c.supportClass) },
        { token: "type", foreground: stripHash(c.supportType) },
        { token: "type.identifier", foreground: stripHash(c.supportType) },

        // Variables - all variants
        { token: "variable", foreground: stripHash(c.variable) },
        {
          token: "variable.parameter",
          foreground: stripHash(c.variableParameter),
        },
        { token: "variable.other", foreground: stripHash(c.variable) },
        { token: "variable.language", foreground: stripHash(c.constant) },
        { token: "identifier", foreground: stripHash(c.variable) },

        // Strings - comprehensive
        { token: "string", foreground: stripHash(c.string) },
        { token: "string.quoted", foreground: stripHash(c.string) },
        { token: "string.quoted.single", foreground: stripHash(c.string) },
        { token: "string.quoted.double", foreground: stripHash(c.string) },
        { token: "string.escape", foreground: stripHash(c.stringEscape) },

        // Comments - all types
        { token: "comment", foreground: stripHash(c.comment) },
        { token: "comment.line", foreground: stripHash(c.comment) },
        { token: "comment.block", foreground: stripHash(c.comment) },
        { token: "comment.line.number-sign", foreground: stripHash(c.comment) },

        // Numbers - comprehensive
        { token: "number", foreground: stripHash(c.number) },
        { token: "constant.numeric", foreground: stripHash(c.number) },
        { token: "constant.numeric.decimal", foreground: stripHash(c.number) },
        { token: "constant.numeric.hex", foreground: stripHash(c.number) },

        // Constants - all variants
        { token: "constant", foreground: stripHash(c.constant) },
        { token: "constant.language", foreground: stripHash(c.constant) },
        { token: "constant.character", foreground: stripHash(c.constant) },

        // Punctuation
        { token: "punctuation", foreground: stripHash(c.punctuation) },
        {
          token: "punctuation.definition",
          foreground: stripHash(c.punctuation),
        },
        { token: "meta.brace", foreground: stripHash(c.punctuation) },
        { token: "delimiter", foreground: stripHash(c.punctuation) },
      ],
      colors: {
        "editor.background": "#1e1e1e",
        "editor.foreground": "#d4d4d4",
        "editorLineNumber.foreground": "#858585",
        "editorLineNumber.activeForeground": "#c6c6c6",
      },
    });

    console.log("[CodeBlock] Theme registered successfully");
  } catch (error) {
    console.error("[CodeBlock] Failed to define theme:", error);
  }
};

interface CodeBlockProps {
  code: string;
  language?: string;
  filename?: string;
  maxLines?: number;
  showCopyButton?: boolean;
  icon?: React.ReactNode;
  headerActions?: React.ReactNode;
  lineHighlights?: {
    startLine: number;
    endLine: number;
    type: "added" | "removed";
  }[];
  /* New props for custom styling */
  backgroundColor?: string;
  disableEditorPadding?: boolean;
  startLineNumber?: number; // New prop
  tokenColors?: any; // Dynamic token colors from VS Code theme
}

export const CodeBlock: React.FC<CodeBlockProps> = ({
  code,
  language = "javascript",
  filename,
  maxLines,
  showCopyButton = true,
  icon,
  headerActions,
  lineHighlights,
  backgroundColor,
  disableEditorPadding,
  startLineNumber,
  tokenColors,
}) => {
  const [copied, setCopied] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const editorRef = React.useRef<any>(null);
  const decorationsRef = React.useRef<string[]>([]);

  // Derive effective language from prop or filename
  const effectiveLanguage = language || getLanguageFromFilename(filename);

  // Truncate path for display
  const displayPath = truncatePath(filename);

  // Handle Copy
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy code:", err);
    }
  };

  const lineHeight = 20;

  // Map common language IDs to extensions for icon lookup
  const languageToExtension: Record<string, string> = {
    python: "py",
    javascript: "js",
    typescript: "ts",
    java: "java",
    c: "c",
    cpp: "cpp",
    csharp: "cs",
    go: "go",
    rust: "rs",
    php: "php",
    ruby: "rb",
    swift: "swift",
    kotlin: "kt",
    scala: "scala",
    html: "html",
    css: "css",
    scss: "scss",
    less: "less",
    json: "json",
    xml: "xml",
    yaml: "yaml",
    sql: "sql",
    shell: "sh",
    bash: "sh",
    powershell: "ps1",
    markdown: "md",
    dockerfile: "dockerfile",
    makefile: "makefile",
  };

  const getIconForLanguage = (lang: string) => {
    const ext = languageToExtension[lang.toLowerCase()] || lang;
    return getFileIconPath(`file.${ext}`);
  };

  const [editorHeight, setEditorHeight] = useState(
    maxLines ? maxLines * 20 : 100,
  );

  const currentMaxLines = maxLines || 15; // Default to 15 lines if not specified

  // Improved auto-height handler
  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;

    console.log("[CodeBlock] handleEditorDidMount - tokenColors:", tokenColors);

    // Define and apply custom theme with dynamic colors from VS Code
    try {
      defineCustomTheme(monaco, tokenColors);
      monaco.editor.setTheme("vscode-dark-plus");
      console.log("[CodeBlock] Applied custom theme successfully");
    } catch (error) {
      console.error("Failed to apply custom theme:", error);
    }

    const updateHeight = () => {
      const contentHeight = editor.getContentHeight();

      // Calculate max height based on line height
      const maxHeight = currentMaxLines * lineHeight;

      // Target height is the smaller of content height or max height
      // Monaco Editor handles its own padding via options.padding
      const targetHeight = Math.min(contentHeight, maxHeight) || lineHeight;

      setEditorHeight(targetHeight);

      editor.layout({
        width: editor.getLayoutInfo().width,
        height: targetHeight,
      });
    };

    editor.onDidContentSizeChange(updateHeight);

    // Initial update
    updateHeight();
    // Safety check after a delay
    setTimeout(updateHeight, 50);

    // Apply decorations if any
    if (lineHighlights && lineHighlights.length > 0) {
      const decorations = lineHighlights.map((h) => ({
        range: new monaco.Range(h.startLine, 1, h.endLine, 1),
        options: {
          isWholeLine: true,
          className:
            h.type === "added" ? "diff-line-added" : "diff-line-removed",
          marginClassName:
            h.type === "added" ? "diff-line-added" : "diff-line-removed",
          lineNumberClassName:
            h.type === "added" ? "diff-line-added" : "diff-line-removed",
        },
      }));
      decorationsRef.current = editor.deltaDecorations([], decorations);
    }
  };

  // Re-apply theme when tokenColors change
  React.useEffect(() => {
    if (editorRef.current && tokenColors) {
      const monaco = (window as any).monaco;
      if (monaco) {
        console.log(
          "[CodeBlock] Applying theme with updated tokenColors:",
          tokenColors,
        );
        defineCustomTheme(monaco, tokenColors, true);
        monaco.editor.setTheme("vscode-dark-plus");
      }
    }
  }, [tokenColors]);

  // Re-apply decorations when code or highlights change
  React.useEffect(() => {
    if (editorRef.current && lineHighlights) {
      const monaco = (window as any).monaco;
      if (!monaco) return;

      const decorations = lineHighlights.map((h) => ({
        range: new monaco.Range(h.startLine, 1, h.endLine, 1),
        options: {
          isWholeLine: true,
          className:
            h.type === "added" ? "diff-line-added" : "diff-line-removed",
          marginClassName:
            h.type === "added" ? "diff-line-added" : "diff-line-removed",
          lineNumberClassName:
            h.type === "added" ? "diff-line-added" : "diff-line-removed",
        },
      }));
      decorationsRef.current = editorRef.current.deltaDecorations(
        decorationsRef.current,
        decorations,
      );
    }
  }, [code, lineHighlights]);

  return (
    <div
      className={`code-block-container ${backgroundColor ? "has-custom-background" : ""}`}
      style={{
        backgroundColor: backgroundColor || "var(--vscode-editor-background)",
      }}
    >
      {(filename || showCopyButton) && (
        <div className="code-block-header">
          <div
            className="file-info"
            onClick={() => setIsCollapsed(!isCollapsed)}
            title={filename || ""}
            style={{
              fontWeight: filename ? "bold" : "normal",
              fontSize: filename ? "13px" : "12px",
              cursor: "pointer",
            }}
          >
            {icon ? (
              <div
                className="file-icon-img"
                style={{
                  width: "16px",
                  height: "16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                {icon}
              </div>
            ) : (
              <img
                src={
                  filename
                    ? getFileIconPath(filename)
                    : getIconForLanguage(effectiveLanguage)
                }
                alt="icon"
                className="file-icon-img"
                style={{ width: "16px", height: "16px" }}
              />
            )}
            {filename ? (
              <span>{displayPath}</span>
            ) : (
              <span>{effectiveLanguage}</span>
            )}

            {/* Show Header Actions (e.g. Stats) NEXT to filename */}
            {headerActions && (
              <div
                style={{
                  marginLeft: "8px",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                {headerActions}
              </div>
            )}
          </div>

          <div className="code-block-actions">
            {/* Removed headerActions from here (moved to left) */}

            {showCopyButton && (
              <button
                className="icon-button"
                onClick={handleCopy}
                title="Copy code"
              >
                {copied ? (
                  <span className="codicon codicon-check" />
                ) : (
                  <span className="codicon codicon-copy" />
                )}
              </button>
            )}
          </div>
        </div>
      )}
      {!isCollapsed && (
        <div
          className="monaco-editor-wrapper"
          style={{
            height: `${editorHeight}px`,
            width: "100%",
            boxSizing: "border-box",
            borderRadius: "0 0 6px 6px", // Match container border-radius (bottom corners only since header has top)
            overflow: "hidden",
          }}
        >
          <Editor
            height="100%"
            language={effectiveLanguage}
            value={code}
            theme="vscode-dark-plus"
            onMount={handleEditorDidMount}
            options={{
              lineNumbers:
                filename || startLineNumber
                  ? startLineNumber
                    ? (n: number) => (n + startLineNumber - 1).toString()
                    : "on"
                  : "off", // Hide line numbers for inline code blocks (no filename)
              readOnly: true,
              minimap: { enabled: false },
              scrollBeyondLastLine: false,
              automaticLayout: true,
              fontFamily: "'Fira Code', 'Consolas', monospace",
              fontSize: 13,
              lineHeight: 20,
              padding: { top: 10, bottom: 0 }, // Remove bottom padding to eliminate extra blank line
              contextmenu: false,
              domReadOnly: true,
              wordWrap: "on",
              renderLineHighlight: "none",
              hideCursorInOverviewRuler: true,
              overviewRulerBorder: false,
              overviewRulerLanes: 0,
              lineNumbersMinChars: 7, // Increase width to accommodate 4 digits
              glyphMargin: false,
              folding: false,
              lineDecorationsWidth: 0, // Remove separate column to prevent coloring issues
              scrollbar: {
                vertical: "auto", // Allow scrolling if content exceeds height
                horizontal: "auto",
                handleMouseWheel: true,
              },
            }}
            loading={
              <div style={{ color: "#ccc", padding: "10px" }}>
                Loading Editor...
              </div>
            }
          />
        </div>
      )}
    </div>
  );
};
