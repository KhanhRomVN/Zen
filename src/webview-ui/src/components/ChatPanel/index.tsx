import React, { useState, useEffect } from "react";
import ChatHeader from "./ChatHeader";
import ChatInput from "./ChatInput";
import TabList from "./TabList";
import { useModels } from "../../hooks/useModels";
import { useZenTabConnection } from "../../hooks/useZenTabConnection";

const ChatPanel: React.FC = () => {
  const { selectedModel } = useModels();
  const [wsConnected, setWsConnected] = useState(false);

  console.log("[ChatPanel] Before useZenTabConnection hook call");
  const { tabs, handleMessage } = useZenTabConnection();
  console.log(
    "[ChatPanel] After useZenTabConnection hook call, tabs:",
    tabs,
    "handleMessage exists:",
    !!handleMessage
  );

  // Hiển thị TabList khi WebSocket đã connected VÀ có tabs
  const shouldShowTabList = wsConnected && tabs.length > 0;

  // Debug logs
  useEffect(() => {
    console.log("[ChatPanel useEffect] wsConnected:", wsConnected);
    console.log("[ChatPanel useEffect] selectedModel:", selectedModel);
    console.log("[ChatPanel useEffect] shouldShowTabList:", shouldShowTabList);
    console.log("[ChatPanel useEffect] tabs count:", tabs.length);
    console.log("[ChatPanel useEffect] tabs data:", JSON.stringify(tabs));
  }, [wsConnected, selectedModel, shouldShowTabList, tabs]);

  // Log khi handleMessage được gọi
  const wrappedHandleMessage = React.useCallback(
    (data: any) => {
      console.log(
        "[ChatPanel wrappedHandleMessage] Received data:",
        JSON.stringify(data)
      );
      handleMessage(data);
      console.log("[ChatPanel wrappedHandleMessage] After handleMessage call");
    },
    [handleMessage]
  );

  return (
    <div className="chat-panel">
      <ChatHeader />
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          paddingBottom: "200px",
        }}
      >
        {shouldShowTabList && <TabList tabs={tabs} />}
      </div>
      <ChatInput
        onWsConnectedChange={setWsConnected}
        onWsMessage={wrappedHandleMessage}
      />
    </div>
  );
};

export default ChatPanel;
