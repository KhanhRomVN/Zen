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
let vscodeApi: any = null;
try {
  vscodeApi = (window as any).acquireVsCodeApi();
} catch (error) {
  // VS Code API not available or already acquired
}

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

      ws.onopen = () => {
        console.log(`[App] ✅ WebSocket opened for port ${port}`);
      };

      ws.onmessage = (event) => {
        console.log(`[App] 📨 WebSocket message received:`, {
          port: port,
          dataLength: event.data?.length || 0,
        });
        try {
          const data = JSON.parse(event.data);
          console.log(`[App] 🔍 Message parsed:`, {
            type: data.type,
            hasTimestamp: !!data.timestamp,
            messageAge: data.timestamp ? Date.now() - data.timestamp : "N/A",
            folderPath: data.folderPath || "N/A", // 🆕 Log folderPath
          });

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

            console.log(`[App] 🔍 Folder filtering:`, {
              messageFolderPath,
              currentFolderPath,
              match: messageFolderPath === currentFolderPath,
            });

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
              return; // ← Ignore this message
            }

            console.log(`[App] ✅ promptResponse accepted (folderPath match)`);
          }

          // 🔥 CRITICAL FIX: Forward ALL messages to child component FIRST
          console.log(`[App] 🔄 Forwarding message to child component:`, {
            type: data.type,
            hasChatPanelHandler: !!(window as any).__chatPanelMessageHandler,
            selectedTab: selectedTab?.tabId,
          });

          if ((window as any).__chatPanelMessageHandler) {
            console.log(
              `[App] 📤 Calling ChatPanel handler for type: ${data.type}`
            );
            (window as any).__chatPanelMessageHandler(data);
          } else {
            console.log(
              `[App] 📤 Calling useZenTabConnection handler for type: ${data.type}`
            );
            handleMessageRef.current(data);
          }

          // Then handle system messages for App state
          if (data.type === "connection-established") {
            console.log(`[App] ✅ Connection established`);
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
            console.log(`[App] 🏓 Ping received, sending pong`);
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(
                JSON.stringify({
                  type: "pong",
                  timestamp: Date.now(),
                })
              );
            }
          } else if (data.type === "response" || data.type === "pong") {
            console.log(`[App] ✅ Response/Pong received`);
            setWsConnected(true);
          } else if (data.type === "focusedTabsUpdate") {
            console.log(`[App] 📋 Tabs update:`, {
              tabCount: Array.isArray(data.data) ? data.data.length : 0,
            });
            if (Array.isArray(data.data) && data.data.length === 0) {
              setWsConnected(false);
            } else if (Array.isArray(data.data) && data.data.length > 0) {
              setWsConnected(true);
            }
          } else if (data.type === "promptResponse") {
            console.log(`[App] 💬 promptResponse received:`, {
              requestId: data.requestId,
              success: data.success,
              hasResponse: !!data.response,
              error: data.error,
            });
          }
        } catch (error) {
          console.error(`[App] ❌ Error parsing message:`, error);
          console.error(`[App] 🔍 Raw data:`, event.data?.substring(0, 200));
        }
      };

      ws.onclose = (event) => {
        console.log(`[App] 🔌 WebSocket closed for port ${currentPort}`);
        if (activePortRef.current === currentPort) {
          setWsConnected(false);
          setWsInstance(null);
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
      // 🔥 CRITICAL: KHÔNG close WebSocket khi component unmount
      // Chỉ close khi port thay đổi
      console.log(`[App] 🧹 WebSocket cleanup called (port: ${currentPort})`);
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
        console.log(`[App] 📡 Received port from VS Code:`, message.port);
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
