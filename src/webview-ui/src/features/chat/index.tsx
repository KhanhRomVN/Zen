import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { useSettings } from "../../context/SettingsContext";
import { useBackendConnection } from "../../context/BackendConnectionContext";

// Services
import { getConversationKey } from "./services/ConversationService";
import { extensionService } from "../../services/ExtensionService";
import {
  isBlockedNow,
  isDeepSeekProvider,
  getBlockedRangeLabel,
  getBlockedHoursDescription,
} from "../../utils/timeBlock";

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
import { useSessionCleanup } from "./hooks/llm/useSessionCleanup";

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
    conversationOverrides?: {
      diagnosticEnabled?: boolean;
      useSkillEnabled?: boolean;
      memoryEnabled?: boolean;
    };
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
  // Per-conversation overrides restored from saved metadata
  const [restoredConversationOverrides, setRestoredConversationOverrides] =
    useState<
      | {
          diagnosticEnabled?: boolean;
          useSkillEnabled?: boolean;
          memoryEnabled?: boolean;
        }
      | undefined
    >(undefined);

  // Capture conversationOverrides from initialMessageData into a stable ref
  // so it survives after onClearInitialData() nulls out initialMessageData.
  const pendingConversationOverridesRef = useRef<
    | {
        diagnosticEnabled?: boolean;
        useSkillEnabled?: boolean;
        memoryEnabled?: boolean;
      }
    | undefined
  >(initialMessageData?.conversationOverrides);
  useEffect(() => {
    if (initialMessageData?.conversationOverrides !== undefined) {
      pendingConversationOverridesRef.current =
        initialMessageData.conversationOverrides;
    }
  }, [initialMessageData]);

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

  // --- Provider capability flags ---
  // true khi provider hiện tại hỗ trợ regenerate (có server-side conversation thread)
  const canRegenerate = React.useMemo(() => {
    if (!currentAccount?.provider_id) {
      return true; // default: hiện
    }
    const pc = providers.find(
      (p: any) => p.provider_id === currentAccount.provider_id,
    );
    if (!pc) {
      return true; // provider chưa load → không ẩn
    }
    const result = pc.can_regenerate === true;
    return result;
  }, [currentAccount?.provider_id, providers]);

  // blocked_time_ranges từ provider config hiện tại — sync với deepseek.constant.ts qua API
  const currentProviderBlockedRanges = React.useMemo(() => {
    const providerId = currentModel?.providerId;
    if (!providerId) return null;
    const pc = providers.find(
      (p: any) => p.provider_id?.toLowerCase() === providerId.toLowerCase(),
    );
    return pc?.blocked_time_ranges ?? null;
  }, [currentModel?.providerId, providers]);

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
  // Ref để fetchAccountStats luôn đọc được backendApiUrl mới nhất, tránh stale closure
  const backendApiUrlRef = useRef(backendApiUrl);
  backendApiUrlRef.current = backendApiUrl;

  // Revert state
  const [revertInput, setRevertInput] = useState<{
    value: string;
    nonce: number;
  } | null>(null);
  const revertParentMessageIdRef = useRef<string | null>(null);

  // ── Conversation title (set by AI via conversation_title tool or restored from storage) ──
  const [conversationTitle, setConversationTitle] = useState<string>("");

  // Loaded conversation file stats from history
  const [loadedConversationFileStats, setLoadedConversationFileStats] =
    useState<{
      totalFiles: number;
      totalAdditions: number;
      totalDeletions: number;
    } | null>(null);

  // ── View-only state ──────────────────────────────────────────────────
  // true khi provider bị blocked_time_ranges (non-DeepSeek) → lock input, không xóa conv
  const [isTimeBlockViewOnly, setIsTimeBlockViewOnly] = React.useState(false);

  // true khi conversation load từ history + provider supports_session_cleanup / no-auth
  // hoặc khi đang trong khung giờ blocked của non-DeepSeek provider
  const isViewOnly = React.useMemo(() => {
    if (isTimeBlockViewOnly) return true;
    if (!loadedConversationFileStats) {
      return false;
    }
    const providerId = currentModel?.providerId;
    if (!providerId) {
      return false;
    }
    const pc = providers.find(
      (p: any) => p.provider_id?.toLowerCase() === providerId.toLowerCase(),
    );
    if (!pc) {
      return false;
    }
    const isSessionCleanup = pc.supports_session_cleanup === true;
    const authMethod = pc.auth_method;
    const isNoAuth = Array.isArray(authMethod) && authMethod.length === 0;
    const result = isSessionCleanup || isNoAuth;
    return result;
  }, [
    currentModel?.providerId,
    providers,
    loadedConversationFileStats,
    isTimeBlockViewOnly,
  ]);

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
    conversationOverrides:
      pendingConversationOverridesRef.current ?? restoredConversationOverrides,
    providerBlockedRanges: currentProviderBlockedRanges,
    onToolRequest: (actions, assistantMessage, isAutoTrigger, actionType) =>
      handleToolRequest(
        actions,
        assistantMessage,
        isAutoTrigger,
        conversationToolOverrides,
        actionType,
      ),
    onMalformedTool: (actionId, toolName, errorMessage, errorCode) => {
      if (setToolOutputsRef.current) {
        setToolOutputsRef.current((prev: any) => {
          const updated = {
            ...prev,
            [actionId]: {
              output: `${errorCode}: ${errorMessage}`,
              isError: true,
              originalError: `${errorCode}: ${errorMessage}`, // Store original error
            },
          };

          return updated;
        });
      } else {
        console.warn(
          "[Zen][onMalformedTool] ⚠️ setToolOutputsRef.current is null!",
        );
      }
    },
  });

  // Track messages and streaming state - kept for potential future use, but removed heavy logging
  // (Previously had debug useEffect here - removed for performance)

  // Enrich currentAccount với usage + period stats sau mỗi lần stream xong
  // và khi account.id đổi. Dùng isStreaming làm trigger — mỗi khi stream
  // kết thúc (true → false) sẽ refetch để lấy usage/stats mới nhất.
  // NOTE: dùng backendApiUrlRef để tránh stale closure — luôn đọc URL mới nhất
  const isStreamingRef = React.useRef(isStreaming);
  const fetchAccountStats = React.useCallback(() => {
    const url = backendApiUrlRef.current;
    if (!currentAccountRef.current?.id || !url) return;
    const accountId = currentAccountRef.current.id;
    let cancelled = false;

    Promise.all([
      fetch(`${url}/v1/accounts?limit=1&page=1`).then((r) => r.json()),
      fetch(`${url}/v1/stats?period=day&account_id=${accountId}`).then((r) =>
        r.json(),
      ),
    ])
      .then(([accountsResult, statsResult]) => {
        if (cancelled) return;
        const updates: Record<string, any> = {};

        // usage + reset_usage_at
        if (accountsResult?.success && accountsResult.data?.accounts) {
          const fetched = accountsResult.data.accounts.find(
            (a: any) => a.id === accountId,
          );
          if (fetched) {
            updates.usage = fetched.usage ?? null;
            updates.reset_usage_at = fetched.reset_usage_at ?? null;
          }
        }

        // period_requests + period_tokens (day)
        if (statsResult?.success && statsResult.data) {
          const usageArr = statsResult.data.usage ?? [];
          const dayRequests = usageArr.reduce(
            (s: number, e: any) => s + (e.requests || 0),
            0,
          );
          const dayTokens = usageArr.reduce(
            (s: number, e: any) => s + (e.tokens || 0),
            0,
          );
          updates.period_requests = dayRequests;
          updates.period_tokens = dayTokens;

          if (statsResult.data.accounts?.length) {
            const stat = statsResult.data.accounts.find(
              (s: any) => s.id === accountId,
            );
            if (stat) {
              updates.total_requests = stat.total_requests ?? null;
              updates.successful_requests = stat.successful_requests ?? null;
              updates.total_tokens = stat.total_tokens ?? null;
            }
          }
        }

        if (Object.keys(updates).length > 0) {
          setCurrentAccount((prev: any) => ({ ...prev, ...updates }));
        }
      })
      .catch(() => {
        /* silent */
      });

    return () => {
      cancelled = true;
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps — dùng refs thay closure

  // Chạy khi account.id đổi
  React.useEffect(() => {
    if (!currentAccount?.id || !backendApiUrlRef.current) return;
    return fetchAccountStats();
  }, [currentAccount?.id, fetchAccountStats]); // eslint-disable-line react-hooks/exhaustive-deps

  // Chạy sau mỗi lần stream kết thúc (isStreaming: true → false)
  React.useEffect(() => {
    const prev = isStreamingRef.current;
    isStreamingRef.current = isStreaming;
    if (prev === true && isStreaming === false) {
      fetchAccountStats();
    }
  }, [isStreaming, fetchAccountStats]);

  // --- Session Cleanup ---
  // Khi user rời chat view hoặc đổi account, dọn sạch conversation phía provider
  // (chỉ với provider hỗ trợ: supports_session_cleanup = true, hiện tại: DeepSeek)
  useSessionCleanup({
    apiUrl,
    accountId: currentAccount?.id ?? null,
    providerId: currentAccount?.provider_id ?? null,
    providers,
    isInChatView: true, // component này render = đang ở chat view
    isStreaming,
  });

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
    setAttachedItems((prev) => {
      const updated = [...prev, item];
      return updated;
    });
  }, []);

  // --- File Handling ---
  const {
    uploadedFiles,
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
    modelId: currentModel?.id,
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

  // Chỉ gắn được 1 rule tại một thời điểm: gỡ rule cũ (nếu có) trước khi gắn rule mới.
  const handleSelectRule = useCallback(
    (item: any) => {
      const existingRule = attachedItems.find((i: any) => i.type === "rule");
      if (existingRule) {
        handleRemoveAttachedItem(existingRule.id);
      }
      addAttachedItemWithCache(item);
    },
    [attachedItems, handleRemoveAttachedItem, addAttachedItemWithCache],
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
      extraOptions?: {
        user_action?: string;
        edit_message_id?: string;
        parent_message_id?: string;
      },
    ) => {
      if (!skipFirstRequestLogic) {
        isStoppedRef.current = false;
      }
      setIsRestored(false);

      // Auto-scroll to bottom when sending new message
      if (scrollToBottomRef.current) {
        scrollToBottomRef.current();
      }

      // For Qwen edit/regenerate: extraOptions.parent_message_id takes priority over revertParentMessageId
      const parentMsgId =
        extraOptions?.parent_message_id ??
        revertParentMessageIdRef.current ??
        undefined;
      if (!extraOptions?.parent_message_id) {
        revertParentMessageIdRef.current = null;
        if (parentMsgId && currentConversationId) {
          sessionStorage.removeItem(
            `zen-revert-parent:${currentConversationId}`,
          );
        }
      } else {
        revertParentMessageIdRef.current = null;
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
        extraOptions,
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
    showGitStatusBlock,
    gitCommitLoading,
    setShowGitStatusBlock,
    enrichedModel,
    handleGitPullRequest,
    handleGitConfirm,
    handleGitCancel,
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
  const { handleSend, handleStopGeneration } = useMessageHandlers({
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

  // --- Time-Block Monitoring: Chặn provider trong giờ cấm khi đang chat ─
  // DeepSeek (AIWeb2API): xóa conversation + hiển thị lỗi khi blocked.
  // Provider khác có blocked_time_ranges: lock view-only, không xóa.
  // Kiểm tra mỗi 30 giây. Ranges lấy từ provider config.
  useEffect(() => {
    const checkTimeBlock = () => {
      const providerId = currentModelRef.current?.providerId;
      if (!providerId) return;

      // Lấy ranges từ provider config đã fetch
      const providerConfig = providers.find(
        (p: any) => p.provider_id?.toLowerCase() === providerId?.toLowerCase(),
      );
      const ranges = providerConfig?.blocked_time_ranges ?? null;
      if (!ranges || ranges.length === 0) {
        setIsTimeBlockViewOnly(false);
        return;
      }

      if (!isBlockedNow(ranges)) {
        setIsTimeBlockViewOnly(false);
        return;
      }

      if (isDeepSeekProvider(providerId)) {
        // DeepSeek (AIWeb2API): xóa conversation
        const rangeLabel = getBlockedRangeLabel(ranges);
        const allRanges = getBlockedHoursDescription(ranges);
        const errorMsg =
          `⛔ DeepSeek bị chặn trong khung giờ ${allRanges}. ` +
          `Hiện tại đang trong khung ${rangeLabel}. Conversation đã bị xóa. Vui lòng thử lại sau.`;

        if (isProcessing || isStreaming) {
          stopGeneration();
        }

        if (currentConversationId) {
          extensionService.postMessage({
            command: "deleteConversation",
            conversationId: currentConversationId,
            requestId: `time-block-monitor-${Date.now()}`,
          });
        }

        resetSession();

        const blockErrorMessage = {
          id: `msg-${Date.now()}-time-block-monitor`,
          role: "assistant" as const,
          content: errorMsg,
          timestamp: Date.now(),
          isError: true,
        };
        setMessages([blockErrorMessage]);
        setIsTimeBlockViewOnly(false);
      } else {
        // Provider khác (Zen): lock view-only, không xóa conversation
        const rangeLabel = getBlockedRangeLabel(ranges);
        const allRanges = getBlockedHoursDescription(ranges);
        if (isProcessing || isStreaming) {
          stopGeneration();
        }
        setIsTimeBlockViewOnly(true);
      }
    };

    // Kiểm tra ngay khi mount (phòng trường hợp load lại trong giờ cấm)
    checkTimeBlock();

    // Kiểm tra mỗi 30 giây
    const interval = setInterval(checkTimeBlock, 30_000);
    return () => clearInterval(interval);
  }, [
    providers,
    currentConversationId,
    isProcessing,
    isStreaming,
    stopGeneration,
    resetSession,
    setMessages,
  ]);
  // ─────────────────────────────────────────────────────────────────────

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
      extraOptions?: {
        user_action?: string;
        edit_message_id?: string;
        parent_message_id?: string;
      },
    ) => {
      wrappedSendMessage(c, f, m, a, skip, ids, hidden, extraOptions);
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

  // Restore per-conversation overrides from saved metadata when loading a conversation
  useEffect(() => {
    const convId = (currentChat as any)?.conversationId;
    if (!convId) {
      setRestoredConversationOverrides(undefined);
      return;
    }
    // Skip if this is a new chat from Home panel (initialMessageData will handle it)
    if (initialMessageData) return;

    const loadOverrides = async () => {
      try {
        const storage = (window as any).storage;
        if (!storage) return;
        const key = getConversationKey(
          currentChat?.sessionId ?? -1,
          currentChat?.folderPath ?? null,
          convId,
        );
        const raw = await storage.get(key, false);
        if (raw?.value) {
          const parsed = JSON.parse(raw.value);
          const meta = parsed?.metadata;
          if (
            meta &&
            (meta.diagnosticEnabled !== undefined ||
              meta.useSkillEnabled !== undefined ||
              meta.memoryEnabled !== undefined)
          ) {
            setRestoredConversationOverrides({
              diagnosticEnabled: meta.diagnosticEnabled,
              useSkillEnabled: meta.useSkillEnabled,
              memoryEnabled: meta.memoryEnabled,
            });
          } else {
            setRestoredConversationOverrides(undefined);
          }
          // Restore conversation title from metadata
          if (meta?.title) {
            setConversationTitle(meta.title);
          } else {
            setConversationTitle("");
          }
        }
      } catch {
        // ignore
      }
    };
    loadOverrides();
  }, [
    currentChat?.sessionId,
    currentChat?.folderPath,
    (currentChat as any)?.conversationId,
    initialMessageData,
  ]);

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

  // Listen for setConversationTitleResult — cập nhật header title khi AI set title mới
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data = event.data;
      if (data.command === "setConversationTitleResult" && !data.error) {
        if (data.title) setConversationTitle(data.title);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

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

  // ── Active conversation overrides (diagnostic / skill / memory) ──────
  const activeOverrides =
    pendingConversationOverridesRef.current ?? restoredConversationOverrides;
  const headerDiagnosticEnabled = activeOverrides?.diagnosticEnabled ?? false;
  const headerSkillEnabled = activeOverrides?.useSkillEnabled ?? false;
  const headerMemoryEnabled = activeOverrides?.memoryEnabled ?? false;

  // ── Chat-level token & request stats from messages ──────────────────
  const chatStats = useMemo(() => {
    let tokens = 0;
    let requests = 0;
    for (const msg of messages) {
      if (msg.role === "assistant") {
        requests++;
        if (msg.usage) {
          tokens += msg.usage.total_tokens ?? 0;
        } else if (msg.token_usage) {
          tokens += msg.token_usage;
        }
      }
    }
    return {
      tokens: tokens > 0 ? tokens : undefined,
      requests: requests > 0 ? requests : undefined,
    };
  }, [messages]);

  // ── 3-dot menu handlers ──────────────────────────────────────────────
  const handleRenameConversation = useCallback(() => {
    const newTitle = window.prompt(
      "Rename conversation:",
      conversationTitle || "",
    );
    if (newTitle === null) return; // user cancelled
    const title = newTitle.trim();
    if (!title || !currentConversationId) return;
    const vscodeApi = (window as any).vscodeApi;
    if (vscodeApi) {
      vscodeApi.postMessage({
        command: "setConversationTitle",
        conversationId: currentConversationId,
        title,
        requestId: `rename-${Date.now()}`,
      });
    }
    setConversationTitle(title);
  }, [conversationTitle, currentConversationId]);

  const handleCopyAsMarkdown = useCallback(() => {
    const lines: string[] = [];
    for (const msg of messages) {
      if (msg.uiHidden || msg.isCancelled) continue;
      const role = msg.role === "user" ? "**You**" : "**Assistant**";
      lines.push(`${role}\n\n${msg.content}\n`);
    }
    navigator.clipboard.writeText(lines.join("\n---\n\n")).catch(() => {});
  }, [messages]);

  const handleCopyAsJson = useCallback(() => {
    const data = messages
      .filter((m) => !m.uiHidden && !m.isCancelled)
      .map((m) => ({
        role: m.role,
        content: m.content,
        timestamp: m.timestamp,
      }));
    navigator.clipboard
      .writeText(JSON.stringify(data, null, 2))
      .catch(() => {});
  }, [messages]);

  const handleExportAsJson = useCallback(() => {
    const data = {
      conversationId: currentConversationId,
      title: conversationTitle,
      exportedAt: new Date().toISOString(),
      messages: messages
        .filter((m) => !m.uiHidden && !m.isCancelled)
        .map((m) => ({
          role: m.role,
          content: m.content,
          timestamp: m.timestamp,
        })),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `conversation-${conversationTitle || currentConversationId || "export"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [messages, currentConversationId, conversationTitle]);

  const handleDeleteConversation = useCallback(() => {
    if (!currentConversationId) return;
    const vscodeApi = (window as any).vscodeApi;
    if (vscodeApi) {
      vscodeApi.postMessage({
        command: "deleteConversation",
        conversationId: currentConversationId,
        requestId: `delete-conv-${Date.now()}`,
      });
    }
    onBack();
  }, [currentConversationId, onBack]);

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
        setCurrentAccount={setCurrentAccount}
        messages={messages}
        conversationTitle={conversationTitle}
        currentConversationId={currentConversationId}
        currentTaskName={currentTaskName}
        diagnosticEnabled={headerDiagnosticEnabled}
        skillEnabled={headerSkillEnabled}
        memoryEnabled={headerMemoryEnabled}
        contextUsage={contextUsage}
        chatTokens={chatStats.tokens}
        chatRequests={chatStats.requests}
        isSearchOpen={isSearchOpen}
        setIsSearchOpen={setIsSearchOpen}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        onRenameConversation={handleRenameConversation}
        onCopyAsMarkdown={handleCopyAsMarkdown}
        onCopyAsJson={handleCopyAsJson}
        onDeleteConversation={handleDeleteConversation}
        onExportAsJson={handleExportAsJson}
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
        canRegenerate={canRegenerate && !isViewOnly}
        isViewOnly={isViewOnly}
      />

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
        onSelectRule={handleSelectRule}
        isViewOnly={isViewOnly}
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
