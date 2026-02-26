import React, { useEffect, useRef, useState } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";
import "./TerminalBlock.css";

interface TerminalBlockProps {
  logs: string;
  status?: "busy" | "idle" | "free";
  maxHeight?: number;
  rows?: number;
  initialCommand?: string;
  onInput?: (data: string) => void;
}

export const TerminalBlock: React.FC<TerminalBlockProps> = ({
  logs,
  status,
  maxHeight = 400,
  initialCommand,
  rows = 15,
  onInput,
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);
  const [isXtermVisible, setIsXtermVisible] = useState(false);

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
      if (!logs.startsWith(lastWrittenLogsRef.current)) {
        // Logs were reset or changed significantly (e.g. raw text replaced by ANSI)
        xtermRef.current.reset();
        xtermRef.current.write(logs);
        lastWrittenLogsRef.current = logs;
      } else if (logs.length > lastWrittenLogsRef.current.length) {
        // Append new data
        const newData = logs.substring(lastWrittenLogsRef.current.length);
        xtermRef.current.write(newData);
        lastWrittenLogsRef.current = logs;
      }

      // 📏 AUTO-FIT HEIGHT: Calculate rows based on content + wrapping
      const stripAnsi = (str: string) =>
        str
          .replace(/\x1B\[[0-9;?]*[A-Za-z~]/g, "")
          .replace(/\x1b\].*?(\x07|\x1b\\)/g, "");
      const logicalLines = logs.split(/\n/);
      const terminalCols = xtermRef.current.cols || 80;
      let physicalLineCount = 0;

      logicalLines.forEach((line) => {
        const cleanLine = stripAnsi(line);
        // Each logical line takes at least 1 physical row, plus extra for wrapping
        physicalLineCount += Math.max(
          1,
          Math.ceil(cleanLine.length / terminalCols),
        );
      });

      const targetRows = Math.max(2, Math.min(rows, physicalLineCount));

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
      <div
        className="terminal-content-wrapper"
        style={{ maxHeight: `${maxHeight}px` }}
      >
        {!isXtermVisible ? (
          <div className="terminal-richtext-fallback">
            {initialCommand || "No command executed yet."}
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
