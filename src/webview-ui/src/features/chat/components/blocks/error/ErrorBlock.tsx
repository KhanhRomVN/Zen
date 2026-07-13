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
            className="error-block-content"
            style={{
              padding: "0 16px",
              marginLeft: showHeader ? "36px" : contentPaddingLeft,
              marginTop: "0",
              marginBottom: "0",
              marginRight: "0",
              display: "flex",
              alignItems: "center",
              minHeight: "32px",
            }}
          >
            <div
              style={{
                whiteSpace: "pre-wrap",
                wordBreak: "break-word",
                color: "var(--vscode-errorForeground, #f14c4c)",
              }}
            >
              {displayMessage}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ErrorBlock;
