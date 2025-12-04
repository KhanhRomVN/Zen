import React from "react";
import ChatHeader from "./ChatHeader";
import ChatBody from "./ChatBody";
import ChatFooter from "./ChatFooter";

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

interface ChatPanelProps {
  selectedTab: TabInfo;
  onBack: () => void;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ selectedTab, onBack }) => {
  return (
    <div className="chat-panel">
      <ChatHeader selectedTab={selectedTab} onBack={onBack} />
      <ChatBody />
      <ChatFooter />
    </div>
  );
};

export default ChatPanel;
