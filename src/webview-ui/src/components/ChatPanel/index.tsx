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
import TaskDrawer from "./TaskDrawer";
import BackupDrawer from "./ChatFooter/components/BackupDrawer";

import { extensionService } from "../../services/ExtensionService";
import {
  saveConversation,
  deleteConversation,
  getConversationKey,
} from "../../services/ConversationService";
import { parseAIResponse } from "../../services/ResponseParser";
import { useSettings } from "../../context/SettingsContext";
import { useChatLLM } from "../../hooks/useChatLLM";
import { useBackupWatcher } from "../../hooks/useBackupWatcher";
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
    thinking?: boolean;
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
  const { isBackupEnabled } = useSettings();
  const [apiUrl, setApiUrl] = useState("http://localhost:8888");
  const [isTaskDrawerOpen, setIsTaskDrawerOpen] = useState(false);
  const [isBackupDrawerOpen, setIsBackupDrawerOpen] = useState(false);
  const [isLoadingConversation, setIsLoadingConversation] = useState(true);
  const [activeTerminalIds, setActiveTerminalIds] = useState<Set<string>>(
    new Set(),
  );
  const [attachedTerminalIds, setAttachedTerminalIds] = useState<Set<string>>(
    new Set(),
  );
  const [selectedQuickModel, setSelectedQuickModel] = useState<{
    providerId: string;
    modelId: string;
    accountId?: string;
    favicon?: string;
    email?: string;
  } | null>(null);
  const [currentModel, setCurrentModel] = useState<any>(null);
  const [currentAccount, setCurrentAccount] = useState<any>(null);

  // --- Hooks ---
  const {
    messages,
    setMessages,
    isProcessing,
    setIsProcessing,
    isStreaming,
    currentConversationId,
    setCurrentConversationId,
    currentConversationIdRef,
    sendMessage,
    stopGeneration,
    setBackendConversationId,
  } = useChatLLM({
    apiUrl,
    selectedTab,
    isBackupEnabled,
    onToolRequest: (actions, assistantMessage, isAutoTrigger) =>
      handleToolRequest(actions, assistantMessage, isAutoTrigger),
  });

  const { backupEventCount } = useBackupWatcher(currentConversationId);

  const { executionState, toolOutputs, terminalStatus, handleToolRequest } =
    useToolExecution({
      conversationIdRef: currentConversationIdRef,
      sendMessage: (
        content,
        files,
        model,
        account,
        skipLogic,
        actionIds,
        uiHidden,
        thinking,
      ) =>
        sendMessage(
          content,
          files,
          model,
          account,
          skipLogic,
          actionIds,
          uiHidden,
          thinking,
          selectedQuickModel,
        ),
    });

  useEffect(() => {
    if (Object.keys(terminalStatus).length > 0) {
      console.log("[ChatPanel] Terminal statuses updated:", terminalStatus);
    }
  }, [terminalStatus]);

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

  const allTaskProgress = useMemo(() => {
    for (let i = parsedMessages.length - 1; i >= 0; i--) {
      const msg = parsedMessages[i];
      if (msg.isCancelled) continue;

      // Stop if we hit a user message to avoid "sticky" progress from previous turns
      if (msg.role === "user") break;

      if (msg.role === "assistant") {
        let progress = msg.parsed.taskProgress;
        if (!progress || progress.length === 0) {
          progress = msg.parsed.actions.flatMap((a) => a.taskProgress || []);
        }

        if (progress && progress.length > 0) {
          return progress.map((item) => ({
            text: item.text,
            status: (item.completed ? "done" : "todo") as "done" | "todo",
          }));
        }
      }
    }
    return [];
  }, [parsedMessages]);

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
        initialMessageData.thinking,
        selectedQuickModel,
      );
      onClearInitialData?.();
    }
  }, [initialMessageData, sendMessage, onClearInitialData, selectedQuickModel]);

  // Load conversation from extension
  useEffect(() => {
    const load = async () => {
      if (!selectedTab) {
        setMessages([]);
        setIsLoadingConversation(false);
        setIsProcessing(false);
        return;
      }
      setIsLoadingConversation(true);
      const convId = (selectedTab as any).conversationId;
      if (convId) {
        extensionService.postMessage({
          command: "getConversation",
          conversationId: convId,
          requestId: `conv-${Date.now()}`,
        });
      } else {
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
        if (data.data?.messages) {
          setMessages(
            data.data.messages.map((msg: Message, i: number) => ({
              ...msg,
              id: msg.id || `restored-${Date.now()}-${i}`,
            })),
          );
          if (data.data.conversationId) {
            setCurrentConversationId(data.data.conversationId);

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

            setBackendConversationId(data.data.conversationId, restoredMeta);
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
            setSelectedQuickModel(null); // Clear Quick Switch
          } else {
            setSelectedQuickModel(null);
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
        onToggleTaskDrawer={() => setIsTaskDrawerOpen(!isTaskDrawerOpen)}
        taskProgress={
          allTaskProgress.length > 0
            ? {
                current: {
                  taskName: currentTaskName || "Unknown Task",
                  tasks: allTaskProgress,
                  files: [] as string[],
                  taskIndex: 0,
                  totalTasks: 1,
                },
                history: [],
              }
            : undefined
        }
      />
      <TaskDrawer
        isOpen={isTaskDrawerOpen}
        onClose={() => setIsTaskDrawerOpen(false)}
        taskProgress={{
          current: allTaskProgress.length
            ? {
                taskName: currentTaskName || "Task",
                tasks: allTaskProgress,
                files: [] as string[],
              }
            : null,
          history: [],
        }}
      />
      <ChatBody
        messages={messages}
        isProcessing={isProcessing}
        onSendToolRequest={handleToolRequest}
        onSendMessage={(c, f, m, a, skip, ids, hidden, thinking) =>
          sendMessage(
            c,
            f,
            m,
            a,
            skip,
            ids,
            hidden,
            thinking,
            selectedQuickModel,
          )
        }
        executionState={executionState}
        toolOutputs={toolOutputs}
        terminalStatus={terminalStatus}
        firstRequestMessageId={firstRequestMessage?.id}
        onLoadConversation={onLoadConversation}
        activeTerminalIds={activeTerminalIds}
        attachedTerminalIds={attachedTerminalIds}
        conversationId={currentConversationId}
      />
      <ChatFooter
        folderPath={selectedTab?.folderPath || null}
        onSendMessage={(c, f, m, a, skip, ids, hidden, thinking) =>
          sendMessage(
            c,
            f,
            m,
            a,
            skip,
            ids,
            hidden,
            thinking,
            selectedQuickModel,
          )
        }
        isHistoryMode={isHistoryMode}
        messages={messages}
        isConversationStarted={messages.length > 0}
        hasTaskProgress={allTaskProgress.length > 0}
        selectedQuickModel={selectedQuickModel}
        onQuickModelSelect={setSelectedQuickModel}
        currentModel={currentModel}
        setCurrentModel={setCurrentModel}
        currentAccount={currentAccount}
        setCurrentAccount={setCurrentAccount}
        onToggleTaskDrawer={() => setIsTaskDrawerOpen(!isTaskDrawerOpen)}
        isProcessing={isProcessing}
        isStreaming={isStreaming}
        onStopGeneration={handleStopGeneration}
        onToggleBackupDrawer={() => setIsBackupDrawerOpen(!isBackupDrawerOpen)}
        hasBackupEvents={backupEventCount > 0}
        backupEventCount={backupEventCount}
        isBackupEnabled={isBackupEnabled}
      />
      {currentConversationId && (
        <BackupDrawer
          conversationId={currentConversationId}
          isOpen={isBackupDrawerOpen}
          onClose={() => setIsBackupDrawerOpen(false)}
        />
      )}
    </div>
  );
};

export default ChatPanel;
