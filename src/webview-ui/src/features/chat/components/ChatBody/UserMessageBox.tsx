import React from "react";
import RevertConfirmModal from "@/components/RevertConfirmModal";
import FilesPreviews from "@/components/MessageInput/FilesPreviews";
import { Message, QuestionAnswer } from "@/features/chat/types/message";

interface UserMessageBoxProps {
  message: Message;
  onRevertConversation?: (messageId: string, timestamp: number) => void;
}

/**
 * Parse <question-answer> tag from user message content
 * Returns: { answers: Record<string, string>, cleanedContent: string }
 */
const parseQuestionAnswerFromContent = (
  content: string,
): { answers: Record<string, string>; cleanedContent: string } => {
  const regex = /<question-answer>([\s\S]*?)<\/question-answer>/i;
  const match = regex.exec(content);

  if (!match) {
    return { answers: {}, cleanedContent: content };
  }

  const innerContent = match[1].trim();
  const answers: Record<string, string> = {};

  // Parse each line: "N. answer"
  const lines = innerContent.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    const lineMatch = /^(\d+)\.\s*(.*)$/i.exec(trimmed);
    if (!lineMatch) continue;

    const questionNumber = lineMatch[1];
    const answerText = lineMatch[2].trim();

    // Store answer (even if empty)
    answers[`q${questionNumber}`] = answerText || "(no answer)";
  }

  // Remove <question-answer> block from content
  const cleanedContent = content.replace(regex, "").trim();

  return { answers, cleanedContent };
};

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

  // Parse <question-answer> tag from content
  const { answers: questionAnswers, cleanedContent } =
    parseQuestionAnswerFromContent(displayContent);
  const hasQuestionAnswers = Object.keys(questionAnswers).length > 0;

  // Use cleaned content (without <question-answer> tag) for display
  if (hasQuestionAnswers) {
    displayContent = cleanedContent;
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
      {/* Files Preview - Show at top if there are files */}
      {message.uploadedFiles?.length || message.attachedItems?.length ? (
        <div style={{ marginBottom: "var(--spacing-xs)" }}>
          <FilesPreviews
            uploadedFiles={message.uploadedFiles || []}
            attachedItems={message.attachedItems || []}
            onRemoveFile={() => {}} // Read-only in message display
            onRemoveAttachedItem={() => {}} // Read-only in message display
            onOpenImage={(file) => {
              const vscodeApi = (window as any).vscodeApi;
              if (vscodeApi) {
                vscodeApi.postMessage({
                  command: "openTempImage",
                  content: file.content,
                  filename: file.name,
                });
              }
            }}
            onAttachedItemClick={() => {}}
            readOnly={true}
          />
        </div>
      ) : null}

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
        {/* Question Answers Summary - Show if parsed from content */}
        {hasQuestionAnswers && (
          <div
            style={{
              marginBottom: "var(--spacing-sm)",
              padding: "var(--spacing-sm)",
              borderRadius: "4px",
              backgroundColor:
                "color-mix(in srgb, var(--vscode-button-background) 10%, transparent)",
              border:
                "1px solid color-mix(in srgb, var(--vscode-button-background) 20%, transparent)",
            }}
          >
            <div
              style={{
                fontSize: "11px",
                fontWeight: 600,
                color: "var(--vscode-descriptionForeground)",
                marginBottom: "8px",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              Question Answers
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              {Object.entries(questionAnswers).map(([qId, answer]) => {
                const questionNumber = qId.replace("q", "");
                return (
                  <div
                    key={qId}
                    style={{
                      fontSize: "12px",
                      color: "var(--vscode-foreground)",
                      lineHeight: 1.5,
                    }}
                  >
                    <span
                      style={{
                        color: "var(--vscode-button-background)",
                        fontWeight: 600,
                        marginRight: "6px",
                      }}
                    >
                      {questionNumber}.
                    </span>
                    <span
                      style={{
                        opacity: answer === "(no answer)" ? 0.5 : 1,
                        fontStyle: answer === "(no answer)" ? "italic" : "normal",
                      }}
                    >
                      {answer}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

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

        {/* Revert button */}
        {onRevertConversation && (
          <button
            onClick={() => {
              setShowRevertModal(true);
            }}
            title="Revert conversation to this point"
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
              <path d="M9 14 4 9l5-5" />
              <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11" />
            </svg>
          </button>
        )}

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

      <RevertConfirmModal
        isOpen={showRevertModal}
        onClose={() => {
          setShowRevertModal(false);
        }}
        onConfirm={() => {
          onRevertConversation!(message.id, message.timestamp);
        }}
      />
    </div>
  );
};

export default UserMessageBox;
