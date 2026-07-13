import React, { useState } from "react";
import { ToolHeader } from "../../tools/ToolHeader";
import "./ErrorBlock.css";

export interface ErrorBlockProps {
  content: string;
  errorCode?: string;
  isPartial?: boolean;
  isLast?: boolean;
  isLastMessage?: boolean;
  /** Whether to show the ToolHeader (default: true) */
  showHeader?: boolean;
  /** Padding left for content when header is hidden */
  contentPaddingLeft?: string;
  /** Use compact inline style (like GrepBlock error) instead of full header style */
  compact?: boolean;
  /** Maximum height for error content */
  maxHeight?: string;
}

// Parse error message to extract meaningful information
const parseErrorMessage = (msg: string): string => {
  // ENOENT: no such file or directory, open '/path/to/file'
  const enoentMatch = msg.match(
    /ENOENT: no such file or directory, open '([^']+)'/,
  );
  if (enoentMatch) {
    const filePath = enoentMatch[1];
    const fileName = filePath.split("/").pop() || filePath;
    return `Error: ${fileName} does not exist`;
  }

  // EACCES: permission denied, open '/path/to/file'
  const eaccesMatch = msg.match(/EACCES: permission denied, open '([^']+)'/);
  if (eaccesMatch) {
    const filePath = eaccesMatch[1];
    const fileName = filePath.split("/").pop() || filePath;
    return `Error: Permission denied to access ${fileName}`;
  }

  // EISDIR: illegal operation on a directory, read '/path/to/dir'
  const eisdirMatch = msg.match(
    /EISDIR: illegal operation on a directory, (?:open|read) '([^']+)'/,
  );
  if (eisdirMatch) {
    const dirPath = eisdirMatch[1];
    const dirName = dirPath.split("/").pop() || dirPath;
    return `Error: ${dirName} is a directory, not a file`;
  }

  // ENOTDIR: not a directory, open '/path/to/file'
  const enotdirMatch = msg.match(/ENOTDIR: not a directory, open '([^']+)'/);
  if (enotdirMatch) {
    const filePath = enotdirMatch[1];
    const fileName = filePath.split("/").pop() || filePath;
    return `Error: ${fileName} is not a directory`;
  }

  // Generic: remove "Error - " prefix if present
  let cleaned = msg.replace(/^Error - /, "");
  // Remove full path if present (keep only filename)
  cleaned = cleaned.replace(/\/[^\s]+/g, (match) => {
    const parts = match.split("/");
    return parts.length > 1 ? parts[parts.length - 1] : match;
  });
  return cleaned;
};

const ErrorBlock: React.FC<ErrorBlockProps> = ({
  content,
  errorCode,
  isPartial = false,
  isLast = false,
  isLastMessage = false,
  showHeader = true,
  contentPaddingLeft = "36px",
  compact = false,
  maxHeight,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const errorColor = "var(--vscode-errorForeground, #f44336)";

  // Extract the actual error message (remove "Error:" prefix if present)
  const cleanContent = content.replace(/^Error:\s*/i, "");

  // Parse error code from "[CODE] message" format
  const codeMatch = cleanContent.match(/^\[([^\]]+)\]\s*(.*)/s);
  const displayErrorCode = errorCode || (codeMatch ? codeMatch[1] : null);
  let displayMessage = codeMatch ? codeMatch[2] : cleanContent;

  // Parse and simplify error message
  displayMessage = parseErrorMessage(displayMessage);

  // Compact inline style (like GrepBlock error)
  if (compact) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          gap: "6px",
          padding: "5px 8px",
          backgroundColor:
            "color-mix(in srgb, var(--vscode-errorForeground) 4%, transparent)",
          border:
            "1px solid color-mix(in srgb, var(--vscode-errorForeground) 20%, transparent)",
          borderRadius: "4px",
          maxHeight: maxHeight,
          overflowY: maxHeight ? "auto" : "visible",
          // @ts-ignore - CSS custom scrollbar properties
          scrollbarColor: `${errorColor} transparent`,
          scrollbarWidth: "thin",
        }}
        className="error-scrollbar"
      >
        <span
          className="codicon codicon-error"
          style={{
            fontSize: "11px",
            color: "var(--vscode-errorForeground)",
            opacity: 0.7,
            marginTop: "1px",
            flexShrink: 0,
          }}
        />
        <span
          style={{
            fontSize: "11px",
            color: "var(--vscode-errorForeground)",
            opacity: 0.85,
            fontFamily: "var(--vscode-editor-font-family, monospace)",
            wordBreak: "break-word",
          }}
        >
          {displayMessage}
        </span>
      </div>
    );
  }

  // Full header style (original ErrorBlock)
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        paddingBottom: "0px",
      }}
    >
      <div
        className="terminal-block error-block"
        style={{
          backgroundColor: "transparent",
          borderRadius: "0px",
          overflow: "visible",
        }}
      >
        {showHeader && (
          <ToolHeader
            title={
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  fontSize: "12px",
                  color: "var(--vscode-editor-foreground)",
                }}
              >
                <span
                  style={{ fontWeight: 600, opacity: 0.8, color: errorColor }}
                >
                  ERROR
                </span>
                {displayErrorCode && (
                  <span
                    style={{
                      fontWeight: 500,
                      opacity: 0.7,
                      fontSize: "11px",
                      color: errorColor,
                    }}
                  >
                    {displayErrorCode}
                  </span>
                )}
              </div>
            }
            statusColor={errorColor}
            isPartial={isPartial}
            isCollapsed={isCollapsed}
            onClick={() => {
              if (content) setIsCollapsed(!isCollapsed);
            }}
          />
        )}

        {!isCollapsed && (
          <div
            style={{
              marginTop: "4px",
              maxHeight: maxHeight,
              overflowY: maxHeight ? "auto" : "visible",
              // @ts-ignore - CSS custom scrollbar properties
              scrollbarColor: `${errorColor} transparent`,
              scrollbarWidth: "thin",
            }}
            className="error-scrollbar"
          >
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "6px",
                padding: "5px 8px",
                backgroundColor:
                  "color-mix(in srgb, var(--vscode-errorForeground) 4%, transparent)",
                border:
                  "1px solid color-mix(in srgb, var(--vscode-errorForeground) 20%, transparent)",
                borderRadius: "4px",
              }}
            >
              <span
                className="codicon codicon-error"
                style={{
                  fontSize: "11px",
                  color: "var(--vscode-errorForeground)",
                  opacity: 0.7,
                  marginTop: "1px",
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  fontSize: "11px",
                  color: "var(--vscode-errorForeground)",
                  opacity: 0.85,
                  fontFamily: "var(--vscode-editor-font-family, monospace)",
                  wordBreak: "break-word",
                }}
              >
                {displayMessage}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ErrorBlock;
