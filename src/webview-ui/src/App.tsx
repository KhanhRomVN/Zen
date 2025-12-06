import React, { useState, useEffect, useRef } from "react";
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

// CRITICAL: VS Code API chỉ có thể acquire một lần duy nhất
// 🔥 FIX: Dùng IIFE để đảm bảo chỉ chạy một lần duy nhất
const getVSCodeApi = (() => {
  let api: any = null;
  let initialized = false;

  return () => {
    if (initialized) {
      return api;
    }

    try {
      // 🔥 CHECK: Nếu đã có global instance, sử dụng luôn
      if ((window as any).vscodeApi) {
        console.log("[App] ✅ Using existing VS Code API instance");
        api = (window as any).vscodeApi;
      } else {
        console.log("[App] 🆕 Acquiring VS Code API for the first time");
        api = (window as any).acquireVsCodeApi();
        // 🆕 Expose globally for other components
        (window as any).vscodeApi = api;
        console.log("[App] ✅ VS Code API acquired and exposed globally");
      }
    } catch (error) {
      // VS Code API not available or already acquired
      console.error("[App] ❌ Could not acquire VS Code API:", error);
      // 🔥 Try to use existing instance if available
      if ((window as any).vscodeApi) {
        console.warn("[App] ⚠️ Using existing global instance despite error");
        api = (window as any).vscodeApi;
      }
    }

    initialized = true;
    return api;
  };
})();

const vscodeApi = getVSCodeApi();

const App: React.FC = () => {
  useVSCodeTheme();
  const [showHistory, setShowHistory] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [selectedTab, setSelectedTab] = useState<TabInfo | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [wsInstance, setWsInstance] = useState<WebSocket | null>(null);
  const [port, setPort] = useState(0);
  const activePortRef = useRef<number>(0);
  const connectionTimestampRef = useRef<number>(0);

  // 🆕 Lift tabs state lên App level để persist khi switch panels
  const { tabs, handleMessage } = useZenTabConnection();

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

  const handleBackToTabPanel = () => {
    setSelectedTab(null);
  };

  // 🔥 CRITICAL: Quản lý WebSocket connection ở App level (persist across panels)
  useEffect(() => {
    if (port === 0) return;

    let ws: WebSocket | null = null;
    const currentPort = port;

    // Chỉ setup WebSocket nếu đây là port đang active
    if (activePortRef.current !== currentPort) {
      return;
    }

    // Reset wsConnected trước khi tạo connection mới
    setWsConnected(false);

    // Set timestamp cho connection mới
    const connectionTimestamp = Date.now();
    connectionTimestampRef.current = connectionTimestamp;

    try {
      ws = new WebSocket(`ws://localhost:${port}`);

      // Update wsInstance immediately
      setWsInstance(ws);

      ws.onopen = () => {};

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          // Ignore old messages
          if (data.timestamp && data.timestamp < connectionTimestamp) {
            console.warn(
              `[App] ⚠️ Ignoring old message (age: ${
                connectionTimestamp - data.timestamp
              }ms)`,
              data.type
            );
            return;
          }

          // 🆕 CRITICAL: Filter promptResponse by folderPath
          if (data.type === "promptResponse") {
            const messageFolderPath = data.folderPath || null;
            const currentFolderPath =
              (window as any).__zenWorkspaceFolderPath || null;

            // Reject if folderPath doesn't match
            if (messageFolderPath !== currentFolderPath) {
              console.warn(
                `[App] ⚠️ Rejecting promptResponse: folderPath mismatch`,
                {
                  expected: currentFolderPath,
                  received: messageFolderPath,
                  requestId: data.requestId,
                }
              );
              return;
            }
          }

          if ((window as any).__chatPanelMessageHandler) {
            (window as any).__chatPanelMessageHandler(data);
          } else {
            handleMessageRef.current(data);
          }

          // Then handle system messages for App state
          if (data.type === "connection-established") {
            setWsConnected(true);
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(
                JSON.stringify({
                  type: "requestFocusedTabs",
                  timestamp: Date.now(),
                })
              );
            }
          } else if (data.type === "ping") {
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(
                JSON.stringify({
                  type: "pong",
                  timestamp: Date.now(),
                })
              );
            }
          } else if (data.type === "response" || data.type === "pong") {
            setWsConnected(true);
          } else if (data.type === "focusedTabsUpdate") {
            if (Array.isArray(data.data) && data.data.length === 0) {
              setWsConnected(false);
            } else if (Array.isArray(data.data) && data.data.length > 0) {
              setWsConnected(true);
            }
          }
        } catch (error) {
          console.error(`[App] ❌ Error parsing message:`, error);
          console.error(`[App] 🔍 Raw data:`, event.data?.substring(0, 200));
        }
      };

      ws.onclose = (event) => {
        if (activePortRef.current === currentPort) {
          setWsConnected(false);
          setWsInstance(null);
          if (selectedTab !== null) {
            setSelectedTab(null);
          }
        }
      };

      ws.onerror = (error) => {
        console.error(
          `[App] ❌ WebSocket ERROR for port ${currentPort}:`,
          error
        );
        if (activePortRef.current === currentPort) {
          setWsConnected(false);
        }
      };
    } catch (error) {
      console.error(`[App] ❌ Exception creating WebSocket:`, error);
      if (activePortRef.current === currentPort) {
        setWsConnected(false);
      }
    }

    return () => {
      // Chỉ close khi port thay đổi
    };
  }, [port]); // ✅ REMOVED handleMessage dependency

  // Initialize port from VS Code
  useEffect(() => {
    if (!vscodeApi) {
      console.error(`[App] ❌ VS Code API not available`);
      return;
    }

    const messageHandler = (event: MessageEvent) => {
      const message = event.data;
      if (message.command === "workspacePort" && message.port) {
        activePortRef.current = message.port;
        setPort(message.port);
        window.removeEventListener("message", messageHandler);
      }
    };

    window.addEventListener("message", messageHandler);

    vscodeApi.postMessage({
      command: "getWorkspacePort",
    });

    setTimeout(() => {
      window.removeEventListener("message", messageHandler);
    }, 2000);

    return () => {
      window.removeEventListener("message", messageHandler);
    };
  }, []);

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
          port={port}
          wsInstance={wsInstance}
        />
      )}
      {!showHistory && !showSettings && selectedTab && (
        <ChatPanel
          selectedTab={selectedTab}
          onBack={handleBackToTabPanel}
          wsConnected={wsConnected}
          onWsMessage={handleMessage}
          wsInstance={wsInstance}
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
