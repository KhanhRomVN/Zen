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
  const [parseDebugChecked, setParseDebugChecked] = React.useState(false);
  const [showRetryModal, setShowRetryModal] = React.useState(false);
  const [showRevertModal, setShowRevertModal] = React.useState(false);
  const [isRetryHovered, setIsRetryHovered] = React.useState(false);
  const [isRevertHovered, setIsRevertHovered] = React.useState(false);

  const showRaw = requestChecked || responseChecked || parseDebugChecked;
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

  const DebugIcon = (
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
      <path d="m8 2 1.88 1.88" />
      <path d="M14.12 3.88 16 2" />
      <path d="M9 7.13v-1a3.003 3.003 0 1 1 6 0v1" />
      <path d="M12 20c-3.3 0-6-2.7-6-6v-3a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v3c0 3.3-2.7 6-6 6" />
      <path d="M12 20v-9" />
      <path d="M6.53 9C4.6 8.8 3 7.1 3 5" />
      <path d="M6 13H2" />
      <path d="M3 21c0-2.1 1.7-3.9 3.8-4" />
      <path d="M20.97 5c0 2.1-1.6 3.8-3.5 4" />
      <path d="M22 13h-4" />
      <path d="M17.2 17c2.1.1 3.8 1.9 3.8 4" />
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

        {/* Parse Debug Badge - Only show if parseDebugInfo exists */}
        {message.parseDebugInfo && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <div
              onClick={() => setParseDebugChecked(!parseDebugChecked)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                cursor: "pointer",
                textDecoration: parseDebugChecked ? "underline" : "none",
                textUnderlineOffset: "3px",
                transition: "opacity 0.2s ease",
                opacity: parseDebugChecked ? 1 : 0.8,
                padding: "2px 6px",
                borderRadius: "3px",
                backgroundColor:
                  message.parseDebugInfo.failedActions > 0
                    ? "var(--vscode-inputValidation-errorBackground, rgba(244, 71, 71, 0.2))"
                    : message.parseDebugInfo.parseError
                      ? "var(--vscode-inputValidation-warningBackground, rgba(252, 185, 0, 0.2))"
                      : "transparent",
              }}
              title={
                message.parseDebugInfo.parseError
                  ? `Parse Error: ${message.parseDebugInfo.parseError.message}`
                  : `Parse Debug Info: ${message.parseDebugInfo.successfulActions}/${message.parseDebugInfo.totalActions} successful`
              }
            >
              <span
                style={{
                  color:
                    message.parseDebugInfo.failedActions > 0
                      ? "var(--vscode-errorForeground, #f48771)"
                      : message.parseDebugInfo.parseError
                        ? "var(--vscode-charts-orange, #d18616)"
                        : "var(--vscode-charts-blue, #75beff)",
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                {DebugIcon}
              </span>
              <span
                style={{
                  color: "var(--vscode-foreground)",
                  fontWeight: 600,
                  fontSize: "11px",
                }}
              >
                {message.parseDebugInfo.parseError
                  ? "Parse Error"
                  : `${message.parseDebugInfo.successfulActions}/${message.parseDebugInfo.totalActions}`}
              </span>
            </div>
          </div>
        )}

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
          {parseDebugChecked && message.parseDebugInfo && (
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
                Parse Debug Info
              </div>
              <CodeBlock
                code={JSON.stringify(message.parseDebugInfo, null, 2)}
                language="json"
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
