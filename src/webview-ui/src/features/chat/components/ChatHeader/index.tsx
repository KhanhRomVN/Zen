import React from "react";
import { Message } from "../../types";

export interface TabInfo {
  tabId: number;
  containerName: string;
  title: string;
  url?: string;
  status: "free" | "busy" | "sleep";
  canAccept: boolean;
  requestCount: number;
  folderPath?: string | null;
  conversationId?: string | null;
  provider?: "deepseek" | "chatgpt" | "gemini" | "grok";
  cookieStoreId?: string;
}

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
  onToggleSearch?: () => void;
  isSearchOpen?: boolean;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({
  selectedTab,
  contextUsage,
  taskName,
  currentModel,
  currentAccount,
  onToggleSearch,
  isSearchOpen = false,
}) => {
  const formatTokens = (num: number) => {
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  };

  const providerId =
    currentModel?.providerId || selectedTab.provider || "deepseek";

  let faviconUrl =
    "https://www.google.com/s2/favicons?domain=deepseek.com&sz=64";
  if (providerId.toLowerCase().includes("openai"))
    faviconUrl = "https://www.google.com/s2/favicons?domain=openai.com&sz=64";
  else if (providerId.toLowerCase().includes("anthropic"))
    faviconUrl =
      "https://www.google.com/s2/favicons?domain=anthropic.com&sz=64";
  else if (providerId.toLowerCase().includes("google"))
    faviconUrl = "https://www.google.com/s2/favicons?domain=google.com&sz=64";
  else if (providerId.toLowerCase().includes("openrouter"))
    faviconUrl =
      "https://www.google.com/s2/favicons?domain=openrouter.ai&sz=64";

  const totalTokens = contextUsage?.total ?? 0;

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
                <div
                  style={{
                    width: "5px",
                    height: "5px",
                    borderRadius: "50%",
                    backgroundColor: "currentColor",
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {taskName}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Right: Token Usage + Search icon */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: "11px",
              color: "var(--secondary-text)",
              opacity: 0.8,
            }}
          >
            {contextUsage ? formatTokens(contextUsage.total) : "0"}
          </span>
          <button
            onClick={onToggleSearch}
            title="Search in chat"
            style={{
              background: isSearchOpen
                ? "color-mix(in srgb, var(--vscode-button-background) 15%, transparent)"
                : "transparent",
              border: isSearchOpen
                ? "1px solid color-mix(in srgb, var(--vscode-button-background) 40%, transparent)"
                : "1px solid transparent",
              cursor: "pointer",
              padding: "3px 4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: isSearchOpen
                ? "var(--vscode-button-background, var(--vscode-textLink-foreground))"
                : "var(--vscode-icon-foreground, var(--secondary-text))",
              opacity: isSearchOpen ? 1 : 0.65,
              borderRadius: "4px",
              transition: "all 0.15s ease",
            }}
            onMouseEnter={(e) => {
              if (!isSearchOpen) e.currentTarget.style.opacity = "1";
            }}
            onMouseLeave={(e) => {
              if (!isSearchOpen) e.currentTarget.style.opacity = "0.65";
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m13 13.5 2-2.5-2-2.5" />
              <path d="m21 21-4.3-4.3" />
              <path d="M9 8.5 7 11l2 2.5" />
              <circle cx="11" cy="11" r="8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatHeader;
