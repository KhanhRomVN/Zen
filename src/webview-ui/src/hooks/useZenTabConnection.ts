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
    console.log(`[useZenTabConnection] 📥 FULL MESSAGE DETAILS:`, {
      type: message.type,
      data: message.data,
      dataType: typeof message.data,
      isArray: Array.isArray(message.data),
      length: Array.isArray(message.data) ? message.data.length : "N/A",
      timestamp: message.timestamp,
      currentTabsCount: tabs.length,
    });

    try {
      console.log(`[useZenTabConnection] 📥 Processing message:`, {
        type: message.type,
        dataLength: Array.isArray(message.data) ? message.data.length : "N/A",
        timestamp: message.timestamp,
        currentTabsCount: tabs.length,
      });

      // 🆕 CRITICAL: Ignore old messages based on timestamp
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
        console.log(
          `[useZenTabConnection] 📅 Updating last message timestamp: ${messageTimestamp}`
        );
        setLastMessageTimestamp(messageTimestamp);
      }

      if (message.type === "focusedTabsUpdate") {
        console.log(`[useZenTabConnection] 🔍 PROCESSING focusedTabsUpdate`);
        console.log(
          `[useZenTabConnection] 📊 Data length: ${
            Array.isArray(message.data) ? message.data.length : "not array"
          }`
        );

        // 🆕 CRITICAL: Explicit handling for disconnect signal (empty array)
        if (Array.isArray(message.data) && message.data.length === 0) {
          console.log(
            `[useZenTabConnection] 🔴 RECEIVED DISCONNECT SIGNAL (empty array)`
          );
          console.log(
            `[useZenTabConnection] 🔄 Clearing tabs (was: ${tabs.length})`
          );
          console.log(
            `[useZenTabConnection] 📊 Before clear: ${tabs.length} tabs`
          );

          // 🆕 FIX: Force state update with callback to avoid stale closure
          setTabs((prevTabs) => {
            if (prevTabs.length > 0) {
              console.log(
                `[useZenTabConnection] 🔄 Clearing ${prevTabs.length} tabs`
              );
            }
            return [];
          });
          return;
        }

        if (message.data && Array.isArray(message.data)) {
          console.log(
            `[useZenTabConnection] ✅ Received ${message.data.length} tabs from ZenTab`
          );
          // Xử lý data có thể thiếu field, thêm giá trị mặc định
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
