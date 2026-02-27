import React, { useState } from "react";
import "./RichtextBlock.css";

interface RichtextBlockProps {
  content: string;
  title?: string;
  prefix?: string;
  statusColor?: string;
  defaultCollapsed?: boolean;
  headerActions?: React.ReactNode;
  maxHeight?: string | number;
  showHeader?: boolean;
}

export const RichtextBlock: React.FC<RichtextBlockProps> = ({
  content,
  title,
  prefix,
  statusColor,
  defaultCollapsed = true,
  headerActions,
  maxHeight,
  showHeader = true,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  const contentStyle: React.CSSProperties = {
    maxHeight: maxHeight || undefined,
    overflowY: maxHeight ? "auto" : undefined,
  };

  return (
    <div
      className={`richtext-block-container ${isCollapsed ? "collapsed" : ""}`}
    >
      {!showHeader ? (
        <div className="richtext-block-expanded no-header">
          <div className="richtext-content" style={contentStyle}>
            <pre className="plaintext-output">
              <code>{content}</code>
            </pre>
          </div>
        </div>
      ) : isCollapsed ? (
        // Collapsed State: Inline summary (no background as per request)
        <div
          className="richtext-block-summary"
          onClick={() => setIsCollapsed(!isCollapsed)}
          style={{
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "8px 0",
            fontSize: "13px",
          }}
        >
          <span
            className="collapse-icon codicon codicon-chevron-right"
            style={{ fontSize: "12px" }}
          />
          {statusColor && (
            <span
              className="status-dot"
              style={{
                backgroundColor: statusColor,
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                display: "inline-block",
              }}
            />
          )}
          {prefix && (
            <span
              className="header-prefix"
              style={{
                fontWeight: 500,
                color: "var(--vscode-foreground)",
              }}
            >
              {prefix}
            </span>
          )}
          <span
            className="title-text"
            style={{
              color: "var(--vscode-editor-foreground)",
              fontFamily: "var(--vscode-font-family)",
            }}
          >
            {title || "Output"}
          </span>
          {headerActions && (
            <div className="header-actions" style={{ marginLeft: "auto" }}>
              {headerActions}
            </div>
          )}
        </div>
      ) : (
        // Expanded State: Full header + content
        <div className="richtext-block-expanded">
          <div
            className="richtext-block-header"
            onClick={() => setIsCollapsed(!isCollapsed)}
            style={{ cursor: "pointer" }}
          >
            <div className="header-info">
              <span
                className="collapse-icon codicon codicon-chevron-down"
                style={{ fontSize: "12px" }}
              />
              {statusColor && (
                <span
                  className="status-dot"
                  style={{
                    backgroundColor: statusColor,
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    display: "inline-block",
                  }}
                />
              )}
              {prefix && <span className="header-prefix">{prefix}</span>}
              <span
                className="title-text"
                style={{
                  color: "var(--vscode-editor-foreground)",
                  fontFamily: "var(--vscode-font-family)",
                }}
              >
                {title || "Output"}
              </span>
            </div>
            <div className="header-actions">{headerActions}</div>
          </div>
          <div className="richtext-content" style={contentStyle}>
            <pre className="plaintext-output">
              <code>{content}</code>
            </pre>
          </div>
        </div>
      )}
    </div>
  );
};
