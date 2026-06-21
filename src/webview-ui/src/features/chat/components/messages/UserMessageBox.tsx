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

  // 🆕 FLEXIBLE FILTER: Regex to find the user message block even if not at the start
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
    if (
      displayContent.startsWith("```") &&
      displayContent.includes("```", 3)
    ) {
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
      ? "..." + displayContent.split("\n").slice(-5).join("\n")
      : displayContent;

  return (
    <div
      className="user-message-container"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "var(--spacing-md)",
        marginBottom: "var(--spacing-md)",
        opacity: message.isCancelled ? 0.4 : 1,
        filter: message.isCancelled ? "grayscale(1) blur(0.5px)" : "none",
        pointerEvents: message.isCancelled ? "none" : "auto",
        transition: "all 0.3s ease",
        position: "relative",
        zIndex: 1, // Add z-index to avoid overlap issues
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--spacing-xs)",
          borderRadius: "var(--border-radius)",
          backgroundColor: "var(--input-bg)",
          padding: "var(--spacing-md)",
          marginLeft: "0px", // Align with left edge since there is no dot
          position: "relative",
        }}
      >
        <style>{``}</style>
        <div
          style={{
            fontSize: "var(--font-size-sm)",
            color: "var(--primary-text)",
            lineHeight: 1.6,
            whiteSpace: "pre-wrap",
          }}
        >
          {truncatedContent}
        </div>
        {isLongMessage && (
          <div
            onClick={() => setIsMessageCollapsed(!isMessageCollapsed)}
            style={{
              fontSize: "var(--font-size-xs)",
              color: "var(--vscode-textLink-foreground)",
              cursor: "pointer",
              marginTop: "var(--spacing-xs)",
              fontWeight: 600,
              userSelect: "none",
              textDecoration: "underline",
            }}
          >
            {isMessageCollapsed ? "Show more" : "Show less"}
          </div>
        )}
      </div>
      {onRevertConversation && (
        <button
          className="user-message-undo-btn"
          onClick={() => setShowRevertModal(true)}
          title="Revert conversation to this state"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
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
                This will restore all modified files to their state before
                this message. Messages after this point will be removed.
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