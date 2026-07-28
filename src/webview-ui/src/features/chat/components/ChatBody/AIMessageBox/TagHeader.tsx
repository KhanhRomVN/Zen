import React, { useMemo, useRef, useState, useEffect } from "react";

// STYLES
import "./blocks/run_command/TerminalBlock.css";

interface TagHeaderProps {
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
  /** Optional custom tooltip text for the status dot */
  statusTooltip?: string;
  /** Whether this action is waiting for approval */
  isWaitingApproval?: boolean;
  /** Whether this action has an error */
  isError?: boolean;
  /** Tool type for context-specific tooltips */
  toolType?: string;
  /** Additional metadata for tooltip (e.g., line count, match count) */
  tooltipMeta?: {
    lineCount?: number;
    lineRange?: string;
    matchCount?: number;
    fileCount?: number;
  };
  /** Diagnostics for the file (errors and warnings) */
  diagnostics?: Array<{
    severity: string;
    message: string;
    line: number;
    column: number;
    source?: string;
    code?: string | number;
  }>;
  /** Callback when dot is clicked (for raw view toggle, etc.) */
  onDotClick?: () => void;
}

// Smart path truncation: dynamically truncate middle folders based on available width
const truncatePath = (fullPath: string, maxLength: number = 35): string => {
  if (!fullPath) return "";

  // If path is short enough, return as-is
  if (fullPath.length <= maxLength) {
    return fullPath;
  }

  const parts = fullPath.split("/");

  // If only 1-2 parts, just return as-is
  if (parts.length <= 2) {
    return fullPath;
  }

  const fileName = parts[parts.length - 1];
  const rootFolder = parts[0];

  // Strategy: Keep first folder and last file, truncate middle progressively
  // Try to fit as many folders as possible from both ends

  // Start with minimum: root/.../filename
  let result = `${rootFolder}/.../${fileName}`;
  let currentLength = result.length;

  // If this doesn't fit, return it anyway (minimum viable)
  if (currentLength >= maxLength) {
    return result;
  }

  // Try to add folders from right side (closest to filename)
  let rightIndex = parts.length - 2; // Start before filename
  const foldersToAdd = [];

  while (rightIndex > 0) {
    // rightIndex > 0 to skip root folder
    const folderToTest = parts[rightIndex];
    const testResult = `${rootFolder}/.../${[...foldersToAdd, folderToTest].reverse().join("/")}/${fileName}`;

    if (testResult.length <= maxLength) {
      foldersToAdd.push(folderToTest);
      result = testResult;
      currentLength = testResult.length;
      rightIndex--;
    } else {
      break;
    }
  }

  return result;
};

export const TagHeader: React.FC<TagHeaderProps> = ({
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
  statusTooltip,
  isWaitingApproval,
  isError,
  toolType,
  tooltipMeta,
  diagnostics,
  onDotClick,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const pathContainerRef = useRef<HTMLDivElement>(null);
  const pathSpanRef = useRef<HTMLSpanElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [pathContainerWidth, setPathContainerWidth] = useState<number>(0);
  const [pathSpanWidth, setPathSpanWidth] = useState<number>(0);

  // Inject spin animation for loading circle ring
  useEffect(() => {
    const styleId = "circle-ring-spin-animation";
    if (!document.getElementById(styleId)) {
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
        @keyframes circle-ring-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `;
      document.head.appendChild(style);
    }
  }, []);

  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newWidth = entry.contentRect.width;
        setContainerWidth(newWidth);
      }
    });
    observer.observe(containerRef.current);
    const initialWidth = containerRef.current.offsetWidth || 0;
    setContainerWidth(initialWidth);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!pathContainerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newWidth = entry.contentRect.width;
        setPathContainerWidth(newWidth);
      }
    });
    observer.observe(pathContainerRef.current);
    const initialWidth = pathContainerRef.current.offsetWidth || 0;
    setPathContainerWidth(initialWidth);
    return () => observer.disconnect();
  }, []);

  const maxLength = useMemo(() => {
    if (containerWidth === 0) {
      return 999; // Default to very large to avoid premature truncation
    }

    // Use actual path container width if available, otherwise estimate
    const availableWidth =
      pathContainerWidth > 0
        ? pathContainerWidth - 24 // subtract padding (20px left + 4px right)
        : Math.max(containerWidth - 80, 100); // less conservative estimate

    // Font size is 10px, monospace typically 6-6.5px per char (more accurate)
    // Using 6.5px for better accuracy with VS Code's default monospace fonts
    const chars = Math.floor(availableWidth / 6.5);
    const result = Math.max(chars, 30);

    return result;
  }, [containerWidth, pathContainerWidth]);

  const displayPath = useMemo(() => {
    if (!path) return "";
    const truncated = truncatePath(path, maxLength);
    return truncated;
  }, [path, maxLength]);

  // Track path span width to see actual content width
  useEffect(() => {
    if (!pathSpanRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const newWidth = entry.contentRect.width;
        setPathSpanWidth(newWidth);
      }
    });
    observer.observe(pathSpanRef.current);
    const initialWidth = pathSpanRef.current.offsetWidth || 0;
    setPathSpanWidth(initialWidth);
    return () => observer.disconnect();
  }, [displayPath]); // Re-observe when displayPath changes

  // Track previous diagnostic counts to avoid redundant logs
  const prevDiagnosticCountsRef = useRef<{
    total: number;
    errors: number;
    warnings: number;
  }>({
    total: 0,
    errors: 0,
    warnings: 0,
  });

  // Calculate error and warning counts from diagnostics
  const diagnosticCounts = useMemo(() => {
    if (!diagnostics || diagnostics.length === 0) {
      return { errors: 0, warnings: 0 };
    }

    const errors = diagnostics.filter((d) => d.severity === "Error").length;
    const warnings = diagnostics.filter((d) => d.severity === "Warning").length;

    // Only log when counts actually change
    const countsChanged =
      prevDiagnosticCountsRef.current.total !== diagnostics.length ||
      prevDiagnosticCountsRef.current.errors !== errors ||
      prevDiagnosticCountsRef.current.warnings !== warnings;

    if (countsChanged && diagnostics.length > 0) {
      // Update previous counts
      prevDiagnosticCountsRef.current = {
        total: diagnostics.length,
        errors,
        warnings,
      };
    }

    return { errors, warnings };
  }, [diagnostics, toolType, path]);

  // Path always uses default description color (no diagnostic-based coloring)
  const pathColor = "var(--vscode-descriptionForeground)";

  // Generate tooltip text based on status
  const getStatusTooltip = useMemo(() => {
    if (statusTooltip) return statusTooltip;

    if (isError) return "Error - Action failed";
    if (isPartial) return "In progress...";
    if (isWaitingApproval) return "Waiting for approval";

    // Check if completed based on color
    const isCompleted =
      statusColor?.includes("gitDecoration-addedResourceForeground") ||
      statusColor?.includes("#3fb950");

    if (isCompleted && toolType) {
      // Context-specific tooltips for completed actions
      switch (toolType) {
        case "write_to_file":
          if (tooltipMeta?.lineCount) {
            return `✓ File created (+${tooltipMeta.lineCount} lines)`;
          }
          return "✓ File created successfully";

        case "replace_in_file":
          if (diffStats) {
            return `✓ File updated (+${diffStats.added} -${diffStats.removed} lines)`;
          }
          return "✓ File updated successfully";

        case "read_file":
          if (tooltipMeta?.lineRange) {
            return `✓ Read lines ${tooltipMeta.lineRange}`;
          }
          return "✓ File read successfully";

        case "list_files":
          if (tooltipMeta?.fileCount) {
            return `✓ Listed ${tooltipMeta.fileCount} ${tooltipMeta.fileCount === 1 ? "item" : "items"}`;
          }
          return "✓ Directory listed successfully";

        case "grep":
          if (
            tooltipMeta?.matchCount !== undefined &&
            tooltipMeta?.fileCount !== undefined
          ) {
            return `✓ Found ${tooltipMeta.matchCount} ${tooltipMeta.matchCount === 1 ? "match" : "matches"} in ${tooltipMeta.fileCount} ${tooltipMeta.fileCount === 1 ? "file" : "files"}`;
          }
          return "✓ Search completed";

        case "delete_file":
          return "✓ File deleted successfully";

        case "view_replace_history":
          if (tooltipMeta?.fileCount) {
            return `✓ Found ${tooltipMeta.fileCount} ${tooltipMeta.fileCount === 1 ? "version" : "versions"}`;
          }
          return "✓ History loaded successfully";

        case "run_command":
          return "✓ Command executed successfully";

        case "git_status":
          return "✓ Git status retrieved";

        case "commit_message":
          return "✓ Commit created successfully";

        default:
          return "✓ Completed successfully";
      }
    }

    if (isCompleted) {
      return "✓ Completed successfully";
    }

    // Default for gray/description color (not started or waiting)
    if (statusColor?.includes("descriptionForeground")) {
      return isWaitingApproval ? "Waiting for approval" : "Not started yet";
    }

    return "Status";
  }, [
    statusTooltip,
    isError,
    isPartial,
    isWaitingApproval,
    statusColor,
    toolType,
    diffStats,
    tooltipMeta,
  ]);

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
                alignItems: "flex-start",
                gap: "8px",
                flexWrap: "nowrap",
              }}
            >
              {/* Left column: CircleDot + CircleRing */}
              {statusColor && (
                <div
                  style={{
                    position: "relative",
                    width: "16px",
                    height: "16px",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: onDotClick ? "pointer" : "default",
                    marginTop: "2px", // Align with text baseline
                  }}
                  title={getStatusTooltip}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onDotClick) {
                      onDotClick();
                    }
                  }}
                >
                  {/* CircleRing */}
                  <div
                    style={{
                      position: "absolute",
                      width: "16px",
                      height: "16px",
                      borderRadius: "50%",
                      // FIX: Use individual border properties instead of shorthand to avoid conflict
                      ...(!isPartial && {
                        border: `2px solid ${statusColor}`,
                        opacity: 0.4,
                      }),
                      ...(isPartial && {
                        borderWidth: "2px",
                        borderStyle: "solid",
                        borderRightColor: statusColor,
                        borderBottomColor: statusColor,
                        borderLeftColor: statusColor,
                        borderTopColor: "transparent",
                        animation: "circle-ring-spin 1s linear infinite",
                        opacity: 0.8,
                      }),
                    }}
                  />
                  {/* CircleDot */}
                  <div
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      backgroundColor: statusColor,
                    }}
                  />
                </div>
              )}

              {/* Right column: All other content */}
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  display: "flex",
                  flexDirection: "column",
                  gap: "2px",
                  marginTop: "2px",
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
                    <div
                      className="terminal-name"
                      style={{ display: "contents" }}
                    >
                      {title}
                    </div>
                  )}
                </div>

                {displayPath && path && (
                  <div
                    ref={pathContainerRef}
                    style={{
                      display: "flex",
                      justifyContent: "flex-start",
                      alignItems: "center",
                      paddingLeft: "20px",
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
                        borderLeft:
                          "1px solid color-mix(in srgb, var(--vscode-descriptionForeground) 20%, transparent)",
                        borderBottom:
                          "1px solid color-mix(in srgb, var(--vscode-descriptionForeground) 20%, transparent)",
                      }}
                    />
                    <span
                      ref={pathSpanRef}
                      style={{
                        fontSize: "10px",
                        opacity: 0.6,
                        color: pathColor,
                        fontFamily:
                          "var(--vscode-editor-font-family, monospace)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        borderRadius: "2px",
                        transition: "text-decoration 0.15s ease",
                        cursor: "default",
                        textDecoration: "none",
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        flexShrink: 1,
                        minWidth: 0,
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
                    {(diagnosticCounts.warnings > 0 ||
                      diagnosticCounts.errors > 0) && (
                      <span
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          flexShrink: 0,
                          fontSize: "10px",
                          fontWeight: 600,
                          color: "var(--vscode-descriptionForeground)",
                          opacity: 0.6,
                        }}
                      >
                        [
                        {diagnosticCounts.warnings > 0 && (
                          <span
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "2px",
                            }}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="10"
                              height="10"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="var(--vscode-editorWarning-foreground, #cca700)"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              style={{ opacity: 1.67 }}
                            >
                              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
                              <path d="M12 9v4" />
                              <path d="M12 17h.01" />
                            </svg>
                            {diagnosticCounts.warnings}
                          </span>
                        )}
                        {diagnosticCounts.warnings > 0 &&
                          diagnosticCounts.errors > 0 &&
                          " "}
                        {diagnosticCounts.errors > 0 && (
                          <span
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "2px",
                            }}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="10"
                              height="10"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="var(--vscode-errorForeground, #ff4d4d)"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              style={{ opacity: 1.67 }}
                            >
                              <path d="M12 20v-9" />
                              <path d="M14 7a4 4 0 0 1 4 4v3a6 6 0 0 1-12 0v-3a4 4 0 0 1 4-4z" />
                              <path d="M14.12 3.88 16 2" />
                              <path d="M21 21a4 4 0 0 0-3.81-4" />
                              <path d="M21 5a4 4 0 0 1-3.55 3.97" />
                              <path d="M22 13h-4" />
                              <path d="M3 21a4 4 0 0 1 3.81-4" />
                              <path d="M3 5a4 4 0 0 0 3.55 3.97" />
                              <path d="M6 13H2" />
                              <path d="m8 2 1.88 1.88" />
                              <path d="M9 7.13V6a3 3 0 1 1 6 0v1.13" />
                            </svg>
                            {diagnosticCounts.errors}
                          </span>
                        )}
                        ]
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
        {(subTitle || diffStats) && (
          <div
            className={`terminal-sub-info${subTitleClassName ? ` ${subTitleClassName}` : ""}`}
          >
            {diffStats ? (
              <>
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
              </>
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
