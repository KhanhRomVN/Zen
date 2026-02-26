import React from "react";
import "./TerminalBlock.css";

interface ToolHeaderProps {
  title: string;
  subTitle?: string;
  statusColor?: string;
  diffStats?: {
    added: number;
    removed: number;
  };
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
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
  icon,
  headerActions,
}) => {
  return (
    <div
      className="terminal-block-header"
      onClick={onToggleCollapse}
      style={{ cursor: onToggleCollapse ? "pointer" : "default" }}
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
              paddingTop: "4px",
              display: "flex",
              alignItems: "center",
              gap: "8px",
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
            <span className="terminal-name">{title}</span>
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
