import React, { useEffect, useRef, useState } from "react";
import {
  parseAIResponse,
  formatActionForDisplay,
  type ParsedResponse,
  type TaskProgressItem,
  type ToolAction,
} from "../../services/ResponseParser";

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
  const [initialRequestCollapsed, setInitialRequestCollapsed] = useState(false);
  const [taskProgressCollapsed, setTaskProgressCollapsed] = useState(true);

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

  // 🆕 Aggregate all task progress from all messages
  const allTaskProgress: TaskProgressItem[] = [];
  messages.forEach((msg) => {
    const parsed = parseAIResponse(msg.content);
    if (parsed.taskProgress) {
      allTaskProgress.push(...parsed.taskProgress);
    }
    parsed.actions.forEach((action) => {
      if (action.taskProgress) {
        allTaskProgress.push(...action.taskProgress);
      }
    });
  });

  const completedTasks = allTaskProgress.filter((t) => t.completed).length;
  const totalTasks = allTaskProgress.length;
  const currentTask = allTaskProgress.find((t) => !t.completed);

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: "var(--spacing-lg)",
        paddingTop:
          totalTasks > 0 || messages.some((m) => m.isFirstRequest)
            ? "120px"
            : "0",
        display: "flex",
        flexDirection: "column",
        gap: "var(--spacing-md)",
      }}
    >
      {/* 🆕 Fixed Wrapper - Only contains First Request + Task Progress */}
      {(totalTasks > 0 || messages.some((m) => m.isFirstRequest)) && (
        <div
          style={{
            position: "fixed",
            top: "0",
            left: 0,
            right: 0,
            zIndex: 9,
            backgroundColor: "var(--primary-bg)",
          }}
        >
          {/* First Request Section - Only show collapsed preview */}
          {messages.some((m) => m.isFirstRequest) &&
            (() => {
              const firstRequestMsg = messages.find((m) => m.isFirstRequest);
              if (!firstRequestMsg) return null;

              return (
                <div
                  style={{
                    borderBottom: "1px solid var(--border-color)",
                  }}
                >
                  {/* Action Icons - Top Left */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "var(--spacing-xs)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        gap: "var(--spacing-xs)",
                      }}
                    >
                      {/* Arrow Up */}
                      <div
                        style={{
                          cursor: "pointer",
                          padding: "4px",
                          borderRadius: "var(--border-radius)",
                          transition: "background-color 0.2s",
                          color: "white",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor =
                            "var(--hover-bg)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "transparent";
                        }}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <polyline points="18 15 12 9 6 15" />
                        </svg>
                      </div>
                      {/* Arrow Down */}
                      <div
                        style={{
                          cursor: "pointer",
                          padding: "4px",
                          borderRadius: "var(--border-radius)",
                          transition: "background-color 0.2s",
                          color: "white",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor =
                            "var(--hover-bg)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "transparent";
                        }}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <polyline points="6 9 12 15 18 9" />
                        </svg>
                      </div>
                      {/* Copy */}
                      <div
                        style={{
                          cursor: "pointer",
                          padding: "4px",
                          borderRadius: "var(--border-radius)",
                          transition: "background-color 0.2s",
                          color: "white",
                        }}
                        onClick={() => copyToClipboard(firstRequestMsg.content)}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor =
                            "var(--hover-bg)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "transparent";
                        }}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <rect
                            x="9"
                            y="9"
                            width="13"
                            height="13"
                            rx="2"
                            ry="2"
                          />
                          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                        </svg>
                      </div>
                      {/* Delete */}
                      <div
                        style={{
                          cursor: "pointer",
                          padding: "4px",
                          borderRadius: "var(--border-radius)",
                          transition: "background-color 0.2s",
                          color: "white",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor =
                            "var(--hover-bg)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "transparent";
                        }}
                      >
                        <svg
                          width="14"
                          height="14"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <polyline points="3 6 5 6 21 6" />
                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                        </svg>
                      </div>
                    </div>
                  </div>

                  {/* Initial Request Display */}
                  <div
                    style={{
                      padding: "var(--spacing-md)",
                      cursor: "pointer",
                    }}
                    onClick={() =>
                      setInitialRequestCollapsed(!initialRequestCollapsed)
                    }
                  >
                    {!initialRequestCollapsed && (
                      <div
                        style={{
                          fontSize: "var(--font-size-sm)",
                          color: "var(--primary-text)",
                          lineHeight: 1.6,
                          whiteSpace: "pre-wrap",
                          maxHeight: "120px",
                          overflowY: "auto",
                          marginBottom: "var(--spacing-sm)",
                        }}
                      >
                        {firstRequestMsg.content}
                      </div>
                    )}
                  </div>

                  {/* Progress Bar - Current/Max Context */}
                  <div
                    style={{
                      padding: "0 var(--spacing-md)",
                      marginBottom: "var(--spacing-sm)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "4px",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "var(--font-size-xs)",
                          color: "var(--secondary-text)",
                        }}
                      >
                        {firstRequestMsg.content.length.toLocaleString()}
                      </span>
                      <span
                        style={{
                          fontSize: "var(--font-size-xs)",
                          color: "var(--secondary-text)",
                        }}
                      >
                        {firstRequestMsg.contextSize?.toLocaleString() || 0}
                      </span>
                    </div>
                    <div
                      style={{
                        width: "100%",
                        height: "4px",
                        backgroundColor: "var(--border-color)",
                        borderRadius: "2px",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: `${Math.min(
                            (firstRequestMsg.content.length /
                              (firstRequestMsg.contextSize || 1)) *
                              100,
                            100
                          )}%`,
                          height: "100%",
                          backgroundColor: "var(--accent-text)",
                          transition: "width 0.3s ease",
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })()}

          {/* Task Progress Section */}
          {totalTasks > 0 && (
            <div
              style={{
                borderBottom: "1px solid var(--border-color)",
                padding: "var(--spacing-md) var(--spacing-lg)",
                cursor: "pointer",
              }}
              onClick={() => setTaskProgressCollapsed(!taskProgressCollapsed)}
            >
              {/* Header */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: taskProgressCollapsed ? 0 : "var(--spacing-sm)",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--spacing-xs)",
                  }}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="var(--accent-text)"
                    strokeWidth="2"
                  >
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                  </svg>
                  <span
                    style={{
                      fontSize: "var(--font-size-sm)",
                      fontWeight: 600,
                      color: "var(--accent-text)",
                    }}
                  >
                    TASK PROGRESS
                  </span>
                  {taskProgressCollapsed && currentTask && (
                    <span
                      style={{
                        fontSize: "var(--font-size-xs)",
                        color: "var(--primary-text)",
                        marginLeft: "var(--spacing-sm)",
                      }}
                    >
                      {currentTask.text.length > 50
                        ? currentTask.text.substring(0, 50) + "..."
                        : currentTask.text}
                    </span>
                  )}
                </div>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--spacing-sm)",
                  }}
                >
                  <span
                    style={{
                      fontSize: "var(--font-size-xs)",
                      color: "var(--secondary-text)",
                    }}
                  >
                    {completedTasks}/{totalTasks}
                  </span>
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    style={{
                      transition: "transform 0.2s",
                      transform: taskProgressCollapsed
                        ? "rotate(0deg)"
                        : "rotate(180deg)",
                    }}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                </div>
              </div>

              {/* Task List */}
              {!taskProgressCollapsed && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--spacing-xs)",
                    maxHeight: "120px",
                    overflowY: "auto",
                  }}
                >
                  {allTaskProgress.map((item, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "var(--spacing-xs)",
                        fontSize: "var(--font-size-sm)",
                        color: "var(--primary-text)",
                      }}
                    >
                      {item.completed ? (
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="var(--success-color)"
                          strokeWidth="2"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      ) : (
                        <svg
                          width="16"
                          height="16"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="var(--secondary-text)"
                          strokeWidth="2"
                        >
                          <rect
                            x="3"
                            y="3"
                            width="18"
                            height="18"
                            rx="2"
                            ry="2"
                          />
                        </svg>
                      )}
                      <span
                        style={{
                          textDecoration: item.completed
                            ? "line-through"
                            : "none",
                          opacity: item.completed ? 0.7 : 1,
                        }}
                      >
                        {item.text}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {messages.map((message, index) => {
        // 🆕 Render first request specially in main flow
        if (message.role === "user" && message.isFirstRequest) {
          const sectionId = `first-req-${message.id}`;
          const isCollapsed = collapsedSections.has(sectionId);

          return (
            <React.Fragment key={message.id}>
              {/* Divider - Checkpoint */}
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
                    borderTop: "2px dashed var(--input-bg)",
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
                    borderTop: "2px dashed var(--input-bg)",
                  }}
                />
              </div>

              {/* Divider - Prompt Request */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--spacing-sm)",
                  padding: "var(--spacing-sm) 0",
                  cursor: "pointer",
                }}
                onClick={() => toggleCollapse(sectionId)}
              >
                <div
                  style={{
                    flex: 1,
                    height: "1px",
                    borderTop: "2px dashed var(--input-bg)",
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
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--spacing-xs)",
                  }}
                >
                  <span
                    style={{
                      fontSize: "10px",
                      transition: "transform 0.2s",
                      transform: isCollapsed ? "rotate(0deg)" : "rotate(90deg)",
                    }}
                  >
                    ▶
                  </span>
                  <span>📝 PROMPT REQUEST</span>
                </span>
                <div
                  style={{
                    flex: 1,
                    height: "1px",
                    borderTop: "2px dashed var(--input-bg)",
                  }}
                />
              </div>

              {/* Prompt Request Content */}
              {!isCollapsed && (
                <div
                  style={{
                    marginTop: "var(--spacing-sm)",
                    marginBottom: "var(--spacing-md)",
                    padding: "var(--spacing-md)",
                    backgroundColor: "var(--input-bg)",
                    borderRadius: "var(--border-radius)",
                    fontSize: "var(--font-size-xs)",
                    color: "var(--primary-text)",
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                    maxHeight: "240px",
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
            </React.Fragment>
          );
        }

        // 🆕 Regular messages - Parse and display
        const parsedContent = parseAIResponse(message.content);

        return (
          <div
            key={message.id}
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--spacing-md)",
              marginBottom: "var(--spacing-md)",
            }}
          >
            {/* Message Header + Content */}
            <div
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

              {/* Main text content (thinking or cleaned text) */}
              {parsedContent.displayText && (
                <div
                  style={{
                    fontSize: "var(--font-size-md)",
                    color: "var(--primary-text)",
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {parsedContent.displayText}
                </div>
              )}
            </div>

            {/* Tool Actions */}
            {parsedContent.actions.length > 0 && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "var(--spacing-xs)",
                }}
              >
                {parsedContent.actions.map((action, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: "var(--spacing-md)",
                      backgroundColor: "var(--tertiary-bg)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "var(--border-radius)",
                      cursor: "pointer",
                      transition: "all 0.2s",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                    onClick={() => {}}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "var(--hover-bg)";
                      e.currentTarget.style.borderColor = "var(--accent-text)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor =
                        "var(--tertiary-bg)";
                      e.currentTarget.style.borderColor = "var(--border-color)";
                    }}
                  >
                    <span
                      style={{
                        fontSize: "var(--font-size-sm)",
                        color: "var(--primary-text)",
                        fontWeight: 500,
                      }}
                    >
                      {formatActionForDisplay(action)}
                    </span>
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      style={{ opacity: 0.5 }}
                    >
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>
                ))}
              </div>
            )}
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
