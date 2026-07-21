import React from "react";

// TYPES
import { Message } from "@/features/chat/types/message";

// COMPONENTS
import CodeBlock from "./blocks/code/CodeBlock";

interface ResponseMetadataBarProps {
  responseNumber: number;
  message: Message;
  previousUserMessage: Message | null;
}

/**
 * ResponseMetadataBar displays token usage statistics and response number.
 * Shows request/response token counts with expandable raw content view.
 */
export const ResponseMetadataBar: React.FC<ResponseMetadataBarProps> = ({
  responseNumber,
  message,
  previousUserMessage,
}) => {
  const [requestChecked, setRequestChecked] = React.useState(false);
  const [responseChecked, setResponseChecked] = React.useState(false);

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

        {/* Response Badge */}
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
    </div>
  );
};

export default ResponseMetadataBar;
