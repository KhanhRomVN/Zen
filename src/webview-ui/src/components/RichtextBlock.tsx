import React, { useState } from "react";
import FileIcon from "./common/FileIcon";
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
  isFilePathList?: boolean; // New prop for list_files output
  onFileClick?: (fullPath: string) => void; // Callback when a file is clicked
  basePath?: string; // Base folder path for reconstructing full paths
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
  isFilePathList = false,
  onFileClick,
  basePath = "",
}) => {
  const [isCollapsed, setIsCollapsed] = useState(defaultCollapsed);

  const contentStyle: React.CSSProperties = {
    maxHeight: maxHeight || undefined,
    overflowY: maxHeight ? "auto" : undefined,
  };

  const renderFileTree = () => {
    if (!content) return null;

    const lines = content.split("\n").filter((l) => l.trim().length > 0);

    // Track folder stack per indent level to reconstruct full paths
    const folderStack: string[] = [];

    return (
      <div
        className="file-tree-container"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "2px",
          padding: "8px 0",
        }}
      >
        {lines.map((line, idx) => {
          // Detect indentation (starts with spaces)
          const indentMatch = line.match(/^(\s*)/);
          const indentLevel = indentMatch ? indentMatch[1].length / 2 : 0;
          const cleanLine = line.trim();

          // Determine if it's a folder (ends with /)
          const isFolder = cleanLine.endsWith("/");
          const namePart = isFolder ? cleanLine.slice(0, -1) : cleanLine;

          // Split name and line count (e.g. "filename (10 lines)")
          const lineCountMatch = namePart.match(/^(.*)\s+\((\d+)\s+lines\)$/);
          const name = lineCountMatch ? lineCountMatch[1] : namePart;
          const lineCount = lineCountMatch ? lineCountMatch[2] : null;

          // Update folder stack based on current indent level
          folderStack.splice(indentLevel);
          if (isFolder) {
            folderStack[indentLevel] = name;
          }

          // Reconstruct full path
          const parentPath = folderStack.slice(0, indentLevel).join("/");
          const relativePath = parentPath ? `${parentPath}/${name}` : name;
          const fullPath = basePath
            ? `${basePath}/${relativePath}`
            : relativePath;

          const isClickable = !isFolder && !!onFileClick;

          return (
            <div
              key={idx}
              className="file-tree-row"
              onClick={isClickable ? () => onFileClick!(fullPath) : undefined}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                paddingLeft: `${indentLevel * 16 + 8}px`,
                fontSize: "13px",
                height: "24px",
                borderRadius: "4px",
                transition: "background 0.15s",
                cursor: isClickable ? "pointer" : "default",
              }}
              onMouseEnter={
                isClickable
                  ? (e) => {
                      e.currentTarget.style.background =
                        "var(--vscode-list-hoverBackground, rgba(255,255,255,0.06))";
                    }
                  : undefined
              }
              onMouseLeave={
                isClickable
                  ? (e) => {
                      e.currentTarget.style.background = "transparent";
                    }
                  : undefined
              }
            >
              <FileIcon
                path={name}
                isFolder={isFolder}
                style={{ width: "16px", height: "16px", opacity: 0.9 }}
              />
              <span
                style={{
                  color: "var(--vscode-editor-foreground)",
                  opacity: 0.9,
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {name}
                {isFolder && "/"}
              </span>
              {lineCount && (
                <span
                  style={{
                    color: "var(--vscode-descriptionForeground)",
                    fontSize: "11px",
                    opacity: 0.6,
                    marginLeft: "4px",
                  }}
                >
                  {lineCount} lines
                </span>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div
      className={`richtext-block-container ${isCollapsed ? "collapsed" : ""}`}
    >
      {!showHeader ? (
        <div className="richtext-block-expanded no-header">
          <div className="richtext-content" style={contentStyle}>
            {isFilePathList ? (
              renderFileTree()
            ) : (
              <pre className="plaintext-output">
                <code>{content}</code>
              </pre>
            )}
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
            {isFilePathList ? (
              renderFileTree()
            ) : (
              <pre className="plaintext-output">
                <code>{content}</code>
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
