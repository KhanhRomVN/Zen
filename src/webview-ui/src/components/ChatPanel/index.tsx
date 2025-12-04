import React, { useState, useEffect } from "react";
import ChatHeader from "./ChatHeader";
import ChatInput from "./ChatInput";
import TabList from "./TabList";
import { useModels } from "../../hooks/useModels";
import { useZenTabConnection } from "../../hooks/useZenTabConnection";

const ChatPanel: React.FC = () => {
  const { selectedModel } = useModels();
  const [wsConnected, setWsConnected] = useState(false);

  const { tabs, handleMessage } = useZenTabConnection();

  // Hiển thị TabList khi WebSocket đã connected VÀ có tabs
  const shouldShowTabList = wsConnected && tabs.length > 0;

  // 🆕 DEBUG: Log state changes và force re-render check
  useEffect(() => {
    console.log(
      `[ChatPanel] 📊 State update: wsConnected=${wsConnected}, tabs.length=${tabs.length}, shouldShowTabList=${shouldShowTabList}`
    );

    // 🆕 CRITICAL: Ensure UI updates when wsConnected changes
    if (!wsConnected) {
      console.log(
        `[ChatPanel] ⚠️ wsConnected=false detected, TabList should be hidden`
      );
    } else if (wsConnected && tabs.length === 0) {
      console.log(
        `[ChatPanel] ⚠️ wsConnected=true but no tabs, waiting for tabs...`
      );
    }
  }, [wsConnected, tabs, shouldShowTabList]);

  const wrappedHandleMessage = React.useCallback(
    (data: any) => {
      handleMessage(data);
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
