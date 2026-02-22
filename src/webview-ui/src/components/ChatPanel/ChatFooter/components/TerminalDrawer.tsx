import React, { useEffect, useState } from "react";
import { X, Plus, Terminal, Trash2 } from "lucide-react";
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
}

const formatCwd = (cwd: string) => {
  if (!cwd) return "";
  const parts = cwd.split(/[\\/]/).filter(Boolean);
  if (parts.length <= 4) return cwd;
  const lastFour = parts.slice(-4);
  return `.../${lastFour.join("/")}`;
};

const TerminalDrawer: React.FC<TerminalDrawerProps> = ({ isOpen, onClose }) => {
  const [terminals, setTerminals] = useState<TerminalInfo[]>([]);
  const [terminalLogs, setTerminalLogs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);

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
      // Poll for updates every 2 seconds to keep metadata fresh
      interval = setInterval(fetchTerminals, 2000);
    }

    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.command === "listTerminalsResult") {
        const newTerms = message.terminals || [];
        setTerminals(newTerms);
        // Synchronize logs: reset if backend log is significantly different (e.g. cleared)
        setTerminalLogs((prev) => {
          const next = { ...prev };
          newTerms.forEach((t: TerminalInfo) => {
            const currentLog = next[t.id] || "";
            // If we don't have logs, or if the backend log is empty/shorter (terminal was likely cleared)
            if (
              !next[t.id] ||
              (t.lastLog !== undefined && t.lastLog.length < currentLog.length)
            ) {
              next[t.id] = t.lastLog || "";
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
          <button
            onClick={handleCreateTerminal}
            title="New Terminal"
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "6px",
              backgroundColor: "transparent",
              color: "var(--secondary-text)",
              border: "none",
              borderRadius: "4px",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                "var(--vscode-button-background, #0e639c)1a"; // 10% opacity
              e.currentTarget.style.color = "var(--accent-text)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "var(--secondary-text)";
            }}
          >
            <Plus size={20} />
          </button>
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
            No active Zen terminals found. Click "New Terminal" icon to start.
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
                  }}
                >
                  {!term.isAttached && (
                    <button
                      onClick={(e) => handleAttachTerminal(term.id, e)}
                      title="Attach"
                      style={{
                        padding: "4px",
                        backgroundColor: "transparent",
                        color: "var(--secondary-text)",
                        border: "none",
                        borderRadius: "4px",
                        cursor: "pointer",
                      }}
                    >
                      <svg
                        width="14"
                        height="14"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                      >
                        <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path>
                        <polyline points="15 3 21 3 21 9"></polyline>
                        <line x1="10" y1="14" x2="21" y2="3"></line>
                      </svg>
                    </button>
                  )}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCloseTerminal(term.id);
                    }}
                    title="Close"
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
