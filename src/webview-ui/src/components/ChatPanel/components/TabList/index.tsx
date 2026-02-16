import React from "react";
import { getProviderIconPath } from "../../../../utils/fileIconMapper";

import { TabInfo } from "../../../../types";

interface TabListProps {
  tabs: TabInfo[];
  onTabSelect?: (tab: TabInfo) => void;
  activeTabId?: number;
}

const TabList: React.FC<TabListProps> = ({
  tabs,
  onTabSelect,
  activeTabId,
}) => {
  const getStatusColor = (status: string): string => {
    if (status === "busy") return "bg-yellow-500";
    if (status === "sleep") return "bg-purple-500";
    return "bg-green-500";
  };

  const getStatusBadge = (status: string): string => {
    if (status === "busy") return "Processing";
    if (status === "sleep") return "Sleeping";
    return "Free";
  };

  if (tabs.length === 0) {
    return (
      <div
        style={{
          padding: "var(--spacing-xl)",
          textAlign: "center",
          color: "var(--secondary-text)",
          fontSize: "var(--font-size-sm)",
        }}
      >
        <div
          style={{
            fontSize: "var(--font-size-xxl)",
            marginBottom: "var(--spacing-md)",
          }}
        >
          🔌
        </div>
        <p>No AI tabs detected</p>
        <p
          style={{
            fontSize: "var(--font-size-xs)",
            marginTop: "var(--spacing-xs)",
          }}
        >
          Open AI chat websites to see active tabs
        </p>
      </div>
    );
  }

  const getProviderInfo = (
    provider?: "deepseek" | "chatgpt" | "gemini" | "grok",
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

  return (
    <div
      style={{
        padding: "var(--spacing-md)",
        display: "flex",
        flexDirection: "column",
        gap: "var(--spacing-sm)",
      }}
    >
      <div
        style={{
          fontSize: "var(--font-size-xs)",
          fontWeight: 600,
          color: "var(--secondary-text)",
          letterSpacing: "0.5px",
          padding: "0 var(--spacing-sm)",
        }}
      >
        ACTIVE AI TABS ({tabs.length})
      </div>
      {tabs.map((tab) => {
        const providerInfo = getProviderInfo(tab.provider);
        return (
          <div
            key={tab.tabId}
            style={{
              padding: "var(--spacing-md)",
              backgroundColor: "var(--secondary-bg)",
              border:
                tab.tabId === activeTabId
                  ? "2px solid #FFD700" // Sparkling gold
                  : "1px solid var(--border-color)",
              boxShadow:
                tab.tabId === activeTabId
                  ? "0 0 10px rgba(255, 215, 0, 0.3)"
                  : "none",
              borderRadius: "var(--border-radius)",
              transition: "all 0.2s",
              cursor: tab.canAccept ? "pointer" : "not-allowed",
              opacity: tab.canAccept ? 1 : 0.6,
            }}
            onClick={() => {
              if (tab.canAccept) {
                onTabSelect?.(tab);
              }
            }}
            onMouseEnter={(e) => {
              if (tab.canAccept) {
                e.currentTarget.style.backgroundColor = "var(--hover-bg)";
                e.currentTarget.style.borderColor = "var(--accent-text)";
              }
            }}
            onMouseLeave={(e) => {
              if (tab.canAccept) {
                e.currentTarget.style.backgroundColor = "var(--secondary-bg)";
                e.currentTarget.style.borderColor = "var(--border-color)";
              }
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--spacing-sm)",
                marginBottom: "var(--spacing-xs)",
              }}
            >
              <span
                style={{
                  fontSize: "10px",
                  fontWeight: 600,
                  color: providerInfo.textColor,
                  backgroundColor: providerInfo.bgColor,
                  padding: "2px 6px",
                  borderRadius: "4px",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <img
                  src={getProviderIconPath(tab.provider || "openai")}
                  alt={providerInfo.name}
                  style={{ width: "12px", height: "12px" }}
                />
                {providerInfo.name}
              </span>
              <span
                style={{
                  fontSize: "var(--font-size-md)",
                  fontWeight: 600,
                  color: "var(--primary-text)",
                  flex: 1,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {tab.title}
              </span>
              {tab.folderPath && (
                <div
                  style={{
                    fontSize: "var(--font-size-xs)",
                    color: "var(--accent-text)",
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--spacing-xs)",
                    backgroundColor: "rgba(99, 102, 241, 0.1)",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    maxWidth: "150px",
                  }}
                >
                  <span>📁</span>
                  <span
                    style={{
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                    title={tab.folderPath}
                  >
                    {tab.folderPath.split("/").pop() || tab.folderPath}
                  </span>
                </div>
              )}
            </div>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "var(--spacing-sm)",
                fontSize: "var(--font-size-xs)",
                color: "var(--secondary-text)",
              }}
            >
              <span style={{ fontFamily: "monospace" }}>ID: {tab.tabId}</span>
              <span>•</span>
              <span>{tab.requestCount} requests</span>
              <span>•</span>
              <span
                style={{
                  color:
                    tab.status === "busy"
                      ? "#ff9800"
                      : tab.status === "sleep"
                        ? "#9c27b0"
                        : "#4caf50",
                  fontWeight: 600,
                }}
              >
                {getStatusBadge(tab.status)}
              </span>
              {tab.containerName && !tab.containerName.startsWith("Tab ") && (
                <>
                  <span>•</span>
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      fontSize: "var(--font-size-xs)",
                      color: "#6366f1",
                    }}
                  >
                    <span style={{ fontSize: "10px" }}>🗂️</span>
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        maxWidth: "100px",
                      }}
                      title={tab.containerName}
                    >
                      {tab.containerName}
                    </span>
                  </span>
                </>
              )}
            </div>

            {(() => {
              return null;
            })()}

            {tab.conversationId && (
              <div
                style={{
                  marginTop: "2px",
                  fontSize: "var(--font-size-xs)",
                  color: "var(--secondary-text)",
                  display: "flex",
                  alignItems: "center",
                  gap: "var(--spacing-xs)",
                }}
              >
                <span>💬</span>
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    maxWidth: "200px",
                  }}
                  title={tab.conversationId}
                >
                  {tab.conversationId}
                </span>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default TabList;
