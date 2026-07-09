import React from "react";
import MessageInput from "@/components/MessageInput";
import FilesPreviews from "@/components/MessageInput/FilesPreviews";
import { CONTEXT_COMPRESSION_THRESHOLD } from "../constants/constants";

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
  shouldShowCompressionButton?: boolean;
  onTriggerCompression?: () => void;
  gitStatus?: { items?: any[]; branch?: string } | null;
  onOpenGitStatus?: () => void;
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
  shouldShowCompressionButton = false,
  onTriggerCompression,
  gitStatus,
  onOpenGitStatus,
}) => {
  // Calculate file changes from conversation messages
  const conversationFileStats = React.useMemo(() => {
    console.log('[DiffSummaryBar Debug] Total messages:', messages.length);
    const fileChanges = new Map<string, { additions: number; deletions: number }>();
    
    messages.forEach((msg, idx) => {
      console.log(`[DiffSummaryBar Debug] Message ${idx}:`, {
        role: msg.role,
        contentPreview: msg.content?.substring(0, 200),
      });
      
      if (msg.role === 'assistant' && msg.content) {
        // Parse tool actions from message content - new format: <write_to_file>, <str_replace>, etc.
        
        // Match write_to_file: <write_to_file><file_path>...</file_path><content>...</content></write_to_file>
        const writeMatches = msg.content.matchAll(/<write_to_file>\s*<file_path>([^<]+)<\/file_path>\s*<content>([\s\S]*?)<\/content>\s*<\/write_to_file>/g);
        
        let matchCount = 0;
        for (const match of writeMatches) {
          matchCount++;
          const filePath = match[1];
          const content = match[2];
          
          console.log(`[DiffSummaryBar Debug] Found write_to_file match ${matchCount} in message ${idx}:`, { filePath });
          
          if (filePath) {
            if (!fileChanges.has(filePath)) {
              fileChanges.set(filePath, { additions: 0, deletions: 0 });
            }
            
            const stats = fileChanges.get(filePath)!;
            const lines = content.split('\n').length;
            stats.additions += lines;
            console.log(`[DiffSummaryBar Debug] Added ${lines} lines to ${filePath}`);
          }
        }
        
        // Match str_replace: <str_replace><file_path>...</file_path><old_str>...</old_str><new_str>...</new_str></str_replace>
        const replaceMatches = msg.content.matchAll(/<str_replace>\s*<file_path>([^<]+)<\/file_path>\s*<old_str>([\s\S]*?)<\/old_str>\s*<new_str>([\s\S]*?)<\/new_str>\s*<\/str_replace>/g);
        
        for (const match of replaceMatches) {
          matchCount++;
          const filePath = match[1];
          const oldStr = match[2];
          const newStr = match[3];
          
          console.log(`[DiffSummaryBar Debug] Found str_replace match ${matchCount} in message ${idx}:`, { filePath });
          
          if (filePath) {
            if (!fileChanges.has(filePath)) {
              fileChanges.set(filePath, { additions: 0, deletions: 0 });
            }
            
            const stats = fileChanges.get(filePath)!;
            const oldLines = oldStr.split('\n').length;
            const newLines = newStr.split('\n').length;
            
            stats.deletions += oldLines;
            stats.additions += newLines;
            
            console.log(`[DiffSummaryBar Debug] Replaced in ${filePath}: -${oldLines} +${newLines}`);
          }
        }
        
        if (matchCount === 0) {
          console.log(`[DiffSummaryBar Debug] No tool matches found in message ${idx}`);
        }
      }
    });
    
    const totalFiles = fileChanges.size;
    const totalAdditions = Array.from(fileChanges.values()).reduce((sum, stat) => sum + stat.additions, 0);
    const totalDeletions = Array.from(fileChanges.values()).reduce((sum, stat) => sum + stat.deletions, 0);
    
    console.log('[DiffSummaryBar Debug] Final stats:', {
      totalFiles,
      totalAdditions,
      totalDeletions,
      fileChanges: Array.from(fileChanges.entries()),
    });
    
    return {
      totalFiles,
      totalAdditions,
      totalDeletions,
    };
  }, [messages]);

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
        overflow: "visible",
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
          showCompressButton={shouldShowCompressionButton}
          onCompress={onTriggerCompression}
          gitStatus={{
            items: Array.from({ length: conversationFileStats.totalFiles }, (_, i) => ({
              path: `file-${i}`,
              additions: 0,
              deletions: 0,
            })),
          }}
          conversationFileStats={conversationFileStats}
          onOpenGitStatus={onOpenGitStatus}
        />
      </div>
    </div>
  );
};

export default ChatFooter;