import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { useSettings } from "../../context/SettingsContext";
import { useBackendConnection } from "../../context/BackendConnectionContext";

// Core chat hooks
import { useChatLLM } from "./hooks/llm/useChatLLM";
import { useToolExecution } from "./hooks/tools/useToolExecution";
import { useWorkspaceData } from "./hooks/workspace/useWorkspaceData";
import { useGitOperations } from "./hooks/workspace/useGitOperations";
import { useConversationRestore } from "./hooks/conversation/useConversationRestore";
import { useFileHandling } from "../../hooks/useFileHandling";

import { useBrowserSession } from "./hooks/llm/useBrowserSession";
import { useDraftManagement } from "./hooks/conversation/useDraftManagement";
import { useModelAccount } from "../../hooks/useModelAccount";

// New modular hooks
import { useApiConfiguration } from "./hooks/api/useApiConfiguration";
import { useUIState } from "./hooks/ui/useUIState";
import { useMessageParsing } from "./hooks/messages/useMessageParsing";
import { useContextUsage } from "./hooks/messages/useContextUsage";
import { useFileStats } from "./hooks/messages/useFileStats";
import { useMessageHandlers } from "./hooks/handlers/useMessageHandlers";
import { useTextareaHandlers } from "./hooks/handlers/useTextareaHandlers";
import { useExternalMessages } from "./hooks/events/useExternalMessages";
import { useConversationCache } from "./hooks/cache/useConversationCache";
import { useConversationPersistence } from "./hooks/persistence/useConversationPersistence";

// Types
import { ChatSession } from "./types/chat";

// Components
import ChatHeader from "./components/ChatHeader";
import ChatBody from "./components/ChatBody";
import ChatFooter from "./components/ChatFooter";

interface ChatPanelProps {
  currentChat: ChatSession | null;
  onBack: (contentToReturn?: string) => void;
  onLoadConversation?: (
    conversationId: string,
    sessionId: number,
    folderPath: string | null,
  ) => void;
  initialMessageData?: {
    content: string;
    files: any[];
    model: any;
    account: any;
  } | null;
  onClearInitialData?: () => void;
}

const ChatPanel: React.FC<ChatPanelProps> = ({
  currentChat,
  onBack,
  onLoadConversation,
  initialMessageData,
  onClearInitialData,
}) => {
  // Track render count for performance monitoring
  const renderCountRef = useRef(0);
  renderCountRef.current++;

  // --- API & Configuration ---
  const { apiUrl, setApiUrl, isApiUrlReady, providers, setProviders } =
    useApiConfiguration();

  // Track chat panel renders - WITH DETAILED TRACKING
  const chatRenderCountRef = useRef(0);
  const lastRenderTimeRef = useRef(Date.now());
  const renderTimingsRef = useRef<number[]>([]);
  const renderStartTime = performance.now();

  chatRenderCountRef.current += 1;
  const now = Date.now();
  const timeSinceLastRender = now - lastRenderTimeRef.current;
  lastRenderTimeRef.current = now;
  renderTimingsRef.current.push(timeSinceLastRender);

  // Keep only last 10 timings
  if (renderTimingsRef.current.length > 10) {
    renderTimingsRef.current.shift();
  }

  // --- Model & Account Selection ---
  const { currentModel, setCurrentModel, currentAccount, setCurrentAccount } =
    useModelAccount(currentChat?.folderPath, {
      initialModel: initialMessageData?.model,
      initialAccount: initialMessageData?.account,
    });

  // Refs to always access the latest model/account values inside callbacks
  const currentModelRef = useRef<any>(null);
  const currentAccountRef = useRef<any>(null);
  currentModelRef.current = currentModel;
  currentAccountRef.current = currentAccount;

  const { commitMessageLanguage } = useSettings();

  // --- UI State Management ---
  const {
    isSearchOpen,
    setIsSearchOpen,
    searchQuery,
    setSearchQuery,
    autoScrollPaused,
    setAutoScrollPaused,
    showProjectStructureDrawer,
    setShowProjectStructureDrawer,
    showChangesDropdown,
    setShowChangesDropdown,
    showProjectContextModal,
    setShowProjectContextModal,
    projectContext,
    setProjectContext,
  } = useUIState();

  // --- Refs ---
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mentionDropdownRef = useRef<HTMLDivElement>(null);
  const scrollToBottomRef = useRef<(() => void) | null>(null);
  const hasProcessedInitial = useRef(false);
  const wasPaused = useRef(false);
  const isStoppedRef = useRef(false);

  const { apiUrl: backendApiUrl } = useBackendConnection();

  // Revert state
  const [revertInput, setRevertInput] = useState<{
    value: string;
    nonce: number;
  } | null>(null);
  const revertParentMessageIdRef = useRef<string | null>(null);

  // Loaded conversation file stats from history
  const [loadedConversationFileStats, setLoadedConversationFileStats] =
    useState<{
      totalFiles: number;
      totalAdditions: number;
      totalDeletions: number;
    } | null>(null);

  // Ref to setToolOutputs (will be set after useToolExecution)
  const setToolOutputsRef = useRef<any>(null);

  const {
    messages,
    setMessages,
    messagesRef,
    isProcessing,
    setIsProcessing,
    isStreaming,
    isContinuing,
    currentConversationId,
    setCurrentConversationId,
    currentConversationIdRef,
    sendMessage,
    stopGeneration,
    resetSession,
    setBackendConversationId,
    conversationToolOverrides,
    setConversationToolOverrides,
    handleToolAction,
    handleSelectOption,
  } = useChatLLM({
    apiUrl,
    selectedTab: currentChat,
    onToolRequest: (actions, assistantMessage, isAutoTrigger, actionType) =>
      handleToolRequest(
        actions,
        assistantMessage,
        isAutoTrigger,
        conversationToolOverrides,
        actionType,
      ),
    onMalformedTool: (actionId, toolName, errorMessage, errorCode) => {
      // Delay setState to avoid React "update during render" warning
      setTimeout(() => {
        if (setToolOutputsRef.current) {
          setToolOutputsRef.current((prev: any) => ({
            ...prev,
            [actionId]: {
              output: `${errorCode}: ${errorMessage}`,
              isError: true,
            },
          }));
        }
      }, 0);
    },
  });

  // Track messages and streaming state - kept for potential future use, but removed heavy logging
  // (Previously had debug useEffect here - removed for performance)

  // --- Workspace Data ---
  useWorkspaceData();

  // --- Draft Management ---
  const {
    message,
    setMessage,
    storage,
    clearDraft,
    handleKeyDown: handleDraftKeyDown,
    undoStackRef,
    undoIndexRef,
  } = useDraftManagement(currentConversationId, revertInput);

  // --- Attached Items ---
  const [attachedItems, setAttachedItems] = React.useState<any[]>([]);

  const removeAttachedItem = useCallback((itemId: string) => {
    setAttachedItems((prev) => prev.filter((item) => item.id !== itemId));
  }, []);

  const clearAttachedItems = useCallback(() => {
    setAttachedItems([]);
  }, []);

  const addAttachedItem = useCallback((item: any) => {
    setAttachedItems((prev) => [...prev, item]);
  }, []);

  // --- File Handling ---
  const {
    uploadedFiles,
    externalFiles,
    invalidExternalFiles,
    fileInputRef,
    externalFileInputRef,
    handlePaste,
    handleFileSelect,
    handleFileInputChange,
    removeFile,
    handleExternalFileSelect,
    handleExternalFileInputChange,
    handleDragOver,
    handleDrop,
    clearFiles,
    clearInvalidExternalFiles,
    addAttachedItemWithCache,
    removeAttachedItemFromCache,
  } = useFileHandling({
    accountId: currentAccount?.id,
    folderPath: currentChat?.folderPath || null,
    onAddAttachedItem: (item) => {
      addAttachedItem(item);
    },
  });

  // --- Browser Session ---
  const {
    isBrowserSessionReady,
    showBrowserWarning,
    isLaunchingBrowser,
    launchBrowserSession,
  } = useBrowserSession(currentModel, currentAccount, backendApiUrl);

  // Wrap removeAttachedItem to also update localStorage cache
  const handleRemoveAttachedItem = useCallback(
    (itemId: string) => {
      removeAttachedItem(itemId);
      removeAttachedItemFromCache(itemId);
    },
    [removeAttachedItem, removeAttachedItemFromCache],
  );

  // --- Wrapped Send Message ---
  const wrappedSendMessage = useCallback(
    async (
      content: string,
      files?: any[],
      model?: any,
      account?: any,
      skipFirstRequestLogic?: boolean,
      actionIds?: string[],
      uiHidden?: boolean,
    ) => {
      if (!skipFirstRequestLogic) {
        isStoppedRef.current = false;
      }
      setIsRestored(false);

      // Auto-scroll to bottom when sending new message
      if (scrollToBottomRef.current) {
        scrollToBottomRef.current();
      }

      const parentMsgId = revertParentMessageIdRef.current || undefined;
      revertParentMessageIdRef.current = null;
      if (parentMsgId && currentConversationId) {
        sessionStorage.removeItem(`zen-revert-parent:${currentConversationId}`);
      }
      return sendMessage(
        content,
        files,
        model,
        account,
        skipFirstRequestLogic,
        actionIds,
        uiHidden,
        parentMsgId,
      );
    },
    [sendMessage, currentConversationId],
  );

  // --- Tool Execution ---
  const {
    executionState,
    toolOutputs,
    setToolOutputs,
    terminalStatus,
    handleToolRequest,
    singleLineReviewActions,
    confirmSingleLineAction,
    rejectSingleLineAction,
  } = useToolExecution({
    conversationIdRef: currentConversationIdRef,
    messagesRef: messagesRef,
    isStoppedRef: isStoppedRef,
    sendMessage: (
      content: string,
      files: any[] | undefined,
      model: any,
      account: any,
      skipLogic: boolean | undefined,
      actionIds: string[] | undefined,
      uiHidden: boolean | undefined,
    ) =>
      wrappedSendMessage(
        content,
        files,
        model,
        account,
        skipLogic,
        actionIds,
        uiHidden,
      ),
  });

  // Store setToolOutputs ref for use in useChatLLM callback
  setToolOutputsRef.current = setToolOutputs;

  // --- Git Operations ---
  const {
    gitStatus,
    gitLoading,
    gitError,
    showGitStatusBlock,
    gitCommitMessage,
    gitCommitLoading,
    gitCommitInput,
    setGitCommitInput,
    setShowGitStatusBlock,
    setGitError,
    setGitCommitMessage,
    enrichedModel,
    handleGitPullRequest,
    handleGitConfirm,
    handleGitCancel,
    handleGitRetry,
    handleGitCommit,
    handleGitCommitMessageDetected,
  } = useGitOperations({
    currentModel,
    currentAccount,
    providers,
    commitMessageLanguage,
    currentConversationId,
    wrappedSendMessage,
    setMessages,
    setToolOutputs,
  });

  // --- Conversation Restore ---
  const {
    isLoadingConversation,
    isRestored,
    setIsRestored,
    setIsLoadingConversation,
    handleRevertConversation,
    handleClearConfirmed,
  } = useConversationRestore({
    currentChat,
    currentConversationId,
    currentConversationIdRef,
    messagesRef,
    setMessages,
    setIsProcessing,
    setToolOutputs,
    setBackendConversationId,
    setCurrentConversationId,
    setCurrentModel,
    setCurrentAccount,
    onBack,
    revertParentMessageIdRef,
    setRevertInput,
    setLoadedConversationFileStats,
  });

  // --- Message Parsing (with caching) ---
  const parsedMessages = useMessageParsing(messages, isStreaming);

  // --- Context Usage ---
  const contextUsage = useContextUsage(messages);

  // --- File Stats ---
  const conversationFileStats = useFileStats(
    messages,
    loadedConversationFileStats,
  );

  // --- Current Task Name ---
  const currentTaskName = useMemo(() => {
    for (let i = parsedMessages.length - 1; i >= 0; i--) {
      const msg = parsedMessages[i];
      if (msg.isCancelled) continue;
      if (msg.role === "user") break;
      if (msg.role === "assistant" && msg.parsed.taskName)
        return msg.parsed.taskName;
    }
    return null;
  }, [parsedMessages]);

  // --- Message Handlers ---
  const { handleSend, handleStopGeneration } =
    useMessageHandlers({
      message,
      setMessage,
      uploadedFiles,
      attachedItems,
      invalidExternalFiles,
      currentModelRef,
      currentAccountRef,
      textareaRef,
      clearDraft,
      clearFiles,
      clearAttachedItems,
      clearInvalidExternalFiles,
      undoStackRef,
      undoIndexRef,
      wrappedSendMessage,
      currentConversationId,
      currentChat,
      stopGeneration,
      setIsProcessing,
      setMessages,
      isStoppedRef,
    });

  // --- Textarea Handlers ---
  const { handleTextareaChange, handleKeyDown, handleOpenImage } =
    useTextareaHandlers({
      setMessage,
      handleDraftKeyDown,
    });

  // --- Handle Back to Home ---
  const handleBackToHome = useCallback(
    (summary: string) => {
      onBack(summary);
    },
    [onBack],
  );

  // --- External Messages ---
  useExternalMessages({
    currentChat,
    currentConversationId,
    messages,
    setMessages,
    setProjectContext,
    addAttachedItem,
  });

  const memoizedMessages = useMemo(
    () => messages,
    [messages.length, messages[messages.length - 1]?.content?.length],
  );
  const memoizedCurrentModel = useMemo(
    () => currentModel,
    [currentModel?.id, currentModel?.name],
  );
  const memoizedCurrentAccount = useMemo(
    () => currentAccount,
    [currentAccount?.id, currentAccount?.name],
  );
  const memoizedToolOutputs = useMemo(
    () => toolOutputs,
    [Object.keys(toolOutputs).length],
  );

  const memoizedHandleToolRequest = useCallback(
    (actions: any, msg: any, isAuto?: boolean, type?: any) => {
      handleToolRequest(actions, msg, isAuto, conversationToolOverrides, type);
    },
    [handleToolRequest, conversationToolOverrides],
  );

  const memoizedWrappedSendMessage = useCallback(
    (
      c: string,
      f?: any,
      m?: any,
      a?: any,
      skip?: boolean,
      ids?: string[],
      hidden?: boolean,
    ) => {
      wrappedSendMessage(c, f, m, a, skip, ids, hidden);
    },
    [wrappedSendMessage],
  );

  // --- Conversation Cache ---
  useConversationCache({
    currentConversationId,
    messages: memoizedMessages,
    isStreaming,
    currentModel: memoizedCurrentModel,
    currentAccount: memoizedCurrentAccount,
    toolOutputs: memoizedToolOutputs,
    conversationFileStats,
  });

  // --- Conversation Persistence ---
  useConversationPersistence({
    currentConversationId,
    currentChat,
    messages,
    toolOutputs,
    singleLineReviewActions,
    conversationFileStats,
  });

  // --- Effects ---

  // Reset hasProcessedInitial when new tab/chat starts
  useEffect(() => {
    hasProcessedInitial.current = false;
    resetSession();
    setLoadedConversationFileStats(null);
  }, [currentChat?.sessionId, resetSession]);

  // Sync currentModel/currentAccount from initialMessageData
  useEffect(() => {
    if (initialMessageData?.model) {
      setCurrentModel(initialMessageData.model);
    }
    if (initialMessageData?.account) {
      setCurrentAccount(initialMessageData.account);
    }
  }, [initialMessageData, setCurrentModel, setCurrentAccount]);

  // Process initial message
  useEffect(() => {
    if (initialMessageData && !hasProcessedInitial.current && isApiUrlReady) {
      hasProcessedInitial.current = true;
      const modelToSend = initialMessageData.model ?? null;
      const accountToSend = initialMessageData.account ?? null;
      sendMessage(
        initialMessageData.content,
        initialMessageData.files,
        modelToSend,
        accountToSend,
        false,
        undefined,
        undefined,
      );
      onClearInitialData?.();
    }
  }, [initialMessageData, sendMessage, onClearInitialData, isApiUrlReady]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        240,
      )}px`;
    }
  }, [message]);

  // Listen for Git commit message detection
  const prevGitMessagesLengthRef = useRef(0);
  useEffect(() => {
    // Only run when messages array actually changes (new message added)
    const currentLength = messages.length;
    if (currentLength === prevGitMessagesLengthRef.current) {
      return;
    }
    prevGitMessagesLengthRef.current = currentLength;
    handleGitCommitMessageDetected(messages);
  }, [messages, handleGitCommitMessageDetected]);

  // --- Computed Values ---
  const isHistoryMode = useMemo(() => {
    return !!(currentChat as any)?.conversationId && !currentChat?.canAccept;
  }, [currentChat]);

  const firstRequestMessage = messages.find((m) => m.role === "user");
  const displayedModel = enrichedModel ?? currentModel;
  const totalTokens = contextUsage?.total ?? 0;
  const footerPaddingBottom =
    showBrowserWarning && currentModel?.providerId === "zai-browser"
      ? "20px"
      : "8px";

  // --- Render ---
  return (
    <div
      className="chat-panel"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        backgroundColor: "var(--secondary-bg)",
        color: "var(--vscode-editor-foreground)",
      }}
    >
      {/* ─── ChatHeader ─── */}
      <ChatHeader
        displayedModel={displayedModel}
        currentAccount={currentAccount}
        currentTaskName={currentTaskName}
        contextUsage={contextUsage}
        isSearchOpen={isSearchOpen}
        setIsSearchOpen={setIsSearchOpen}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />

      {/* ─── ChatBody ─── */}
      <ChatBody
        messages={parsedMessages}
        isProcessing={isProcessing}
        isContinuing={isContinuing}
        onSendToolRequest={memoizedHandleToolRequest}
        onSendMessage={memoizedWrappedSendMessage}
        executionState={executionState}
        toolOutputs={toolOutputs}
        terminalStatus={terminalStatus}
        firstRequestMessageId={firstRequestMessage?.id}
        onLoadConversation={onLoadConversation}
        conversationId={currentConversationId}
        onToolAction={handleToolAction}
        onSelectOption={handleSelectOption}
        isRestored={isRestored}
        onContinue={() => setIsRestored(false)}
        hasInitialMessage={!!initialMessageData}
        onRevertConversation={handleRevertConversation}
        onAutoScrollPausedChange={setAutoScrollPaused}
        scrollToBottomRef={scrollToBottomRef}
        singleLineReviewActions={singleLineReviewActions}
        onConfirmSingleLineAction={confirmSingleLineAction}
        onRejectSingleLineAction={rejectSingleLineAction}
        isSearchOpen={isSearchOpen}
        searchQuery={searchQuery}
        onSearchQueryChange={setSearchQuery}
        onCloseSearch={() => {
          setIsSearchOpen(false);
          setSearchQuery("");
        }}
        onGitConfirm={handleGitConfirm}
        onGitCancel={handleGitCancel}
        gitStatusItems={gitStatus?.items || []}
        gitStatusBranch={gitStatus?.branch || ""}
        isGitProcessing={gitCommitLoading}
        isGitStatusVisible={showGitStatusBlock}
        onBackToHome={handleBackToHome}
        isLoadingConversation={isLoadingConversation}
      />

      {/* ─── ChatFooter ─── */}
      {(() => {
        return null;
      })()}
      <ChatFooter
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
        onOpenProjectStructure={() => setShowProjectStructureDrawer(true)}
        showChangesDropdown={showChangesDropdown}
        setShowChangesDropdown={setShowChangesDropdown}
        messages={messages}
        handleSend={handleSend}
        hasProjectContext={!!projectContext}
        onOpenProjectContext={() => setShowProjectContextModal(true)}
        folderPath={currentChat?.folderPath || null}
        isConversationStarted={messages.length > 0 || !!initialMessageData}
        currentModel={enrichedModel ?? currentModel}
        setCurrentModel={setCurrentModel}
        currentAccount={currentAccount}
        setCurrentAccount={setCurrentAccount}
        isProcessing={isProcessing || executionState.status === "running"}
        isStreaming={isStreaming}
        onStopGeneration={handleStopGeneration}
        showBrowserWarning={showBrowserWarning}
        isLaunchingBrowser={isLaunchingBrowser}
        onLaunchBrowserSession={launchBrowserSession}
        onGitPullRequest={handleGitPullRequest}
        gitLoading={gitLoading}
        isGitStatusVisible={showGitStatusBlock}
        removeAttachedItem={handleRemoveAttachedItem}
        onOpenImage={handleOpenImage}
        removeFile={removeFile}
        externalFileInputRef={externalFileInputRef}
        handleExternalFileInputChange={handleExternalFileInputChange}
        handleFileInputChange={handleFileInputChange}
        footerPaddingBottom={footerPaddingBottom}
        gitStatus={gitStatus}
        onOpenGitStatus={() => setShowGitStatusBlock(true)}
        loadedConversationFileStats={loadedConversationFileStats}
        onRevertConversation={handleRevertConversation}
        autoScrollPaused={autoScrollPaused}
        scrollToBottom={scrollToBottomRef.current || undefined}
      />
    </div>
  );
};

// Wrap with React.memo to prevent unnecessary re-renders from parent
export default React.memo(ChatPanel, (prevProps, nextProps) => {
  const sessionIdSame =
    prevProps.currentChat?.sessionId === nextProps.currentChat?.sessionId;
  const folderPathSame =
    prevProps.currentChat?.folderPath === nextProps.currentChat?.folderPath;
  const initialDataSame =
    prevProps.initialMessageData === nextProps.initialMessageData;
  const onBackSame = prevProps.onBack === nextProps.onBack;
  const onLoadConvSame =
    prevProps.onLoadConversation === nextProps.onLoadConversation;
  const onClearSame =
    prevProps.onClearInitialData === nextProps.onClearInitialData;

  return (
    sessionIdSame &&
    folderPathSame &&
    initialDataSame &&
    onBackSame &&
    onLoadConvSame &&
    onClearSame
  );
});
