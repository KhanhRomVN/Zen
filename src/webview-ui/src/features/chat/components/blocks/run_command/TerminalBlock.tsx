import React, { useEffect, useRef, useState } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";
import "./TerminalBlock.css";
import { useProject } from "../../../../../context/ProjectContext";

interface TerminalBlockProps {
  logs: string;
  status?: "busy" | "idle" | "free";
  maxHeight?: number;
  rows?: number;
  initialCommand?: string;
  cwd?: string;
  onInput?: (data: string) => void;
  rejectedOutline?: boolean;
}

const CopyIcon: React.FC = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);

const CheckIcon: React.FC = () => (
  <svg
    width="13"
    height="13"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2.5"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

/** Copy button:
 *  - hidden (opacity 0) by default, shown (opacity 1) via parent CSS class
 *  - no background in resting state, subtle bg on hover
 *  - shows checkmark for 1.5 s after copy
 */
const CopyButton: React.FC<{ getText: () => string; title?: string }> = ({
  getText,
  title,
}) => {
  const [copied, setCopied] = useState(false);
  const [hovered, setHovered] = useState(false);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const text = getText();
    navigator.clipboard
      .writeText(text)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {
        const el = document.createElement("textarea");
        el.value = text;
        el.style.position = "fixed";
        el.style.opacity = "0";
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      });
  };

  return (
    <button
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={title || "Copy"}
      className="terminal-copy-btn"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        width: "22px",
        height: "22px",
        padding: 0,
        border: "none",
        borderRadius: "4px",
        background: copied
          ? "color-mix(in srgb, var(--vscode-gitDecoration-addedResourceForeground) 15%, transparent)"
          : hovered
            ? "color-mix(in srgb, var(--vscode-foreground) 22%, transparent)"
            : "transparent",
        color: copied
          ? "var(--vscode-gitDecoration-addedResourceForeground)"
          : "var(--vscode-terminal-foreground)",
        cursor: "pointer",
        flexShrink: 0,
        transition: "background 0.15s, color 0.15s, opacity 0.15s",
      }}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </button>
  );
};

const TerminalInputBar: React.FC<{ onInput: (data: string) => void }> = ({
  onInput,
}) => {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onInput(value + "\n");
      setValue("");
      if (textareaRef.current) textareaRef.current.style.height = "auto";
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    const ta = e.target;
    ta.style.height = "auto";
    const lineHeight = 18;
    ta.style.height = Math.min(ta.scrollHeight, lineHeight * 3) + "px";
  };

  return (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        padding: "4px 10px",
        borderTop: "1px solid var(--vscode-panel-border)",
        backgroundColor:
          "var(--vscode-input-background, var(--vscode-terminal-background))",
      }}
    >
      <textarea
        ref={textareaRef}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder="type and press Enter…"
        rows={1}
        style={{
          flex: 1,
          background: "none",
          border: "none",
          outline: "none",
          resize: "none",
          overflow: "hidden",
          color: "var(--vscode-terminal-foreground)",
          fontFamily: "var(--vscode-editor-font-family, monospace)",
          fontSize: "12px",
          lineHeight: "18px",
          padding: 0,
          minHeight: "18px",
          maxHeight: "54px",
        }}
      />
    </div>
  );
};

/** Helper: Read a CSS custom property value from the document root.
 *  Returns the resolved value or fallback if unavailable.
 *  This is needed because xterm.js requires actual color values,
 *  not CSS var() strings which it cannot parse. */
const getCSSVar = (name: string, fallback: string): string => {
  if (typeof document === "undefined" || !document.documentElement)
    return fallback;
  const styles = getComputedStyle(document.documentElement);
  const value = styles.getPropertyValue(name).trim();
  return value || fallback;
};

/** Build xterm.js theme object by reading VS Code CSS variables from the DOM.
 *  This ensures xterm receives actual resolved color values,
 *  so terminal output colors match the current VS Code theme. */
const buildXtermTheme = () => ({
  background: "transparent",
  foreground: getCSSVar("--vscode-terminal-foreground", "#cccccc"),
  cursor: getCSSVar("--vscode-terminal-foreground", "#cccccc"),
  black: getCSSVar("--vscode-terminal-ansiBlack", "#000000"),
  red: getCSSVar("--vscode-terminal-ansiRed", "#cd3131"),
  green: getCSSVar("--vscode-terminal-ansiGreen", "#0dbc79"),
  yellow: getCSSVar("--vscode-terminal-ansiYellow", "#e5e510"),
  blue: getCSSVar("--vscode-terminal-ansiBlue", "#2472c8"),
  magenta: getCSSVar("--vscode-terminal-ansiMagenta", "#bc3fbc"),
  cyan: getCSSVar("--vscode-terminal-ansiCyan", "#11a8cd"),
  white: getCSSVar("--vscode-terminal-ansiWhite", "#e5e5e5"),
  brightBlack: getCSSVar("--vscode-terminal-ansiBrightBlack", "#666666"),
  brightRed: getCSSVar("--vscode-terminal-ansiBrightRed", "#f14c4c"),
  brightGreen: getCSSVar("--vscode-terminal-ansiBrightGreen", "#23d18b"),
  brightYellow: getCSSVar("--vscode-terminal-ansiBrightYellow", "#f5f543"),
  brightBlue: getCSSVar("--vscode-terminal-ansiBrightBlue", "#3b8eea"),
  brightMagenta: getCSSVar("--vscode-terminal-ansiBrightMagenta", "#d670d6"),
  brightCyan: getCSSVar("--vscode-terminal-ansiBrightCyan", "#29b8db"),
  brightWhite: getCSSVar("--vscode-terminal-ansiBrightWhite", "#e5e5e5"),
});

export const TerminalBlock: React.FC<TerminalBlockProps> = ({
  logs,
  status,
  maxHeight = 400,
  initialCommand,
  cwd,
  rows = 22,
  onInput,
  rejectedOutline,
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const { homedir } = useProject();

  const formatCommand = (cmd: string) => {
    if (!cmd) return "";
    const lines = cmd.split("\n");
    if (lines.length > 3) {
      return lines.slice(0, 3).join("\n") + "\n...";
    }
    return cmd;
  };

  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [isXtermVisible, setIsXtermVisible] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [physicalLineCount, setPhysicalLineCount] = useState(0);
  const canExpand = physicalLineCount > 15;

  const toggleExpand = () => {
    if (canExpand) setIsExpanded((v) => !v);
  };

  const stripAnsi = (str: string) =>
    str
      .replace(/\x1B\[[0-9;?]*[A-Za-z~]/g, "")
      .replace(/\x1b\].*?(\x07|\x1b\\)/g, "");

  const visibleEffectCountRef = useRef(0);
  useEffect(() => {
    visibleEffectCountRef.current += 1;
    const shouldShow = !!(logs || status === "busy");
    if (shouldShow) {
      setIsXtermVisible(true);
    } else {
      setIsXtermVisible(false);
    }
  }, [logs, status]);

  const initTermCountRef = useRef(0);
  useEffect(() => {
    initTermCountRef.current += 1;
    if (!isXtermVisible || !terminalRef.current) return;

    if (!xtermRef.current) {
      const term = new Terminal({
        cursorBlink: false,
        cursorStyle: "underline",
        cursorInactiveStyle: "none",
        disableStdin: true,
        fontSize: 12,
        fontFamily:
          'var(--vscode-editor-font-family, "Courier New", Courier, monospace)',
        theme: buildXtermTheme(),
        allowProposedApi: true,
        rows: rows,
        cols: 80,
        convertEol: true,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(terminalRef.current);
      fitAddon.fit();

      xtermRef.current = term;
      fitAddonRef.current = fitAddon;

      term.attachCustomKeyEventHandler(() => false);

      const handleResize = () => {
        fitAddon.fit();
      };
      window.addEventListener("resize", handleResize);

      return () => {
        term.dispose();
        window.removeEventListener("resize", handleResize);
        xtermRef.current = null;
        lastWrittenLogsRef.current = "";
      };
    }
  }, [isXtermVisible]);

  const lastWrittenLogsRef = useRef("");

  const updateTermCountRef = useRef(0);
  useEffect(() => {
    updateTermCountRef.current += 1;
    if (xtermRef.current && isXtermVisible) {
      const trimmedLogs = logs.replace(/\r?\n$/, "");

      if (!trimmedLogs.startsWith(lastWrittenLogsRef.current)) {
        xtermRef.current.reset();
        xtermRef.current.write(trimmedLogs);
        lastWrittenLogsRef.current = trimmedLogs;
      } else if (trimmedLogs.length > lastWrittenLogsRef.current.length) {
        const newData = trimmedLogs.substring(
          lastWrittenLogsRef.current.length,
        );
        xtermRef.current.write(newData);
        lastWrittenLogsRef.current = trimmedLogs;
      }

      const logicalLines = logs.split(/\n/);
      const terminalCols = xtermRef.current.cols || 80;
      let count = 0;
      logicalLines.forEach((line) => {
        const cleanLine = stripAnsi(line);
        count += Math.max(1, Math.ceil(cleanLine.length / terminalCols));
      });

      if (physicalLineCount !== count) setPhysicalLineCount(count);

      const effectiveMaxRows = isExpanded ? rows : 15;
      const targetRows = Math.max(1, Math.min(effectiveMaxRows, count));

      if (xtermRef.current.rows !== targetRows) {
        xtermRef.current.resize(terminalCols, targetRows);
        if (fitAddonRef.current) fitAddonRef.current.fit();
      }

      xtermRef.current.options.cursorBlink = status === "busy";
      xtermRef.current.options.theme = {
        ...xtermRef.current.options.theme,
        cursor:
          status === "busy"
            ? getCSSVar("--vscode-terminal-foreground", "#cccccc")
            : "transparent",
      };
    }
  }, [logs, status, isXtermVisible, rows]);

  const getCleanLogs = () => stripAnsi(logs || "");
  const getCommand = () => initialCommand || "";

  // Shared text style — same font/size/color for both command and output areas
  const terminalTextStyle: React.CSSProperties = {
    fontFamily:
      'var(--vscode-editor-font-family, "Courier New", Courier, monospace)',
    fontSize: "12px",
    color: "var(--vscode-terminal-foreground, #cccccc)",
    lineHeight: "1.5",
  };

  return (
    <div
      className="terminal-block-container"
      style={
        rejectedOutline
          ? {
              outline:
                "1px solid color-mix(in srgb, var(--vscode-errorForeground, #f44336) 60%, transparent)",
              borderRadius: "6px",
            }
          : undefined
      }
    >
      {/* ── COMMAND HEADER ── Copy button hidden by default, shown on hover via CSS */}
      {isXtermVisible && (
        <div
          className="terminal-fixed-header terminal-cmd-area"
          onClick={toggleExpand}
          style={{
            padding: "6px 8px 6px 10px",
            backgroundColor: "var(--vscode-editor-background)",
            borderBottom: "1px solid var(--vscode-panel-border)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            zIndex: 5,
            position: "sticky",
            top: 0,
            cursor: canExpand ? "pointer" : "default",
            userSelect: "none",
            transition: "background-color 0.2s",
          }}
          onMouseEnter={(e) => {
            if (canExpand)
              e.currentTarget.style.backgroundColor =
                "var(--vscode-list-hoverBackground, var(--vscode-editor-background))";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor =
              "var(--vscode-editor-background, #1e1e1e)";
          }}
        >
          {/* Command text — same style as output */}
          <div
            style={{
              ...terminalTextStyle,
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
              flex: 1,
              minWidth: 0,
            }}
          >
            {initialCommand ? formatCommand(initialCommand) : "Terminal"}
          </div>

          {/* Right actions: copy + chevron */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              marginLeft: "auto",
              flexShrink: 0,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* CSS class on parent (.terminal-cmd-area) controls opacity */}
            <CopyButton getText={getCommand} title="Copy command" />
            {canExpand && (
              <div
                className={`codicon codicon-chevron-${isExpanded ? "up" : "down"}`}
                style={{
                  fontSize: "12px",
                  opacity: 0.7,
                  cursor: "pointer",
                  color: "var(--vscode-terminal-foreground, #cccccc)",
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleExpand();
                }}
              />
            )}
          </div>
        </div>
      )}

      {/* ── OUTPUT AREA ── Copy button hidden by default, shown on hover via CSS */}
      <div className="terminal-output-area" style={{ position: "relative" }}>
        {isXtermVisible && logs && (
          <div
            className="terminal-output-copy-btn"
            style={{
              position: "absolute",
              top: "6px",
              right: "8px",
              zIndex: 10,
            }}
          >
            <CopyButton getText={getCleanLogs} title="Copy output" />
          </div>
        )}

        <div
          className="terminal-content-wrapper"
          style={{
            maxHeight: `${maxHeight}px`,
            overflowY: "auto",
            pointerEvents: "auto",
            userSelect: "none",
          }}
        >
          {!isXtermVisible ? (
            <div
              className="terminal-richtext-fallback"
              style={{
                display: "flex",
                flexWrap: "wrap",
                gap: "8px",
                alignItems: "center",
              }}
            >
              <div
                style={{
                  ...terminalTextStyle,
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                }}
              >
                {initialCommand
                  ? formatCommand(initialCommand)
                  : "No command executed yet."}
              </div>
            </div>
          ) : (
            <div
              ref={terminalRef}
              className="xterm-container"
              onPaste={(e) => e.preventDefault()}
            />
          )}
        </div>
      </div>

      {onInput && <TerminalInputBar onInput={onInput} />}
    </div>
  );
};
