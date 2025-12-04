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

interface TabListProps {
  tabs: TabInfo[];
  onTabSelect?: (tab: TabInfo) => void;
}

const TabList: React.FC<TabListProps> = ({ tabs, onTabSelect }) => {
  const getStatusColor = (status: string): string => {
    if (status === "busy") return "bg-yellow-500";
    if (status === "sleep") return "bg-purple-500";
    return "bg-green-500";
  };

  const getStatusIcon = (status: string): string => {
    if (status === "busy") return "⏳";
    if (status === "sleep") return "💤";
    return "✅";
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
        <p>No DeepSeek tabs detected</p>
        <p
          style={{
            fontSize: "var(--font-size-xs)",
            marginTop: "var(--spacing-xs)",
          }}
        >
          Open https://chat.deepseek.com/ in ZenTab to see active tabs
        </p>
      </div>
    );
  }

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
        ACTIVE DEEPSEEK TABS ({tabs.length})
      </div>
      {tabs.map((tab) => (
        <div
          key={tab.tabId}
          style={{
            padding: "var(--spacing-md)",
            backgroundColor: "var(--secondary-bg)",
            border: "1px solid var(--border-color)",
            borderRadius: "var(--border-radius)",
            transition: "all 0.2s",
            cursor: "pointer",
          }}
          onClick={() => onTabSelect?.(tab)}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--hover-bg)";
            e.currentTarget.style.borderColor = "var(--accent-text)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "var(--secondary-bg)";
            e.currentTarget.style.borderColor = "var(--border-color)";
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
            <div
              className={getStatusColor(tab.status)}
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
              }}
            />
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
            <span style={{ fontSize: "var(--font-size-sm)" }}>
              {getStatusIcon(tab.status)}
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
          </div>

          {tab.folderPath && (
            <div
              style={{
                marginTop: "var(--spacing-xs)",
                fontSize: "var(--font-size-xs)",
                color: "var(--accent-text)",
                display: "flex",
                alignItems: "center",
                gap: "var(--spacing-xs)",
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
      ))}
    </div>
  );
};

export default TabList;
