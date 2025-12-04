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

  // Monitor tabs state changes
  useEffect(() => {
    // Tabs state changed
  }, [tabs]);

  const handleMessage = (message: any) => {
    try {
      if (message.type === "focusedTabsUpdate") {
        if (message.data) {
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
      // Error processing message
    }
  };

  return { tabs, handleMessage };
};
