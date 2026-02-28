import React, { useEffect, useRef, useState } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";
import "./TerminalBlock.css";
import { useProject } from "../context/ProjectContext";

interface TerminalBlockProps {
  logs: string;
  status?: "busy" | "idle" | "free";
  maxHeight?: number;
  rows?: number;
  initialCommand?: string;
  cwd?: string;
  onInput?: (data: string) => void;
}

export const TerminalBlock: React.FC<TerminalBlockProps> = ({
  logs,
  status,
  maxHeight = 400,
  initialCommand,
  cwd,
  rows = 22,
  onInput,
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const { homedir } = useProject();

  const formatCwd = (path: string) => {
    if (homedir && path.startsWith(homedir)) {
      return path.replace(homedir, "~");
    }
    return path;
  };

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
    if (canExpand) {
      setIsExpanded(!isExpanded);
    }
  };

  useEffect(() => {
    // Show xterm only if we have logs or if it's busy
    if (logs || status === "busy") {
      setIsXtermVisible(true);
    } else {
      setIsXtermVisible(false);
    }
  }, [logs, status]);

  useEffect(() => {
    if (!isXtermVisible || !terminalRef.current) return;

    if (!xtermRef.current) {
      const term = new Terminal({
        cursorBlink: status === "busy",
        disableStdin: true,
        fontSize: 12,
        fontFamily:
          'var(--vscode-editor-font-family, "Courier New", Courier, monospace)',
        theme: {
          background: "transparent",
          foreground: "var(--vscode-terminal-foreground, #cccccc)",
          cursor:
            status === "busy"
              ? "var(--vscode-terminal-foreground)"
              : "transparent",
        },
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

      // 🆕 PROHIBIT INPUT: Disable data listener and block all key events
      // This ensures the terminal is view-only but still allows text selection.
      term.attachCustomKeyEventHandler(() => false);

      const handleResize = () => {
        fitAddon.fit();
      };
      window.addEventListener("resize", handleResize);

      // Clean up on unmount or visibility change
      return () => {
        term.dispose();
        window.removeEventListener("resize", handleResize);
        xtermRef.current = null;
      };
    }
  }, [isXtermVisible, status]);

  const lastWrittenLogsRef = useRef("");

  useEffect(() => {
    if (xtermRef.current && isXtermVisible) {
      // Trim trailing newline for clean display in timeline
      const trimmedLogs = logs.replace(/\r?\n$/, "");

      if (!trimmedLogs.startsWith(lastWrittenLogsRef.current)) {
        // Logs were reset or changed significantly
        xtermRef.current.reset();
        xtermRef.current.write(trimmedLogs);
        lastWrittenLogsRef.current = trimmedLogs;
      } else if (trimmedLogs.length > lastWrittenLogsRef.current.length) {
        // Append new data
        const newData = trimmedLogs.substring(
          lastWrittenLogsRef.current.length,
        );
        xtermRef.current.write(newData);
        lastWrittenLogsRef.current = trimmedLogs;
      }

      // 📏 AUTO-FIT HEIGHT: Calculate rows based on content + wrapping
      const stripAnsi = (str: string) =>
        str
          .replace(/\x1B\[[0-9;?]*[A-Za-z~]/g, "")
          .replace(/\x1b\].*?(\x07|\x1b\\)/g, "");
      const logicalLines = logs.split(/\n/);
      const terminalCols = xtermRef.current.cols || 80;
      let count = 0;
      logicalLines.forEach((line) => {
        const cleanLine = stripAnsi(line);
        // Each logical line takes at least 1 physical row, plus extra for wrapping
        count += Math.max(1, Math.ceil(cleanLine.length / terminalCols));
      });

      if (physicalLineCount !== count) {
        setPhysicalLineCount(count);
      }

      // Calculate target rows based on expansion state
      const effectiveMaxRows = isExpanded ? rows : 15;
      const targetRows = Math.max(1, Math.min(effectiveMaxRows, count));

      if (xtermRef.current.rows !== targetRows) {
        xtermRef.current.resize(terminalCols, targetRows);
        if (fitAddonRef.current) {
          fitAddonRef.current.fit();
        }
      }

      // Update cursor and blink based on status
      xtermRef.current.options.cursorBlink = status === "busy";
      xtermRef.current.options.theme = {
        ...xtermRef.current.options.theme,
        cursor:
          status === "busy"
            ? "var(--vscode-terminal-foreground)"
            : "transparent",
      };
    }
  }, [logs, status, isXtermVisible, rows]);

  return (
    <div className="terminal-block-container">
      {/* 🆕 FIXED HEADER: Environment info & Command (Only show when running) */}
      {isXtermVisible && (
        <div
          className="terminal-fixed-header"
          onClick={toggleExpand}
          style={{
            padding: "6px 10px",
            backgroundColor: "var(--vscode-editor-background)",
            borderBottom: "1px solid var(--vscode-panel-border)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "11px",
            fontWeight: 500,
            color: "var(--vscode-descriptionForeground)",
            zIndex: 5,
            position: "sticky",
            top: 0,
            cursor: canExpand ? "pointer" : "default",
            userSelect: "none",
            transition: "background-color 0.2s",
          }}
          onMouseEnter={(e) => {
            if (canExpand)
              e.currentTarget.style.backgroundColor = "var(--vscode-hover-bg)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor =
              "var(--vscode-editor-background)";
          }}
        >
          <div
            style={{
              fontFamily: "var(--vscode-editor-font-family, monospace)",
              whiteSpace: "pre-wrap",
              wordBreak: "break-all",
              opacity: 0.9,
              width: "100%",
            }}
          >
            <span style={{ color: "var(--vscode-descriptionForeground)" }}>
              {cwd ? `${formatCwd(cwd)}$` : ""}
            </span>
            <span style={{ color: "var(--vscode-terminal-foreground)" }}>
              {initialCommand ? formatCommand(initialCommand) : "Terminal"}
            </span>
          </div>
          {canExpand && (
            <div
              className={`codicon codicon-chevron-${isExpanded ? "up" : "down"}`}
              style={{ fontSize: "12px", opacity: 0.8 }}
            />
          )}
        </div>
      )}
      <div
        className="terminal-content-wrapper"
        style={{ maxHeight: `${maxHeight}px` }}
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
                fontFamily: "var(--vscode-editor-font-family, monospace)",
                whiteSpace: "pre-wrap",
                wordBreak: "break-all",
                opacity: 0.8,
                fontSize: "12px",
              }}
            >
              <span style={{ color: "var(--vscode-descriptionForeground)" }}>
                {cwd ? `${formatCwd(cwd)}$` : ""}
              </span>
              <span style={{ color: "var(--vscode-terminal-foreground)" }}>
                {initialCommand
                  ? formatCommand(initialCommand)
                  : "No command executed yet."}
              </span>
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
  );
};
