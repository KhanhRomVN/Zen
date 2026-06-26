import React, { useMemo, useRef, useState, useEffect } from "react";
import "../blocks/TerminalBlock.css";

interface ToolHeaderProps {
  title: React.ReactNode;
  subTitle?: React.ReactNode;
  subTitleClassName?: string;
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
  /** File or folder path to display in the header */
  path?: string;
  /** Callback when path is clicked (separate from header click) */
  onPathClick?: (path: string) => void;
}

// Truncate path to prevent line wrapping
// Keep beginning (root folder) and end (filename + a few parent folders)
const truncatePath = (fullPath: string, maxLength: number = 35): string => {
  if (!fullPath) return "";
  if (fullPath.length <= maxLength) return fullPath;

  const parts = fullPath.split("/");
  if (parts.length <= 2) return fullPath;

  let keepEnd = 2;
  if (maxLength > 50) keepEnd = 3;
  if (maxLength > 70) keepEnd = 4;
  if (maxLength > 90) keepEnd = 5;

  const first = parts[0];
  const lastParts = parts.slice(-keepEnd);
  const middle = "...";

  return `${first}/${middle}/${lastParts.join("/")}`;
};

export const ToolHeader: React.FC<ToolHeaderProps> = ({
  title,
  subTitle,
  subTitleClassName,
  statusColor,
  diffStats,
  isCollapsed,
  onToggleCollapse,
  onClick,
  icon,
  headerActions,
  isPartial,
  path,
  onPathClick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const pathContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [pathContainerWidth, setPathContainerWidth] = useState<number>(0);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(containerRef.current);
    setContainerWidth(containerRef.current.offsetWidth || 0);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!pathContainerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setPathContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(pathContainerRef.current);
    setPathContainerWidth(pathContainerRef.current.offsetWidth || 0);
    return () => observer.disconnect();
  }, []);

  const maxLength = useMemo(() => {
    if (containerWidth === 0) return 35;
    
    // Use actual path container width if available, otherwise estimate
    const availableWidth = pathContainerWidth > 0 
      ? pathContainerWidth - 24 // subtract padding (20px left + 4px right)
      : Math.max(containerWidth - 80, 100); // less conservative estimate
    
    // Font size is 10px, monospace ~6px per char
    const chars = Math.floor(availableWidth / 6);
    const result = Math.max(chars, 30);
    
    // Debug logging
    console.log('[ToolHeader Path Debug]', {
      containerWidth,
      pathContainerWidth,
      availableWidth,
      calculatedChars: chars,
      maxLength: result,
      pathLength: path?.length || 0,
      willTruncate: (path?.length || 0) > result
    });
    
    return result;
  }, [containerWidth, pathContainerWidth, path]);

  const displayPath = useMemo(() => {
    if (!path) return "";
    const truncated = truncatePath(path, maxLength);
    
    // Debug logging
    if (truncated !== path) {
      console.log('[ToolHeader Path Truncated]', {
        original: path,
        truncated,
        originalLength: path.length,
        maxLength
      });
    }
    
    return truncated;
  }, [path, maxLength]);

  return (
    <div
      ref={containerRef}
      className="terminal-block-header"
      onClick={onClick || onToggleCollapse}
      style={{
        cursor: onClick || onToggleCollapse ? "pointer" : "default",
        paddingTop: "4px",
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "space-between",
        width: "100%",
      }}
    >
      <div className="terminal-info" style={{ flex: 1, minWidth: 0 }}>
        <div className="terminal-header-top">
          {statusColor && (
            <div
              className={`terminal-status-dot timeline-dot ${isPartial ? "streaming-pulse" : ""}`}
              style={{
                backgroundColor: statusColor,
                top: "10px",
                left: "15px",
                transform: "translateX(-50%)",
                boxShadow: `0 0 0 2px var(--vscode-editor-background), 0 0 0 3px color-mix(in srgb, ${statusColor} 50%, transparent)`,
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
              flexDirection: "column",
              gap: "2px",
              flex: 1,
              minWidth: 0,
              width: "100%",
              maxWidth: "100%",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                flexWrap: "wrap",
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
            {displayPath && path && path.includes('/') && (
              <div
                ref={pathContainerRef}
                style={{
                  display: "flex",
                  justifyContent: "flex-end",
                  alignItems: "center",
                  paddingRight: "4px",
                  paddingTop: "4px",
                  marginTop: "2px",
                  position: "relative",
                  width: "100%",
                  maxWidth: "100%",
                  overflow: "hidden",
                }}
              >
                {/* Corner line: vertical + horizontal L-shape */}
                <div
                  style={{
                    position: "absolute",
                    left: "0",
                    top: "0",
                    width: "16px",
                    height: "12px",
                    borderLeft: "1px solid color-mix(in srgb, var(--vscode-descriptionForeground) 20%, transparent)",
                    borderBottom: "1px solid color-mix(in srgb, var(--vscode-descriptionForeground) 20%, transparent)",
                  }}
                />
                <span
                  style={{
                    fontSize: "10px",
                    opacity: 0.6,
                    color: "var(--vscode-descriptionForeground)",
                    fontFamily: "var(--vscode-editor-font-family, monospace)",
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    width: "100%",
                    padding: "0 4px 0 20px",
                    borderRadius: "2px",
                    transition: "text-decoration 0.15s ease",
                    cursor: "default",
                    textDecoration: "none",
                  }}
                  title={path}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onPathClick && path) {
                      onPathClick(path);
                    }
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.textDecoration = "underline";
                    e.currentTarget.style.textDecorationColor =
                      "var(--vscode-focusBorder, rgba(0, 122, 204, 0.6))";
                    e.currentTarget.style.textUnderlineOffset = "2px";
                    e.currentTarget.style.cursor = "pointer";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.textDecoration = "none";
                    e.currentTarget.style.cursor = "default";
                  }}
                >
                  {displayPath}
                </span>
              </div>
            )}
          </div>
        </div>
        {(subTitle || diffStats) && (
          <div
            className={`terminal-sub-info${subTitleClassName ? ` ${subTitleClassName}` : ""}`}
          >
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
      <div
        className="header-actions"
        onClick={(e) => e.stopPropagation()}
        style={{ flexShrink: 0, marginLeft: "8px" }}
      >
        {headerActions}
      </div>
    </div>
  );
};