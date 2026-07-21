import React, { useState } from "react";
import FileIcon from "@/icons/FileIcon";
import "../run_command/TerminalBlock.css";
import "./GitDiffBlock.css";

export interface GitDiffBlockProps {
  filePath: string;
  diffContent: string;
  added?: number;
  deleted?: number;
  isPartial?: boolean;
  statusColor?: string;
  onFileClick?: (filePath: string) => void;
  branch?: string;
}

const GitDiffBlock: React.FC<GitDiffBlockProps> = ({
  filePath,
  diffContent,
  added = 0,
  deleted = 0,
  isPartial = false,
  statusColor = "var(--vscode-gitDecoration-addedResourceForeground, #3fb950)",
  onFileClick,
  branch,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(true);

  // Parse and filter diff content to remove metadata lines and markers
  const parseDiffContent = (
    content: string,
  ): { lines: string[]; types: string[] } => {
    const rawLines = content.split("\n");
    const lines: string[] = [];
    const types: string[] = [];
    let inHunk = false;

    for (const line of rawLines) {
      // Skip diff lines (metadata) - includes "diff", "diff --git", etc.
      if (line.startsWith("diff")) continue;

      // Skip index lines (metadata)
      if (line.startsWith("index ")) continue;

      // Skip --- and +++ file headers (not file content)
      if (line.startsWith("--- ") || line.startsWith("+++ ")) continue;

      // Skip @@ hunk headers (not file content)
      if (line.startsWith("@@")) {
        inHunk = true;
        continue;
      }

      // Skip git metadata lines (new file mode, etc.)
      if (line.startsWith("new file mode")) continue;
      if (line.startsWith("deleted file mode")) continue;

      // Skip trailing git metadata (no newline at end of file)
      if (line.includes("No newline at end of file")) continue;

      // Process lines within hunks
      if (inHunk) {
        let content = line;
        let type = "context";

        // Strip leading +, -, or space and track the type
        if (line.startsWith("+") && !line.startsWith("+++")) {
          content = line.substring(1);
          type = "added";
        } else if (line.startsWith("-") && !line.startsWith("---")) {
          content = line.substring(1);
          type = "removed";
        } else if (line.startsWith(" ")) {
          content = line.substring(1);
          type = "context";
        } else if (line === "") {
          content = "";
          type = "empty";
        } else {
          // If we're in a hunk and hit something unexpected, treat as context
          content = line;
          type = "context";
        }

        // Only keep non-empty lines or show empty as a blank line
        if (content !== "" || line === "") {
          lines.push(content);
          types.push(type);
        }
      } else {
        // Before first hunk, if there's any meaningful content, keep it as context
        if (line.trim() !== "") {
          lines.push(line);
          types.push("context");
        }
      }
    }

    return { lines, types };
  };

  // Render diff lines with colors based on type
  const renderDiffLines = (content: string) => {
    const { lines, types } = parseDiffContent(content);
    return lines.map((line, index) => {
      const type = types[index] || "context";
      let color = "var(--vscode-editor-foreground)";
      let backgroundColor = "transparent";

      if (type === "added") {
        color = "var(--vscode-gitDecoration-addedResourceForeground, #3fb950)";
        backgroundColor =
          "color-mix(in srgb, var(--vscode-gitDecoration-addedResourceForeground, #3fb950) 12%, transparent)";
      } else if (type === "removed") {
        color =
          "var(--vscode-gitDecoration-deletedResourceForeground, #f14c4c)";
        backgroundColor =
          "color-mix(in srgb, var(--vscode-gitDecoration-deletedResourceForeground, #f14c4c) 12%, transparent)";
      } else if (type === "empty") {
        color = "transparent";
        backgroundColor = "transparent";
        // Render empty line with height
        return (
          <div
            key={index}
            style={{
              padding: "0 8px",
              height: "20px",
              fontFamily: "var(--vscode-editor-font-family, monospace)",
              fontSize: "12px",
              lineHeight: "1.5",
            }}
          />
        );
      }

      return (
        <div
          key={index}
          style={{
            padding: "0 8px",
            color,
            backgroundColor,
            fontFamily: "var(--vscode-editor-font-family, monospace)",
            fontSize: "12px",
            lineHeight: "1.5",
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            overflowWrap: "break-word",
            minHeight: "20px",
          }}
        >
          {line}
        </div>
      );
    });
  };

  const fileName = filePath.split("/").pop() || filePath;

  // Header style - collapse icon + label + file icon + filename + stats + action icon
  const headerTitle = (
    <div className="terminal-name" style={{ display: "contents" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          fontSize: "12px",
          color: "var(--vscode-editor-foreground)",
        }}
      >
        <span style={{ fontWeight: 600, opacity: 0.8 }}>
          DIFF{branch ? `(${branch})` : ""}
        </span>
        <FileIcon
          path={filePath}
          style={{ width: "14px", height: "14px", flexShrink: 0 }}
        />
        <span
          style={{
            fontWeight: 500,
            opacity: 0.9,
            fontFamily: "var(--vscode-editor-font-family, monospace)",
            fontSize: "11px",
            cursor: onFileClick ? "pointer" : "default",
          }}
          onClick={(e) => {
            e.stopPropagation();
            if (onFileClick) onFileClick(filePath);
          }}
          title={onFileClick ? "Click để mở file" : ""}
        >
          {fileName}
        </span>
        {(added > 0 || deleted > 0) && (
          <>
            <span
              style={{
                color:
                  "var(--vscode-gitDecoration-addedResourceForeground, #3fb950)",
                fontWeight: 600,
                fontSize: "11px",
              }}
            >
              +{added}
            </span>
            <span
              style={{
                color:
                  "var(--vscode-gitDecoration-deletedResourceForeground, #f14c4c)",
                fontWeight: 600,
                fontSize: "11px",
              }}
            >
              -{deleted}
            </span>
          </>
        )}
        {isPartial && (
          <span
            className="codicon codicon-loading codicon-modifier-spin"
            style={{ fontSize: "12px", opacity: 0.6 }}
          />
        )}
        <span
          className="codicon codicon-git-pull-request"
          style={{ fontSize: "14px", marginLeft: "2px" }}
        />
      </div>
    </div>
  );

  const handleHeaderClick = () => {
    // Only toggle if there's diff content
    if (diffContent) {
      setIsCollapsed(!isCollapsed);
    }
  };

  return (
    <div
      className="terminal-block git-diff-block"
      style={{
        marginBottom: "8px",
        backgroundColor: "transparent",
        borderRadius: "0px",
        overflow: "visible",
      }}
    >
      <div
        className="terminal-block-header"
        onClick={handleHeaderClick}
        style={{
          cursor: diffContent ? "pointer" : "default",
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
                {/* Status dot */}
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
                      marginTop: "2px",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        width: "16px",
                        height: "16px",
                        borderRadius: "50%",
                        border: `2px solid ${statusColor}`,
                        opacity: isPartial ? 0.8 : 0.4,
                      }}
                    />
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

                {/* Content */}
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
                    {diffContent && (
                      <span
                        className={`collapse-icon codicon codicon-chevron-${isCollapsed ? "right" : "down"}`}
                        style={{ fontSize: "12px", marginRight: "4px" }}
                      />
                    )}
                    {headerTitle}
                  </div>

                  {filePath && (
                    <div
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
                        style={{
                          fontSize: "10px",
                          opacity: 0.6,
                          color: "var(--vscode-descriptionForeground)",
                          fontFamily:
                            "var(--vscode-editor-font-family, monospace)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          width: "100%",
                          padding: "0 4px 0 20px",
                          borderRadius: "2px",
                          transition: "text-decoration 0.15s ease",
                          cursor: onFileClick ? "pointer" : "default",
                          textDecoration: "none",
                        }}
                        title={filePath}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onFileClick) {
                            onFileClick(filePath);
                          }
                        }}
                        onMouseEnter={(e) => {
                          if (onFileClick) {
                            e.currentTarget.style.textDecoration = "underline";
                            e.currentTarget.style.textDecorationColor =
                              "var(--vscode-focusBorder, rgba(0, 122, 204, 0.6))";
                            e.currentTarget.style.textUnderlineOffset = "2px";
                          }
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.textDecoration = "none";
                        }}
                      >
                        {filePath}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {!isCollapsed && diffContent && (
        <div
          style={{
            padding: "4px 12px 12px 0",
          }}
        >
          <div
            style={{
              background:
                "var(--vscode-editor-background, var(--vscode-textCodeBlock-background))",
              borderRadius: "4px",
              border:
                "1px solid var(--vscode-widget-border, rgba(255,255,255,0.08))",
              overflow: "auto",
              maxHeight: "400px",
              fontFamily: "var(--vscode-editor-font-family, monospace)",
              fontSize: "12px",
              lineHeight: "1.5",
              padding: "4px 0",
              wordBreak: "break-word",
              overflowWrap: "break-word",
            }}
          >
            {renderDiffLines(diffContent)}
          </div>
        </div>
      )}
    </div>
  );
};

export { GitDiffBlock };
export default GitDiffBlock;
