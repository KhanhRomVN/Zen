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

  // 🆕 State for model filtering
  const [selectedModel, setSelectedModel] =
    React.useState<string>("deepseek-web");
  const { models: availableModels } = useModels();

  // 🆕 Filter tabs based on selected model
  const filteredTabs = React.useMemo(() => {
    const selectedModelData = availableModels.find(
      (m) => m.id === selectedModel
    );
    if (!selectedModelData) {
      console.warn(`[TabPanel] ⚠️ Model not found:`, selectedModel);
      return tabs; // No filtering if model not found
    }

    const targetProvider = selectedModelData.provider;

    // 🆕 Debug logging
    console.log(`[TabPanel] 🔍 Filtering tabs:`, {
      selectedModel,
      targetProvider,
      totalTabs: tabs.length,
      tabsWithProvider: tabs.filter((t) => t.provider).length,
      providers: tabs.map((t) => t.provider),
    });

    // 🆕 Filter tabs by provider (allow undefined provider = no filter)
    const filtered = tabs.filter((tab) => {
      // Nếu tab không có provider field → accept (backward compatibility)
      if (!tab.provider) {
        console.warn(`[TabPanel] ⚠️ Tab missing provider field:`, tab.tabId);
        return true;
      }
      return tab.provider === targetProvider;
    });

    console.log(`[TabPanel] ✅ Filtered result:`, {
      filteredCount: filtered.length,
      filteredTabIds: filtered.map((t) => t.tabId),
    });

    return filtered;
  }, [tabs, selectedModel, availableModels]);

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
            <p>No tabs available for selected model</p>
            <p
              style={{
                fontSize: "var(--font-size-xs)",
                marginTop: "var(--spacing-xs)",
              }}
            >
              Try selecting a different model or open a new AI chat tab
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
        onModelChange={setSelectedModel}
      />
    </div>
  );
};

export default TabPanel;
