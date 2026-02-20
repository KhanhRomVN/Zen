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

const formatCwd = (cwd: string) => {
  if (!cwd) return "";
  const parts = cwd.split(/[\\/]/).filter(Boolean);
  if (parts.length <= 4) return cwd;
  const lastFour = parts.slice(-4);
  return `.../${lastFour.join("/")}`;
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

  const getTerminalColor = (id: string) => {
    // Generate a consistent color based on the terminal ID
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h = Math.abs(hash) % 360;
    return `hsla(${h}, 70%, 50%, 0.15)`; // Semi-transparent for subtle effect
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
              onClick={() => handleFocusTerminal(term.id)}
              onMouseEnter={() => setHoveredId(term.id)}
              onMouseLeave={() => setHoveredId(null)}
              style={{
                borderBottom: "1px solid var(--border-color)",
                padding: "12px 16px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
                transition: "all 0.2s",
                cursor: "pointer",
                backgroundColor:
                  term.state === "busy"
                    ? `linear-gradient(90deg, ${getTerminalColor(term.id)} 0%, transparent 100%)`
                    : hoveredId === term.id
                      ? "var(--hover-bg)"
                      : "transparent",
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
                      (zen)
                      {term.state === "busy"
                        ? term.currentCommand
                        : term.shellType}
                      {term.state === "busy" && (
                        <span
                          style={{
                            fontSize: "10px",
                            padding: "2px 6px",
                            borderRadius: "10px",
                            backgroundColor: "rgba(76, 175, 80, 0.1)",
                            color: "#4caf50",
                            fontWeight: 500,
                            marginLeft: "4px",
                          }}
                        >
                          Running
                        </span>
                      )}
                    </span>
                    <span
                      style={{ fontSize: "11px", opacity: 0.4 }}
                      title={term.cwd}
                    >
                      {formatCwd(term.cwd)}
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
                      padding: "4px",
                      backgroundColor: "transparent",
                      color: "inherit",
                      border: "none",
                      borderRadius: "4px",
                      cursor: "pointer",
                      transition: "color 0.2s",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.color =
                        "var(--vscode-errorForeground, #f44336)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.color = "inherit";
                    }}
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};

export default TerminalDrawer;
