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

interface ChatHeaderProps {
  selectedTab: TabInfo;
  onBack: () => void;
  onClearChat: () => void;
  isLoadingConversation?: boolean;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({
  selectedTab,
  onBack,
  onClearChat,
  isLoadingConversation,
}) => {
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
    <div
      style={{
        position: "sticky",
        top: 0,
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
  );
};

export default ChatHeader;
