import React, { useEffect, useState } from "react";
import MessageInput from "@/components/MessageInput";
import WelcomeUI from "../chat/components/WelcomeUI";
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
    extensionService.postMessage({
      command: "getHistory",
      requestId: `home-enforce-${Date.now()}`,
    });
  }, []);

  const folderPath = (window as any).__zenWorkspaceFolderPath as
    | string
    | null
    | undefined;

  const [currentModel, setCurrentModel] = useState<any>(null);
  const [currentAccount, setCurrentAccount] = useState<any>(null);
  const [message, setMessage] = useState(initialValue || "");
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  const handleSend = (model: any, account: any) => {
    if (message.trim()) {
      onSendMessage(message, [], model, account);
      setMessage("");
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
  };

  const handleKeyDown = (_e: React.KeyboardEvent<HTMLTextAreaElement>) => {};
  const handlePaste = (_e: React.ClipboardEvent<HTMLTextAreaElement>) => {};
  const handleDragOver = (_e: React.DragEvent) => {};
  const handleDrop = (_e: React.DragEvent) => {};
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
