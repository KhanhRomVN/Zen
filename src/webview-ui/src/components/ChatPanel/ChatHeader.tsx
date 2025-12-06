import React from "react";

interface TabInfo {
  tabId: number;
  containerName: string;
  title: string;
  url?: string;
  status: "free" | "busy" | "sleep";
  canAccept: boolean;
  requestCount: number;
  folderPath?: string | null;
  conversationId?: string;
  provider?: "deepseek" | "chatgpt" | "gemini" | "grok" | "claude";
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  isFirstRequest?: boolean;
  systemPrompt?: string;
  contextSize?: number;
}

interface TaskProgressItem {
  text: string;
  completed: boolean;
}

interface ChatHeaderProps {
  selectedTab: TabInfo;
  onBack: () => void;
  onClearChat: () => void;
  isLoadingConversation?: boolean;
  firstRequestMessage?: Message;
  allTaskProgress?: TaskProgressItem[];
}

const ChatHeader: React.FC<ChatHeaderProps> = ({
  selectedTab,
  onBack,
  onClearChat,
  isLoadingConversation,
  firstRequestMessage,
  allTaskProgress,
}) => {
  const [initialRequestCollapsed, setInitialRequestCollapsed] =
    React.useState(true);
  const [taskProgressCollapsed, setTaskProgressCollapsed] =
    React.useState(true);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  const completedTasks =
    allTaskProgress?.filter((t) => t.completed).length || 0;
  const totalTasks = allTaskProgress?.length || 0;
  const currentTask = allTaskProgress?.find((t) => !t.completed);
  const getProviderInfo = (
    provider?: "deepseek" | "chatgpt" | "gemini" | "grok" | "claude"
  ): { name: string; emoji: string; bgColor: string; textColor: string } => {
    switch (provider) {
      case "deepseek":
        return {
          name: "DeepSeek",
          emoji: "🤖",
          bgColor: "rgba(59, 130, 246, 0.1)",
          textColor: "#3b82f6",
        };
      case "chatgpt":
        return {
          name: "ChatGPT",
          emoji: "💬",
          bgColor: "rgba(16, 185, 129, 0.1)",
          textColor: "#10b981",
        };
      case "claude":
        return {
          name: "Claude",
          emoji: "🧠",
          bgColor: "rgba(245, 158, 11, 0.1)",
          textColor: "#f59e0b",
        };
      case "gemini":
        return {
          name: "Gemini",
          emoji: "✨",
          bgColor: "rgba(168, 85, 247, 0.1)",
          textColor: "#a855f7",
        };
      case "grok":
        return {
          name: "Grok",
          emoji: "⚡",
          bgColor: "rgba(249, 115, 22, 0.1)",
          textColor: "#f97316",
        };
      default:
        return {
          name: "Unknown",
          emoji: "❓",
          bgColor: "rgba(107, 114, 128, 0.1)",
          textColor: "#6b7280",
        };
    }
  };

  const providerInfo = getProviderInfo(selectedTab.provider);

  return (
    <>
      {/* Fixed Box - First Request + Task Progress */}
      {(totalTasks > 0 || firstRequestMessage) && (
        <div
          data-fixed-header="true"
          style={{
            position: "fixed",
            top: "0",
            left: 0,
            right: 0,
            zIndex: 999,
            backgroundColor: "var(--primary-bg)",
            boxShadow: "0 2px 8px rgba(0, 0, 0, 0.1)",
          }}
        >
          {/* First Request Section */}
          {firstRequestMessage && (
            <div
              style={{
                borderBottom: "1px solid var(--border-color)",
                backgroundColor: "var(--primary-bg)",
                padding: "var(--spacing-md)",
                cursor: "pointer",
              }}
              onClick={() =>
                setInitialRequestCollapsed(!initialRequestCollapsed)
              }
            >
              {/* Initial Request Display with Header */}
              <div
                style={{
                  position: "relative",
                }}
              >
                {/* Header Icons - Positioned at top-left */}
                <div
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--spacing-xs)",
                    zIndex: 10,
                  }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {/* Toggle Arrow */}
                  <div
                    style={{
                      cursor: "pointer",
                      padding: "4px",
                      borderRadius: "var(--border-radius)",
                      transition: "background-color 0.2s",
                      color: "var(--primary-text)",
                      backgroundColor: "var(--secondary-bg)",
                    }}
                    onClick={() =>
                      setInitialRequestCollapsed(!initialRequestCollapsed)
                    }
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "var(--hover-bg)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor =
                        "var(--secondary-bg)";
                    }}
                  >
                    <svg
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      style={{
                        transition: "transform 0.2s",
                        transform: initialRequestCollapsed
                          ? "rotate(0deg)"
                          : "rotate(180deg)",
                      }}
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
                      color: "var(--primary-text)",
                      backgroundColor: "var(--secondary-bg)",
                    }}
                    onClick={() => copyToClipboard(firstRequestMessage.content)}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "var(--hover-bg)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor =
                        "var(--secondary-bg)";
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
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                  </div>
                </div>

                {/* Message Content */}
                <div
                  style={{
                    fontSize: "var(--font-size-sm)",
                    color: "var(--primary-text)",
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    display: "-webkit-box",
                    WebkitLineClamp: initialRequestCollapsed ? 1 : 20,
                    WebkitBoxOrient: "vertical",
                    maxHeight: initialRequestCollapsed ? "1.6em" : "32em",
                    paddingLeft: "68px",
                    marginBottom: initialRequestCollapsed
                      ? 0
                      : "var(--spacing-sm)",
                  }}
                >
                  {firstRequestMessage.content}
                </div>

                {/* Progress Bar */}
                {!initialRequestCollapsed && (
                  <div>
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
                        {firstRequestMessage.content.length.toLocaleString()}
                      </span>
                      <span
                        style={{
                          fontSize: "var(--font-size-xs)",
                          color: "var(--secondary-text)",
                        }}
                      >
                        {firstRequestMessage.contextSize?.toLocaleString() || 0}
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
                            (firstRequestMessage.content.length /
                              (firstRequestMessage.contextSize || 1)) *
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
                )}
              </div>
            </div>
          )}

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
                  {allTaskProgress?.map((item, idx) => (
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

      {/* Header Bar */}
      <div
        style={{
          position: "sticky",
          top: totalTasks > 0 || firstRequestMessage ? "auto" : 0,
          zIndex: 100,
          backgroundColor: "var(--secondary-bg)",
          borderBottom: "1px solid var(--border-color)",
          padding: "var(--spacing-sm) var(--spacing-lg)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "var(--spacing-sm)",
        }}
      >
        {/* Left: Back button */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--spacing-xs)",
            flex: 1,
          }}
        >
          {/* Provider Badge */}
          <span
            style={{
              fontSize: "var(--font-size-xs)",
              fontWeight: 600,
              color: providerInfo.textColor,
              backgroundColor: providerInfo.bgColor,
              padding: "4px 8px",
              borderRadius: "var(--border-radius)",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              whiteSpace: "nowrap",
            }}
          >
            {providerInfo.emoji} {providerInfo.name}
          </span>

          {/* Container Badge */}
          {selectedTab.containerName && (
            <span
              style={{
                fontSize: "var(--font-size-xs)",
                fontWeight: 500,
                color: "var(--primary-text)",
                backgroundColor: "var(--hover-bg)",
                padding: "4px 8px",
                borderRadius: "var(--border-radius)",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                maxWidth: "200px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
              title={selectedTab.containerName}
            >
              🗂️ {selectedTab.containerName}
            </span>
          )}

          {/* Loading indicator */}
          {isLoadingConversation && (
            <span
              style={{
                fontSize: "var(--font-size-xs)",
                color: "var(--secondary-text)",
                marginLeft: "var(--spacing-xs)",
              }}
            >
              Loading...
            </span>
          )}
        </div>

        {/* Right: Delete button */}
        <div
          style={{
            cursor: "pointer",
            padding: "var(--spacing-xs)",
            borderRadius: "var(--border-radius)",
            transition: "all 0.2s",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "var(--error-color)",
          }}
          onClick={onClearChat}
          title="Delete conversation"
        >
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="3 6 5 6 21 6" />
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
            <line x1="10" y1="11" x2="10" y2="17" />
            <line x1="14" y1="11" x2="14" y2="17" />
          </svg>
        </div>
      </div>
    </>
  );
};

export default ChatHeader;
