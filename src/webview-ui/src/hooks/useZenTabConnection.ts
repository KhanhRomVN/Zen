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
    console.log("[useZenTabConnection useEffect] Tabs state changed!");
    console.log("[useZenTabConnection useEffect] New tabs count:", tabs.length);
    console.log(
      "[useZenTabConnection useEffect] New tabs data:",
      JSON.stringify(tabs)
    );
  }, [tabs]);

  const handleMessage = (message: any) => {
    console.log(
      "[useZenTabConnection handleMessage] START - Received message:",
      JSON.stringify(message)
    );
    console.log(
      "[useZenTabConnection handleMessage] Message type:",
      message.type
    );
    console.log(
      "[useZenTabConnection handleMessage] Message has data?",
      !!message.data
    );
    console.log(
      "[useZenTabConnection handleMessage] Current tabs state before update:",
      JSON.stringify(tabs)
    );
    console.log(
      "[useZenTabConnection handleMessage] Current tabs length:",
      tabs.length
    );

    try {
      console.log("[useZenTabConnection handleMessage] Entering try block");

      if (message.type === "focusedTabsUpdate") {
        console.log(
          "[useZenTabConnection handleMessage] Message type is focusedTabsUpdate"
        );

        if (message.data) {
          console.log(
            "[useZenTabConnection handleMessage] Message has data, processing..."
          );
          console.log(
            "[useZenTabConnection handleMessage] Raw message.data:",
            JSON.stringify(message.data)
          );
          console.log(
            "[useZenTabConnection handleMessage] message.data is Array?",
            Array.isArray(message.data)
          );
          console.log(
            "[useZenTabConnection handleMessage] message.data length:",
            message.data.length
          );
          console.log(
            "[useZenTabConnection handleMessage] Previous tabs count:",
            tabs.length
          );

          // Xử lý data có thể thiếu field, thêm giá trị mặc định
          console.log(
            "[useZenTabConnection handleMessage] Starting to process tabs..."
          );
          const processedTabs = message.data.map((tab: any, index: number) => {
            console.log(
              `[useZenTabConnection handleMessage] Processing tab ${index}:`,
              JSON.stringify(tab)
            );
            const processed = {
              tabId: tab.tabId || 0,
              containerName: tab.containerName || "Unknown",
              title: tab.title || "No Title",
              url: tab.url || "",
              status: tab.status || "free",
              canAccept: tab.canAccept !== undefined ? tab.canAccept : true,
              requestCount: tab.requestCount || 0,
              folderPath: tab.folderPath || null,
            };
            console.log(
              `[useZenTabConnection handleMessage] Processed tab ${index}:`,
              JSON.stringify(processed)
            );
            return processed;
          });

          console.log(
            "[useZenTabConnection handleMessage] All tabs processed:",
            JSON.stringify(processedTabs)
          );
          console.log(
            "[useZenTabConnection handleMessage] Processed tabs count:",
            processedTabs.length
          );
          console.log(
            "[useZenTabConnection handleMessage] Calling setTabs with:",
            processedTabs
          );

          setTabs(processedTabs);

          console.log(
            "[useZenTabConnection handleMessage] setTabs called successfully"
          );

          // Log sau khi set state (React batch updates)
          setTimeout(() => {
            console.log(
              "[useZenTabConnection handleMessage] Tabs after update (in setTimeout):",
              processedTabs
            );
            console.log(
              "[useZenTabConnection handleMessage] Tabs length after update:",
              processedTabs.length
            );
          }, 0);
        } else {
          console.warn(
            "[useZenTabConnection handleMessage] Message type is focusedTabsUpdate but data is missing/null/undefined"
          );
          console.log(
            "[useZenTabConnection handleMessage] message.data value:",
            message.data
          );
        }
      } else {
        console.log(
          "[useZenTabConnection handleMessage] Message type is NOT focusedTabsUpdate, ignoring"
        );
        console.log(
          "[useZenTabConnection handleMessage] Actual type:",
          message.type
        );
      }

      console.log(
        "[useZenTabConnection handleMessage] END - Try block completed successfully"
      );
    } catch (error) {
      console.error(
        "[useZenTabConnection handleMessage] ERROR in catch block:",
        error
      );
      console.error(
        "[useZenTabConnection handleMessage] Error stack:",
        error instanceof Error ? error.stack : "No stack trace"
      );
      console.error(
        "[useZenTabConnection handleMessage] Message that caused error:",
        JSON.stringify(message)
      );
    }
  };

  return { tabs, handleMessage };
};
