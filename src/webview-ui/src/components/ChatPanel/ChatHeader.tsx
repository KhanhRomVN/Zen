import React from "react";
import { TabInfo } from "../../types";
import { Message } from "./ChatBody/types";

interface ChatHeaderProps {
  selectedTab: TabInfo;
  onBack: () => void;
  onClearChat: () => void;
  isLoadingConversation?: boolean;
  firstRequestMessage?: Message;
  contextUsage?: {
    prompt: number;
    completion: number;
    total: number;
  };
  taskName?: string | null;
  conversationId?: string;
  currentModel?: any;
  currentAccount?: any;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({
  selectedTab,
  contextUsage,
  taskName,
  currentModel,
  currentAccount,
}) => {
  const formatTokens = (num: number) => {
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  };

  const providerId = currentModel?.providerId || selectedTab.provider || "deepseek";

  let faviconUrl = "https://www.google.com/s2/favicons?domain=deepseek.com&sz=64";
  if (providerId.toLowerCase().includes("openai")) faviconUrl = "https://www.google.com/s2/favicons?domain=openai.com&sz=64";
  else if (providerId.toLowerCase().includes("anthropic")) faviconUrl = "https://www.google.com/s2/favicons?domain=anthropic.com&sz=64";
  else if (providerId.toLowerCase().includes("google")) faviconUrl = "https://www.google.com/s2/favicons?domain=google.com&sz=64";
  else if (providerId.toLowerCase().includes("openrouter")) faviconUrl = "https://www.google.com/s2/favicons?domain=openrouter.ai&sz=64";

  return (
    <div
      style={{
        borderBottom: "1px solid var(--border-color)",
        backgroundColor: "var(--primary-bg)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: "8px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
        }}
      >
        {/* Left: Model Info */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "12px",
            fontWeight: 600,
            color: "var(--primary-text)",
            overflow: "hidden",
          }}
        >
          <img
            src={faviconUrl}
            alt="provider"
            style={{ width: "14px", height: "14px", borderRadius: "2px" }}
          />
          <span style={{ whiteSpace: "nowrap" }}>
            {providerId}/{currentModel?.id || "chat"}
          </span>

          {currentAccount?.email && (
            <span
              style={{
                opacity: 0.7,
                fontStyle: "italic",
                fontWeight: "normal",
                fontSize: "11px",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: "150px",
              }}
              title={currentAccount.email}
            >
              &lt;{currentAccount.email}&gt;
            </span>
          )}

          {taskName && (
            <>
              <span style={{ opacity: 0.3 }}>|</span>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "11px",
                  color: "var(--vscode-textLink-foreground)",
                  fontWeight: 500,
                  overflow: "hidden",
                }}
              >
                <div style={{ width: "5px", height: "5px", borderRadius: "50%", backgroundColor: "currentColor", flexShrink: 0 }} />
                <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {taskName}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Right: Token Usage */}
        <div style={{ fontSize: "11px", color: "var(--secondary-text)", opacity: 0.8, flexShrink: 0 }}>
          {contextUsage ? formatTokens(contextUsage.total) : "0"}
        </div>
      </div>
    </div>
  );
};

export default ChatHeader;
