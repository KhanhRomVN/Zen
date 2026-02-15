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
  conversationId?: string | null;
  provider?: string;
}

import { Message } from "./ChatBody/types";

interface ChatHeaderProps {
  selectedTab: TabInfo;
  onBack: () => void;
  onClearChat: () => void;
  isLoadingConversation?: boolean;
  firstRequestMessage?: Message;
  contextUsage?: {
    completion: number;
    total: number;
  };
  taskName?: string | null;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({
  selectedTab,
  contextUsage,
  taskName,
}) => {
  // Helper to format large numbers
  const formatNumber = (num: number) => {
    if (num >= 1000000) {
      return (num / 1000000).toFixed(1) + "M";
    }
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + "k";
    }
    return num.toString();
  };

  // Mock model info (In real app, this should come from props or context)
  // For now, we derive it from provider status or default
  const modelName = "DeepSeek Chat"; // TODO: Pass actual model name
  const providerId = selectedTab.provider || "deepseek";
  // Assuming favicon logic or usage of getProviderIconPath if needed, but user asked for <favicon> <provider> | <model>
  // We will use a generic icon or the one from fileIconMapper if available, but here we simplest approach.
  const faviconUrl =
    "https://www.google.com/s2/favicons?domain=deepseek.com&sz=64"; // Example default

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
          flexDirection: "column",
          gap: "4px",
        }}
      >
        {/* Row 1: Model Info (Left) & Token Usage (Right) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: "24px",
          }}
        >
          {/* Left: Model Info */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--primary-text)",
            }}
          >
            <img
              src={faviconUrl}
              alt="provider"
              style={{ width: "14px", height: "14px", borderRadius: "2px" }}
            />
            <span>
              {providerId.charAt(0).toUpperCase() + providerId.slice(1)}
            </span>
            <span style={{ opacity: 0.3 }}>|</span>
            <span style={{ opacity: 0.9 }}>{modelName}</span>
          </div>

          {/* Right: Token Usage */}
          <div
            style={{
              fontSize: "11px",
              color: "var(--secondary-text)",
              fontFamily: "monospace",
              backgroundColor: "var(--vscode-badge-background)",
              padding: "1px 6px",
              borderRadius: "4px",
            }}
          >
            {contextUsage ? formatNumber(contextUsage.total) : "0"} tok
          </div>
        </div>

        {/* Row 2: Task Name (Left) & Conversation ID (Right) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: "20px",
          }}
        >
          {/* Task Name */}
          <div
            style={{
              fontSize: "12px",
              color: "var(--vscode-textLink-foreground)", // Highlight color
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              gap: "6px",
              overflow: "hidden",
            }}
          >
            {taskName && (
              <>
                <div
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    backgroundColor: "currentColor",
                  }}
                />
                <span
                  style={{
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    maxWidth: "300px",
                  }}
                  title={taskName}
                >
                  {taskName}
                </span>
              </>
            )}
            {!taskName && (
              <span
                style={{ opacity: 0.5, fontStyle: "italic", fontSize: "11px" }}
              >
                No active task
              </span>
            )}
          </div>

          {/* Conversation ID */}
          <div
            style={{
              fontSize: "10px",
              color: "var(--secondary-text)",
              fontFamily: "monospace",
              opacity: 0.6,
            }}
          >
            #{selectedTab.conversationId?.slice(-6) || "NEW"}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatHeader;
