import React, { useState, useEffect } from "react";
import TabPanel from "./components/TabPanel";
import HistoryPanel from "./components/HistoryPanel";
import SettingsPanel from "./components/SettingsPanel";
import "./styles/components/chat.css";
import { useVSCodeTheme } from "./hooks/useVSCodeTheme";

const App: React.FC = () => {
  useVSCodeTheme();
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      switch (message.command) {
        case "showHistory":
          setShowHistory(true);
          setShowSettings(false);
          break;
        case "showSettings":
          setShowSettings(true);
          setShowHistory(false);
          break;
        case "newChat":
          setShowHistory(false);
          setShowSettings(false);
          break;
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return (
    <div className="app-container">
      {!showHistory && !showSettings && <TabPanel />}
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
