import React, { useEffect, useRef, useState } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";
import "./TerminalBlock.css";
import { useProject } from "../../../../../../../context/ProjectContext";

interface TerminalBlockProps {
  logs: string;
  maxHeight?: number;
  rows?: number;
  initialCommand?: string;
  cwd?: string;
  onInput?: (data: string) => void;
  rejectedOutline?: boolean;
}

const TerminalInputBar: React.FC<{ onInput: (data: string) => void }> = ({
  onInput,
}) => {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.ctrlKey && e.key.toLowerCase() === "c") {
      const selection = window.getSelection()?.toString();
      if (!selection && !value) {
        e.preventDefault();
        onInput("\x03");
        return;
      }
    }
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
        borderTop:
          "1px solid var(--vscode-widget-border, rgba(255, 255, 255, 0.08))",
        backgroundColor: "var(--vscode-editor-background)",
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
          color: "var(--vscode-editor-foreground)",
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
 *  Simplified version — only foreground/background/cursor are needed
 *  since terminal output is monochrome (no ANSI color codes). */
const buildXtermTheme = () => ({
  background: "transparent",
  foreground: getCSSVar("--vscode-editor-foreground", "#cccccc"),
  cursor: getCSSVar("--vscode-editor-foreground", "#cccccc"),
});

export const TerminalBlock: React.FC<TerminalBlockProps> = ({
  logs,
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
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [copiedOut, setCopiedOut] = useState(false);
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
    const shouldShow = !!logs;
    if (shouldShow) {
      setIsXtermVisible(true);
    } else {
      setIsXtermVisible(false);
    }
  }, [logs]);

  const initTermCountRef = useRef(0);
  useEffect(() => {
    initTermCountRef.current += 1;
    if (!isXtermVisible || !terminalRef.current) return;

    if (!xtermRef.current) {
      const term = new Terminal({
        cursorBlink: false,
        cursorStyle: "block",
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

      xtermRef.current.options.theme = {
        ...xtermRef.current.options.theme,
        cursor: "transparent",
      };
    }
  }, [logs, isXtermVisible, rows]);

  // Shared text style — same font/size/color for both command and output areas
  const terminalTextStyle: React.CSSProperties = {
    fontFamily:
      'var(--vscode-editor-font-family, "Courier New", Courier, monospace)',
    fontSize: "12px",
    color: "var(--vscode-editor-foreground, #cccccc)",
    lineHeight: "1.5",
  };

  const copyToClipboard = async (text: string, onSuccess?: () => void) => {
    try {
      await navigator.clipboard.writeText(text);
      onSuccess?.();
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  const handleCopyCommand = () => {
    copyToClipboard(initialCommand || "", () => {
      setCopiedCmd(true);
      setTimeout(() => setCopiedCmd(false), 1500);
    });
  };

  const handleCopyOutput = () => {
    copyToClipboard(logs, () => {
      setCopiedOut(true);
      setTimeout(() => setCopiedOut(false), 1500);
    });
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
            borderBottom:
              "1px solid var(--vscode-widget-border, rgba(255, 255, 255, 0.08))",
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

          {/* Right actions: chevron only */}
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
            <button
              className="terminal-copy-btn"
              title="Copy command"
              onClick={(e) => {
                e.stopPropagation();
                handleCopyCommand();
              }}
            >
              {copiedCmd ? (
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
                  style={{ color: "var(--vscode-gitDecoration-addedResourceForeground, #3fb950)" }}
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
            {canExpand && (
              <div
                className={`codicon codicon-chevron-${isExpanded ? "up" : "down"}`}
                style={{
                  fontSize: "12px",
                  opacity: 0.7,
                  cursor: "pointer",
                  color: "var(--vscode-editor-foreground, #cccccc)",
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

      {/* ── OUTPUT AREA ── */}
      <div className="terminal-output-area" style={{ position: "relative" }}>
        <button
          className="terminal-output-copy-btn"
          title="Copy output"
          onClick={(e) => {
            e.stopPropagation();
            handleCopyOutput();
          }}
        >
              {copiedOut ? (
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
                  style={{ color: "var(--vscode-gitDecoration-addedResourceForeground, #3fb950)" }}
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
