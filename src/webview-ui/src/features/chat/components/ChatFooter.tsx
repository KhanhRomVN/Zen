import React from "react";
import MessageInput from "@/components/MessageInput";
import FilesPreviews from "@/components/MessageInput/FilesPreviews";

interface ChatFooterProps {
  message: string;
  setMessage: React.Dispatch<React.SetStateAction<string>>;
  isHistoryMode: boolean;
  uploadedFiles: any[];
  attachedItems: any[];
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  handleTextareaChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  handlePaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => void;
  setShowAtMenu: (value: boolean) => void;
  handleFileSelect: () => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onOpenProjectStructure: () => void;
  showChangesDropdown: boolean;
  setShowChangesDropdown: (value: boolean) => void;
  messages: any[];
  handleSend: (model: any, account: any) => void;
  hasProjectContext: boolean;
  onOpenProjectContext: () => void;
  folderPath: string | null;
  isConversationStarted: boolean;
  currentModel: any;
  setCurrentModel: (model: any) => void;
  currentAccount: any;
  setCurrentAccount: (account: any) => void;
  isProcessing: boolean;
  isStreaming: boolean;
  onStopGeneration: () => void;
  showBrowserWarning: boolean;
  isLaunchingBrowser: boolean;
  onLaunchBrowserSession: () => void;
  onGitPullRequest: () => void;
  gitLoading: boolean;
  isGitStatusVisible?: boolean;
  removeAttachedItem: (id: string) => void;
  onOpenImage: (file: any) => void;
  removeFile: (id: string) => void;
  externalFileInputRef: React.RefObject<HTMLInputElement>;
  handleExternalFileInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleFileInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  footerPaddingBottom: string;
}

const ChatFooter: React.FC<ChatFooterProps> = ({
  message,
  setMessage,
  isHistoryMode,
  uploadedFiles,
  attachedItems,
  textareaRef,
  handleTextareaChange,
  handleKeyDown,
  handlePaste,
  handleDragOver,
  handleDrop,
  setShowAtMenu,
  handleFileSelect,
  fileInputRef,
  onOpenProjectStructure,
  showChangesDropdown,
  setShowChangesDropdown,
  messages,
  handleSend,
  hasProjectContext,
  onOpenProjectContext,
  folderPath,
  isConversationStarted,
  currentModel,
  setCurrentModel,
  currentAccount,
  setCurrentAccount,
  isProcessing,
  isStreaming,
  onStopGeneration,
  showBrowserWarning,
  isLaunchingBrowser,
  onLaunchBrowserSession,
  onGitPullRequest,
  gitLoading,
  isGitStatusVisible,
  removeAttachedItem,
  onOpenImage,
  removeFile,
  externalFileInputRef,
  handleExternalFileInputChange,
  handleFileInputChange,
  footerPaddingBottom,
}) => {
  return (
    <div
      id="chat-footer-container"
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        display: "flex",
        flexDirection: "column",
        width: "100%",
        backgroundColor: "var(--secondary-bg)",
        zIndex: 100,
        transition: "bottom 0.2s ease",
        paddingBottom: 0,
        overflow: "hidden",
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: "none" }}
        onChange={handleFileInputChange}
        accept="image/*,text/*"
      />
      <input
        ref={externalFileInputRef}
        type="file"
        multiple
        style={{ display: "none" }}
        onChange={handleExternalFileInputChange}
      />

      <FilesPreviews
        uploadedFiles={uploadedFiles}
        attachedItems={attachedItems}
        onRemoveFile={removeFile}
        onRemoveAttachedItem={removeAttachedItem}
        onOpenImage={onOpenImage}
        onAttachedItemClick={(item) => {
          const vscodeApi = (window as any).vscodeApi;
          if (!vscodeApi) return;
          if (item.type === "file") {
            vscodeApi.postMessage({
              command: "openWorkspaceFile",
              path: item.path,
            });
          } else if (item.type === "folder") {
            vscodeApi.postMessage({
              command: "openWorkspaceFolder",
              path: item.path,
            });
          } else if (item.type === ("terminal" as any)) {
            vscodeApi.postMessage({
              command: "focusTerminal",
              terminalId: item.path,
            });
          }
        }}
      />

      <div style={{ position: "relative" }}>
        <MessageInput
          message={message}
          setMessage={setMessage}
          isHistoryMode={isHistoryMode}
          uploadedFiles={uploadedFiles}
          textareaRef={textareaRef}
          handleTextareaChange={handleTextareaChange}
          handleKeyDown={handleKeyDown}
          handlePaste={handlePaste}
          handleDragOver={handleDragOver}
          handleDrop={handleDrop}
          setShowAtMenu={setShowAtMenu}
          handleFileSelect={handleFileSelect}
          fileInputRef={fileInputRef}
          onOpenProjectStructure={onOpenProjectStructure}
          showChangesDropdown={showChangesDropdown}
          setShowChangesDropdown={setShowChangesDropdown}
          messages={messages}
          handleSend={handleSend}
          hasProjectContext={hasProjectContext}
          onOpenProjectContext={onOpenProjectContext}
          folderPath={folderPath}
          isConversationStarted={isConversationStarted}
          currentModel={currentModel}
          setCurrentModel={setCurrentModel}
          currentAccount={currentAccount}
          setCurrentAccount={setCurrentAccount}
          isProcessing={isProcessing}
          isStreaming={isStreaming}
          onStopGeneration={onStopGeneration}
          showBrowserWarning={showBrowserWarning}
          isLaunchingBrowser={isLaunchingBrowser}
          onLaunchBrowserSession={onLaunchBrowserSession}
          onGitPullRequest={onGitPullRequest}
          isGitLoading={gitLoading}
          isGitStatusVisible={isGitStatusVisible}
        />
      </div>
    </div>
  );
};

export default ChatFooter;