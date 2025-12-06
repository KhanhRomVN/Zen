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
  provider?: "deepseek" | "chatgpt" | "gemini" | "grok" | "claude";
}

interface ChatHeaderProps {
  selectedTab: TabInfo;
  onBack: () => void;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({ selectedTab, onBack }) => {
  const getProviderInfo = (
    provider?: "deepseek" | "chatgpt" | "gemini" | "grok" | "claude"
  ): { name: string; emoji: string; color: string } => {
    switch (provider) {
      case "deepseek":
        return { name: "DeepSeek", emoji: "🤖", color: "#3b82f6" };
      case "chatgpt":
        return { name: "ChatGPT", emoji: "💬", color: "#10b981" };
      case "claude":
        return { name: "Claude", emoji: "🧠", color: "#f59e0b" };
      case "gemini":
        return { name: "Gemini", emoji: "✨", color: "#a855f7" };
      case "grok":
        return { name: "Grok", emoji: "⚡", color: "#f97316" };
      default:
        return { name: "Unknown", emoji: "❓", color: "#6b7280" };
    }
  };

  const providerInfo = getProviderInfo(selectedTab.provider);

  return (
    <div className="chat-header">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--spacing-md)",
        }}
      >
        <div style={{ flex: 1 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--spacing-sm)",
            }}
          >
            <span
              style={{
                fontSize: "11px",
                fontWeight: 600,
                color: providerInfo.color,
                backgroundColor: `${providerInfo.color}15`,
                padding: "3px 8px",
                borderRadius: "6px",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              {providerInfo.emoji} {providerInfo.name}
            </span>
            <h2
              style={{
                margin: 0,
                fontSize: "var(--font-size-lg)",
                fontWeight: 600,
                color: "var(--primary-text)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {selectedTab.title}
            </h2>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatHeader;
