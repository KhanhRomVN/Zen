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
          black: "var(--vscode-terminal-ansiBlack, #000000)",
          red: "var(--vscode-terminal-ansiRed, #cd3131)",
          green: "var(--vscode-terminal-ansiGreen, #0dbc79)",
          yellow: "var(--vscode-terminal-ansiYellow, #e5e510)",
          blue: "var(--vscode-terminal-ansiBlue, #2472c8)",
          magenta: "var(--vscode-terminal-ansiMagenta, #bc3fbc)",
          cyan: "var(--vscode-terminal-ansiCyan, #11a8cd)",
          white: "var(--vscode-terminal-ansiWhite, #e5e5e5)",
          brightBlack: "var(--vscode-terminal-ansiBrightBlack, #666666)",
          brightRed: "var(--vscode-terminal-ansiBrightRed, #f14c4c)",
          brightGreen: "var(--vscode-terminal-ansiBrightGreen, #23d18b)",
          brightYellow: "var(--vscode-terminal-ansiBrightYellow, #f5f543)",
          brightBlue: "var(--vscode-terminal-ansiBrightBlue, #3b8eea)",
          brightMagenta: "var(--vscode-terminal-ansiBrightMagenta, #d670d6)",
          brightCyan: "var(--vscode-terminal-ansiBrightCyan, #29b8db)",
          brightWhite: "var(--vscode-terminal-ansiBrightWhite, #e5e5e5)",
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

      // Ensure fit happens after a short delay since it's in a drawer
      setTimeout(() => fitAddon.fit(), 100);

      // 🆕 PROHIBIT INPUT: Disable data listener and block all key events
      term.attachCustomKeyEventHandler(() => false);

      const handleResize = () => {
        fitAddon.fit();
      };
      window.addEventListener("resize", handleResize);

      return () => {
        term.dispose();
        window.removeEventListener("resize", handleResize);
        xtermRef.current = null;
      };
    }
  }, []);

  const lastWrittenIndexRef = useRef(0);

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
      className="terminal-block-container mini-terminal"
      style={{
        marginBottom: 0,
        border: "none",
        backgroundColor: "var(--vscode-terminal-background, #1e1e1e)",
      }}
    >
      <div
        className="terminal-content-wrapper"
        style={{
          height: "90px",
          padding: "4px 8px",
        }}
      >
        <div
          ref={terminalRef}
          className="xterm-container"
          onPaste={(e) => e.preventDefault()}
        />
      </div>
    </div>
  );
};
