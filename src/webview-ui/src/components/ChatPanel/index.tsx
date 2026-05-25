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
import { useProject } from "../../context/ProjectContext";
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
  const { stopWatching } = useProject();

  useEffect(() => {
    stopWatching();
  }, [stopWatching]);

  // --- States ---
  const [apiUrl, setApiUrl] = useState("http://localhost:8888");
  const [providers, setProviders] = useState<any[]>([]);
  const [isLoadingConversation, setIsLoadingConversation] = useState(true);
  const [activeTerminalIds, setActiveTerminalIds] = useState<Set<string>>(
    new Set(),
  );
  const [attachedTerminalIds, setAttachedTerminalIds] = useState<Set<string>>(
    new Set(),
  );
  const [currentModel, setCurrentModel] = useState<any>(null);
  const [currentAccount, setCurrentAccount] = useState<any>(null);
  const { isSimpleMode } = useSettings();

  const [isRestored, setIsRestored] = useState(false);
  const [revertInput, setRevertInput] = useState<{ value: string; nonce: number } | null>(null);
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
    currentConversationId,
    setCurrentConversationId,
    currentConversationIdRef,
    sendMessage,
    stopGeneration,
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
      setIsRestored(false);
      let finalContent = content;
      const isFromHistory = !!(selectedTab as any)?.conversationId && !selectedTab?.canAccept;
      if (isFromHistory && !hasAppendedHistoryContext.current) {
        hasAppendedHistoryContext.current = true;
        finalContent = content + HISTORY_CONTEXT_REMINDER;
      } else if (wasPaused.current) {
        wasPaused.current = false;
        finalContent = content + AFTER_PAUSE_REMINDER;
      }
      return sendMessage(
        finalContent,
        files,
        model,
        account,
        skipFirstRequestLogic,
        actionIds,
        uiHidden,
      );
    },
    [sendMessage, selectedTab],
  );

  const { executionState, toolOutputs, terminalStatus, handleToolRequest } =
    useToolExecution({
      conversationIdRef: currentConversationIdRef,
      messagesRef: messagesRef,
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

  // --- Refs ---
  const hasProcessedInitial = useRef(false);
  const hasAppendedHistoryContext = useRef(false);
  const wasPaused = useRef(false);

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
    storage.get("backend-api-url").then((res: any) => {
      if (res?.value?.startsWith("http")) {
        setApiUrl(res.value.endsWith("/") ? res.value.slice(0, -1) : res.value);
      }
    });
  }, []);

  useEffect(() => {
    if (!apiUrl) return;
    fetch(`${apiUrl}/v1/providers`)
      .then((r) => r.json())
      .then((data: any[]) => setProviders(data))
      .catch(() => {});
  }, [apiUrl]);

  useEffect(() => {
    if (initialMessageData && !hasProcessedInitial.current) {
      hasProcessedInitial.current = true;
      sendMessage(
        initialMessageData.content,
        initialMessageData.files,
        initialMessageData.model,
        initialMessageData.account,
        false,
        undefined,
        undefined,
      );
      onClearInitialData?.();
    }
  }, [initialMessageData, sendMessage, onClearInitialData]);

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
      });
    }
  }, [messages, currentConversationId, currentModel, currentAccount]);

  // Load conversation from extension
  useEffect(() => {
    const load = async () => {
      console.log("[ChatPanel] load conversation effect triggered", {
        selectedTab,
        tabId: selectedTab?.tabId,
        conversationId: (selectedTab as any)?.conversationId,
      });
      if (!selectedTab) {
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
          console.log("[ChatPanel] Loading conversation from cache:", convId);
          setMessages(cached.messages);
          setIsRestored(cached.messages.length > 0);
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
        console.log("[ChatPanel] Sending getConversation", { convId, requestId });
        extensionService.postMessage({
          command: "getConversation",
          conversationId: convId,
          requestId,
        });
      } else {
        console.log("[ChatPanel] No conversationId, clearing messages");
        setMessages([]);
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
        console.log("[ChatPanel] conversationResult received", {
          requestId: data.requestId,
          hasData: !!data.data,
          hasError: !!data.error,
          error: data.error,
          messageCount: data.data?.messages?.length,
          conversationId: data.data?.conversationId,
        });
        if (data.data?.messages) {
          const restoredMessages = data.data.messages.map((msg: Message, i: number) => ({
            ...msg,
            id: msg.id || `restored-${Date.now()}-${i}`,
          }));
          setMessages(restoredMessages);

          if (data.data.messages.length > 0) {
            setIsRestored(true);
          }
          if (data.data.conversationId) {
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
          // First message reverted → delete conv and go back to HomePanel
          deleteConversation(currentConversationId);
          const firstUserMsg = messagesRef.current.find((m) => !m.uiHidden && !m.isCancelled && m.role === "user");
          let content = firstUserMsg?.content || "";
          const match = content.match(/## User Message\n```\n([\s\S]*?)\n```/);
          if (match) content = match[1];
          setMessages([]);
          setIsLoadingConversation(false);
          onBack(content);
        } else {
          setMessages((prev) => {
            const idx = targetId ? prev.findIndex((m) => m.id === targetId) : -1;
            if (idx === -1) return prev;
            const msg = prev[idx];
            const match = msg.content.match(/## User Message\n```\n([\s\S]*?)\n```/);
            const content = match ? match[1] : msg.content;
            setRevertInput({ value: content, nonce: Date.now() });
            return prev.slice(0, idx);
          });
          setIsLoadingConversation(false);
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

  const handleRevertConversation = useCallback((messageId: string, timestamp: number) => {
    if (!currentConversationId) return;
    // Check if this is the first user message
    const visibleUserMessages = messagesRef.current.filter((m) => !m.uiHidden && !m.isCancelled && m.role === "user");
    const isFirstMessage = visibleUserMessages.length > 0 && visibleUserMessages[0].id === messageId;
    revertMessageIdRef.current = isFirstMessage ? "__first__" : messageId;
    setIsLoadingConversation(true);
    extensionService.postMessage({
      command: "revertConversation",
      conversationId: currentConversationId,
      messageId,
      timestamp,
    });
  }, [currentConversationId, messagesRef]);
  const handleClearConfirmed = async () => {
    if (selectedTab) {
      await deleteConversation(currentConversationId);
      setMessages([]);
      setIsProcessing(false);
      setCurrentConversationId(Date.now().toString());
    }
  };

  const handleStopGeneration = useCallback(() => {
    // 🆕 REDIRECTION LOGIC: If stopping AND it was the first request (req1), go back to Home
    const isFirstRequest = messages.filter((m) => !m.isCancelled).length <= 2; // User + Assistant (partial)

    // 🆕 PAUSE API: Call pause endpoint if provider is_pausable
    if (currentAccount?.id && currentModel?.providerId) {
      const provider = providers.find((p: any) => p.provider_id === currentModel.providerId);
      if (provider?.is_pausable) {
        fetch(`${apiUrl}/v1/chat/pause`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ account_id: currentAccount.id }),
        }).catch(() => {});
      }
    }

    wasPaused.current = true;
    stopGeneration();

    if (isFirstRequest) {
      // Find the user message content to return
      // We check messagesRef for the raw content if possible, or just messages state
      const userMsg = messages.find((m) => m.role === "user");
      if (userMsg) {
        let content = userMsg.content;
        // Strip ## User Message\n```\n...\n``` if present
        if (content.startsWith("## User Message")) {
          const match = content.match(
            /^## User Message\n```\n([\s\S]*?)\n```$/,
          );
          if (match) content = match[1];
        }
        onBack(content);
      } else {
        onBack();
      }
    }
  }, [messages, stopGeneration, onBack, currentAccount, currentModel, providers, apiUrl]);

  const firstRequestMessage = messages.find((m) => m.role === "user");

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
        currentModel={currentModel}
        currentAccount={currentAccount}
      />
      <ChatBody
        messages={messages}
        isProcessing={isProcessing}
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
        onRevertConversation={handleRevertConversation}
        onAutoScrollPausedChange={setAutoScrollPaused}
        scrollToBottomRef={scrollToBottomRef}
      />
      <ChatFooter
        apiUrl={apiUrl}
        folderPath={selectedTab?.folderPath || null}
        onSendMessage={(c, f, m, a, skip, ids, hidden) =>
          wrappedSendMessage(c, f, m, a, skip, ids, hidden)
        }
        isHistoryMode={isHistoryMode}
        messages={messages}
        isConversationStarted={messages.length > 0}
        currentModel={currentModel}
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
