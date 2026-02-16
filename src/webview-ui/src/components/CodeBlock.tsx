import React, { useState, useRef } from "react";
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
  console.log("[CodeBlock] defineCustomTheme:", {
    hasColors: !!colors,
    force,
    backgroundColor: colors?.editorBackground,
    isMonacoAvailable: !!monaco,
    colorSample: colors
      ? {
          keyword: colors.keyword,
          entityNameFunction: colors.entityNameFunction,
          variable: colors.variable,
          supportType: colors.supportType,
        }
      : null,
  });

  try {
    const c = colors || {
      // Fallback colors (Dark theme defaults)
      editorBackground: "#1e1e1e",
      editorForeground: "#d4d4d4",
      keyword: "#569CD6",
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

    const stripHash = (color: string) => color.replace("#", "");

    // Get VS Code CSS variables as ultimate fallback if they exist in the DOM
    const getVSCVariable = (name: string) => {
      if (typeof document === "undefined") return null;
      return getComputedStyle(document.documentElement)
        .getPropertyValue(name)
        .trim();
    };

    // Use token colors from extension OR VS Code CSS variables OR hardcoded fallbacks
    const resolvedColors = {
      background:
        c.editorBackground || getVSCVariable("--vscode-editor-background"),
      foreground:
        c.editorForeground || getVSCVariable("--vscode-editor-foreground"),
      keyword:
        c.keyword || getVSCVariable("--vscode-symbolIcon-keywordForeground"),
      keywordControl:
        c.keywordControl ||
        getVSCVariable("--vscode-debugControl-break") ||
        c.keyword,
      keywordOperator: c.keywordOperator || c.foreground,
      function:
        c.entityNameFunction ||
        getVSCVariable("--vscode-symbolIcon-functionForeground"),
      type:
        c.entityNameType ||
        getVSCVariable("--vscode-symbolIcon-classForeground"),
      variable:
        c.variable || getVSCVariable("--vscode-symbolIcon-variableForeground"),
      string:
        c.string ||
        getVSCVariable("--vscode-debugIcon-breakpointForeground") ||
        "#CE9178",
      comment: c.comment || getVSCVariable("--vscode-descriptionForeground"),
      number: c.number || "#B5CEA8",
      constant:
        c.constant || getVSCVariable("--vscode-symbolIcon-constantForeground"),
      punctuation: c.punctuation || c.foreground,
    };

    console.log("[CodeBlock] Resolved dynamic colors:", {
      bg: resolvedColors.background,
      fg: resolvedColors.foreground,
      kw: resolvedColors.keyword,
      fn: resolvedColors.function,
      tp: resolvedColors.type,
    });

    monaco.editor.defineTheme("vscode-dark-plus", {
      base: "vs-dark",
      inherit: true,
      rules: [
        // Generic Monarch tokens (Used by most languages in Monaco)
        {
          token: "",
          foreground: stripHash(resolvedColors.foreground || "d4d4d4"),
        },
        {
          token: "keyword",
          foreground: stripHash(resolvedColors.keyword || "569CD6"),
        },
        {
          token: "keyword.control",
          foreground: stripHash(resolvedColors.keywordControl || "C586C0"),
        },
        {
          token: "keyword.operator",
          foreground: stripHash(resolvedColors.keywordOperator || "D4D4D4"),
        },
        {
          token: "operator",
          foreground: stripHash(resolvedColors.keywordOperator || "D4D4D4"),
        },
        {
          token: "string",
          foreground: stripHash(resolvedColors.string || "CE9178"),
        },
        {
          token: "number",
          foreground: stripHash(resolvedColors.number || "B5CEA8"),
        },
        {
          token: "comment",
          foreground: stripHash(resolvedColors.comment || "6A9955"),
        },
        {
          token: "constant",
          foreground: stripHash(resolvedColors.constant || "4FC1FF"),
        },
        {
          token: "delimiter",
          foreground: stripHash(resolvedColors.punctuation || "D4D4D4"),
        },
        {
          token: "identifier",
          foreground: stripHash(resolvedColors.variable || "9CDCFE"),
        },
        {
          token: "type.identifier",
          foreground: stripHash(resolvedColors.type || "4EC9B0"),
        },
        {
          token: "function.identifier",
          foreground: stripHash(resolvedColors.function || "DCDCAA"),
        },

        // Python specific Monarch tokens
        {
          token: "keyword.python",
          foreground: stripHash(resolvedColors.keyword || "569CD6"),
        },
        {
          token: "keyword.control.python",
          foreground: stripHash(resolvedColors.keywordControl || "C586C0"),
        },
        {
          token: "keyword.operator.python",
          foreground: stripHash(resolvedColors.keywordOperator || "D4D4D4"),
        },
        {
          token: "function.python", // Simplified from entity.name.function
          foreground: stripHash(resolvedColors.function || "DCDCAA"),
        },
        {
          token: "type.python", // New token for types
          foreground: stripHash(resolvedColors.type || "4EC9B0"),
        },
        {
          token: "variable.python",
          foreground: stripHash(resolvedColors.variable || "9CDCFE"),
        },
        {
          token: "storage.type.function.python",
          foreground: stripHash(resolvedColors.keyword || "569CD6"),
        },
        {
          token: "storage.type.class.python",
          foreground: stripHash(resolvedColors.keyword || "569CD6"),
        },
        {
          token: "entity.name.function.python",
          foreground: stripHash(resolvedColors.function || "DCDCAA"),
        },
        {
          token: "entity.name.type.python",
          foreground: stripHash(resolvedColors.type || "4EC9B0"),
        },
        {
          token: "variable.parameter.python",
          foreground: stripHash(resolvedColors.variable || "9CDCFE"),
        },
        {
          token: "keyword.type.python",
          foreground: stripHash(resolvedColors.type || "4EC9B0"),
        },

        // JavaScript/TypeScript specific Monarch tokens
        {
          token: "keyword.js",
          foreground: stripHash(resolvedColors.keyword || "569CD6"),
        },
        {
          token: "keyword.ts",
          foreground: stripHash(resolvedColors.keyword || "569CD6"),
        },
        {
          token: "identifier.js",
          foreground: stripHash(resolvedColors.variable || "9CDCFE"),
        },
        {
          token: "identifier.ts",
          foreground: stripHash(resolvedColors.variable || "9CDCFE"),
        },
        {
          token: "type.identifier.ts",
          foreground: stripHash(resolvedColors.type || "4EC9B0"),
        },

        // Language-agnostic scope-based rules (compatible with more highlighters)
        {
          token: "storage",
          foreground: stripHash(resolvedColors.keyword || "569CD6"),
        },
        {
          token: "storage.type",
          foreground: stripHash(resolvedColors.keyword || "569CD6"),
        },
        {
          token: "entity.name.function",
          foreground: stripHash(resolvedColors.function || "DCDCAA"),
        },
        {
          token: "entity.name.type",
          foreground: stripHash(resolvedColors.type || "4EC9B0"),
        },
        {
          token: "entity.name.class",
          foreground: stripHash(resolvedColors.type || "4EC9B0"),
        },
        {
          token: "variable.parameter",
          foreground: stripHash(resolvedColors.variable || "9CDCFE"),
        },
        {
          token: "support.type",
          foreground: stripHash(resolvedColors.type || "4EC9B0"),
        },
        {
          token: "support.class",
          foreground: stripHash(resolvedColors.type || "4EC9B0"),
        },
        {
          token: "support.function",
          foreground: stripHash(resolvedColors.function || "DCDCAA"),
        },
      ],
      colors: {
        "editor.background": resolvedColors.background || "#1e1e1e",
        "editor.foreground": resolvedColors.foreground || "#d4d4d4",
        "editorLineNumber.foreground": "#858585",
        "editorLineNumber.activeForeground": "#c6c6c6",
      },
    });
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
  const monacoRef = React.useRef<any>(null);
  const decorationsRef = React.useRef<any>(null);

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

  // Handler called BEFORE Monaco editor mounts
  const handleEditorWillMount = (monaco: any) => {
    console.log("[CodeBlock] handleEditorWillMount:", {
      language: effectiveLanguage,
      monacoAvailable: !!monaco,
    });

    // Ensure languages are loaded
    try {
      const languages = monaco.languages.getLanguages();
      console.log(
        "[CodeBlock] Available languages:",
        languages.map((l: any) => l.id),
      );

      // Check if Python is available
      const hasPython = languages.some((l: any) => l.id === "python");
      console.log("[CodeBlock] Python language available:", hasPython);

      if (!hasPython) {
        console.warn("[CodeBlock] Python language not found in Monaco!");
      }
    } catch (e) {
      console.error("[CodeBlock] Failed to check languages:", e);
    }

    // Apply custom tokenizer for Python to get better tokens
    try {
      monaco.languages.setMonarchTokensProvider("python", {
        defaultToken: "",
        tokenPostfix: ".python",

        keywords: [
          "and",
          "as",
          "assert",
          "break",
          "class",
          "continue",
          "def",
          "del",
          "elif",
          "else",
          "except",
          "exec",
          "finally",
          "for",
          "from",
          "global",
          "if",
          "import",
          "in",
          "is",
          "lambda",
          "None",
          "not",
          "or",
          "pass",
          "print",
          "raise",
          "return",
          "self",
          "try",
          "while",
          "with",
          "yield",
        ],

        types: [
          "int",
          "float",
          "long",
          "complex",
          "hex",
          "oct",
          "bin",
          "list",
          "dict",
          "set",
          "tuple",
          "range",
          "str",
          "unicode",
          "basestring",
          "bool",
        ],

        brackets: [
          { open: "{", close: "}", token: "delimiter.curly" },
          { open: "[", close: "]", token: "delimiter.bracket" },
          { open: "(", close: ")", token: "delimiter.parenthesis" },
        ],

        tokenizer: {
          root: [
            // Function definitions
            [/(def)(\s+)([a-zA-Z_]\w*)/, ["keyword", "white", "function"]],

            // Class definitions
            [/(class)(\s+)([a-zA-Z_]\w*)/, ["keyword", "white", "type"]],

            // Identifiers, keywords and types
            [
              /[a-zA-Z_]\w*/,
              {
                cases: {
                  "@keywords": "keyword",
                  "@types": "type",
                  "@default": "identifier",
                },
              },
            ],

            // Function calls
            [/[a-zA-Z_]\w*(?=\s*\()/, "function"],

            // Whitespace
            { include: "@whitespace" },

            // Delimiters and operators
            [/[{}()\[\]]/, "@brackets"],
            [/[<>:=!%&|+\-*/^~]/, "keyword.operator"],

            // Numbers
            [/\d*\.\d+([eE][\-+]?\d+)?/, "number.float"],
            [/\d+/, "number"],

            // Strings
            [/'([^'\\]|\\.)*$/, "string.invalid"], // non-teminated string
            [/'/, "string", "@string.'"],
            [/"/, "string", '@string."'],
          ],

          whitespace: [
            [/[ \t\r\n]+/, "white"],
            [/#.*$/, "comment"],
          ],

          string: [
            [/[^\\"']+/, "string"],
            [/\\./, "string.escape"],
            [
              /["']/,
              {
                cases: {
                  "$#==$S2": { token: "string", next: "@pop" },
                  "@default": "string",
                },
              },
            ],
          ],
        },
      });
    } catch (e) {
      console.warn(
        "[CodeBlock] Failed to register custom Python tokenizer:",
        e,
      );
    }

    // Apply theme early if we have colors
    if (tokenColors) {
      console.log("[CodeBlock] Applying theme in beforeMount");
      defineCustomTheme(monaco, tokenColors, true);
    }
  };

  // Improved auto-height handler
  const handleEditorDidMount = (editor: any, monaco: any) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    console.log("[CodeBlock] handleEditorDidMount:", {
      hasTokenColors: !!tokenColors,
      hasMonaco: !!monaco,
      language: effectiveLanguage,
      filename,
      codePreview: code.substring(0, 100),
    });

    // Debug: Log Monaco's tokenization for first line
    if (monaco && code) {
      try {
        const model = editor.getModel();
        if (model) {
          const lineTokens = monaco.editor.tokenize(
            code.split("\n")[0],
            effectiveLanguage,
          );
          console.log("[CodeBlock] First line tokens:", {
            line: code.split("\n")[0],
            tokens: lineTokens[0]?.map((t: any) => ({
              type: t.type,
              offset: t.offset,
            })),
          });
        }
      } catch (e) {
        console.warn("[CodeBlock] Failed to tokenize:", e);
      }
    }

    // Define and apply custom theme with dynamic colors from VS Code
    try {
      defineCustomTheme(monaco, tokenColors);
      monaco.editor.setTheme("vscode-dark-plus");
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

  // Re-apply theme khi tokenColors thay đổi hoặc editor vừa mount
  React.useEffect(() => {
    const monaco = monacoRef.current || (window as any).monaco;
    if (editorRef.current && monaco && tokenColors) {
      console.log("[CodeBlock] Applying theme (useEffect):", {
        hasTokenColors: true,
        source: monacoRef.current ? "ref" : "window",
        tokenColorsSample: {
          keyword: tokenColors.keyword,
          entityNameFunction: tokenColors.entityNameFunction,
          variable: tokenColors.variable,
        },
      });
      defineCustomTheme(monaco, tokenColors, true);
      monaco.editor.setTheme("vscode-dark-plus");

      // Debug: Check if theme was applied
      setTimeout(() => {
        const currentTheme = monaco.editor.getTheme?.();
        console.log("[CodeBlock] Theme applied, current theme:", currentTheme);
      }, 100);
    }
  }, [tokenColors, editorRef.current]);

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
            beforeMount={handleEditorWillMount}
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
