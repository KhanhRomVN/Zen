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
  rows?: number;
  headerActions?: React.ReactNode;
  initialCommand?: string;
  onInput?: (data: string) => void;
  onAttachToVSCode?: () => void;
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
  rows = 15,
  onInput,
  onAttachToVSCode,
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

      // Handle user input
      if (onInput) {
        term.onData((data) => {
          onInput(data);
        });
      }

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

  const lastWrittenIndexRef = useRef(0);

  useEffect(() => {
    if (xtermRef.current && isXtermVisible) {
      if (logs.length < lastWrittenIndexRef.current) {
        // Logs were reset (e.g. cleared)
        xtermRef.current.clear();
        lastWrittenIndexRef.current = 0;
      }

      if (logs.length > lastWrittenIndexRef.current) {
        const newData = logs.substring(lastWrittenIndexRef.current);
        xtermRef.current.write(newData);
        lastWrittenIndexRef.current = logs.length;
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
        <div className="header-actions">
          {onAttachToVSCode && (
            <button
              className="attach-terminal-btn"
              onClick={onAttachToVSCode}
              title="Open in VSCode Terminal"
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "var(--vscode-icon-foreground)",
                padding: "4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginRight: "8px",
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                <polyline points="15 3 21 3 21 9"></polyline>
                <line x1="10" y1="14" x2="21" y2="3"></line>
              </svg>
            </button>
          )}
          {headerActions}
        </div>
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
