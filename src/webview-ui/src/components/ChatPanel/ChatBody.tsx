import React, { useEffect, useRef } from "react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
}

interface ChatBodyProps {
  messages: Message[];
  isProcessing: boolean;
}

const ChatBody: React.FC<ChatBodyProps> = ({ messages, isProcessing }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom khi có message mới
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isProcessing]);

  if (messages.length === 0 && !isProcessing) {
    return (
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "var(--spacing-lg)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--spacing-md)",
        }}
      >
        <div
          style={{
            textAlign: "center",
            color: "var(--secondary-text)",
            fontSize: "var(--font-size-sm)",
            padding: "var(--spacing-xl)",
          }}
        >
          <div
            style={{
              fontSize: "var(--font-size-xxl)",
              marginBottom: "var(--spacing-md)",
            }}
          >
            💬
          </div>
          <p>No messages yet</p>
          <p
            style={{
              fontSize: "var(--font-size-xs)",
              marginTop: "var(--spacing-xs)",
            }}
          >
            Start a conversation by typing a message below
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "var(--spacing-lg)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--spacing-md)",
      }}
    >
      {messages.map((message) => (
        <div
          key={message.id}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--spacing-xs)",
            padding: "var(--spacing-md)",
            borderRadius: "var(--border-radius)",
            backgroundColor:
              message.role === "user"
                ? "var(--input-bg)"
                : "var(--secondary-bg)",
            border: "1px solid var(--border-color)",
            maxWidth: "100%",
            wordWrap: "break-word",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--spacing-xs)",
              fontSize: "var(--font-size-xs)",
              color: "var(--secondary-text)",
              fontWeight: 600,
            }}
          >
            <span>{message.role === "user" ? "👤" : "🤖"}</span>
            <span>{message.role === "user" ? "You" : "AI Assistant"}</span>
            <span style={{ marginLeft: "auto" }}>
              {new Date(message.timestamp).toLocaleTimeString()}
            </span>
          </div>
          <div
            style={{
              fontSize: "var(--font-size-md)",
              color: "var(--primary-text)",
              lineHeight: 1.6,
              whiteSpace: "pre-wrap",
            }}
          >
            {message.content}
          </div>
        </div>
      ))}

      {isProcessing && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--spacing-sm)",
            padding: "var(--spacing-md)",
            color: "var(--secondary-text)",
            fontSize: "var(--font-size-sm)",
          }}
        >
          <div
            style={{
              width: "8px",
              height: "8px",
              borderRadius: "50%",
              backgroundColor: "var(--accent-text)",
              animation: "pulse 1.5s ease-in-out infinite",
            }}
          />
          <span>AI is thinking...</span>
        </div>
      )}

      <div ref={messagesEndRef} />

      <style>
        {`
          @keyframes pulse {
            0%, 100% {
              opacity: 1;
            }
            50% {
              opacity: 0.3;
            }
          }
        `}
      </style>
    </div>
  );
};

export default ChatBody;
