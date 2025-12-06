import React, { useEffect } from "react";
import TabHeader from "./TabHeader";
import TabInput from "./TabFooter";
import TabList from "./TabList";
import { useModels } from "../../hooks/useModels";

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

interface TabPanelProps {
  onTabSelect?: (tab: TabInfo) => void;
  tabs: TabInfo[];
  wsConnected: boolean;
  port: number;
  wsInstance?: WebSocket | null; // 🆕 Pass WebSocket instance
}

const TabPanel: React.FC<TabPanelProps> = ({
  onTabSelect,
  tabs,
  wsConnected,
  port,
  wsInstance, // 🆕 Receive WebSocket instance
}) => {
  // Hiển thị TabList khi WebSocket đã connected VÀ có tabs
  const shouldShowTabList = wsConnected && tabs.length > 0;

  // 🆕 State for model filtering (multi-select)
  const [selectedModels, setSelectedModels] = React.useState<string[]>([
    "deepseek-web",
  ]);
  const { models: availableModels } = useModels();

  // 🆕 Filter tabs based on selected models (multi-select)
  const filteredTabs = React.useMemo(() => {
    if (selectedModels.length === 0) {
      return tabs; // Show all tabs if no model selected
    }

    // Get target providers from selected models
    const targetProviders = selectedModels
      .map((modelId) => {
        const modelData = availableModels.find((m) => m.id === modelId);
        return modelData?.provider;
      })
      .filter((p): p is NonNullable<typeof p> => p !== undefined);

    if (targetProviders.length === 0) {
      return tabs;
    }

    // 🆕 Filter tabs by providers (OR logic)
    const filtered = tabs.filter((tab) => {
      // Nếu tab không có provider field → accept (backward compatibility)
      if (!tab.provider) {
        return true;
      }
      return targetProviders.includes(tab.provider);
    });

    return filtered;
  }, [tabs, selectedModels, availableModels]);

  // 🆕 Auto-refresh tab state every 0.5s when in TabPanel
  useEffect(() => {
    if (!wsInstance || wsInstance.readyState !== WebSocket.OPEN) {
      return;
    }

    const intervalId = setInterval(() => {
      if (wsInstance && wsInstance.readyState === WebSocket.OPEN) {
        wsInstance.send(
          JSON.stringify({
            type: "requestFocusedTabs",
            timestamp: Date.now(),
          })
        );
      }
    }, 500); // 0.5 seconds

    return () => {
      clearInterval(intervalId);
    };
  }, [wsInstance]);

  return (
    <div className="chat-panel">
      <TabHeader />
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          paddingBottom: "200px",
        }}
      >
        {filteredTabs.length > 0 && (
          <TabList tabs={filteredTabs} onTabSelect={onTabSelect} />
        )}
        {tabs.length > 0 && filteredTabs.length === 0 && (
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
              🔍
            </div>
            <p>No tabs available for selected models</p>
            <p
              style={{
                fontSize: "var(--font-size-xs)",
                marginTop: "var(--spacing-xs)",
              }}
            >
              Try selecting different models or open a new AI chat tab
            </p>
          </div>
        )}
        {tabs.length === 0 && (
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
              🌐
            </div>
            <p>No AI chat tabs detected</p>
            <p
              style={{
                fontSize: "var(--font-size-xs)",
                marginTop: "var(--spacing-xs)",
              }}
            >
              {wsConnected
                ? "Open DeepSeek, ChatGPT, Claude, Gemini, or Grok to get started"
                : "Connect to WebSocket first to see available tabs"}
            </p>
          </div>
        )}
      </div>
      <TabInput
        port={port}
        wsConnected={wsConnected}
        onModelChange={setSelectedModels}
      />
    </div>
  );
};

export default TabPanel;
