import React from "react";
import "./TerminalBlock.css";

interface ToolHeaderProps {
  title: React.ReactNode;
  subTitle?: string;
  statusColor?: string;
  diffStats?: {
    added: number;
    removed: number;
  };
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
  onClick?: () => void;
  icon?: React.ReactNode;
  headerActions?: React.ReactNode;
  isPartial?: boolean;
}

export const ToolHeader: React.FC<ToolHeaderProps> = ({
  title,
  subTitle,
  statusColor,
  diffStats,
  isCollapsed,
  onToggleCollapse,
  onClick,
  icon,
  headerActions,
  isPartial,
}) => {
  return (
    <div
      className="terminal-block-header"
      onClick={onClick || onToggleCollapse}
      style={{ cursor: onClick || onToggleCollapse ? "pointer" : "default" }}
    >
      <div className="terminal-info">
        <div className="terminal-header-top">
          {statusColor && (
            <div
              className={`terminal-status-dot timeline-dot ${isPartial ? "streaming-pulse" : ""}`}
              style={{
                backgroundColor: statusColor,
                top: "8px",
                boxShadow: isPartial ? `0 0 0 0 ${statusColor}40` : "none",
              }}
            />
          )}
          {isPartial && (
            <style>{`
              @keyframes pulse {
                0% { box-shadow: 0 0 0 0 var(--pulse-color); }
                70% { box-shadow: 0 0 0 6px rgba(0, 0, 0, 0); }
                100% { box-shadow: 0 0 0 0 rgba(0, 0, 0, 0); }
              }
              .streaming-pulse {
                animation: pulse 2s infinite;
                --pulse-color: ${statusColor}60;
              }
            `}</style>
          )}
          <div
            style={{
              marginTop: "1px",
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            {onToggleCollapse && (
              <span
                className={`collapse-icon codicon codicon-chevron-${isCollapsed ? "right" : "down"}`}
                style={{ fontSize: "12px", marginRight: "4px" }}
              />
            )}
            {icon && (
              <span style={{ display: "flex", alignItems: "center" }}>
                {icon}
              </span>
            )}
            {typeof title === "string" ? (
              <span className="terminal-name">{title}</span>
            ) : (
              <div className="terminal-name" style={{ display: "contents" }}>
                {title}
              </div>
            )}
          </div>
        </div>
        {(subTitle || diffStats) && (
          <div className="terminal-sub-info">
            {diffStats ? (
              <span
                style={{
                  display: "flex",
                  gap: "6px",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    color:
                      "var(--vscode-gitDecoration-addedResourceForeground)",
                  }}
                >
                  +{diffStats.added}
                </span>
                <span
                  style={{
                    color:
                      "var(--vscode-gitDecoration-deletedResourceForeground)",
                  }}
                >
                  -{diffStats.removed}
                </span>
                <span>lines</span>
              </span>
            ) : (
              subTitle
            )}
          </div>
        )}
      </div>
      <div className="header-actions" onClick={(e) => e.stopPropagation()}>
        {headerActions}
      </div>
    </div>
  );
};
