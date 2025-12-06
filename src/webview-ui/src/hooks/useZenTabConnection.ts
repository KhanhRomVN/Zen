import { useEffect, useState } from "react";

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

/**
 * Hook to manage tabs state from WebSocket messages
 * KHÔNG tạo WebSocket connection mới - nhận messages từ parent component
 */
export const useZenTabConnection = () => {
  const [tabs, setTabs] = useState<TabInfo[]>([]);
  const [lastMessageTimestamp, setLastMessageTimestamp] = useState<number>(0);

  // Monitor tabs state changes
  useEffect(() => {
    // Tabs state changed
  }, [tabs]);

  const handleMessage = (message: any) => {
    try {
      const messageTimestamp = message.timestamp || 0;
      if (messageTimestamp > 0 && messageTimestamp < lastMessageTimestamp) {
        console.warn(
          `[useZenTabConnection] ⚠️ Ignoring old message (${
            lastMessageTimestamp - messageTimestamp
          }ms old)`,
          message.type
        );
        return;
      }

      // Update last message timestamp
      if (messageTimestamp > 0) {
        setLastMessageTimestamp(messageTimestamp);
      }

      // 🔥 FIX: Ignore requestFocusedTabs message (backend internal message)
      if (message.type === "requestFocusedTabs") {
        return;
      }

      if (message.type === "focusedTabsUpdate") {
        if (Array.isArray(message.data) && message.data.length === 0) {
          setTabs((prevTabs) => {
            if (prevTabs.length > 0) {
            }
            return [];
          });
          return;
        }

        if (message.data && Array.isArray(message.data)) {
          const processedTabs = message.data.map((tab: any) => {
            return {
              tabId: tab.tabId || 0,
              containerName: tab.containerName || "Unknown",
              title: tab.title || "No Title",
              url: tab.url || "",
              status: tab.status || "free",
              canAccept: tab.canAccept !== undefined ? tab.canAccept : true,
              requestCount: tab.requestCount || 0,
              folderPath: tab.folderPath || null,
              provider: tab.provider || undefined,
            };
          });

          setTabs(processedTabs);
        }
      }
    } catch (error) {
      console.error(
        `[useZenTabConnection] ❌ Error processing message:`,
        error,
        `Message:`,
        message
      );
    }
  };

  return { tabs, handleMessage };
};
