import React, { useEffect, useState } from "react";
import { X, Terminal, Trash2 } from "lucide-react";
import { MiniTerminal } from "./MiniTerminal";

interface TerminalInfo {
  id: string;
  name: string;
  state: "busy" | "idle";
  shellType: string;
  cwd: string;
  uptime: number;
  lastLog: string;
  currentCommand: string;
  isAttached?: boolean;
  promptPrefix?: string;
}

interface TerminalDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect?: (terminalId: string) => void;
}

const formatCwd = (cwd: string) => {
  if (!cwd) return "";
  const parts = cwd.split(/[\\/]/).filter(Boolean);
  if (parts.length <= 4) return cwd;
  const lastFour = parts.slice(-4);
  return `.../${lastFour.join("/")}`;
};

const TerminalDrawer: React.FC<TerminalDrawerProps> = ({
  isOpen,
  onClose,
  onSelect,
}) => {
  const [terminals, setTerminals] = useState<TerminalInfo[]>([]);
  // ... rest of state ...
  const [terminalLogs, setTerminalLogs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

  // ... rest of component logic ...
  // (Note: view_file showed lines 1-407, but I need to be careful with the replacement)

  const fetchTerminals = () => {
    const vscodeApi = (window as any).vscodeApi;
    if (vscodeApi) {
      const requestId = `list-terms-${Date.now()}`;
      vscodeApi.postMessage({ command: "listTerminals", requestId });
    }
  };

  useEffect(() => {
    let interval: any;
    if (isOpen) {
      fetchTerminals();
      interval = setInterval(fetchTerminals, 2000);
    }

    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.command === "listTerminalsResult") {
        const newTerms = message.terminals || [];
        setTerminals(newTerms);
        setTerminalLogs((prev) => {
          const next = { ...prev };
          newTerms.forEach((t: TerminalInfo) => {
            const currentLog = next[t.id] || "";
            if (!currentLog && t.lastLog) {
              next[t.id] = t.lastLog;
            } else if (t.lastLog !== undefined) {
              const cleanLastLog = t.lastLog.replace(
                /\x1b\[[0-9;]*[mGKH]/g,
                "",
              );
              const cleanCurrentLog = currentLog.replace(
                /\x1b\[[0-9;]*[mGKH]/g,
                "",
              );
              if (
                cleanLastLog &&
                cleanCurrentLog.length > cleanLastLog.length + 50
              ) {
                next[t.id] = t.lastLog;
              }
            }
          });
          return next;
        });
        setLoading(false);
      } else if (message.command === "terminalOutput") {
        setTerminalLogs((prev) => ({
          ...prev,
          [message.terminalId]: (prev[message.terminalId] || "") + message.data,
        }));
      } else if (
        message.command === "createTerminalShellResult" ||
        message.command === "removeTerminalResult"
      ) {
        fetchTerminals();
      }
    };

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
      if (interval) clearInterval(interval);
    };
  }, [isOpen]);

  const handleCreateTerminal = () => {
    const vscodeApi = (window as any).vscodeApi;
    if (vscodeApi) {
      vscodeApi.postMessage({ command: "createTerminalShell" });
    }
  };

  const handleCloseTerminal = (id: string) => {
    const vscodeApi = (window as any).vscodeApi;
    if (vscodeApi) {
      vscodeApi.postMessage({ command: "removeTerminal", terminalId: id });
    }
  };

  const handleFocusTerminal = (id: string) => {
    const vscodeApi = (window as any).vscodeApi;
    if (vscodeApi) {
      vscodeApi.postMessage({ command: "focusTerminal", terminalId: id });
    }
  };

  const handleAttachTerminal = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const vscodeApi = (window as any).vscodeApi;
    if (vscodeApi) {
      vscodeApi.postMessage({
        command: "attachTerminalToVSCode",
        terminalId: id,
      });
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "0",
        left: 0,
        right: 0,
        backgroundColor: "var(--secondary-bg)",
        borderTop: "1px solid var(--border-color)",
        boxShadow: "0 -4px 12px rgba(0,0,0,0.2)",
        zIndex: 1000,
        height: "60vh",
        display: "flex",
        flexDirection: "column",
        animation: "slideUp 0.3s ease-out",
      }}
    >
      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes pulse {
          0% { opacity: 0.4; }
          50% { opacity: 1; }
          100% { opacity: 0.4; }
        }
      `}</style>

      {/* Header */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--border-color)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: "var(--tertiary-bg)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <Terminal size={18} />
          <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 600 }}>
            Active Terminals
          </h3>
          <span
            style={{
              fontSize: "10px",
              backgroundColor: "var(--hover-bg)",
              padding: "2px 6px",
              borderRadius: "10px",
              opacity: 0.8,
            }}
          >
            {terminals.length}
          </span>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
          <div style={{ cursor: "pointer", opacity: 0.7 }} onClick={onClose}>
            <X size={20} />
          </div>
        </div>
      </div>

      {/* Content */}
      <div
        style={{
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          flex: 1,
        }}
      >
        {terminals.length === 0 ? (
          <div
            style={{
              textAlign: "center",
              padding: "40px 0",
              opacity: 0.5,
              fontSize: "13px",
            }}
          >
            No active Zen terminals found.
          </div>
        ) : (
          terminals.map((term) => (
            <div
              key={term.id}
              style={{
                borderBottom: "1px solid var(--border-color)",
                borderLeft:
                  term.state === "busy"
                    ? "3px solid #4caf50"
                    : "3px solid transparent",
                display: "flex",
                flexDirection: "column",
                transition: "all 0.2s",
                backgroundColor: "var(--vscode-terminal-background, #1e1e1e)",
                position: "relative",
                cursor: "default",
                userSelect: "none",
              }}
            >
              {/* Part 1: Header - Status & Command only */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 12px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    flex: 1,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      backgroundColor:
                        term.state === "busy" ? "#4caf50" : "#808080", // Gray for idle
                      boxShadow:
                        term.state === "busy" ? "0 0 8px #4caf5066" : "none",
                      flexShrink: 0,
                    }}
                  />
                  <div
                    style={{
                      fontSize: "12px",
                      color: "var(--vscode-editor-foreground)",
                      opacity: 0.9,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      fontFamily:
                        'SFMono-Regular, Consolas, "Liberation Mono", Menlo, monospace',
                    }}
                  >
                    {term.currentCommand || "..."}
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    marginLeft: "8px",
                    alignItems: "center",
                  }}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCloseTerminal(term.id);
                    }}
                    title="Close Terminal"
                    style={{
                      padding: "4px",
                      backgroundColor: "transparent",
                      color: "var(--secondary-text)",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Divider */}
              <div
                style={{
                  height: "1px",
                  backgroundColor: "var(--border-color)",
                  opacity: 0.3,
                }}
              />

              {/* Part 2: Body - MiniTerminal (No padding) */}
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  handleFocusTerminal(term.id);
                }}
                style={{ overflow: "hidden" }}
              >
                <MiniTerminal
                  logs={terminalLogs[term.id] || ""}
                  status={term.state === "busy" ? "busy" : "free"}
                  rows={5}
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TerminalDrawer;
