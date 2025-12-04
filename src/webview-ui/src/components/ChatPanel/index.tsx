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
