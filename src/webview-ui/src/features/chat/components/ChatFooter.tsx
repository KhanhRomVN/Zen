/**
 * ------------------------------------------------------------------
 * ChatFooter
 * ------------------------------------------------------------------
 * Thành phần chân trang của giao diện chat, chịu trách nhiệm hiển thị
 * ô nhập tin nhắn (MessageInput) và danh sách file đính kèm (FilesPreviews).
 *
 * Main features:
 * - Hiển thị input area và preview files
 * - Truyền props xuống MessageInput và quản lý trạng thái UI cục bộ
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── React ──
import React from "react";

// ── Components ──
import MessageInput from "@/components/MessageInput";
import FilesPreviews from "@/components/MessageInput/FilesPreviews";

// ─── Interfaces ────────────────────────────────────────────────────────
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
  handleFileSelect: (accept?: string, textOnly?: boolean) => void;
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
  handleExternalFileInputChange: (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => void;
  handleFileInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  footerPaddingBottom: string;
  gitStatus?: { items?: any[]; branch?: string } | null;
  onOpenGitStatus?: () => void;
  loadedConversationFileStats?: {
    totalFiles: number;
    totalAdditions: number;
    totalDeletions: number;
  } | null;
  onModelSwitch?: (
    newModel: any,
    newAccount: any,
    contextData: {
      fileChanges: Array<{
        path: string;
        additions: number;
        deletions: number;
      }>;
      userMessages: Array<{ content: string; responseNumber: number }>;
    },
  ) => void;
  onRevertConversation?: (messageId: string, timestamp: number) => void;
  autoScrollPaused?: boolean;
  scrollToBottom?: () => void;
  /** Gọi khi người dùng chọn (hoặc vừa tạo) 1 rule để gắn vào input. */
  onSelectRule?: (item: any) => void;
  /** Gọi khi xác nhận chọn skill — truyền toàn bộ tập skill mới (thay thế tập cũ). */
  onSelectSkills?: (items: any[]) => void;
  /** View-only: conversation không thể tiếp tục (provider supports_session_cleanup hoặc no-auth) */
  isViewOnly?: boolean;
  /** Tool format cho conversation này */
  conversationToolFormat?: "xml" | "json";
  onConversationToolFormatToggle?: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────
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
  gitStatus,
  onOpenGitStatus,
  loadedConversationFileStats,
  onModelSwitch,
  onRevertConversation,
  autoScrollPaused = false,
  scrollToBottom,
  onSelectRule,
  onSelectSkills,
  isViewOnly = false,
  conversationToolFormat,
  onConversationToolFormatToggle,
}) => {
  // ── Refs ──
  const renderCountRef = React.useRef(0);
  renderCountRef.current++;

  // ── Derived ─
  const responseRange = React.useMemo(() => {
    // Count all assistant responses
    const assistantResponses = messages.filter((m) => m.role === "assistant");
    const totalResponses = assistantResponses.length;

    if (totalResponses === 0) return null;

    return { start: 1, end: totalResponses };
  }, [messages]);

  // ── Render ──
  return (
    <div
      id="chat-footer-container"
      style={{
        display: "flex",
        flexDirection: "column",
        width: "100%",
        backgroundColor: "var(--secondary-bg)",
        zIndex: 100,
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
      />
      <input
        ref={externalFileInputRef}
        type="file"
        multiple
        style={{ display: "none" }}
        onChange={handleExternalFileInputChange}
      />

      <div
        className="chat-footer-inner"
        style={{
          width: "100%",
          maxWidth: 900,
          margin: "0 auto",
          padding: "0 12px",
          boxSizing: "border-box",
        }}
      >
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
                command: "openFile",
                path: item.path,
              });
            } else if (item.type === "text-snippet") {
              // Show text snippet content in a modal or copy to clipboard
              // For now, just log - could open in editor or show preview
            }
          }}
        />

        <div style={{ position: "relative" }}>
          <MessageInput
            isViewOnly={isViewOnly}
            message={message}
            setMessage={setMessage}
            isHistoryMode={isHistoryMode}
            uploadedFiles={uploadedFiles}
            attachedItems={attachedItems}
            textareaRef={textareaRef}
            handleTextareaChange={handleTextareaChange}
            handleKeyDown={handleKeyDown}
            handlePaste={handlePaste}
            handleDragOver={handleDragOver}
            handleDrop={handleDrop}
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
            gitStatus={gitStatus || undefined}
            conversationFileStats={loadedConversationFileStats ?? undefined}
            onOpenGitStatus={onOpenGitStatus}
            onReviewClick={() => {}}
            onRevertConversation={onRevertConversation}
            onModelSwitch={onModelSwitch}
            autoScrollPaused={autoScrollPaused}
            scrollToBottom={scrollToBottom}
            enableViewOnlyMode={true}
            onSelectRule={onSelectRule}
            onSelectSkills={onSelectSkills}
            onRemoveAttachedItem={removeAttachedItem}
            conversationToolFormat={conversationToolFormat}
            onConversationToolFormatToggle={onConversationToolFormatToggle}
          />
        </div>
      </div>
    </div>
  );
};

// 🚀 PERF: Wrap with React.memo to prevent re-renders when parent ChatPanel re-renders
// TEMPORARY: Disable React.memo for debugging
export default ChatFooter;
