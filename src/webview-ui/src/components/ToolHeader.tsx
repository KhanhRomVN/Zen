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
              className="terminal-status-dot timeline-dot"
              style={{
                backgroundColor: statusColor,
                top: "10px",
              }}
            />
          )}
          <div
            style={{
              paddingTop: "2px",
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
