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
  const [showRevertModal, setShowRevertModal] = React.useState(false);
  const [isCopied, setIsCopied] = React.useState(false);

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

  const handleCopy = () => {
    navigator.clipboard.writeText(displayContent);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 1000);
  };

  const handleRegenerate = () => {
    // TODO: Implement regenerate logic - resend this message
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
        zIndex: 1,
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "var(--spacing-xs)",
          borderRadius: "var(--border-radius)",
          backgroundColor: "var(--input-bg)",
          border:
            "1px solid var(--vscode-widget-border, rgba(255,255,255,0.08))",
          padding: "var(--spacing-md)",
          marginLeft: "0px",
          position: "relative",
        }}
      >
        <div
          style={{
            fontSize: "var(--font-size-sm)",
            color: "var(--primary-text)",
            lineHeight: 1.6,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            overflowWrap: "break-word",
            maxWidth: "100%",
            maxHeight: "400px",
            overflow: "auto",
          }}
        >
          {displayContent}
        </div>
      </div>

      {/* Bottom toolbar - always visible, transparent background */}
      <div
        style={{
          width: "100%",
          display: "flex",
          justifyContent: "flex-start",
          alignItems: "center",
          gap: "8px",
          backgroundColor: "transparent",
          padding: "4px 8px",
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
            padding: "4px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: isCopied
              ? "var(--vscode-gitDecoration-addedResourceForeground, #3fb950)"
              : "var(--vscode-descriptionForeground)",
            borderRadius: "4px",
            opacity: 0.7,
            transition: "opacity 0.2s, color 0.2s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.7")}
        >
          {isCopied ? (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 6 9 17l-5-5" />
            </svg>
          ) : (
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
            </svg>
          )}
        </button>

        {/* Regenerate button */}
        <button
          onClick={handleRegenerate}
          title="Regenerate response"
          style={{
            background: "transparent",
            border: "none",
            cursor: "pointer",
            padding: "4px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--vscode-descriptionForeground)",
            borderRadius: "4px",
            opacity: 0.7,
            transition: "opacity 0.2s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
          onMouseLeave={(e) => (e.currentTarget.style.opacity = "0.7")}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
            <path d="M21 3v5h-5" />
          </svg>
        </button>
      </div>

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
