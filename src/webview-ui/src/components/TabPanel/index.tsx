import React, { useEffect } from "react";
import TabHeader from "./TabHeader";
import TabInput from "./TabFooter";
import TabList from "./TabList";

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

interface TabPanelProps {
  onTabSelect?: (tab: TabInfo) => void;
  tabs: TabInfo[];
  wsConnected: boolean;
  onWsConnectedChange: (connected: boolean) => void;
  onWsMessage: (message: any) => void;
}

const TabPanel: React.FC<TabPanelProps> = ({
  onTabSelect,
  tabs,
  wsConnected,
  onWsConnectedChange,
  onWsMessage,
}) => {
  // Hiển thị TabList khi WebSocket đã connected VÀ có tabs
  const shouldShowTabList = wsConnected && tabs.length > 0;

  useEffect(() => {
    // UI will update automatically when wsConnected or tabs change
  }, [wsConnected, tabs, shouldShowTabList]);

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
        {wsConnected && tabs.length > 0 && (
          <TabList tabs={tabs} onTabSelect={onTabSelect} />
        )}
      </div>
      <TabInput
        onWsConnectedChange={onWsConnectedChange}
        onWsMessage={onWsMessage}
      />
    </div>
  );
};

export default TabPanel;
