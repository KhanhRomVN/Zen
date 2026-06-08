import React, { useEffect, useState } from "react";
import ChatHeader from "../ChatPanel/ChatHeader";
import ChatFooter from "../ChatPanel/ChatFooter";
import WelcomeUI from "./WelcomeUI";
import { TabInfo } from "../../types";
import { extensionService } from "../../services/ExtensionService";

interface HomePanelProps {
  onSendMessage: (
    content: string,
    files: any[],
    model: any,
    account: any,
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
  useEffect(() => {
    // Trigger history limit enforcement on mount
    extensionService.postMessage({ command: "getHistory", requestId: `home-enforce-${Date.now()}` });
  }, []);

  // Read workspace folder path injected by ZenChatViewProvider
  const folderPath = (window as any).__zenWorkspaceFolderPath as string | null | undefined;

  const [currentModel, setCurrentModel] = useState<any>(null);
  const [currentAccount, setCurrentAccount] = useState<any>(null);

  // Debug: log whenever HomePanel's model/account state changes
  useEffect(() => {
    console.log("[Zen][HomePanel] currentModel changed →", currentModel?.id ?? null, "| provider:", currentModel?.providerId ?? null);
  }, [currentModel]);

  useEffect(() => {
    console.log("[Zen][HomePanel] currentAccount changed →", currentAccount?.email ?? null);
  }, [currentAccount]);

  // Dummy tab for Header to verify visual consistency
  const dummyTab: TabInfo = {
    tabId: -1,
    title: "New Chat",
    // type: "chat", // Removed as it is not in TabInfo? Or check definition.
    // Wait, if TabInfo has type, I should keep it. But error says it does not.
    status: "free",
    conversationId: "",
    folderPath: null,
    provider: currentModel?.providerId,
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
        onSendMessage={(content, files, model, account) => {
          // Clear the home draft when message is sent
          console.log("[Zen][HomePanel] onSendMessage fired → model:", model?.id, "| account:", account?.email);
          onSendMessage(content, files || [], model, account);
        }}
        isHistoryMode={false}
        messages={[]} // No messages in HomePanel
        isProcessing={false}
        isStreaming={false}
        currentModel={currentModel}
        setCurrentModel={setCurrentModel}
        currentAccount={currentAccount}
        setCurrentAccount={setCurrentAccount}
        initialValue={initialValue}
        conversationId="home"
        folderPath={folderPath || null}
      />
    </div>
  );
};

export default HomePanel;
