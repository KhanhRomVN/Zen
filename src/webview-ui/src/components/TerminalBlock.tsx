import React, { useEffect, useRef, useState } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";
import "./TerminalBlock.css";

interface TerminalBlockProps {
  logs: string;
  terminalName: string;
  subInfo?: string;
  status?: "busy" | "idle" | "free";
  statusColor?: string;
  maxHeight?: number;
  headerActions?: React.ReactNode;
  initialCommand?: string;
}

export const TerminalBlock: React.FC<TerminalBlockProps> = ({
  logs,
  terminalName,
  subInfo,
  status,
  statusColor,
  maxHeight = 400,
  headerActions,
  initialCommand,
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
        rows: 15,
        cols: 80,
        convertEol: true,
      });

      const fitAddon = new FitAddon();
      term.loadAddon(fitAddon);
      term.open(terminalRef.current);
      fitAddon.fit();

      xtermRef.current = term;
      fitAddonRef.current = fitAddon;

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

  useEffect(() => {
    if (xtermRef.current && isXtermVisible) {
      xtermRef.current.clear();
      if (logs) {
        xtermRef.current.write(logs);
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
  }, [logs, status, isXtermVisible]);

  return (
    <div className="terminal-block-container">
      <div className="terminal-block-header">
        <div className="terminal-info">
          <div className="terminal-header-top">
            {statusColor && (
              <div
                className="terminal-status-dot"
                style={{
                  backgroundColor: statusColor,
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                }}
              />
            )}
            <span className="terminal-name">{terminalName}</span>
            {status && (
              <span
                className="terminal-state-badge"
                style={
                  status === "busy"
                    ? {
                        backgroundColor: "rgba(76, 175, 80, 0.1)",
                        color: "#4caf50",
                      }
                    : {}
                }
              >
                {status === "busy" ? "Running" : "Free"}
              </span>
            )}
          </div>
          {subInfo && <span className="terminal-sub-info">{subInfo}</span>}
        </div>
        <div className="header-actions">{headerActions}</div>
      </div>
      <div
        className="terminal-content-wrapper"
        style={{ maxHeight: `${maxHeight}px` }}
      >
        {!isXtermVisible ? (
          <div className="terminal-richtext-fallback">
            {initialCommand || "No command executed yet."}
          </div>
        ) : (
          <div ref={terminalRef} className="xterm-container" />
        )}
      </div>
    </div>
  );
};
