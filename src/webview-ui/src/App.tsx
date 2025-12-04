import React, { useState, useEffect } from "react";
import TabPanel from "./components/TabPanel";
import ChatPanel from "./components/ChatPanel";
import HistoryPanel from "./components/HistoryPanel";
import SettingsPanel from "./components/SettingsPanel";
import "./styles/components/chat.css";
import { useVSCodeTheme } from "./hooks/useVSCodeTheme";
import { useZenTabConnection } from "./hooks/useZenTabConnection";

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

const App: React.FC = () => {
  useVSCodeTheme();
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedTab, setSelectedTab] = useState<TabInfo | null>(null);
  const [wsConnected, setWsConnected] = useState(false);

  // 🆕 Lift tabs state lên App level để persist khi switch panels
  const { tabs, handleMessage } = useZenTabConnection();

  const handleTabSelect = (tab: TabInfo) => {
    setSelectedTab(tab);
    setShowHistory(false);
    setShowSettings(false);
  };

  const handleBackToTabPanel = () => {
    setSelectedTab(null);
  };

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      switch (message.command) {
        case "showHistory":
          setShowHistory(true);
          setShowSettings(false);
          setSelectedTab(null);
          break;
        case "showSettings":
          setShowSettings(true);
          setShowHistory(false);
          setSelectedTab(null);
          break;
        case "newChat":
          setShowHistory(false);
          setShowSettings(false);
          setSelectedTab(null);
          break;
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return (
    <div className="app-container">
      {!showHistory && !showSettings && !selectedTab && (
        <TabPanel
          onTabSelect={handleTabSelect}
          tabs={tabs}
          wsConnected={wsConnected}
          onWsConnectedChange={setWsConnected}
          onWsMessage={handleMessage}
        />
      )}
      {!showHistory && !showSettings && selectedTab && (
        <ChatPanel
          selectedTab={selectedTab}
          onBack={handleBackToTabPanel}
          wsConnected={wsConnected}
          onWsConnectedChange={setWsConnected}
          onWsMessage={handleMessage}
        />
      )}
      {showHistory && (
        <HistoryPanel
          isOpen={showHistory}
          onClose={() => setShowHistory(false)}
        />
      )}
      {showSettings && (
        <SettingsPanel
          isOpen={showSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
};

export default App;
