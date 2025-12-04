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
}

interface ChatHeaderProps {
  selectedTab: TabInfo;
  onBack: () => void;
}

const ChatHeader: React.FC<ChatHeaderProps> = ({ selectedTab, onBack }) => {
  const getStatusColor = (status: string): string => {
    if (status === "busy") return "#ff9800";
    if (status === "sleep") return "#9c27b0";
    return "#4caf50";
  };

  const getStatusIcon = (status: string): string => {
    if (status === "busy") return "⏳";
    if (status === "sleep") return "💤";
    return "✅";
  };

  return (
    <div className="chat-header">
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--spacing-md)",
        }}
      >
        <div
          style={{
            cursor: "pointer",
            padding: "var(--spacing-xs)",
            borderRadius: "var(--border-radius)",
            transition: "background-color 0.2s",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={onBack}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--hover-bg)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </div>

        <div style={{ flex: 1 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--spacing-sm)",
              marginBottom: "var(--spacing-xs)",
            }}
          >
            <div
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: getStatusColor(selectedTab.status),
              }}
            />
            <h2
              style={{
                margin: 0,
                fontSize: "var(--font-size-lg)",
                fontWeight: 600,
                color: "var(--primary-text)",
              }}
            >
              {selectedTab.title}
            </h2>
            <span style={{ fontSize: "var(--font-size-md)" }}>
              {getStatusIcon(selectedTab.status)}
            </span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--spacing-md)",
              fontSize: "var(--font-size-xs)",
              color: "var(--secondary-text)",
            }}
          >
            <span style={{ fontFamily: "monospace" }}>
              Tab ID: {selectedTab.tabId}
            </span>
            <span>•</span>
            <span>{selectedTab.requestCount} requests</span>
            {selectedTab.folderPath && (
              <>
                <span>•</span>
                <span
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "var(--spacing-xs)",
                    color: "var(--accent-text)",
                  }}
                >
                  <span>📁</span>
                  <span>{selectedTab.folderPath.split("/").pop()}</span>
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatHeader;
