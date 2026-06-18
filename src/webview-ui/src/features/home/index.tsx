import React, { useEffect, useState } from "react";
import MessageInput from "@/components/MessageInput";
import WelcomeUI from "./components/WelcomeUI";
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
    extensionService.postMessage({
      command: "getHistory",
      requestId: `home-enforce-${Date.now()}`,
    });
  }, []);

  // Read workspace folder path injected by ZenChatViewProvider
  const folderPath = (window as any).__zenWorkspaceFolderPath as
    | string
    | null
    | undefined;

  const [currentModel, setCurrentModel] = useState<any>(null);
  const [currentAccount, setCurrentAccount] = useState<any>(null);

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

  const [message, setMessage] = useState(initialValue || "");
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const handleSend = (model: any, account: any) => {
    if (message.trim()) {
      onSendMessage(message, [], model, account);
      setMessage("");
    }
  };

  // Placeholder functions for MessageInput props that HomePanel doesn't need
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Enter key is handled by MessageInput itself via handleSend
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {};
  const handleDragOver = (e: React.DragEvent) => {};
  const handleDrop = (e: React.DragEvent) => {};
  const handleFileSelect = () => {};

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
      <MessageInput
        message={message}
        setMessage={setMessage}
        isHistoryMode={false}
        uploadedFiles={[]}
        textareaRef={textareaRef}
        handleTextareaChange={handleTextareaChange}
        handleKeyDown={handleKeyDown}
        handlePaste={handlePaste}
        handleDragOver={handleDragOver}
        handleDrop={handleDrop}
        setShowAtMenu={() => {}}
        handleFileSelect={handleFileSelect}
        onOpenProjectStructure={() => {}}
        showChangesDropdown={false}
        setShowChangesDropdown={() => {}}
        messages={[]}
        handleSend={handleSend}
        hasProjectContext={false}
        onOpenProjectContext={() => {}}
        folderPath={folderPath || null}
        isConversationStarted={false}
        currentModel={currentModel}
        setCurrentModel={setCurrentModel}
        currentAccount={currentAccount}
        setCurrentAccount={setCurrentAccount}
        isProcessing={false}
        isStreaming={false}
      />
    </div>
  );
};

export default HomePanel;
