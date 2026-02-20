import React, { useEffect, useState } from "react";
import {
  X,
  Plus,
  Terminal,
  Trash2,
  Folder,
  Clock,
  Activity,
  Cpu,
  Code,
} from "lucide-react";

interface TerminalInfo {
  id: string;
  name: string;
  state: "busy" | "idle";
  shellType: string;
  cwd: string;
  uptime: number;
  lastLog: string;
  currentCommand: string;
}

interface TerminalDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const formatUptime = (seconds: number) => {
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}m ${secs}s`;
};

const TerminalDrawer: React.FC<TerminalDrawerProps> = ({ isOpen, onClose }) => {
  const [terminals, setTerminals] = useState<TerminalInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

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
        setTerminals(message.terminals || []);
        setLoading(false);
      } else if (
        message.command === "openInteractiveTerminalResult" ||
        message.command === "closeTerminalResult"
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
      vscodeApi.postMessage({ command: "openInteractiveTerminal" });
    }
  };

  const handleCloseTerminal = (id: string) => {
    const vscodeApi = (window as any).vscodeApi;
    if (vscodeApi) {
      vscodeApi.postMessage({ command: "closeTerminal", terminalId: id });
    }
  };

  const handleFocusTerminal = (id: string) => {
    const vscodeApi = (window as any).vscodeApi;
    if (vscodeApi) {
      vscodeApi.postMessage({ command: "focusTerminal", terminalId: id });
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
          padding: "16px",
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
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
              onClick={() => handleFocusTerminal(term.id)}
              onMouseEnter={() => setHoveredId(term.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                backgroundColor: "var(--input-bg)",
                border: "1px solid var(--border-color)",
                borderRadius: "12px",
                padding: "16px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                transition: "all 0.2s",
                cursor: "pointer",
                borderColor:
                  hoveredId === term.id
                    ? "var(--accent-text)"
                    : "var(--border-color)",
                position: "relative",
              }}
            >
              {/* Row 1: Status & Title */}
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "10px" }}
                >
                  <div
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      backgroundColor:
                        term.state === "busy" ? "#4caf50" : "#858585",
                      boxShadow:
                        term.state === "busy" ? "0 0 8px #4caf50" : "none",
                      animation:
                        term.state === "busy" ? "pulse 1.5s infinite" : "none",
                    }}
                  />
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "2px",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "14px",
                        fontWeight: 600,
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <Terminal size={14} /> (zen)
                      {term.state === "busy"
                        ? term.currentCommand
                        : term.shellType}
                    </span>
                    <span style={{ fontSize: "11px", opacity: 0.4 }}>
                      {term.state === "busy"
                        ? `Running: ${term.currentCommand}`
                        : "Idle"}{" "}
                      • ID: {term.id}
                    </span>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    opacity: hoveredId === term.id ? 1 : 0,
                    transition: "opacity 0.2s",
                  }}
                >
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCloseTerminal(term.id);
                    }}
                    title="Close Terminal"
                    style={{
                      padding: "6px",
                      backgroundColor: "transparent",
                      color: "var(--vscode-errorForeground, #f44336)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor =
                        "rgba(244, 67, 54, 0.1)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Row 2: Metadata Grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "8px",
                  fontSize: "12px",
                  opacity: 0.8,
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
                >
                  <Folder size={12} />
                  <span
                    style={{
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                    title={term.cwd}
                  >
                    {term.cwd.split("/").pop() || "/"}
                  </span>
                </div>
                <div
                  style={{ display: "flex", alignItems: "center", gap: "6px" }}
                >
                  <Clock size={12} />
                  <span>{formatUptime(term.uptime)}</span>
                </div>
              </div>

              {/* Row 3: Current Command (If Busy) */}
              {term.state === "busy" && (
                <div
                  style={{
                    backgroundColor: "rgba(76, 175, 80, 0.05)",
                    padding: "6px 10px",
                    borderRadius: "6px",
                    fontSize: "11px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    border: "1px dashed rgba(76, 175, 80, 0.3)",
                  }}
                >
                  <Cpu size={12} style={{ color: "#4caf50" }} />
                  <span style={{ color: "#4caf50", fontWeight: 500 }}>
                    Running:
                  </span>
                  <code style={{ opacity: 0.9 }}>{term.currentCommand}</code>
                </div>
              )}

              {/* Row 4: Last Log Snippet */}
              <div
                style={{
                  fontSize: "11px",
                  opacity: 0.6,
                  fontFamily: "monospace",
                  padding: "8px",
                  backgroundColor: "rgba(0,0,0,0.15)",
                  borderRadius: "4px",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <Code size={12} />
                {term.lastLog || "No output yet..."}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TerminalDrawer;
