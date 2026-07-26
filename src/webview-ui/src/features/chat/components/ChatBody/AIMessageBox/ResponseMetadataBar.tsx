import React from "react";

// TYPES
import { Message } from "@/features/chat/types/message";

// COMPONENTS
import CodeBlock from "./blocks/code/CodeBlock";
import RevertConfirmModal from "@/components/RevertConfirmModal";

interface ResponseMetadataBarProps {
  responseNumber: number;
  message: Message;
  previousUserMessage: Message | null;
  onRetryRequest?: () => void;
  onRevertConversation?: (messageId: string, timestamp: number) => void;
}

/**
 * ResponseMetadataBar displays token usage statistics and response number.
 * Shows request/response token counts with expandable raw content view.
 */
export const ResponseMetadataBar: React.FC<ResponseMetadataBarProps> = ({
  responseNumber,
  message,
  previousUserMessage,
  onRetryRequest,
  onRevertConversation,
}) => {
  const [requestChecked, setRequestChecked] = React.useState(false);
  const [responseChecked, setResponseChecked] = React.useState(false);
  const [showRetryModal, setShowRetryModal] = React.useState(false);
  const [showRevertModal, setShowRevertModal] = React.useState(false);
  const [isRetryHovered, setIsRetryHovered] = React.useState(false);
  const [isRevertHovered, setIsRevertHovered] = React.useState(false);

  const showRaw = requestChecked || responseChecked;
  const reqTokens =
    previousUserMessage?.token_usage ??
    previousUserMessage?.usage?.prompt_tokens ??
    0;
  const resTokens =
    message.usage?.completion_tokens ?? message.token_usage ?? 0;

  // Request/Response icons (upload/download)
  const RequestIcon = (
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
      style={{ flexShrink: 0 }}
    >
      <path d="M12 3v12" />
      <path d="m17 8-5-5-5 5" />
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    </svg>
  );

  const ResponseIcon = (
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
      style={{ flexShrink: 0 }}
    >
      <path d="M12 15V3" />
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m7 10 5 5 5-5" />
    </svg>
  );

  const RetryIcon = (
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
      style={{ flexShrink: 0 }}
    >
      <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
    </svg>
  );

  const RevertIcon = (
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
      style={{ flexShrink: 0 }}
    >
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11" />
    </svg>
  );

  const handleRetryClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowRetryModal(true);
  };

  const handleRevertClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowRevertModal(true);
  };

  const handleConfirmRetry = () => {
    if (onRetryRequest) {
      onRetryRequest();
    }
  };

  const handleConfirmRevert = () => {
    if (onRevertConversation) {
      onRevertConversation(message.id, message.timestamp);
    }
  };

  return (
    <div>
      <div
        style={{
          position: "relative",
          paddingTop: "6px",
          paddingBottom: "6px",
          fontSize: "11px",
          fontFamily: "var(--vscode-editor-font-family, monospace)",
          lineHeight: 1.6,
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: "12px",
          userSelect: "none",
          flexWrap: "wrap",
        }}
      >
        {/* Request Badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <div
            onClick={() => setRequestChecked(!requestChecked)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              cursor: "pointer",
              textDecoration: requestChecked ? "underline" : "none",
              textUnderlineOffset: "3px",
              transition: "opacity 0.2s ease",
              opacity: requestChecked ? 1 : 0.8,
            }}
          >
            <span
              style={{
                color: "var(--vscode-charts-green, #89d185)",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              {RequestIcon}
            </span>
            <span
              style={{
                color: "var(--vscode-foreground)",
                fontWeight: 600,
              }}
            >
              {reqTokens.toLocaleString()}
            </span>
          </div>

          {/* Retry Icon - Only show when request is active (checked) */}
          {onRetryRequest && previousUserMessage && requestChecked && (
            <div
              onClick={handleRetryClick}
              onMouseEnter={() => setIsRetryHovered(true)}
              onMouseLeave={() => setIsRetryHovered(false)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                cursor: "pointer",
                color: "var(--vscode-charts-yellow, #f9dd66)",
                textDecoration: isRetryHovered ? "underline" : "none",
                textUnderlineOffset: "3px",
                transition: "opacity 0.2s ease",
                opacity: isRetryHovered ? 1 : 0.7,
              }}
              title="Retry this request"
            >
              {RetryIcon}
            </div>
          )}

          {/* Revert Icon - Only show when request is active (checked) */}
          {onRevertConversation && requestChecked && (
            <div
              onClick={handleRevertClick}
              onMouseEnter={() => setIsRevertHovered(true)}
              onMouseLeave={() => setIsRevertHovered(false)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                cursor: "pointer",
                color: "var(--vscode-charts-orange, #d18616)",
                textDecoration: isRevertHovered ? "underline" : "none",
                textUnderlineOffset: "3px",
                transition: "opacity 0.2s ease",
                opacity: isRevertHovered ? 1 : 0.7,
              }}
              title="Revert conversation to this point"
            >
              {RevertIcon}
            </div>
          )}
        </div>

        {/* Response Badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <div
            onClick={() => setResponseChecked(!responseChecked)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              cursor: "pointer",
              textDecoration: responseChecked ? "underline" : "none",
              textUnderlineOffset: "3px",
              transition: "opacity 0.2s ease",
              opacity: responseChecked ? 1 : 0.8,
            }}
          >
            <span
              style={{
                color: "var(--vscode-charts-red, #f48771)",
                display: "inline-flex",
                alignItems: "center",
              }}
            >
              {ResponseIcon}
            </span>
            <span
              style={{
                color: "var(--vscode-foreground)",
                fontWeight: 600,
              }}
            >
              {resTokens.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Response Number */}
        <span
          style={{
            color: "var(--vscode-descriptionForeground)",
            fontSize: "11px",
            fontWeight: 600,
          }}
        >
          [{responseNumber}]
        </span>
      </div>
      {showRaw && (
        <div
          style={{
            marginTop: "4px",
            marginBottom: "8px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          {requestChecked && previousUserMessage?.rawRequest && (
            <div>
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "var(--vscode-descriptionForeground)",
                  marginBottom: "4px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                Request (User Content)
              </div>
              <CodeBlock
                code={previousUserMessage.rawRequest}
                language="text"
                maxHeight="400px"
              />
            </div>
          )}
          {responseChecked && message.rawResponse && (
            <div>
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "var(--vscode-descriptionForeground)",
                  marginBottom: "4px",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px",
                }}
              >
                Response (Assistant Content)
              </div>
              <CodeBlock
                code={message.rawResponse}
                language="text"
                maxHeight="400px"
              />
            </div>
          )}
          {showRaw &&
            !previousUserMessage?.rawRequest &&
            !message.rawResponse && (
              <div
                style={{
                  fontSize: "11px",
                  color: "var(--vscode-descriptionForeground)",
                  fontStyle: "italic",
                  padding: "8px",
                }}
              >
                Raw data not available for this response (may have been loaded
                from history before this feature was added).
              </div>
            )}
        </div>
      )}

      {/* Retry Confirmation Modal */}
      <RevertConfirmModal
        isOpen={showRetryModal}
        onClose={() => setShowRetryModal(false)}
        onConfirm={handleConfirmRetry}
        title="Retry this request?"
        description="This will resend the request from this point. If there are messages after this one, they will be removed and any file changes from those messages will be reverted."
      />

      {/* Revert Confirmation Modal */}
      <RevertConfirmModal
        isOpen={showRevertModal}
        onClose={() => setShowRevertModal(false)}
        onConfirm={handleConfirmRevert}
        title="Revert conversation to this point?"
        description="This will remove all messages after this response and revert any file changes from those messages."
      />
    </div>
  );
};

export default ResponseMetadataBar;
