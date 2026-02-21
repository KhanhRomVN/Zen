import React, { useEffect, useRef } from "react";
import "./TerminalBlock.css";

interface TerminalBlockProps {
  logs: string;
  terminalName: string;
  subInfo?: string;
  status?: "busy" | "idle" | "free";
  statusColor?: string;
  maxHeight?: number;
  headerActions?: React.ReactNode;
}

export const TerminalBlock: React.FC<TerminalBlockProps> = ({
  logs,
  terminalName,
  subInfo,
  status,
  statusColor,
  maxHeight = 400,
  headerActions,
}) => {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isAtBottom = useRef(true);

  const handleScroll = () => {
    if (scrollRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
      const atBottom = scrollHeight - scrollTop - clientHeight < 50;
      isAtBottom.current = atBottom;
    }
  };

  useEffect(() => {
    if (isAtBottom.current && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  return (
    <div className="terminal-block-container">
      <div className="terminal-block-header">
        <div className="terminal-info">
          <div className="terminal-header-top">
            <span className="terminal-prefix">(zen)</span>
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
                {status === "busy"
                  ? "Running"
                  : status === "free"
                    ? "Free"
                    : "Idle"}
              </span>
            )}
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
          </div>
          {subInfo && <span className="terminal-sub-info">{subInfo}</span>}
        </div>
        <div className="header-actions">
          {headerActions}
          <div
            className="codicon codicon-terminal"
            style={{ fontSize: "14px", opacity: 0.7 }}
          />
        </div>
      </div>
      <div
        className="terminal-content-wrapper"
        ref={scrollRef}
        onScroll={handleScroll}
        style={{ maxHeight: `${maxHeight}px` }}
      >
        <div className="terminal-log-line">{logs}</div>
      </div>
    </div>
  );
};
