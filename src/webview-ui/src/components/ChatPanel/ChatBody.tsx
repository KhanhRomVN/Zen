import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  parseAIResponse,
  formatActionForDisplay,
  type ParsedResponse,
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
  onSendToolRequest?: (action: ToolAction, message: Message) => void;
}

const ChatBody: React.FC<ChatBodyProps> = ({
  messages,
  isProcessing,
  checkpoints,
  onSendToolRequest,
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    new Set()
  );
  const [checkpointCollapsed, setCheckpointCollapsed] = useState(true);
  const [isAtBottom, setIsAtBottom] = useState(true);

  // 🆕 Memoize parsed messages với cache để tránh parse duplicate
  const parsedMessages = useMemo(() => {
    // Cache để tránh parse lại cùng một content
    const cache = new Map<string, ParsedResponse>();

    return messages.map((msg) => {
      // Nếu đã parse content này rồi, dùng lại kết quả
      if (!cache.has(msg.content)) {
        cache.set(msg.content, parseAIResponse(msg.content));
      }

      return {
        ...msg,
        parsed: cache.get(msg.content)!,
      };
    });
  }, [messages]);

  // Auto-scroll to bottom khi có message mới
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isProcessing]);

  // 🆕 Track scroll position để hiển thị scroll-to-bottom button
  useEffect(() => {
    const container = messagesEndRef.current?.parentElement;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const atBottom = scrollHeight - scrollTop - clientHeight < 100;
      setIsAtBottom(atBottom);
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, []);

  // 🆕 Scroll to bottom handler
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  // 🆕 Helper to get tool icon
  const getToolIcon = (type: string) => {
    switch (type) {
      case "read_file":
        return "📖";
      case "write_to_file":
        return "✍️";
      case "replace_in_file":
        return "🔄";
      case "execute_command":
        return "⚡";
      case "list_files":
        return "📁";
      case "search_files":
        return "🔍";
      case "list_code_definition_names":
        return "📚";
      case "ask_followup_question":
        return "❓";
      case "attempt_completion":
        return "✅";
      default:
        return "🔧";
    }
  };

  // 🆕 Helper to get tool color
  const getToolColor = (type: string) => {
    switch (type) {
      case "read_file":
        return "#3b82f6"; // blue
      case "write_to_file":
      case "replace_in_file":
        return "#10b981"; // green
      case "execute_command":
        return "#f59e0b"; // orange
      case "attempt_completion":
        return "#22c55e"; // success green
      default:
        return "#6b7280"; // gray
    }
  };

  // 🆕 Handle tool action click
  const handleToolClick = (action: ToolAction, message: Message) => {
    if (action.type === "read_file" && onSendToolRequest) {
      onSendToolRequest(action, message);
    }
  };

  // 🆕 Extract code content from action for preview
  const getCodePreview = (action: ToolAction): string | null => {
    if (action.type === "write_to_file" && action.params.content) {
      return action.params.content;
    }
    if (action.type === "replace_in_file" && action.params.diff) {
      return action.params.diff;
    }
    return null;
  };

  // 🆕 Truncate code to max lines
  const truncateCode = (
    code: string,
    maxLines: number = 15
  ): { code: string; truncated: boolean } => {
    const lines = code.split("\n");
    if (lines.length <= maxLines) {
      return { code, truncated: false };
    }
    return {
      code: lines.slice(0, maxLines).join("\n"),
      truncated: true,
    };
  };

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
        paddingBottom: "200px",
        display: "flex",
        flexDirection: "column",
        gap: "var(--spacing-md)",
      }}
    >
      {messages.map((message) => {
        // 🆕 Render first request specially in main flow
        if (message.role === "user" && message.isFirstRequest) {
          const sectionId = `first-req-${message.id}`;
          const isCollapsed = collapsedSections.has(sectionId);

          return (
            <React.Fragment key={message.id}>
              {/* 🆕 Divider - REQUEST 1 */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--spacing-sm)",
                  margin: "var(--spacing-md) 0",
                }}
              >
                <div
                  style={{
                    flex: 1,
                    height: "2px",
                    background:
                      "linear-gradient(90deg, transparent, var(--accent-text), transparent)",
                  }}
                />
                <span
                  style={{
                    fontSize: "var(--font-size-sm)",
                    color: "var(--accent-text)",
                    fontWeight: 700,
                  }}
                >
                  📍 REQUEST 1
                </span>
                <div
                  style={{
                    flex: 1,
                    height: "2px",
                    background:
                      "linear-gradient(90deg, var(--accent-text), transparent)",
                  }}
                />
              </div>

              {/* Divider - Checkpoint */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--spacing-sm)",
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

              {/* 🆕 PROMPT REQUEST Section - Collapsible (same style as THINKING) */}
              <div
                style={{
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--spacing-xs)",
                    paddingBottom: "var(--spacing-sm) var(--spacing-md)",
                    cursor: "pointer",
                  }}
                  onClick={() => setCheckpointCollapsed(!checkpointCollapsed)}
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    style={{
                      transition: "transform 0.2s",
                      transform: checkpointCollapsed
                        ? "rotate(0deg)"
                        : "rotate(180deg)",
                    }}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                  <span
                    style={{
                      fontSize: "var(--font-size-xs)",
                      fontWeight: 600,
                      color: "var(--secondary-text)",
                      letterSpacing: "0.5px",
                    }}
                  >
                    📝 PROMPT REQUEST
                  </span>
                </div>
                {!checkpointCollapsed && (
                  <div
                    style={{
                      fontSize: "var(--font-size-xs)",
                      color: "var(--primary-text)",
                      lineHeight: 1.6,
                      whiteSpace: "pre-wrap",
                      fontFamily: "monospace",
                      maxHeight: "400px",
                      overflowY: "auto",
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

        // 🆕 Regular messages - Use memoized parsed content
        const parsedMessage = parsedMessages.find((pm) => pm.id === message.id);
        if (!parsedMessage) return null;
        const parsedContent = parsedMessage.parsed;

        // 🆕 Calculate request number for user messages
        const requestNumber =
          message.role === "user"
            ? messages.filter(
                (m) => m.role === "user" && m.timestamp <= message.timestamp
              ).length
            : null;

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
            {/* 🆕 REQUEST Divider for user messages (excluding first request) */}
            {message.role === "user" && !message.isFirstRequest && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--spacing-sm)",
                  margin: "var(--spacing-md) 0",
                }}
              >
                <div
                  style={{
                    flex: 1,
                    height: "2px",
                    background:
                      "linear-gradient(90deg, transparent, var(--accent-text), transparent)",
                  }}
                />
                <span
                  style={{
                    fontSize: "var(--font-size-sm)",
                    color: "var(--accent-text)",
                    fontWeight: 700,
                    padding: "4px 12px",
                    backgroundColor: "var(--secondary-bg)",
                    borderRadius: "var(--border-radius)",
                    border: "2px solid var(--accent-text)",
                  }}
                >
                  📍 REQUEST {requestNumber}
                </span>
                <div
                  style={{
                    flex: 1,
                    height: "2px",
                    background:
                      "linear-gradient(90deg, var(--accent-text), transparent)",
                  }}
                />
              </div>
            )}

            {/* 🆕 THINKING Section - Collapsible (for assistant messages) */}
            {message.role === "assistant" && parsedContent.thinking && (
              <div
                style={{
                  borderRadius: "var(--border-radius)",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--spacing-xs)",
                    paddingBottom: "var(--spacing-sm) var(--spacing-md)",
                    cursor: "pointer",
                  }}
                  onClick={() => toggleCollapse(`thinking-${message.id}`)}
                >
                  <svg
                    width="12"
                    height="12"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    style={{
                      transition: "transform 0.2s",
                      transform: collapsedSections.has(`thinking-${message.id}`)
                        ? "rotate(0deg)"
                        : "rotate(180deg)",
                    }}
                  >
                    <polyline points="6 9 12 15 18 9" />
                  </svg>
                  <span
                    style={{
                      fontSize: "var(--font-size-xs)",
                      fontWeight: 600,
                      color: "var(--secondary-text)",
                      letterSpacing: "0.5px",
                    }}
                  >
                    🧠 THINKING
                  </span>
                </div>
                {!collapsedSections.has(`thinking-${message.id}`) && (
                  <div
                    style={{
                      fontSize: "var(--font-size-sm)",
                      color: "var(--secondary-text)",
                      lineHeight: 1.6,
                      whiteSpace: "pre-wrap",
                      opacity: 0.8,
                    }}
                  >
                    {parsedContent.thinking}
                  </div>
                )}
              </div>
            )}

            {/* 🆕 RESULT Section - Collapsible (for assistant messages) */}
            {message.role === "assistant" &&
              parsedContent.attemptCompletion && (
                <div
                  style={{
                    borderRadius: "var(--border-radius)",
                    border: "1px solid var(--border-color)",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "var(--spacing-xs)",
                      padding: "var(--spacing-sm) var(--spacing-md)",
                      backgroundColor: "var(--secondary-bg)",
                      cursor: "pointer",
                      borderBottom: collapsedSections.has(
                        `result-${message.id}`
                      )
                        ? "none"
                        : "1px solid var(--border-color)",
                    }}
                    onClick={() => toggleCollapse(`result-${message.id}`)}
                  >
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      style={{
                        transition: "transform 0.2s",
                        transform: collapsedSections.has(`result-${message.id}`)
                          ? "rotate(0deg)"
                          : "rotate(180deg)",
                      }}
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                    <span
                      style={{
                        fontSize: "var(--font-size-xs)",
                        fontWeight: 600,
                        color: "var(--secondary-text)",
                        letterSpacing: "0.5px",
                      }}
                    >
                      ✅ RESULT
                    </span>
                  </div>
                  {!collapsedSections.has(`result-${message.id}`) && (
                    <div
                      style={{
                        padding: "var(--spacing-md)",
                        fontSize: "var(--font-size-sm)",
                        color: "var(--success-color)",
                        lineHeight: 1.6,
                        whiteSpace: "pre-wrap",
                        backgroundColor: "var(--primary-bg)",
                      }}
                    >
                      {parsedContent.attemptCompletion}
                    </div>
                  )}
                </div>
              )}

            {/* Message Header + Content */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "var(--spacing-xs)",
                borderRadius: "var(--border-radius)",
                backgroundColor:
                  message.role === "user"
                    ? "var(--input-bg)"
                    : "var(--secondary-bg)",
                padding: message.role === "user" ? "var(--spacing-md)" : "0",
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
                  gap: "var(--spacing-sm)",
                }}
              >
                {parsedContent.actions.map((action, idx) => {
                  const toolColor = getToolColor(action.type);
                  const toolIcon = getToolIcon(action.type);
                  const codePreview = getCodePreview(action);
                  const hasCodePreview = codePreview !== null;

                  return (
                    <div
                      key={idx}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "var(--spacing-xs)",
                      }}
                    >
                      {/* Tool Button */}
                      <div
                        style={{
                          padding: "var(--spacing-sm) var(--spacing-md)",
                          backgroundColor: "var(--secondary-bg)",
                          border: `2px solid ${toolColor}`,
                          borderRadius: "var(--border-radius-lg)",
                          cursor:
                            action.type === "read_file" ? "pointer" : "default",
                          transition: "all 0.2s",
                          display: "flex",
                          alignItems: "center",
                          gap: "var(--spacing-sm)",
                        }}
                        onClick={() => handleToolClick(action, message)}
                        onMouseEnter={(e) => {
                          if (action.type === "read_file") {
                            e.currentTarget.style.backgroundColor = `${toolColor}15`;
                            e.currentTarget.style.transform = "translateX(4px)";
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (action.type === "read_file") {
                            e.currentTarget.style.backgroundColor =
                              "var(--secondary-bg)";
                            e.currentTarget.style.transform = "translateX(0)";
                          }
                        }}
                      >
                        <span style={{ fontSize: "20px" }}>{toolIcon}</span>
                        <span
                          style={{
                            fontSize: "var(--font-size-sm)",
                            color: "var(--primary-text)",
                            fontWeight: 600,
                            flex: 1,
                          }}
                        >
                          {formatActionForDisplay(action)}
                        </span>
                        {action.type === "read_file" && (
                          <svg
                            width="16"
                            height="16"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke={toolColor}
                            strokeWidth="2"
                          >
                            <polyline points="9 18 15 12 9 6" />
                          </svg>
                        )}
                      </div>

                      {/* Code Preview for write_to_file/replace_in_file */}
                      {hasCodePreview && (
                        <div
                          style={{
                            backgroundColor: "var(--primary-bg)",
                            border: "1px solid var(--border-color)",
                            borderRadius: "var(--border-radius)",
                            overflow: "hidden",
                          }}
                        >
                          {/* Header */}
                          <div
                            style={{
                              padding: "var(--spacing-xs) var(--spacing-sm)",
                              backgroundColor: "var(--secondary-bg)",
                              borderBottom: "1px solid var(--border-color)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                            }}
                          >
                            <span
                              style={{
                                fontSize: "var(--font-size-xs)",
                                color: "var(--secondary-text)",
                                fontFamily: "monospace",
                              }}
                            >
                              {action.params.path || "code"}
                            </span>
                            <button
                              style={{
                                padding: "2px 6px",
                                backgroundColor: "transparent",
                                border: "1px solid var(--border-color)",
                                borderRadius: "var(--border-radius)",
                                fontSize: "var(--font-size-xs)",
                                color: "var(--secondary-text)",
                                cursor: "pointer",
                                transition: "all 0.2s",
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                navigator.clipboard.writeText(codePreview!);
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.backgroundColor =
                                  "var(--hover-bg)";
                                e.currentTarget.style.color =
                                  "var(--primary-text)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.backgroundColor =
                                  "transparent";
                                e.currentTarget.style.color =
                                  "var(--secondary-text)";
                              }}
                            >
                              Copy
                            </button>
                          </div>

                          {/* Code Content */}
                          <div
                            style={{
                              padding: "var(--spacing-sm)",
                              fontSize: "var(--font-size-xs)",
                              fontFamily: "monospace",
                              color: "var(--primary-text)",
                              whiteSpace: "pre",
                              overflowX: "auto",
                              maxHeight: "300px",
                              overflowY: "auto",
                            }}
                          >
                            {(() => {
                              const { code, truncated } = truncateCode(
                                codePreview!
                              );
                              return (
                                <>
                                  {code}
                                  {truncated && (
                                    <div
                                      style={{
                                        marginTop: "var(--spacing-sm)",
                                        padding: "var(--spacing-xs)",
                                        backgroundColor: "var(--secondary-bg)",
                                        borderRadius: "var(--border-radius)",
                                        textAlign: "center",
                                        color: "var(--secondary-text)",
                                      }}
                                    >
                                      ... (truncated, showing first 15 lines)
                                    </div>
                                  )}
                                </>
                              );
                            })()}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* 🆕 Followup Options Buttons */}
            {parsedContent.followupOptions &&
              parsedContent.followupOptions.length > 0 && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "var(--spacing-sm)",
                    marginTop: "var(--spacing-sm)",
                  }}
                >
                  {parsedContent.followupOptions.map((option, idx) => (
                    <button
                      key={idx}
                      style={{
                        padding: "var(--spacing-md)",
                        backgroundColor: "var(--secondary-bg)",
                        border: "2px solid var(--accent-text)",
                        borderRadius: "var(--border-radius-lg)",
                        cursor: "pointer",
                        transition: "all 0.2s",
                        fontSize: "var(--font-size-md)",
                        color: "var(--primary-text)",
                        fontWeight: 500,
                        textAlign: "left",
                        width: "100%",
                        minHeight: "auto",
                      }}
                      onClick={() => {
                        // Send option as new message
                        const textarea = document.querySelector(
                          "textarea"
                        ) as HTMLTextAreaElement;
                        if (textarea) {
                          textarea.value = option;
                          textarea.dispatchEvent(
                            new Event("input", { bubbles: true })
                          );
                          textarea.focus();
                        }
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.backgroundColor =
                          "var(--accent-text)";
                        e.currentTarget.style.color = "white";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor =
                          "var(--secondary-bg)";
                        e.currentTarget.style.color = "var(--primary-text)";
                      }}
                    >
                      {option}
                    </button>
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

      {/* 🆕 Scroll to Bottom Button - Pass to parent */}
      {!isAtBottom && (
        <div
          style={{
            position: "fixed",
            bottom: "calc(var(--spacing-lg) + 180px)",
            left: "50%",
            transform: "translateX(-50%)",
            zIndex: 100,
          }}
        >
          <button
            onClick={scrollToBottom}
            style={{
              padding: "var(--spacing-sm) var(--spacing-md)",
              backgroundColor: "var(--accent-text)",
              color: "white",
              border: "none",
              borderRadius: "var(--border-radius-lg)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "var(--spacing-xs)",
              fontSize: "var(--font-size-sm)",
              fontWeight: 500,
              boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
              transition: "all 0.2s",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = "translateY(-2px)";
              e.currentTarget.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.3)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = "translateY(0)";
              e.currentTarget.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.2)";
            }}
          >
            <span>Scroll to Bottom</span>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
        </div>
      )}

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
