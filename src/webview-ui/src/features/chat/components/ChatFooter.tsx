import React from "react";
import MessageInput from "@/components/MessageInput";
import FilesPreviews from "@/components/MessageInput/FilesPreviews";
import { CONTEXT_COMPRESSION_THRESHOLD } from "../constants/constants";
import { parseAIResponse } from "../services/ResponseParser";

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
  handleExternalFileInputChange: (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => void;
  handleFileInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  footerPaddingBottom: string;
  shouldShowCompressionButton?: boolean;
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
  onTriggerCompression?: () => void;
  onRevertConversation?: (messageId: string, timestamp: number) => void;
  autoScrollPaused?: boolean;
  scrollToBottom?: () => void;
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
  gitStatus,
  onOpenGitStatus,
  loadedConversationFileStats,
  onModelSwitch,
  onTriggerCompression,
  onRevertConversation,
  autoScrollPaused = false,
  scrollToBottom,
}) => {
  // 🔍 PERFORMANCE DEBUG
  const renderStartTime = performance.now();
  const renderCountRef = React.useRef(0);
  renderCountRef.current++;

  // Calculate response range - count all assistant responses in the conversation
  const responseRange = React.useMemo(() => {
    // Count all assistant responses
    const assistantResponses = messages.filter((m) => m.role === "assistant");
    const totalResponses = assistantResponses.length;

    if (totalResponses === 0) return null;

    return { start: 1, end: totalResponses };
  }, [messages]);

  // Calculate response ranges per manual user message
  const responseRanges = React.useMemo(() => {
    const computeStart = performance.now();
    const ranges: Array<{
      start: number;
      end: number;
      isCurrent: boolean;
      messageId?: string;
      timestamp?: number;
      fileChanges: Map<
        string,
        {
          additions: number;
          deletions: number;
          toolType?: "write_to_file" | "replace_in_file" | "revert_file";
          content?: string;
          oldContent?: string;
          newContent?: string;
        }
      >;
    }> = [];

    let currentRangeStart = 1;
    let assistantCount = 0;

    messages.forEach((msg, idx) => {
      if (msg.role === "assistant") {
        assistantCount++;
      }

      // Check if this is a manual user message (not auto request)
      if (msg.role === "user") {
        const isManual = !msg.actionIds || msg.actionIds.length === 0;
        if (isManual) {
          // Find the end of this range (last assistant response before next user message or end)
          let rangeEnd = assistantCount;

          // Look ahead to find next manual user message
          for (let i = idx + 1; i < messages.length; i++) {
            if (messages[i].role === "assistant") {
              rangeEnd++;
            } else if (
              messages[i].role === "user" &&
              (!messages[i].actionIds || messages[i].actionIds.length === 0)
            ) {
              break;
            }
          }

          if (rangeEnd >= currentRangeStart) {
            // Calculate file changes for this range
            const fileChanges = new Map<
              string,
              {
                additions: number;
                deletions: number;
                toolType?: "write_to_file" | "replace_in_file" | "revert_file";
                content?: string;
                oldContent?: string;
                newContent?: string;
              }
            >();

            for (let i = 0; i < messages.length; i++) {
              const m = messages[i];
              if (m.role !== "assistant" || !m.content) continue;

              // Count which response number this is
              let responseNum = 0;
              for (let j = 0; j <= i; j++) {
                if (messages[j].role === "assistant") responseNum++;
              }

              // Only include if in current range
              if (responseNum < currentRangeStart || responseNum > rangeEnd)
                continue;

              // Parse file changes from this message
              const writeMatches = m.content.matchAll(
                /<write_to_file[^>]*?>[\s\S]*?<file_path[^>]*?>(.*?)<\/file_path>[\s\S]*?<content[^>]*?>([\s\S]*?)<\/content>[\s\S]*?<\/write_to_file>/gi,
              );

              for (const match of writeMatches) {
                const filePath = match[1]?.trim();
                const content = match[2] || "";

                if (filePath) {
                  if (!fileChanges.has(filePath)) {
                    fileChanges.set(filePath, {
                      additions: 0,
                      deletions: 0,
                      toolType: "write_to_file",
                      content: content,
                    });
                  } else {
                    // Update existing entry
                    const stats = fileChanges.get(filePath)!;
                    stats.toolType = "write_to_file";
                    stats.content = content;
                  }

                  const stats = fileChanges.get(filePath)!;
                  const lines = content.split("\n").length;
                  stats.additions += lines;
                }
              }

              const replaceMatches1 = m.content.matchAll(
                /<replace_in_file[^>]*?>[\s\S]*?<file_path[^>]*?>(.*?)<\/file_path>[\s\S]*?<old_content[^>]*?>([\s\S]*?)<\/old_content>[\s\S]*?<new_content[^>]*?>([\s\S]*?)<\/new_content>[\s\S]*?<\/replace_in_file>/gi,
              );

              for (const match of replaceMatches1) {
                const filePath = match[1]?.trim();
                const oldContent = match[2] || "";
                const newContent = match[3] || "";

                if (filePath) {
                  if (!fileChanges.has(filePath)) {
                    fileChanges.set(filePath, {
                      additions: 0,
                      deletions: 0,
                      toolType: "replace_in_file",
                      oldContent: oldContent,
                      newContent: newContent,
                    });
                  } else {
                    // Update existing entry
                    const stats = fileChanges.get(filePath)!;
                    stats.toolType = "replace_in_file";
                    stats.oldContent = oldContent;
                    stats.newContent = newContent;
                  }

                  const stats = fileChanges.get(filePath)!;
                  const oldLines = oldContent.split("\n").length;
                  const newLines = newContent.split("\n").length;

                  stats.deletions += oldLines;
                  stats.additions += newLines;
                }
              }

              const replaceMatches2 = m.content.matchAll(
                /<replace_in_file[^>]*?>[\s\S]*?<file_path[^>]*?>(.*?)<\/file_path>[\s\S]*?<old_str[^>]*?>([\s\S]*?)<\/old_str>[\s\S]*?<new_str[^>]*?>([\s\S]*?)<\/new_str>[\s\S]*?<\/replace_in_file>/gi,
              );

              for (const match of replaceMatches2) {
                const filePath = match[1]?.trim();
                const oldStr = match[2] || "";
                const newStr = match[3] || "";

                if (filePath) {
                  if (!fileChanges.has(filePath)) {
                    fileChanges.set(filePath, {
                      additions: 0,
                      deletions: 0,
                      toolType: "replace_in_file",
                      oldContent: oldStr,
                      newContent: newStr,
                    });
                  } else {
                    // Update existing entry
                    const stats = fileChanges.get(filePath)!;
                    stats.toolType = "replace_in_file";
                    stats.oldContent = oldStr;
                    stats.newContent = newStr;
                  }

                  const stats = fileChanges.get(filePath)!;
                  const oldLines = oldStr.split("\n").length;
                  const newLines = newStr.split("\n").length;

                  stats.deletions += oldLines;
                  stats.additions += newLines;
                }
              }

              // Match revert_file and SUBTRACT the reverted changes
              const revertMatches = m.content.matchAll(
                /<revert_file[^>]*?>[\s\S]*?<file_path[^>]*?>(.*?)<\/file_path>[\s\S]*?<\/revert_file>/gi,
              );

              for (const match of revertMatches) {
                const filePath = match[1]?.trim();

                if (filePath) {
                  if (fileChanges.has(filePath)) {
                    // If we already have stats for this file in current range,
                    // reverse them (because revert undoes the change)
                    const stats = fileChanges.get(filePath)!;

                    // Mark as revert_file
                    stats.toolType = "revert_file";

                    // Swap additions and deletions (revert reverses the change)
                    const tempAdditions = stats.additions;
                    stats.additions = stats.deletions;
                    stats.deletions = tempAdditions;
                  } else {
                    // File not in current range - create new entry for revert
                    // We don't know exact additions/deletions, so set to 1/1 as placeholder
                    fileChanges.set(filePath, {
                      additions: 1,
                      deletions: 1,
                      toolType: "revert_file",
                    });
                  }
                }
              }
            }

            ranges.push({
              start: currentRangeStart,
              end: rangeEnd,
              isCurrent: false, // Will mark the last one as current later
              messageId: msg.id,
              timestamp: msg.timestamp,
              fileChanges,
            });

            currentRangeStart = rangeEnd + 1;
          }
        }
      }
    });

    // Mark the last range as current
    if (ranges.length > 0) {
      ranges[ranges.length - 1].isCurrent = true;
    }

    // Reverse to show current first
    const reversedRanges = [...ranges].reverse();
    return reversedRanges;
  }, [messages]);

  // Calculate file changes from conversation messages
  const { conversationFileStats, fileChangesMap } = React.useMemo(() => {
    const fileChanges = new Map<
      string,
      {
        additions: number;
        deletions: number;
        toolType?: "write_to_file" | "replace_in_file" | "revert_file";
      }
    >();

    // Count assistant responses for STT
    let assistantResponseCount = 0;

    messages.forEach((msg, idx) => {
      if (msg.role === "assistant" && msg.content) {
        assistantResponseCount++;

        // Match write_to_file: <write_to_file><file_path>...</file_path><content>...</content></write_to_file>
        const writeMatches = msg.content.matchAll(
          /<write_to_file[^>]*?>[\s\S]*?<file_path[^>]*?>(.*?)<\/file_path>[\s\S]*?<content[^>]*?>([\s\S]*?)<\/content>[\s\S]*?<\/write_to_file>/gi,
        );

        for (const match of writeMatches) {
          const filePath = match[1]?.trim();
          const content = match[2] || "";

          if (filePath) {
            if (!fileChanges.has(filePath)) {
              fileChanges.set(filePath, { additions: 0, deletions: 0 });
            }

            const stats = fileChanges.get(filePath)!;
            const lines = content.split("\n").length;
            stats.additions += lines;
          }
        }

        // Match replace_in_file with old_content/new_content
        const replaceMatches1 = msg.content.matchAll(
          /<replace_in_file[^>]*?>[\s\S]*?<file_path[^>]*?>(.*?)<\/file_path>[\s\S]*?<old_content[^>]*?>([\s\S]*?)<\/old_content>[\s\S]*?<new_content[^>]*?>([\s\S]*?)<\/new_content>[\s\S]*?<\/replace_in_file>/gi,
        );

        for (const match of replaceMatches1) {
          const filePath = match[1]?.trim();
          const oldContent = match[2] || "";
          const newContent = match[3] || "";

          if (filePath) {
            if (!fileChanges.has(filePath)) {
              fileChanges.set(filePath, { additions: 0, deletions: 0 });
            }

            const stats = fileChanges.get(filePath)!;
            const oldLines = oldContent.split("\n").length;
            const newLines = newContent.split("\n").length;

            stats.deletions += oldLines;
            stats.additions += newLines;
          }
        }

        // Match replace_in_file with old_str/new_str (legacy format)
        const replaceMatches2 = msg.content.matchAll(
          /<replace_in_file[^>]*?>[\s\S]*?<file_path[^>]*?>(.*?)<\/file_path>[\s\S]*?<old_str[^>]*?>([\s\S]*?)<\/old_str>[\s\S]*?<new_str[^>]*?>([\s\S]*?)<\/new_str>[\s\S]*?<\/replace_in_file>/gi,
        );

        for (const match of replaceMatches2) {
          const filePath = match[1]?.trim();
          const oldStr = match[2] || "";
          const newStr = match[3] || "";

          if (filePath) {
            if (!fileChanges.has(filePath)) {
              fileChanges.set(filePath, { additions: 0, deletions: 0 });
            }

            const stats = fileChanges.get(filePath)!;
            const oldLines = oldStr.split("\n").length;
            const newLines = newStr.split("\n").length;

            stats.deletions += oldLines;
            stats.additions += newLines;
          }
        }

        // Match revert_file and SUBTRACT the reverted changes
        const revertMatches = msg.content.matchAll(
          /<revert_file[^>]*?>[\s\S]*?<file_path[^>]*?>(.*?)<\/file_path>[\s\S]*?<\/revert_file>/gi,
        );

        for (const match of revertMatches) {
          const filePath = match[1]?.trim();

          if (filePath && fileChanges.has(filePath)) {
            // If we already have stats for this file, SUBTRACT them (revert cancels out the change)
            const stats = fileChanges.get(filePath)!;

            // Mark as revert_file
            stats.toolType = "revert_file";

            // SUBTRACT the stats (revert cancels the original change)
            // If original was +5 -3, after revert should be +0 -0
            stats.additions = 0;
            stats.deletions = 0;
          }
        }
      }
    });

    // Use loaded stats if available, otherwise calculate
    const totalFiles =
      loadedConversationFileStats?.totalFiles ?? fileChanges.size;
    const totalAdditions =
      loadedConversationFileStats?.totalAdditions ??
      Array.from(fileChanges.values()).reduce(
        (sum, stat) => sum + stat.additions,
        0,
      );
    const totalDeletions =
      loadedConversationFileStats?.totalDeletions ??
      Array.from(fileChanges.values()).reduce(
        (sum, stat) => sum + stat.deletions,
        0,
      );

    return {
      conversationFileStats: {
        totalFiles,
        totalAdditions,
        totalDeletions,
        responseNumber: assistantResponseCount,
      },
      fileChangesMap: fileChanges,
    };
  }, [messages, loadedConversationFileStats]);

  // 🔍 Track render performance
  React.useEffect(() => {
    const renderTime = performance.now() - renderStartTime;
    if (renderTime > 16) {
      console.warn(`[ChatFooter] ⚠️ Slow render: ${renderTime.toFixed(2)}ms`);
    }
  });

  // Prepare data for review drawer
  const fileChangesList = React.useMemo(() => {
    return Array.from(fileChangesMap.entries()).map(
      ([path, stats]: [string, { additions: number; deletions: number }]) => ({
        path,
        additions: stats.additions,
        deletions: stats.deletions,
      }),
    );
  }, [fileChangesMap]);

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
          gitStatus={{
            items: Array.from(
              { length: conversationFileStats.totalFiles },
              (_, i) => ({
                path: `file-${i}`,
                additions: 0,
                deletions: 0,
              }),
            ),
          }}
          conversationFileStats={conversationFileStats}
          onOpenGitStatus={onOpenGitStatus}
          onReviewClick={() => {}}
          responseRange={responseRange}
          responseRanges={responseRanges}
          onRevertConversation={onRevertConversation}
          onModelSwitch={onModelSwitch}
          autoScrollPaused={autoScrollPaused}
          scrollToBottom={scrollToBottom}
        />
      </div>
    </div>
  );
};

// 🚀 PERF: Wrap with React.memo to prevent re-renders when parent ChatPanel re-renders
// Custom comparator checks only props that actually change across renders
export default React.memo(ChatFooter, (prevProps, nextProps) => {
  // Quick check: if any of these primitives changed, re-render
  if (prevProps.message !== nextProps.message) return false;
  if (prevProps.isProcessing !== nextProps.isProcessing) return false;
  if (prevProps.isStreaming !== nextProps.isStreaming) return false;
  if (prevProps.isHistoryMode !== nextProps.isHistoryMode) return false;
  if (prevProps.showChangesDropdown !== nextProps.showChangesDropdown)
    return false;
  if (prevProps.hasProjectContext !== nextProps.hasProjectContext) return false;
  if (prevProps.folderPath !== nextProps.folderPath) return false;
  if (prevProps.isConversationStarted !== nextProps.isConversationStarted)
    return false;
  if (prevProps.showBrowserWarning !== nextProps.showBrowserWarning)
    return false;
  if (prevProps.isLaunchingBrowser !== nextProps.isLaunchingBrowser)
    return false;
  if (prevProps.gitLoading !== nextProps.gitLoading) return false;
  if (prevProps.isGitStatusVisible !== nextProps.isGitStatusVisible)
    return false;
  if (prevProps.footerPaddingBottom !== nextProps.footerPaddingBottom)
    return false;
  if (
    prevProps.shouldShowCompressionButton !==
    nextProps.shouldShowCompressionButton
  )
    return false;
  if (prevProps.autoScrollPaused !== nextProps.autoScrollPaused) return false;

  // Messages: only re-render if length changed (content changes are handled by child memo)
  if (prevProps.messages !== nextProps.messages) {
    if (prevProps.messages.length !== nextProps.messages.length) return false;
    // Same-length array but different reference — check last message
    const prevLast = prevProps.messages[prevProps.messages.length - 1];
    const nextLast = nextProps.messages[nextProps.messages.length - 1];
    if (prevLast !== nextLast) return false;
  }

  // Arrays: reference comparison
  if (prevProps.uploadedFiles !== nextProps.uploadedFiles) return false;
  if (prevProps.attachedItems !== nextProps.attachedItems) return false;

  // Objects: reference comparison
  if (prevProps.currentModel !== nextProps.currentModel) return false;
  if (prevProps.currentAccount !== nextProps.currentAccount) return false;
  if (prevProps.gitStatus !== nextProps.gitStatus) return false;
  if (
    prevProps.loadedConversationFileStats !==
    nextProps.loadedConversationFileStats
  )
    return false;

  // Function props: reference comparison (should be stable after useTextareaHandlers ref fix)
  if (prevProps.handleTextareaChange !== nextProps.handleTextareaChange)
    return false;
  if (prevProps.handleKeyDown !== nextProps.handleKeyDown) return false;
  if (prevProps.handleSend !== nextProps.handleSend) return false;
  if (prevProps.handlePaste !== nextProps.handlePaste) return false;
  if (prevProps.handleDragOver !== nextProps.handleDragOver) return false;
  if (prevProps.handleDrop !== nextProps.handleDrop) return false;
  if (prevProps.onStopGeneration !== nextProps.onStopGeneration) return false;
  if (prevProps.onModelSwitch !== nextProps.onModelSwitch) return false;
  if (prevProps.onRevertConversation !== nextProps.onRevertConversation)
    return false;
  if (prevProps.scrollToBottom !== nextProps.scrollToBottom) return false;

  // All checks passed — skip re-render
  return true;
});
