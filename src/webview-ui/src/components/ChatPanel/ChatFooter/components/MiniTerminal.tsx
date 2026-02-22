import React, { useEffect, useRef, useState } from "react";
import { Terminal } from "xterm";
import { FitAddon } from "xterm-addon-fit";
import "xterm/css/xterm.css";
import "../../../TerminalBlock.css";

interface MiniTerminalProps {
  logs: string;
  status?: "busy" | "idle" | "free";
  rows?: number;
  onInput?: (data: string) => void;
}

export const MiniTerminal: React.FC<MiniTerminalProps> = ({
  logs,
  status,
  rows = 5,
  onInput,
}) => {
  const terminalRef = useRef<HTMLDivElement>(null);
  const xtermRef = useRef<Terminal | null>(null);
  const fitAddonRef = useRef<FitAddon | null>(null);

  useEffect(() => {
    if (!terminalRef.current) return;

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
        rows: 5,
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

      // Initial logs
      if (logs) {
        term.write(logs);
      }

      return () => {
        term.dispose();
        window.removeEventListener("resize", handleResize);
        xtermRef.current = null;
      };
    }
  }, []);

  const lastWrittenIndexRef = useRef(logs?.length || 0);

  useEffect(() => {
    if (xtermRef.current) {
      if (!logs) {
        xtermRef.current.clear();
        lastWrittenIndexRef.current = 0;
        return;
      }

      if (logs.length < lastWrittenIndexRef.current) {
        xtermRef.current.clear();
        lastWrittenIndexRef.current = 0;
      }

      if (logs.length > lastWrittenIndexRef.current) {
        const newData = logs.substring(lastWrittenIndexRef.current);
        xtermRef.current.write(newData);
        lastWrittenIndexRef.current = logs.length;
      }

      xtermRef.current.options.cursorBlink = status === "busy";
      xtermRef.current.options.theme = {
        ...xtermRef.current.options.theme,
        cursor:
          status === "busy"
            ? "var(--vscode-terminal-foreground)"
            : "transparent",
      };
    }
  }, [logs, status]);

  return (
    <div
      style={{
        width: "100%",
        height: "90px", // Fixed height for exactly 5 lines
        backgroundColor: "var(--vscode-terminal-background, #1e1e1e)",
        padding: "0", // Padding is handled by .xterm .xterm-screen in TerminalBlock.css
        overflow: "hidden",
        pointerEvents: "none", // Completely non-clickable
        userSelect: "none",
      }}
    >
      <div
        ref={terminalRef}
        className="xterm-container"
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
};
