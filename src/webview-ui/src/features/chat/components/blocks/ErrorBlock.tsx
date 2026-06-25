import React, { useState } from "react";
import { ToolHeader } from "../tools/ToolHeader";
import "./TerminalBlock.css";
import "./ErrorBlock.css";

export interface ErrorBlockProps {
  content: string;
  errorCode?: string;
  isPartial?: boolean;
  isLast?: boolean;
  isLastMessage?: boolean;
}

const ErrorBlock: React.FC<ErrorBlockProps> = ({
  content,
  errorCode,
  isPartial = false,
  isLast = false,
  isLastMessage = false,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const errorColor = "var(--vscode-errorForeground, #f44336)";

  // Extract the actual error message (remove "Error:" prefix if present)
  const cleanContent = content.replace(/^Error:\s*/i, "");

  // Parse error code from "[CODE] message" format
  const codeMatch = cleanContent.match(/^\[([^\]]+)\]\s*(.*)/s);
  const displayErrorCode = errorCode || (codeMatch ? codeMatch[1] : null);
  const displayMessage = codeMatch ? codeMatch[2] : cleanContent;

  const timelineClass = isLast ? "timeline-item last" : "timeline-item";

  return (
    <div
      className={timelineClass}
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        paddingBottom: isLast ? (isLastMessage ? "0px" : "12px") : "8px",
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
              <span style={{ fontWeight: 600, opacity: 0.8, color: errorColor }}>
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

        {!isCollapsed && (
          <div className="error-block-content" style={{ paddingLeft: "36px" }}>
            <div style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
              {displayMessage}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ErrorBlock;
