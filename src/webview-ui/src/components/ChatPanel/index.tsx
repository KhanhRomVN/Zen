import React from "react";
import ChatHeader from "./ChatHeader";
import ChatInput from "./ChatInput";

const ChatPanel: React.FC = () => {
  return (
    <div className="chat-panel">
      <ChatHeader />
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          paddingBottom: "200px",
        }}
      ></div>
      <ChatInput />
    </div>
  );
};

export default ChatPanel;
