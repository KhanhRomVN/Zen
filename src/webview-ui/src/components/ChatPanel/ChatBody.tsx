import React, { useEffect, useRef, useState } from "react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  isFirstRequest?: boolean;
  systemPrompt?: string;
  contextSize?: number;
}

interface ChatBodyProps {
  messages: Message[];
  isProcessing: boolean;
  checkpoints: string[];
}

const ChatBody: React.FC<ChatBodyProps> = ({
  messages,
  isProcessing,
  checkpoints,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    new Set()
  );

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
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "var(--spacing-xl)",
        }}
      >
        <div
          style={{
            textAlign: "center",
            maxWidth: "400px",
            width: "100%",
          }}
        >
          <div
            style={{
              fontSize: "64px",
              marginBottom: "var(--spacing-lg)",
              animation: "float 3s ease-in-out infinite",
            }}
          >
            💬
          </div>
          <h3
            style={{
              margin: 0,
              fontSize: "var(--font-size-xl)",
              fontWeight: 600,
              color: "var(--primary-text)",
              marginBottom: "var(--spacing-sm)",
            }}
          >
            Start a Conversation
          </h3>
          <p
            style={{
              margin: 0,
              fontSize: "var(--font-size-md)",
              color: "var(--secondary-text)",
              lineHeight: 1.6,
              marginBottom: "var(--spacing-lg)",
            }}
          >
            Ask anything, get instant responses from your AI assistant
          </p>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--spacing-sm)",
              padding: "var(--spacing-md)",
              backgroundColor: "var(--secondary-bg)",
              borderRadius: "var(--border-radius-lg)",
              border: "1px solid var(--border-color)",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--spacing-xs)",
                fontSize: "var(--font-size-sm)",
                color: "var(--primary-text)",
              }}
            >
              <span style={{ fontSize: "16px" }}>💡</span>
              <span>Get code suggestions and explanations</span>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--spacing-xs)",
                fontSize: "var(--font-size-sm)",
                color: "var(--primary-text)",
              }}
            >
              <span style={{ fontSize: "16px" }}>🔍</span>
              <span>Debug and troubleshoot issues</span>
            </div>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--spacing-xs)",
                fontSize: "var(--font-size-sm)",
                color: "var(--primary-text)",
              }}
            >
              <span style={{ fontSize: "16px" }}>📝</span>
              <span>Generate documentation and tests</span>
            </div>
          </div>
          <style>
            {`
              @keyframes float {
                0%, 100% {
                  transform: translateY(0px);
                }
                50% {
                  transform: translateY(-10px);
                }
              }
            `}
          </style>
        </div>
      </div>
    );
  }

  // 🆕 Helper function to copy text
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  // 🆕 Helper to toggle section collapse
  const toggleCollapse = (sectionId: string) => {
    setCollapsedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  };

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
      {messages.map((message, index) => {
        // 🆕 Render first request specially
        if (message.role === "user" && message.isFirstRequest) {
          const sectionId = `first-req-${message.id}`;
          const isCollapsed = collapsedSections.has(sectionId);

          return (
            <React.Fragment key={message.id}>
              {/* 🆕 First Request Section */}
              <div
                style={{
                  padding: "var(--spacing-lg)",
                  backgroundColor: "var(--primary-bg)",
                  border: "2px solid var(--accent-text)",
                  borderRadius: "var(--border-radius-lg)",
                }}
              >
                {/* Header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--spacing-sm)",
                    marginBottom: "var(--spacing-md)",
                    paddingBottom: "var(--spacing-sm)",
                    borderBottom: "1px solid var(--border-color)",
                  }}
                >
                  <span style={{ fontSize: "20px" }}>🎯</span>
                  <span
                    style={{
                      fontSize: "var(--font-size-md)",
                      fontWeight: 600,
                      color: "var(--accent-text)",
                    }}
                  >
                    Initial Request
                  </span>
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: "var(--font-size-xs)",
                      color: "var(--secondary-text)",
                      padding: "2px 8px",
                      backgroundColor: "var(--secondary-bg)",
                      borderRadius: "var(--border-radius)",
                    }}
                  >
                    📏 {message.contextSize?.toLocaleString() || 0} chars
                  </span>
                  <div
                    style={{
                      cursor: "pointer",
                      padding: "4px",
                      borderRadius: "var(--border-radius)",
                      transition: "background-color 0.2s",
                    }}
                    onClick={() => copyToClipboard(message.content)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "var(--hover-bg)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                    title="Copy request"
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  </div>
                </div>

                {/* Content */}
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

              {/* 🆕 Divider Checkpoint */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--spacing-sm)",
                  padding: "var(--spacing-sm) 0",
                }}
              >
                <div
                  style={{
                    flex: 1,
                    height: "1px",
                    borderTop: "2px dashed var(--border-color)",
                  }}
                />
                <span
                  style={{
                    fontSize: "var(--font-size-xs)",
                    color: "var(--secondary-text)",
                    padding: "2px 8px",
                    backgroundColor: "var(--secondary-bg)",
                    borderRadius: "var(--border-radius)",
                    fontWeight: 600,
                  }}
                >
                  📍 CHECKPOINT
                </span>
                <div
                  style={{
                    flex: 1,
                    height: "1px",
                    borderTop: "2px dashed var(--border-color)",
                  }}
                />
              </div>

              {/* 🆕 Collapsible Combined Prompt Section */}
              <div
                style={{
                  padding: "var(--spacing-md)",
                  backgroundColor: "var(--secondary-bg)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "var(--border-radius)",
                }}
              >
                {/* Header */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--spacing-sm)",
                    cursor: "pointer",
                    padding: "var(--spacing-xs)",
                    borderRadius: "var(--border-radius)",
                    transition: "background-color 0.2s",
                  }}
                  onClick={() => toggleCollapse(sectionId)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--hover-bg)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  <span
                    style={{
                      fontSize: "12px",
                      transition: "transform 0.2s",
                      transform: isCollapsed ? "rotate(0deg)" : "rotate(90deg)",
                    }}
                  >
                    ▶
                  </span>
                  <span
                    style={{
                      fontSize: "var(--font-size-sm)",
                      fontWeight: 600,
                      color: "var(--secondary-text)",
                    }}
                  >
                    Combined Request (System Prompt + Context + Message)
                  </span>
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: "var(--font-size-xs)",
                      color: "var(--secondary-text)",
                    }}
                  >
                    {message.contextSize?.toLocaleString() || 0} chars
                  </span>
                </div>

                {/* Content (collapsed by default) */}
                {!isCollapsed && (
                  <div
                    style={{
                      marginTop: "var(--spacing-sm)",
                      padding: "var(--spacing-md)",
                      backgroundColor: "var(--input-bg)",
                      borderRadius: "var(--border-radius)",
                      fontSize: "var(--font-size-xs)",
                      color: "var(--primary-text)",
                      lineHeight: 1.6,
                      whiteSpace: "pre-wrap",
                      maxHeight: "400px",
                      overflowY: "auto",
                      fontFamily: "monospace",
                    }}
                  >
                    {message.systemPrompt && (
                      <>
                        <div
                          style={{
                            fontWeight: 600,
                            color: "var(--accent-text)",
                            marginBottom: "var(--spacing-xs)",
                          }}
                        >
                          === SYSTEM PROMPT ===
                        </div>
                        {message.systemPrompt}
                        <div
                          style={{
                            margin: "var(--spacing-md) 0",
                            borderTop: "1px dashed var(--border-color)",
                          }}
                        />
                      </>
                    )}
                    <div
                      style={{
                        fontWeight: 600,
                        color: "var(--accent-text)",
                        marginBottom: "var(--spacing-xs)",
                      }}
                    >
                      === USER REQUEST + CONTEXT ===
                    </div>
                    {message.content}
                  </div>
                )}
              </div>
            </React.Fragment>
          );
        }

        // 🆕 Regular messages
        return (
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
        );
      })}

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
