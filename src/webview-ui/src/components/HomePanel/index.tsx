import React, { useState } from "react";
import ChatHeader from "../ChatPanel/ChatHeader";
import ChatFooter from "../ChatPanel/ChatFooter";
import WelcomeUI from "./WelcomeUI";
import { TabInfo } from "../../types";

interface HomePanelProps {
  onSendMessage: (
    content: string,
    files: any[],
    model: any,
    account: any,
    thinking?: boolean,
  ) => void;
  onLoadConversation: (
    conversationId: string,
    tabId: number,
    folderPath: string | null,
  ) => void;
  initialValue?: string;
}

const HomePanel: React.FC<HomePanelProps> = ({
  onSendMessage,
  onLoadConversation,
  initialValue,
}) => {
  const [currentModel, setCurrentModel] = useState<any>(null);
  const [currentAccount, setCurrentAccount] = useState<any>(null);
  const [selectedQuickModel, setSelectedQuickModel] = useState<any>(null);

  // Dummy tab for Header to verify visual consistency
  const dummyTab: TabInfo = {
    tabId: -1,
    title: "New Chat",
    // type: "chat", // Removed as it is not in TabInfo? Or check definition.
    // Wait, if TabInfo has type, I should keep it. But error says it does not.
    status: "free",
    conversationId: "",
    folderPath: null,
    provider: selectedQuickModel?.providerId || currentModel?.providerId,
    containerName: "Home",
    canAccept: true,
    requestCount: 0,
  };

  return (
    <div
      className="home-panel"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        backgroundColor: "var(--primary-bg)",
      }}
    >
      {/* ChatHeader removed as per user request */}
      <div
        style={{
          flex: 1,
          overflow: "auto",
          backgroundColor: "var(--secondary-bg)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <WelcomeUI onLoadConversation={onLoadConversation} />
      </div>
      <ChatFooter
        onSendMessage={(
          content,
          files,
          model,
          account,
          skipFirstRequestLogic,
          actionIds,
          uiHidden,
          thinking,
        ) => {
          onSendMessage(content, files || [], model, account, thinking);
        }}
        isHistoryMode={false}
        messages={[]} // No messages in HomePanel
        executionState={{ total: 0, completed: 0, status: "idle" }}
        isProcessing={false}
        isStreaming={false}
        currentModel={currentModel}
        setCurrentModel={setCurrentModel}
        currentAccount={currentAccount}
        setCurrentAccount={setCurrentAccount}
        selectedQuickModel={selectedQuickModel}
        onQuickModelSelect={setSelectedQuickModel}
        initialValue={initialValue}
      />
    </div>
  );
};

export default HomePanel;
