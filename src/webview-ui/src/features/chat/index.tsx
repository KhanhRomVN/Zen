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
import { useMentionSystem } from "./hooks/ui/useMentionSystem";
import { useBrowserSession } from "./hooks/llm/useBrowserSession";
import { useDraftManagement } from "./hooks/conversation/useDraftManagement";
import { useModelAccount } from "../../hooks/useModelAccount";

// New modular hooks
import { useApiConfiguration } from "./hooks/api/useApiConfiguration";
import { useUIState } from "./hooks/ui/useUIState";
import { useMessageParsing } from "./hooks/messages/useMessageParsing";
import { useContextUsage } from "./hooks/messages/useContextUsage";
import { useFileStats } from "./hooks/messages/useFileStats";
import { useContextCompression } from "./hooks/compression/useContextCompression";
import { useMessageHandlers } from "./hooks/handlers/useMessageHandlers";
import { useTextareaHandlers } from "./hooks/handlers/useTextareaHandlers";
import { useModelSwitch } from "./hooks/handlers/useModelSwitch";
import { useExternalMessages } from "./hooks/events/useExternalMessages";
import { useConversationCache } from "./hooks/cache/useConversationCache";
import { useConversationPersistence } from "./hooks/persistence/useConversationPersistence";

// Types
import { ChatSession } from "./types/chat";
import { Message } from "./types/message";

// Components
import ChatHeader from "./components/ChatHeader";
import ChatBody from "./components/ChatBody";
import ChatFooter from "./components/ChatFooter";
import { ChatErrorBoundary } from "./components/ChatErrorBoundary";

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
  const prevPropsRef = useRef<any>({});
  renderCountRef.current++;

  // DEBUG: Log what caused this render
  useEffect(() => {
    const changedProps: string[] = [];
    const prev = prevPropsRef.current;

    if (prev.currentChat !== currentChat) changedProps.push("currentChat");
    if (prev.onBack !== onBack) changedProps.push("onBack");
    if (prev.onLoadConversation !== onLoadConversation)
      changedProps.push("onLoadConversation");
    if (prev.initialMessageData !== initialMessageData)
      changedProps.push("initialMessageData");
    if (prev.onClearInitialData !== onClearInitialData)
      changedProps.push("onClearInitialData");

    prevPropsRef.current = {
      currentChat,
      onBack,
      onLoadConversation,
      initialMessageData,
      onClearInitialData,
    };
  });

  // DEBUG: Track all state changes that could cause re-renders
  const prevStateRef = useRef<any>({});
  useEffect(() => {
    const prev = prevStateRef.current;
    const changes: string[] = [];

    // Track what changed
    if (prev.apiUrl !== apiUrl) changes.push(`apiUrl`);
    if (prev.isApiUrlReady !== isApiUrlReady) changes.push(`isApiUrlReady`);
    if (prev.currentModel !== currentModel) changes.push(`currentModel`);
    if (prev.currentAccount !== currentAccount) changes.push(`currentAccount`);
    if (prev.isSearchOpen !== isSearchOpen) changes.push(`isSearchOpen`);
    if (prev.searchQuery !== searchQuery) changes.push(`searchQuery`);
    if (prev.autoScrollPaused !== autoScrollPaused)
      changes.push(`autoScrollPaused`);
    if (prev.showProjectStructureDrawer !== showProjectStructureDrawer)
      changes.push(`showProjectStructureDrawer`);
    if (prev.showChangesDropdown !== showChangesDropdown)
      changes.push(`showChangesDropdown`);
    if (prev.showProjectContextModal !== showProjectContextModal)
      changes.push(`showProjectContextModal`);
    if (prev.revertInput !== revertInput) changes.push(`revertInput`);
    if (prev.loadedConversationFileStats !== loadedConversationFileStats)
      changes.push(`loadedConversationFileStats`);

    prevStateRef.current = {
      apiUrl,
      isApiUrlReady,
      currentModel,
      currentAccount,
      isSearchOpen,
      searchQuery,
      autoScrollPaused,
      showProjectStructureDrawer,
      showChangesDropdown,
      showProjectContextModal,
      revertInput,
      loadedConversationFileStats,
    };
  });

  // --- API & Configuration ---
  const { apiUrl, setApiUrl, isApiUrlReady, providers, setProviders } =
    useApiConfiguration();

  // Track chat panel renders - WITH DETAILED TRACKING
  const chatRenderCountRef = useRef(0);
  const lastRenderTimeRef = useRef(Date.now());
  const renderTimingsRef = useRef<number[]>([]);

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

  // --- Chat LLM Hook ---
  const {
    messages,
    setMessages,
    messagesRef,
    isProcessing,
    setIsProcessing,
    isStreaming,
    isContinuing,
    incompleteHasPartialTool,
    incompletePartialToolType,
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
  });

  // DEBUG: Track messages and streaming state changes
  const prevChatStateRef = useRef<any>({});
  useEffect(() => {
    const prev = prevChatStateRef.current;
    const changes: string[] = [];

    if (prev.messages !== messages)
      changes.push(`messages (length: ${messages.length})`);
    if (prev.isProcessing !== isProcessing)
      changes.push(`isProcessing: ${isProcessing}`);
    if (prev.isStreaming !== isStreaming)
      changes.push(`isStreaming: ${isStreaming}`);
    if (prev.currentConversationId !== currentConversationId)
      changes.push(`currentConversationId`);
    if (prev.isContinuing !== isContinuing)
      changes.push(`isContinuing: ${isContinuing}`);

    prevChatStateRef.current = {
      messages,
      isProcessing,
      isStreaming,
      currentConversationId,
      isContinuing,
    };
  });

  // DEBUG: Track hook return value changes that might cause re-renders
  const hookChangesRef = useRef<any>({});
  useEffect(() => {
    const prev = hookChangesRef.current;
    const changes: string[] = [];

    // Track workspace data
    if (prev.availableFiles !== availableFiles) changes.push("availableFiles");
    if (prev.availableFolders !== availableFolders)
      changes.push("availableFolders");
    if (prev.availableRules !== availableRules) changes.push("availableRules");

    // Track tool execution state
    if (prev.executionState !== executionState) changes.push("executionState");
    if (prev.toolOutputs !== toolOutputs) changes.push("toolOutputs");
    if (prev.terminalStatus !== terminalStatus) changes.push("terminalStatus");

    // Track git operations
    if (prev.gitStatus !== gitStatus) changes.push("gitStatus");
    if (prev.gitLoading !== gitLoading) changes.push("gitLoading");

    // Track parsed messages
    if (prev.parsedMessages !== parsedMessages) changes.push("parsedMessages");
    if (prev.contextUsage !== contextUsage) changes.push("contextUsage");

    hookChangesRef.current = {
      availableFiles,
      availableFolders,
      availableRules,
      executionState,
      toolOutputs,
      terminalStatus,
      gitStatus,
      gitLoading,
      parsedMessages,
      contextUsage,
    };
  });

  // --- Workspace Data ---
  const { availableFiles, availableFolders, availableRules } =
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

  // --- Mention System ---
  const {
    showAtMenu,
    setShowAtMenu,
    showMentionDropdown,
    setShowMentionDropdown,
    mentionType,
    setMentionType,
    attachedItems,
    checkMentions,
    handleMentionOptionSelect,
    handleWorkspaceItemSelect,
    handleRuleSelect,
    removeAttachedItem,
    clearAttachedItems,
    addAttachedItem,
  } = useMentionSystem({
    message,
    setMessage,
    textareaRef,
    availableFiles,
    availableFolders,
    onRequestWorkspaceFiles: () => {
      const vscodeApi = (window as any).vscodeApi;
      if (vscodeApi) {
        vscodeApi.postMessage({ command: "getWorkspaceFiles" });
      }
    },
    onRequestWorkspaceFolders: () => {
      const vscodeApi = (window as any).vscodeApi;
      if (vscodeApi) {
        vscodeApi.postMessage({ command: "getWorkspaceFolders" });
      }
    },
  });

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
  } = useFileHandling({
    accountId: currentAccount?.id,
    onAddAttachedItem: (item) => {
      addAttachedItem(item);
      setShowAtMenu(false);
    },
  });

  // --- Browser Session ---
  const {
    isBrowserSessionReady,
    showBrowserWarning,
    isLaunchingBrowser,
    launchBrowserSession,
  } = useBrowserSession(currentModel, currentAccount, backendApiUrl);

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

  // --- Context Compression ---
  const { triggerContextCompression, shouldShowCompressionButton } =
    useContextCompression({
      currentConversationIdRef,
      messages,
      isProcessing,
      sendMessage,
      currentModelRef,
      currentAccountRef,
    });

  // --- Message Handlers ---
  const { handleSend, handleStopGeneration, handleClearChat } =
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
      checkMentions,
      handleDraftKeyDown,
    });

  // --- Model Switch ---
  const { handleModelSwitch } = useModelSwitch({
    messages,
    currentConversationId,
    currentChat,
    providers,
    setMessages,
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

  // Click outside for dropdowns
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (showAtMenu) {
        const menu = document.querySelector('[data-at-menu="true"]');
        if (menu && !menu.contains(target) && target !== textareaRef.current) {
          setShowAtMenu(false);
        }
      }
      if (showMentionDropdown) {
        const dropdown = document.querySelector(
          '[data-mention-dropdown="true"]',
        );
        if (dropdown && !dropdown.contains(target)) {
          setShowMentionDropdown(false);
          setMentionType(null);
        }
      }
    };
    if (showAtMenu || showMentionDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [
    showAtMenu,
    showMentionDropdown,
    setShowAtMenu,
    setShowMentionDropdown,
    setMentionType,
  ]);

  // Listen for Git commit message detection
  useEffect(() => {
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
      <ChatErrorBoundary>
        <ChatBody
          messages={parsedMessages}
          isProcessing={isProcessing}
          isContinuing={isContinuing}
          incompleteHasPartialTool={incompleteHasPartialTool}
          incompletePartialToolType={incompletePartialToolType}
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
      </ChatErrorBoundary>

      {/* ─── ChatFooter ─── */}
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
        setShowAtMenu={setShowAtMenu}
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
        removeAttachedItem={removeAttachedItem}
        onOpenImage={handleOpenImage}
        removeFile={removeFile}
        externalFileInputRef={externalFileInputRef}
        handleExternalFileInputChange={handleExternalFileInputChange}
        handleFileInputChange={handleFileInputChange}
        footerPaddingBottom={footerPaddingBottom}
        shouldShowCompressionButton={shouldShowCompressionButton}
        gitStatus={gitStatus}
        onOpenGitStatus={() => setShowGitStatusBlock(true)}
        loadedConversationFileStats={loadedConversationFileStats}
        onModelSwitch={handleModelSwitch}
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
