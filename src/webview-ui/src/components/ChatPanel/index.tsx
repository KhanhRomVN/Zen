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

import { extensionService } from "../../services/ExtensionService";
import {
  saveConversation,
  deleteConversation,
  getConversationKey,
} from "../../services/ConversationService";
import { parseAIResponse } from "../../services/ResponseParser";
import { useChatLLM } from "../../hooks/useChatLLM";
import { useToolExecution } from "../../hooks/useToolExecution";
import { TabInfo } from "../../types";
import { Message } from "./ChatBody/types";

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
  const [isLoadingConversation, setIsLoadingConversation] = useState(true);
  const [activeTerminalIds, setActiveTerminalIds] = useState<Set<string>>(
    new Set(),
  );
  const [attachedTerminalIds, setAttachedTerminalIds] = useState<Set<string>>(
    new Set(),
  );
  const [currentModel, setCurrentModel] = useState<any>(null);
  const [currentAccount, setCurrentAccount] = useState<any>(null);
  const [isSimpleMode, setIsSimpleMode] = useState<boolean>(() => {
    try { return localStorage.getItem("zen-simple-mode") === "true"; } catch { return true; }
  });

  const [isRestored, setIsRestored] = useState(false);

  const toggleSimpleMode = React.useCallback(() => {
    setIsSimpleMode((prev) => {
      const next = !prev;
      try { localStorage.setItem("zen-simple-mode", String(next)); } catch {}
      return next;
    });
  }, []);

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
      return sendMessage(
        content,
        files,
        model,
        account,
        skipFirstRequestLogic,
        actionIds,
        uiHidden,
      );
    },
    [sendMessage],
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
      const convId = (selectedTab as any).conversationId;
      if (convId) {
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
          setMessages(
            data.data.messages.map((msg: Message, i: number) => ({
              ...msg,
              id: msg.id || `restored-${Date.now()}-${i}`,
            })),
          );
          if (data.data.messages.length > 0) {
            setIsRestored(true);
          }
          if (data.data.conversationId) {
            setCurrentConversationId(data.data.conversationId);

            // 🆕 Restore Backend Conversation ID from messages if available
            const lastMsgWithBackendId = [...data.data.messages]
              .reverse()
              .find((m: Message) => m.conversationId);

            const backendIdFromMsg = lastMsgWithBackendId?.conversationId;

            // Restore metadata from the last assistant message to prime the LLM hooks
            const lastAssistantWithMeta = [...data.data.messages]
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
          }

          // Restore Main Model and Account from the last assistant message
          const lastAssistantMsgForMeta = [...data.data.messages]
            .reverse()
            .find(
              (m: Message) =>
                m.role === "assistant" && m.providerId && m.modelId,
            );

          if (lastAssistantMsgForMeta) {
            setCurrentModel({
              providerId: lastAssistantMsgForMeta.providerId!,
              id: lastAssistantMsgForMeta.modelId!,
              name: lastAssistantMsgForMeta.modelId!, // Fallback name
            });
            setCurrentAccount({
              id: lastAssistantMsgForMeta.accountId!,
              email: lastAssistantMsgForMeta.email!,
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
  }, [messages, stopGeneration, onBack]);

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
        isProcessing={isProcessing}
        isStreaming={isStreaming}
        onStopGeneration={handleStopGeneration}
        isSimpleMode={isSimpleMode}
        onToggleSimpleMode={toggleSimpleMode}
      />
    </div>
  );
};

export default ChatPanel;
