import React from "react";
import { createPortal } from "react-dom";
import { Message } from "../../types/message";

interface UserMessageBoxProps {
  message: Message;
  onRevertConversation?: (messageId: string, timestamp: number) => void;
}

const UserMessageBox: React.FC<UserMessageBoxProps> = ({
  message,
  onRevertConversation,
}) => {
  const [isMessageCollapsed, setIsMessageCollapsed] = React.useState(false);
  const [showRevertModal, setShowRevertModal] = React.useState(false);
  const [isHovered, setIsHovered] = React.useState(false);

  const userMsgRegex =
    /## User Message\n<zen-user-content>\n([\s\S]*?)\n<\/zen-user-content>/;
  const match = message.content.match(userMsgRegex);

  if (!match && !message.content.includes("## User Message")) {
    return null;
  }

  let displayContent = match
    ? match[1]
    : message.content.replace(/^[\s\S]*?## User Message\n/, "");

  // Fallback cleanup if it didn't match the full block regex but has the header
  if (!match) {
    // Legacy: strip old ``` wrapper if present
    if (displayContent.startsWith("```") && displayContent.includes("```", 3)) {
      displayContent = displayContent.split("```")[1].trim();
    }
    // Strip new zen-user-content wrapper if partially matched
    displayContent = displayContent
      .replace(/^<zen-user-content>\n?/, "")
      .replace(/\n?<\/zen-user-content>[\s\S]*$/, "");
  }

  // 🆕 Collapsible long messages
  const lineCount = displayContent.split("\n").length;
  const charCount = displayContent.length;
  const isLongMessage = lineCount > 10 || charCount > 500;

  // Auto-collapse on mount if message is long
  React.useEffect(() => {
    if (isLongMessage && !isMessageCollapsed) {
      setIsMessageCollapsed(true);
    }
  }, [isLongMessage]);

  const truncatedContent =
    isLongMessage && isMessageCollapsed
      ? displayContent.split("\n").slice(0, 5).join("\n") + "\n..."
      : displayContent;

  const handleCopy = () => {
    navigator.clipboard.writeText(displayContent);
  };

  return (
    <div
      className="user-message-container"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "0px",
        marginBottom: "var(--spacing-md)",
        opacity: message.isCancelled ? 0.4 : 1,
        filter: message.isCancelled ? "grayscale(1) blur(0.5px)" : "none",
        pointerEvents: message.isCancelled ? "none" : "auto",
        transition: "all 0.3s ease",
        position: "relative",
        zIndex: 1, // Add z-index to avoid overlap issues
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--spacing-xs)",
          borderRadius: "var(--border-radius)",
          backgroundColor: "var(--input-bg)",
          border: "1px solid var(--vscode-widget-border, rgba(255,255,255,0.08))",
          padding: "var(--spacing-md)",
          marginLeft: "0px", // Align with left edge since there is no dot
          position: "relative",
          borderBottomLeftRadius: isHovered ? "0" : "var(--border-radius)",
          borderBottomRightRadius: isHovered ? "0" : "var(--border-radius)",
        }}
      >
        <style>{``}</style>
        <div
          style={{
            fontSize: "var(--font-size-sm)",
            color: "var(--primary-text)",
            lineHeight: 1.6,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            overflowWrap: "break-word",
            maxWidth: "100%",
            maxHeight: isMessageCollapsed ? "200px" : "none",
            overflow: "hidden",
          }}
        >
          {truncatedContent}
        </div>
      </div>
      
      {/* Bottom toolbar - show on hover */}
      {isHovered && (
        <div
          style={{
            width: "95%",
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: "4px",
            backgroundColor: "var(--input-bg)",
            borderLeft: "1px solid var(--vscode-widget-border, rgba(255,255,255,0.08))",
            borderRight: "1px solid var(--vscode-widget-border, rgba(255,255,255,0.08))",
            borderBottom: "1px solid var(--vscode-widget-border, rgba(255,255,255,0.08))",
            borderTop: "none",
            borderRadius: "0 0 var(--border-radius) var(--border-radius)",
            padding: "6px",
            paddingLeft: "8px",
            paddingRight: "8px",
            margin: "0 auto",
          }}
        >
          {/* Copy button */}
          <button
            onClick={handleCopy}
            title="Copy content"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "2px 4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--primary-text)",
              borderRadius: "4px",
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
              <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
            </svg>
          </button>

          {/* Expand/Collapse button */}
          {isLongMessage && (
            <button
              onClick={() => setIsMessageCollapsed(!isMessageCollapsed)}
              title={isMessageCollapsed ? "Expand content" : "Collapse content"}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "2px 4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--primary-text)",
                borderRadius: "4px",
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{
                  transform: isMessageCollapsed ? "rotate(0deg)" : "rotate(180deg)",
                  transition: "transform 0.2s",
                }}
              >
                <polyline points="18 15 12 9 6 15" />
              </svg>
            </button>
          )}

          {/* Revert button */}
          {onRevertConversation && (
            <button
              onClick={() => setShowRevertModal(true)}
              title="Revert conversation to this state"
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "2px 4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--primary-text)",
                borderRadius: "4px",
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="12"
                height="12"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 14 4 9l5-5" />
                <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11" />
              </svg>
            </button>
          )}
        </div>
      )}
      
      {showRevertModal &&
        createPortal(
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 9999,
              backgroundColor: "rgba(0,0,0,0.5)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onClick={() => setShowRevertModal(false)}
          >
            <div
              style={{
                backgroundColor: "var(--vscode-editor-background)",
                border: "1px solid var(--border-color)",
                borderRadius: "8px",
                padding: "20px 24px",
                minWidth: "300px",
                maxWidth: "400px",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  fontWeight: 600,
                  fontSize: "14px",
                  marginBottom: "8px",
                }}
              >
                Revert conversation?
              </div>
              <div
                style={{
                  fontSize: "12px",
                  color: "var(--secondary-text)",
                  marginBottom: "16px",
                }}
              >
                This will restore all modified files to their state before this
                message. Messages after this point will be removed.
              </div>
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  justifyContent: "flex-end",
                }}
              >
                <button
                  onClick={() => setShowRevertModal(false)}
                  style={{
                    padding: "5px 14px",
                    borderRadius: "4px",
                    fontSize: "12px",
                    cursor: "pointer",
                    background: "transparent",
                    border: "1px solid var(--border-color)",
                    color: "var(--primary-text)",
                  }}
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    setShowRevertModal(false);
                    onRevertConversation!(message.id, message.timestamp);
                  }}
                  style={{
                    padding: "5px 14px",
                    borderRadius: "4px",
                    fontSize: "12px",
                    cursor: "pointer",
                    background: "var(--vscode-button-background)",
                    border: "none",
                    color: "var(--vscode-button-foreground)",
                    fontWeight: 600,
                  }}
                >
                  Revert
                </button>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};

export default UserMessageBox;
