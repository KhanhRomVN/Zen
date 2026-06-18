import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import ChatHeader from "./ChatHeader";
import ChatBody from "./ChatBody";
import ChatFooter from "./ChatFooter";
import { useSettings } from "../../context/SettingsContext";

import { extensionService } from "../../services/ExtensionService";
import {
  saveConversation,
  deleteConversation,
  getConversationKey,
} from "../../services/ConversationService";
import { parseAIResponse } from "../../services/ResponseParser";
import { HISTORY_CONTEXT_REMINDER, AFTER_PAUSE_REMINDER } from "./prompts";
import { useChatLLM } from "../../hooks/useChatLLM";
import { useToolExecution } from "../../hooks/useToolExecution";
import { TabInfo } from "../../types";
import { Message } from "./ChatBody/types";
import { ConversationCache } from "../../services/ConversationCache";

interface ChatPanelProps {
  selectedTab: TabInfo | null;
  onBack: (contentToReturn?: string) => void;
  tabs?: TabInfo[];
  onTabSelect?: (tab: TabInfo) => void;
  onLoadConversation?: (
    conversationId: string,
    tabId: number,
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
  selectedTab,
  onBack,
  tabs,
  onTabSelect,
  onLoadConversation,
  initialMessageData,
  onClearInitialData,
}) => {
  // --- States ---
  const [apiUrl, setApiUrl] = useState("http://localhost:8888");
  const [isApiUrlReady, setIsApiUrlReady] = useState(false);
  const [providers, setProviders] = useState<any[]>([]);
  const [isLoadingConversation, setIsLoadingConversation] = useState(true);
  const [activeTerminalIds, setActiveTerminalIds] = useState<Set<string>>(
    new Set(),
  );
  const [attachedTerminalIds, setAttachedTerminalIds] = useState<Set<string>>(
    new Set(),
  );
  const [currentModel, setCurrentModel] = useState<any>(
    // Seed from initialMessageData so ChatHeader shows correct model immediately,
    // preventing the cache-load from MessageInput from overwriting it.
    () => initialMessageData?.model ?? null,
  );
  const [currentAccount, setCurrentAccount] = useState<any>(
    () => initialMessageData?.account ?? null,
  );

  const { isSimpleMode } = useSettings();

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const [isRestored, setIsRestored] = useState(false);
  const [revertInput, setRevertInput] = useState<{
    value: string;
    nonce: number;
  } | null>(null);
  const revertParentMessageIdRef = useRef<string | null>(null);
  const [autoScrollPaused, setAutoScrollPaused] = useState(false);
  const scrollToBottomRef = useRef<(() => void) | null>(null);

  // --- Hooks ---
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
    selectedTab,
    onToolRequest: (actions, assistantMessage, isAutoTrigger, actionType) =>
      handleToolRequest(
        actions,
        assistantMessage,
        isAutoTrigger,
        conversationToolOverrides,
        actionType,
      ),
  });

  // --- Refs ---
  const hasProcessedInitial = useRef(false);
  const hasAppendedHistoryContext = useRef(false);
  const wasPaused = useRef(false);
  const isStoppedRef = useRef(false);

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
      // If this is a real user message (not a tool result), clear the stop flag
      // so subsequent tool auto-flush is allowed again.
      if (!skipFirstRequestLogic) {
        isStoppedRef.current = false;
      }
      setIsRestored(false);
      let finalContent = content;
      const isFromHistory =
        !!(selectedTab as any)?.conversationId && !selectedTab?.canAccept;
      if (isFromHistory && !hasAppendedHistoryContext.current) {
        hasAppendedHistoryContext.current = true;
        finalContent = content + HISTORY_CONTEXT_REMINDER;
      } else if (false) {
        // wasPaused logic removed — stop now triggers revert instead of continue
      }
      const parentMsgId = revertParentMessageIdRef.current || undefined;
      revertParentMessageIdRef.current = null;
      if (parentMsgId && currentConversationId) {
        sessionStorage.removeItem(`zen-revert-parent:${currentConversationId}`);
      }
      return sendMessage(
        finalContent,
        files,
        model,
        account,
        skipFirstRequestLogic,
        actionIds,
        uiHidden,
        parentMsgId,
      );
    },
    [sendMessage, selectedTab],
  );

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
      content,
      files,
      model,
      account,
      skipLogic,
      actionIds,
      uiHidden,
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

  // Reset hasProcessedInitial whenever a new tab/chat session starts
  // so that initialMessageData from a subsequent HomePanel send is not skipped.
  // resetSession() resets all refs synchronously so sendMessage sees isNewSession=true.
  // NOTE: Do NOT clear lastUsedModelRef here — it is pinned inside sendMessage
  // when isNewSession=true to avoid the model-switch race condition.
  useEffect(() => {
    hasProcessedInitial.current = false;
    resetSession();
  }, [selectedTab?.tabId]);

  // --- Memoized Values ---
  const isHistoryMode = useMemo(() => {
    return !!(selectedTab as any)?.conversationId && !selectedTab?.canAccept;
  }, [selectedTab]);

  const parsedMessages = useMemo(() => {
    return messages.map((msg: Message) => ({
      ...msg,
      parsed: parseAIResponse(msg.content),
    }));
  }, [messages]);

  const contextUsage = useMemo(() => {
    return messages.reduce(
      (acc, msg) => {
        if (msg.isCancelled) return acc;

        // Use the new standardized token_usage field if available
        if (msg.token_usage) {
          acc.total += msg.token_usage;
          // Optionally attribute to prompt/completion if we have granular data
          if (msg.usage) {
            acc.prompt += msg.usage.prompt_tokens || 0;
            acc.completion += msg.usage.completion_tokens || 0;
          } else if (msg.role === "user") {
            acc.prompt += msg.token_usage;
          } else {
            acc.completion += msg.token_usage;
          }
        } else if (msg.usage) {
          // Fallback for legacy messages or specific API responses
          acc.prompt += msg.usage.prompt_tokens || 0;
          acc.completion += msg.usage.completion_tokens || 0;
          acc.total += msg.usage.total_tokens || 0;
        }
        return acc;
      },
      { prompt: 0, completion: 0, total: 0 },
    );
  }, [messages]);

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

  // --- Terminal Polling ---
  useEffect(() => {
    const fetchTerminals = () => {
      extensionService.postMessage({
        command: "listTerminals",
        requestId: `chat-panel-poll-${Date.now()}`,
      });
    };

    fetchTerminals();
    const interval = setInterval(fetchTerminals, 2000);

    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (
        message.command === "listTerminalsResult" &&
        message.requestId?.startsWith("chat-panel-poll-")
      ) {
        if (message.terminals) {
          const allIds = new Set<string>();
          const attachedIds = new Set<string>();
          message.terminals.forEach((t: any) => {
            allIds.add(t.id);
            if (t.isAttached) {
              attachedIds.add(t.id);
            }
          });
          setActiveTerminalIds(allIds);
          setAttachedTerminalIds(attachedIds);
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
      clearInterval(interval);
    };
  }, []);

  // --- Effects ---
  useEffect(() => {
    const storage = extensionService.getStorage();
    storage
      .get("backend-api-url")
      .then((res: any) => {
        if (res?.value?.startsWith("http")) {
          const url = res.value.endsWith("/")
            ? res.value.slice(0, -1)
            : res.value;
          setApiUrl(url);
        }
        // Mark ready regardless — if no saved URL, default is used
        setIsApiUrlReady(true);
      })
      .catch((err: any) => {
        console.warn(
          "[Zen] ChatPanel failed to load apiUrl from storage:",
          err,
        );
        setIsApiUrlReady(true);
      });
  }, []);

  useEffect(() => {
    if (!apiUrl) return;
    fetch(`${apiUrl}/v1/providers`)
      .then((r) => r.json())
      .then((res: any) => {
        const data = Array.isArray(res) ? res : res?.data;
        if (Array.isArray(data)) setProviders(data);
      })
      .catch(() => {});
  }, [apiUrl]);

  useEffect(() => {
    if (initialMessageData && !hasProcessedInitial.current && isApiUrlReady) {
      hasProcessedInitial.current = true;
      // Capture model/account explicitly into local const to avoid any stale
      // closure or React state lag — these must reach sendMessage synchronously.
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

  // Update ConversationCache when local messages or selection changes
  useEffect(() => {
    if (currentConversationId && messages.length > 0) {
      const existing = ConversationCache.get(currentConversationId);
      ConversationCache.set(currentConversationId, {
        messages,
        conversationId: currentConversationId,
        backendConversationId: existing?.backendConversationId,
        currentModel: currentModel || existing?.currentModel,
        currentAccount: currentAccount || existing?.currentAccount,
        toolOutputs:
          Object.keys(toolOutputs).length > 0
            ? toolOutputs
            : existing?.toolOutputs,
      });
    }
  }, [
    messages,
    currentConversationId,
    currentModel,
    currentAccount,
    toolOutputs,
  ]);

  // Persist toolOutputs to disk when they change
  useEffect(() => {
    if (!currentConversationId || Object.keys(toolOutputs).length === 0) return;
    const tabId = selectedTab?.tabId || -1;
    const folderPath = selectedTab?.folderPath || null;
    const errorKeys = Object.entries(toolOutputs)
      .filter(([, v]) => v.isError)
      .map(([k]) => k);
    saveConversation(
      tabId,
      folderPath,
      messages,
      currentConversationId,
      selectedTab || undefined,
      true,
      undefined,
      undefined,
      toolOutputs,
    );
  }, [toolOutputs, currentConversationId]);

  // Persist singleLineReviewActions to disk when they change
  useEffect(() => {
    if (
      !currentConversationId ||
      Object.keys(singleLineReviewActions).length === 0
    )
      return;
    const tabId = selectedTab?.tabId || -1;
    const folderPath = selectedTab?.folderPath || null;
    saveConversation(
      tabId,
      folderPath,
      messages,
      currentConversationId,
      selectedTab || undefined,
      true,
      undefined,
      undefined,
      undefined,
      singleLineReviewActions,
    );
  }, [singleLineReviewActions, currentConversationId]);

  // Load conversation from extension
  useEffect(() => {
    const load = async () => {
      if (!selectedTab) {
        if (currentConversationIdRef.current) {
          return;
        }
        setMessages([]);
        setIsLoadingConversation(false);
        setIsProcessing(false);
        setIsRestored(false);
        return;
      }
      setIsLoadingConversation(true);
      setIsRestored(false);
      hasAppendedHistoryContext.current = false;
      const convId = (selectedTab as any).conversationId;
      if (convId) {
        // Try reading from in-memory cache first
        const cached = ConversationCache.get(convId);
        if (cached) {
          setMessages(cached.messages);
          if (
            cached.toolOutputs &&
            Object.keys(cached.toolOutputs).length > 0
          ) {
            setToolOutputs(cached.toolOutputs);
          }
          if (
            cached.singleLineReviewActions &&
            Object.keys(cached.singleLineReviewActions).length > 0
          ) {
            window.postMessage(
              {
                command: "restoreSingleLineReviewActions",
                actions: cached.singleLineReviewActions,
              },
              "*",
            );
          }
          // Restore pending revert parent if any
          const pendingParent = sessionStorage.getItem(
            `zen-revert-parent:${convId}`,
          );
          if (pendingParent) revertParentMessageIdRef.current = pendingParent;
          setIsRestored(cached.messages.length > 0);
          // 🔧 FIX: Sync ref immediately (same race-condition fix as conversationResult handler)
          currentConversationIdRef.current = cached.conversationId;
          setCurrentConversationId(cached.conversationId);
          if (cached.backendConversationId) {
            setBackendConversationId(cached.backendConversationId);
          }
          if (cached.currentModel) {
            setCurrentModel(cached.currentModel);
          }
          if (cached.currentAccount) {
            setCurrentAccount(cached.currentAccount);
          }
          setIsLoadingConversation(false);
          return;
        }

        const requestId = `conv-${Date.now()}`;
        extensionService.postMessage({
          command: "getConversation",
          conversationId: convId,
          requestId,
        });
      } else {
        // New chat tab with no existing conversationId — reset everything
        setMessages([]);
        setCurrentConversationId("");
        setIsLoadingConversation(false);
      }
    };
    load();
  }, [selectedTab?.tabId, (selectedTab as any)?.conversationId]);

  // Handle incoming messages for data loading
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data = event.data;
      if (data.command === "conversationResult") {
        const toolOutputKeys = data.data?.toolOutputs
          ? Object.keys(data.data.toolOutputs)
          : [];
        const errorToolKeys = data.data?.toolOutputs
          ? Object.entries(data.data.toolOutputs)
              .filter(([, v]: [string, any]) => v.isError)
              .map(([k]) => k)
          : [];
        if (data.data?.messages) {
          const restoredMessages = data.data.messages.map(
            (msg: Message, i: number) => ({
              ...msg,
              id: msg.id || `restored-${Date.now()}-${i}`,
            }),
          );
          const errorMsgs = restoredMessages.filter((m: Message) => m.isError);
          setMessages(restoredMessages);

          if (
            data.data.toolOutputs &&
            Object.keys(data.data.toolOutputs).length > 0
          ) {
            setToolOutputs(data.data.toolOutputs);
          } else {
            console.warn(
              `[ChatPanel][RESTORE] NO toolOutputs in conversationResult — file tool errors will show blank`,
            );
          }

          // Restore singleLineReviewActions
          if (
            data.data.singleLineReviewActions &&
            Object.keys(data.data.singleLineReviewActions).length > 0
          ) {
            // Need to call the setter from useToolExecution — we access it via a workaround
            // The setter is internal to useToolExecution, so we need to pass it up or use ref.
            // For now, we post a message to trigger the restore
            window.postMessage(
              {
                command: "restoreSingleLineReviewActions",
                actions: data.data.singleLineReviewActions,
              },
              "*",
            );
          }

          // Restore pending revert parent if any
          const pendingParent = sessionStorage.getItem(
            `zen-revert-parent:${data.data?.conversationId}`,
          );
          if (pendingParent) revertParentMessageIdRef.current = pendingParent;

          if (data.data.messages.length > 0) {
            setIsRestored(true);
          }
          if (data.data.conversationId) {
            // 🔧 FIX: Update ref synchronously BEFORE setCurrentConversationId (async)
            // to prevent race condition where sendMessage reads stale "" ref between
            // resetSession() and the useEffect that syncs state→ref.
            currentConversationIdRef.current = data.data.conversationId;
            setCurrentConversationId(data.data.conversationId);

            // 🆕 Restore Backend Conversation ID from messages if available
            const lastMsgWithBackendId = [...restoredMessages]
              .reverse()
              .find((m: Message) => m.conversationId);

            const backendIdFromMsg = lastMsgWithBackendId?.conversationId;

            // Restore metadata from the last assistant message to prime the LLM hooks
            const lastAssistantWithMeta = [...restoredMessages]
              .reverse()
              .find(
                (m: Message) =>
                  m.role === "assistant" && m.providerId && m.modelId,
              );

            const restoredMeta = lastAssistantWithMeta
              ? {
                  providerId: lastAssistantWithMeta.providerId,
                  modelId: lastAssistantWithMeta.modelId,
                  accountId: lastAssistantWithMeta.accountId,
                }
              : undefined;

            // Use backendId from message history, or the top-level backendConversationId, or fallback to local UUID
            const backendIdToUse =
              backendIdFromMsg ||
              data.data.backendConversationId ||
              data.data.conversationId;
            setBackendConversationId(backendIdToUse, restoredMeta);

            // Restore Main Model and Account from the last assistant message
            const lastAssistantMsgForMeta = [...restoredMessages]
              .reverse()
              .find(
                (m: Message) =>
                  m.role === "assistant" && m.providerId && m.modelId,
              );

            let modelToCache: any = undefined;
            let accountToCache: any = undefined;

            if (lastAssistantMsgForMeta) {
              modelToCache = {
                providerId: lastAssistantMsgForMeta.providerId!,
                id: lastAssistantMsgForMeta.modelId!,
                name: lastAssistantMsgForMeta.modelId!, // Fallback name
              };
              accountToCache = {
                id: lastAssistantMsgForMeta.accountId!,
                email: lastAssistantMsgForMeta.email!,
              };
              setCurrentModel(modelToCache);
              setCurrentAccount(accountToCache);
            }

            // Sync to in-memory cache
            ConversationCache.set(data.data.conversationId, {
              messages: restoredMessages,
              conversationId: data.data.conversationId,
              backendConversationId: backendIdToUse,
              currentModel: modelToCache,
              currentAccount: accountToCache,
            });
          }
        }
        setIsLoadingConversation(false);
        setIsProcessing(false);
      } else if (
        data.command === "clearChatConfirmed" &&
        data.conversationId === currentConversationId
      ) {
        handleClearConfirmed();
      } else if (
        data.command === "conversationReverted" &&
        data.conversationId === currentConversationId
      ) {
        const targetId = revertMessageIdRef.current;
        revertMessageIdRef.current = null;

        if (targetId === "__first__") {
          deleteConversation(currentConversationId);
          const firstUserMsg = messagesRef.current.find(
            (m) => !m.uiHidden && !m.isCancelled && m.role === "user",
          );
          let content = firstUserMsg?.content || "";
          const match = content.match(
            /<zen-user-content>\n([\s\S]*?)\n<\/zen-user-content>/,
          );
          if (match) content = match[1];
          setMessages([]);
          setIsLoadingConversation(false);
          onBack(content);
        } else {
          setMessages((prev) => {
            const idx = targetId
              ? prev.findIndex((m) => m.id === targetId)
              : -1;
            if (idx === -1) return prev;
            const msg = prev[idx];
            const match = msg.content.match(
              /<zen-user-content>\n([\s\S]*?)\n<\/zen-user-content>/,
            );
            const content = match ? match[1] : msg.content;
            const prevAssistant = [...prev.slice(0, idx)]
              .reverse()
              .find((m) => m.role === "assistant");
            revertParentMessageIdRef.current =
              prevAssistant?.response_message_id || null;
            // Persist across webview reloads
            if (revertParentMessageIdRef.current) {
              sessionStorage.setItem(
                `zen-revert-parent:${currentConversationId}`,
                revertParentMessageIdRef.current,
              );
            } else {
              sessionStorage.removeItem(
                `zen-revert-parent:${currentConversationId}`,
              );
            }
            setRevertInput({ value: content, nonce: Date.now() });
            const reverted = prev.slice(0, idx);
            const existing = ConversationCache.get(currentConversationId);
            ConversationCache.set(currentConversationId, {
              messages: reverted,
              conversationId: currentConversationId,
              backendConversationId: existing?.backendConversationId,
              currentModel: existing?.currentModel,
              currentAccount: existing?.currentAccount,
            });
            return reverted;
          });
          setIsLoadingConversation(false);
          setIsProcessing(false);
        }
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [currentConversationId]);

  // --- Handlers ---
  const handleClearChat = useCallback(() => {
    extensionService.postMessage({
      command: "confirmClearChat",
      conversationId: currentConversationId,
    });
  }, [currentConversationId]);

  const revertMessageIdRef = useRef<string | null>(null);

  const handleRevertConversation = useCallback(
    (messageId: string, timestamp: number) => {
      if (!currentConversationId) return;
      // Check if this is the first user message
      const visibleUserMessages = messagesRef.current.filter(
        (m) => !m.uiHidden && !m.isCancelled && m.role === "user",
      );
      const isFirstMessage =
        visibleUserMessages.length > 0 &&
        visibleUserMessages[0].id === messageId;
      revertMessageIdRef.current = isFirstMessage ? "__first__" : messageId;
      setIsLoadingConversation(true);
      extensionService.postMessage({
        command: "revertConversation",
        conversationId: currentConversationId,
        messageId,
        timestamp,
      });
    },
    [currentConversationId, messagesRef],
  );
  const handleClearConfirmed = async () => {
    if (selectedTab) {
      await deleteConversation(currentConversationId);
      setMessages([]);
      setIsProcessing(false);
      setCurrentConversationId(Date.now().toString());
    }
  };

  const handleStopGeneration = useCallback(() => {
    isStoppedRef.current = true; // block any pending tool auto-flush
    stopGeneration(); // already sets isProcessing=false, isStreaming=false
    setIsProcessing(false);

    // Mark the in-progress assistant message (the one being streamed) as cancelled/truncated.
    // We do NOT revert previous messages — all prior context (including 100+ tool-call turns) must be preserved.
    setMessages((prev) => {
      // Find the last assistant message that has no content yet or is clearly mid-stream
      // (it will be the final item or very close to it)
      const lastAssistantIdx = [...prev].reduceRight(
        (found, m, i) =>
          found === -1 && m.role === "assistant" && !m.isCancelled ? i : found,
        -1,
      );
      if (lastAssistantIdx === -1) return prev;

      const updated = [...prev];
      updated[lastAssistantIdx] = {
        ...updated[lastAssistantIdx],
        isCancelled: true,
      };

      // Persist so the truncated state survives a reload
      const tabId = selectedTab?.tabId || -1;
      const folderPath = selectedTab?.folderPath || null;
      saveConversation(
        tabId,
        folderPath,
        updated,
        currentConversationId,
        selectedTab || undefined,
        true,
      );

      return updated;
    });
  }, [
    stopGeneration,
    setIsProcessing,
    setMessages,
    selectedTab,
    currentConversationId,
  ]);

  const firstRequestMessage = messages.find((m) => m.role === "user");

  // Enrich currentModel with provider-config data
  const enrichedModel = useMemo(() => {
    if (!currentModel) return null;
    if (!Array.isArray(providers)) return currentModel;
    const providerData = providers.find(
      (p: any) => p.provider_id === currentModel.providerId,
    );
    const modelData = providerData?.models?.find(
      (m: any) => m.id === currentModel.id,
    );
    if (!modelData) return currentModel;
    return { ...currentModel, ...modelData };
  }, [currentModel, providers]);

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
      <ChatHeader
        selectedTab={
          selectedTab ||
          ({
            tabId: -1,
            containerName: "Global",
            title: "New Chat",
            status: "free",
            canAccept: true,
            requestCount: 0,
            provider: "deepseek",
          } as any)
        }
        onBack={onBack}
        onClearChat={handleClearChat}
        isLoadingConversation={isLoadingConversation}
        firstRequestMessage={firstRequestMessage}
        contextUsage={contextUsage}
        taskName={currentTaskName}
        conversationId={currentConversationId}
        currentModel={enrichedModel}
        currentAccount={currentAccount}
        onToggleSearch={() => {
          setIsSearchOpen((v) => !v);
          if (isSearchOpen) setSearchQuery("");
        }}
        isSearchOpen={isSearchOpen}
      />
      <ChatBody
        messages={messages}
        isProcessing={isProcessing}
        isContinuing={isContinuing}
        incompleteHasPartialTool={incompleteHasPartialTool}
        incompletePartialToolType={incompletePartialToolType}
        isSimpleMode={isSimpleMode}
        onSendToolRequest={(actions, msg, isAuto, type) =>
          handleToolRequest(
            actions,
            msg,
            isAuto,
            conversationToolOverrides,
            type,
          )
        }
        onSendMessage={(c, f, m, a, skip, ids, hidden) =>
          wrappedSendMessage(c, f, m, a, skip, ids, hidden)
        }
        executionState={executionState}
        toolOutputs={toolOutputs}
        terminalStatus={terminalStatus}
        firstRequestMessageId={firstRequestMessage?.id}
        onLoadConversation={onLoadConversation}
        activeTerminalIds={activeTerminalIds}
        attachedTerminalIds={attachedTerminalIds}
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
      />
      <ChatFooter
        apiUrl={apiUrl}
        folderPath={selectedTab?.folderPath || null}
        onSendMessage={(c, f, m, a, skip, ids, hidden) =>
          wrappedSendMessage(c, f, m, a, skip, ids, hidden)
        }
        isHistoryMode={isHistoryMode}
        messages={messages}
        isConversationStarted={messages.length > 0 || !!initialMessageData}
        currentModel={enrichedModel ?? currentModel}
        setCurrentModel={setCurrentModel}
        currentAccount={currentAccount}
        setCurrentAccount={setCurrentAccount}
        isProcessing={isProcessing || executionState.status === "running"}
        isStreaming={isStreaming}
        onStopGeneration={handleStopGeneration}
        initialValue={revertInput?.value}
        initialValueNonce={revertInput?.nonce}
        conversationId={currentConversationId}
        autoScrollPaused={autoScrollPaused}
        onResumeScroll={() => scrollToBottomRef.current?.()}
      />
    </div>
  );
};

export default ChatPanel;
