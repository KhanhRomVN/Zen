import React, { useState, useEffect, useRef, useCallback } from "react";
import ChatPanel from "./components/ChatPanel";
import HomePanel from "./components/HomePanel";
import HistoryPanel from "./components/HistoryPanel";
import SettingsPanel from "./components/SettingsPanel";
import "./styles/components/chat.css";
import { ProjectProvider } from "./context/ProjectContext";
import { ThemeProvider } from "./context/ThemeContext";
import { BackendConnectionProvider } from "./context/BackendConnectionContext";
import { SettingsProvider } from "./context/SettingsContext";

import { TabInfo } from "./types";

import { extensionService } from "./services/ExtensionService";

// Initialize global storage API
(window as any).storage = extensionService.getStorage();

const App: React.FC = () => {
  // Notify extension host rằng React app đã mount xong
  // Extension sẽ dùng signal này để lazy-load theme (tránh block render lần đầu)
  useEffect(() => {
    extensionService.postMessage({ command: "webviewReady" });
  }, []);

  // 🆕 Clear stale state on mount
  useEffect(() => {
    try {
      // Only clear if extension just started (check timestamp)
      const lastClear = sessionStorage.getItem("zen-last-clear");
      const now = Date.now();
      if (!lastClear || now - parseInt(lastClear) > 60000) {
        // 1 minute
        sessionStorage.clear();
        sessionStorage.setItem("zen-last-clear", now.toString());
      }
    } catch (error) {
      // console.error("[App] Failed to clear stale state:", error);
    }
  }, []);

  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedTab, setSelectedTab] = useState<TabInfo | null>(null);
  const [previousPanel, setPreviousPanel] = useState<"tab" | "chat" | null>(
    null,
  );
  const [externalTabs, setExternalTabs] = useState<TabInfo[]>([]);
  const [homeInitialValue, setHomeInitialValue] = useState("");

  // Lift tabs state lên App level để persist khi switch panels
  const tabs: TabInfo[] = []; // WebSocket removed, using empty tabs for now
  const handleMessage = (data: any) => {};
  const clearTabs = () => {};

  // 🔥 CRITICAL: Wrap handleMessage trong useRef để tránh dependency change
  const handleMessageRef = useRef(handleMessage);

  useEffect(() => {
    handleMessageRef.current = handleMessage;
  }, [handleMessage]);

  const handleTabSelect = (tab: TabInfo) => {
    setSelectedTab(tab);
    setShowHistory(false);
    setShowSettings(false);
  };

  const handleLoadConversation = useCallback(
    (conversationId: string, tabId: number, folderPath: string | null) => {
      // Find matching tab from current tabs
      const matchingTab = tabs.find((t) => t.tabId === tabId);

      if (matchingTab) {
        // Set selected tab with conversationId flag
        const newSelectedTab = {
          ...matchingTab,
          conversationId: conversationId,
        } as any;

        setSelectedTab(newSelectedTab);
        setShowHistory(false);
        setShowSettings(false);
        setPreviousPanel(null); // Reset previous panel
      } else {
        // Create virtual tab when real tab not found
        const virtualTab = {
          tabId: tabId,
          containerName: "Virtual Tab",
          title: "Loaded Conversation",
          status: "free" as const,
          canAccept: true, // Allow input for loaded history
          requestCount: 0,
          folderPath: folderPath,
          conversationId: conversationId,
        };

        setSelectedTab(virtualTab as any);
        setShowHistory(false);
        setShowSettings(false);
        setPreviousPanel(null);
      }
    },
    [tabs],
  );

  // 🆕 Initial Message Data State
  const [initialMessageData, setInitialMessageData] = useState<{
    content: string;
    files: any[];
    model: any;
    account: any;
  } | null>(null);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      switch (message.command) {
        case "showHistory":
          // Save current panel before switching
          if (selectedTab) {
            setPreviousPanel("chat");
          } else {
            setPreviousPanel("tab");
          }
          setShowHistory(true);
          setShowSettings(false);
          break;
        case "showSettings":
          if (selectedTab) {
            setPreviousPanel("chat");
          } else {
            setPreviousPanel("tab");
          }
          setShowSettings(true);
          setShowHistory(false);
          break;
        case "newChat":
          setShowHistory(false);
          setShowSettings(false);
          setSelectedTab(null);
          setPreviousPanel(null);
          setInitialMessageData(null); // Clear initial data on new chat
          break;
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [selectedTab]);

  const handleHomeSendMessage = useCallback(
    (
      content: string,
      files: any[],
      model: any,
      account: any,
    ) => {
      console.log("[Zen] App handleHomeSendMessage called", {
        contentLength: content.trim().length,
        model: model?.id,
        account: account?.email,
        files: files?.length,
      });
      setInitialMessageData({
        content,
        files,
        model,
        account,
      });
      const newTab: TabInfo = {
        tabId: Date.now(),
        containerName: "New Chat",
        title: "New Chat",
        status: "free",
        conversationId: "", // Empty for new chat
        folderPath: (window as any).__zenWorkspaceFolderPath || null,
        canAccept: true,
        requestCount: 0,
      };
      console.log("[Zen] App switching to ChatPanel with newTab", { tabId: newTab.tabId });
      setSelectedTab(newTab);
      setHomeInitialValue(""); // Clear when starting fresh from Home
    },
    [],
  );

  const handleBack = useCallback((contentToReturn?: string) => {
    setSelectedTab(null);
    if (typeof contentToReturn === "string" && contentToReturn.trim()) {
      setHomeInitialValue(contentToReturn);
    } else {
      setHomeInitialValue("");
    }
  }, []);

  const lastSelectedTabRef = React.useRef<TabInfo | null>(null);
  if (selectedTab) lastSelectedTabRef.current = selectedTab;

  return (
    <ThemeProvider>
      <SettingsProvider>
        <BackendConnectionProvider>
          <ProjectProvider>
            <div className="app-container">
              {lastSelectedTabRef.current && (
                <div style={{ display: selectedTab ? "contents" : "none" }}>
                  <ChatPanel
                    selectedTab={lastSelectedTabRef.current}
                    onBack={handleBack}
                    tabs={tabs}
                    onTabSelect={handleTabSelect}
                    onLoadConversation={handleLoadConversation}
                    initialMessageData={initialMessageData}
                    onClearInitialData={() => setInitialMessageData(null)}
                  />
                </div>
              )}
              {!selectedTab && (
                <HomePanel
                  onSendMessage={handleHomeSendMessage}
                  onLoadConversation={handleLoadConversation}
                  initialValue={homeInitialValue}
                />
              )}
              <HistoryPanel
                isOpen={showHistory}
                onClose={() => { setShowHistory(false); setPreviousPanel(null); }}
                onLoadConversation={handleLoadConversation}
              />
              <SettingsPanel
                isOpen={showSettings}
                onClose={() => { setShowSettings(false); setPreviousPanel(null); }}
              />
            </div>
          </ProjectProvider>
        </BackendConnectionProvider>
      </SettingsProvider>
    </ThemeProvider>
  );
};

export default App;
