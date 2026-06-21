import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import { useSettings } from "../../context/SettingsContext";
import { useBackendConnection } from "../../context/BackendConnectionContext";

import { extensionService } from "../../services/ExtensionService";
import {
  saveConversation,
  deleteConversation,
} from "./services/ConversationService";
import { HISTORY_CONTEXT_REMINDER } from "./prompts";
import { getCommitMessagePrompt } from "./prompts/commit-message";
import { useChatLLM } from "./hooks/useChatLLM";
import { useToolExecution } from "./hooks/useToolExecution";
import { useWorkspaceData } from "./hooks/useWorkspaceData";
import { useFileHandling } from "../../hooks/useFileHandling";
import { useMentionSystem } from "./hooks/useMentionSystem";
import { ChatSession } from "./types/chat";
import { Message } from "./types/message";
import { ConversationCache } from "./services/ConversationCache";
import ChatBody from "./components/ChatBody";
import { parseAIResponse } from "./services/ResponseParser";
import { useTerminalPolling } from "./hooks/useTerminalPolling";
import { useBrowserSession } from "./hooks/useBrowserSession";
import { useDraftManagement } from "./hooks/useDraftManagement";

// Shared components
import MessageInput from "@/components/MessageInput";
import FilesPreviews from "@/components/MessageInput/FilesPreviews";
import GitStatusBlock from "./components/blocks/GitStatusBlock";
import { RichtextBlock } from "./components/blocks/RichtextBlock";

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
  // --- States ---
  const [apiUrl, setApiUrl] = useState("http://localhost:8888");
  const [isApiUrlReady, setIsApiUrlReady] = useState(false);
  const [providers, setProviders] = useState<any[]>([]);
  const [isLoadingConversation, setIsLoadingConversation] = useState(true);
  const { activeTerminalIds, attachedTerminalIds } = useTerminalPolling();
  const [currentModel, setCurrentModel] = useState<any>(() => {
    if (initialMessageData?.model) return initialMessageData.model;
    try {
      const saved = localStorage.getItem("zen_last_model");
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return null;
  });
  const [currentAccount, setCurrentAccount] = useState<any>(() => {
    if (initialMessageData?.account) return initialMessageData.account;
    try {
      const saved = localStorage.getItem("zen_last_account");
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return null;
  });

  // Refs to always access the latest model/account values inside callbacks.
  // Without these, callbacks created via useCallback can capture stale closure
  // values of currentModel/currentAccount from a previous render, leading to
  // the wrong model being sent when the user switches mid-session.
  const currentModelRef = useRef<any>(null);
  const currentAccountRef = useRef<any>(null);

  // Keep refs in sync with state (synchronous, runs before any async callbacks)
  currentModelRef.current = currentModel;
  currentAccountRef.current = currentAccount;

  // Persist model/account selection when changed
  useEffect(() => {
    if (currentModel) {
      localStorage.setItem("zen_last_model", JSON.stringify(currentModel));
    }
  }, [currentModel]);

  useEffect(() => {
    if (currentAccount) {
      localStorage.setItem("zen_last_account", JSON.stringify(currentAccount));
    }
  }, [currentAccount]);

  const { isSimpleMode, commitMessageLanguage } = useSettings();

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Git state
  const [gitStatus, setGitStatus] = useState<{
    items: {
      status: string;
      path: string;
      staged: boolean;
      added?: number;
      deleted?: number;
    }[];
    raw: string;
    diffStats?: Record<string, { added: number; deleted: number }>;
  } | null>(null);
  const [gitLoading, setGitLoading] = useState(false);
  const [gitError, setGitError] = useState<string | null>(null);
  const [showGitStatusBlock, setShowGitStatusBlock] = useState(false);
  const [gitCommitMessage, setGitCommitMessage] = useState<string | null>(null);
  const [gitCommitLoading, setGitCommitLoading] = useState(false);
  const [gitCommitInput, setGitCommitInput] = useState<string>("");

  const [isRestored, setIsRestored] = useState(false);
  const [revertInput, setRevertInput] = useState<{
    value: string;
    nonce: number;
  } | null>(null);
  const revertParentMessageIdRef = useRef<string | null>(null);
  const [autoScrollPaused, setAutoScrollPaused] = useState(false);
  const scrollToBottomRef = useRef<(() => void) | null>(null);

  // --- ChatFooter local state ---
  const [showProjectStructureDrawer, setShowProjectStructureDrawer] =
    useState(false);
  const [showChangesDropdown, setShowChangesDropdown] = useState(false);
  const [showProjectContextModal, setShowProjectContextModal] = useState(false);
  const [projectContext, setProjectContext] = useState<any>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mentionDropdownRef = useRef<HTMLDivElement>(null);
  const { apiUrl: backendApiUrl } = useBackendConnection();

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

  const { availableFiles, availableFolders, availableRules } =
    useWorkspaceData();

  const {
    message,
    setMessage,
    storage,
    clearDraft,
    handleKeyDown: handleDraftKeyDown,
    undoStackRef,
    undoIndexRef,
  } = useDraftManagement(currentConversationId, revertInput);

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

  const {
    isBrowserSessionReady,
    showBrowserWarning,
    isLaunchingBrowser,
    launchBrowserSession,
  } = useBrowserSession(currentModel, currentAccount, backendApiUrl);

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
      if (!skipFirstRequestLogic) {
        isStoppedRef.current = false;
      }
      setIsRestored(false);
      let finalContent = content;
      const isFromHistory =
        !!(currentChat as any)?.conversationId && !currentChat?.canAccept;
      if (isFromHistory && !hasAppendedHistoryContext.current) {
        hasAppendedHistoryContext.current = true;
        finalContent = content + HISTORY_CONTEXT_REMINDER;
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
    [sendMessage, currentChat],
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
  useEffect(() => {
    hasProcessedInitial.current = false;
    resetSession();
  }, [currentChat?.sessionId]);

  // --- Memoized Values ---
  const isHistoryMode = useMemo(() => {
    return !!(currentChat as any)?.conversationId && !currentChat?.canAccept;
  }, [currentChat]);

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
        if (msg.token_usage) {
          acc.total += msg.token_usage;
          if (msg.usage) {
            acc.prompt += msg.usage.prompt_tokens || 0;
            acc.completion += msg.usage.completion_tokens || 0;
          } else if (msg.role === "user") {
            acc.prompt += msg.token_usage;
          } else {
            acc.completion += msg.token_usage;
          }
        } else if (msg.usage) {
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

  // Update ConversationCache
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

  // Persist toolOutputs
  useEffect(() => {
    if (!currentConversationId || Object.keys(toolOutputs).length === 0) return;
    const sessionId = currentChat?.sessionId || -1;
    const folderPath = currentChat?.folderPath || null;
    saveConversation(
      sessionId,
      folderPath,
      messages,
      currentConversationId,
      currentChat || undefined,
      true,
      undefined,
      undefined,
      toolOutputs,
    );
  }, [toolOutputs, currentConversationId, currentChat]);

  // Persist singleLineReviewActions
  useEffect(() => {
    if (
      !currentConversationId ||
      Object.keys(singleLineReviewActions).length === 0
    )
      return;
    const sessionId = currentChat?.sessionId || -1;
    const folderPath = currentChat?.folderPath || null;
    saveConversation(
      sessionId,
      folderPath,
      messages,
      currentConversationId,
      currentChat || undefined,
      true,
      undefined,
      undefined,
      undefined,
      singleLineReviewActions,
    );
  }, [singleLineReviewActions, currentConversationId, currentChat]);

  // Load conversation
  useEffect(() => {
    const load = async () => {
      if (!currentChat) {
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
      const convId = (currentChat as any).conversationId;
      if (convId) {
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
          const pendingParent = sessionStorage.getItem(
            `zen-revert-parent:${convId}`,
          );
          if (pendingParent) revertParentMessageIdRef.current = pendingParent;
          setIsRestored(cached.messages.length > 0);
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
        setMessages([]);
        setCurrentConversationId("");
        setIsLoadingConversation(false);
      }
    };
    load();
  }, [currentChat?.sessionId, (currentChat as any)?.conversationId]);

  // Handle incoming messages
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      const data = event.data;
      if (data.command === "conversationResult") {
        if (data.data?.messages) {
          const restoredMessages = data.data.messages.map(
            (msg: Message, i: number) => ({
              ...msg,
              id: msg.id || `restored-${Date.now()}-${i}`,
            }),
          );
          setMessages(restoredMessages);

          if (
            data.data.toolOutputs &&
            Object.keys(data.data.toolOutputs).length > 0
          ) {
            setToolOutputs(data.data.toolOutputs);
          }

          if (
            data.data.singleLineReviewActions &&
            Object.keys(data.data.singleLineReviewActions).length > 0
          ) {
            window.postMessage(
              {
                command: "restoreSingleLineReviewActions",
                actions: data.data.singleLineReviewActions,
              },
              "*",
            );
          }

          const pendingParent = sessionStorage.getItem(
            `zen-revert-parent:${data.data?.conversationId}`,
          );
          if (pendingParent) revertParentMessageIdRef.current = pendingParent;

          if (data.data.messages.length > 0) {
            setIsRestored(true);
          }
          if (data.data.conversationId) {
            currentConversationIdRef.current = data.data.conversationId;
            setCurrentConversationId(data.data.conversationId);

            const lastMsgWithBackendId = [...restoredMessages]
              .reverse()
              .find((m: Message) => m.conversationId);
            const backendIdFromMsg = lastMsgWithBackendId?.conversationId;
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
            const backendIdToUse =
              backendIdFromMsg ||
              data.data.backendConversationId ||
              data.data.conversationId;
            setBackendConversationId(backendIdToUse, restoredMeta);

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
                name: lastAssistantMsgForMeta.modelId!,
              };
              accountToCache = {
                id: lastAssistantMsgForMeta.accountId!,
                email: lastAssistantMsgForMeta.email!,
              };
              setCurrentModel(modelToCache);
              setCurrentAccount(accountToCache);
            }
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

  // --- ChatFooter handlers ---
  const handleSend = (model: any, account: any) => {
    // Check for invalid external files before sending
    if (invalidExternalFiles && invalidExternalFiles.length > 0) {
      const vscodeApi = (window as any).vscodeApi;
      const message = `Cannot send message due to invalid file(s):\n${invalidExternalFiles.map((f) => `• ${f.name}: ${f.reason}`).join("\n")}\n\nPlease remove these files and try again.`;
      if (vscodeApi) {
        vscodeApi.postMessage({
          command: "showError",
          message: message,
        });
      } else {
        alert(message);
      }
      return;
    }

    if (
      message.trim() ||
      uploadedFiles.length > 0 ||
      attachedItems.length > 0
    ) {
      // Use refs (not state) to get the latest model/account values.
      // This prevents stale closure: if the user changed model right before
      // pressing Send, the state update may not have propagated into this
      // callback yet, but the ref always reflects the latest value.
      const latestModel = model || currentModelRef.current;
      const latestAccount = account || currentAccountRef.current;
      wrappedSendMessage(
        message,
        [...uploadedFiles, ...attachedItems],
        latestModel,
        latestAccount,
        undefined,
        undefined,
        undefined,
      );
      setMessage("");
      clearDraft();
      clearFiles();
      clearAttachedItems();
      clearInvalidExternalFiles();
      undoStackRef.current = [];
      undoIndexRef.current = -1;
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setMessage(value);
    checkMentions(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    handleDraftKeyDown(e, checkMentions);
  };

  const handleOpenImage = (file: any) => {
    const vscodeApi = (window as any).vscodeApi;
    if (vscodeApi) {
      vscodeApi.postMessage({
        command: "openTempImage",
        content: file.content,
        filename: file.name,
      });
    }
  };

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
  }, [showAtMenu, showMentionDropdown]);

  // Load Project Context
  useEffect(() => {
    const vscodeApi = (window as any).vscodeApi;
    if (vscodeApi) {
      vscodeApi.postMessage({ command: "loadProjectContext" });
    }
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.command === "projectContextResponse") {
        setProjectContext(message.context);
      } else if (message.command === "addAttachedItem") {
        const isFolder =
          message.itemType === "folder" ||
          (!message.uri.includes(".") && !message.itemType);
        addAttachedItem({
          id: Math.random().toString(36).substring(7),
          path: message.uri,
          type: isFolder ? "folder" : "file",
        });
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

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
    if (currentChat) {
      await deleteConversation(currentConversationId);
      setMessages([]);
      setIsProcessing(false);
      setCurrentConversationId(Date.now().toString());
    }
  };

  const handleStopGeneration = useCallback(() => {
    isStoppedRef.current = true;
    stopGeneration();
    setIsProcessing(false);
    setMessages((prev) => {
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
      const sessionId = currentChat?.sessionId || -1;
      const folderPath = currentChat?.folderPath || null;
      saveConversation(
        sessionId,
        folderPath,
        updated,
        currentConversationId,
        currentChat || undefined,
        true,
      );
      return updated;
    });
  }, [
    stopGeneration,
    setIsProcessing,
    setMessages,
    currentChat,
    currentConversationId,
  ]);

  // 🆕 Git handlers
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

  const handleGitPullRequest = useCallback(async () => {
    if (gitLoading) {
      return;
    }
    setGitLoading(true);
    setGitError(null);
    setShowGitStatusBlock(false);
    setGitCommitMessage(null);
    try {
      // Use extension service to run git status
      const vscodeApi = (window as any).vscodeApi;
      if (!vscodeApi) {
        console.error("[Git] vscodeApi not available");
        setGitError("Không thể kết nối với VSCode API");
        setGitLoading(false);
        return;
      }

      const requestId = `git-status-${Date.now()}`;
      console.log("[Git] Request ID:", requestId);

      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      const promise = new Promise<{
        output: string;
        error?: string;
        diffStats?: Record<string, { added: number; deleted: number }>;
      }>((resolve) => {
        const handler = (event: MessageEvent) => {
          const msg = event.data;
          if (
            msg.command === "gitStatusResult" &&
            msg.requestId === requestId
          ) {
            if (timeoutId) {
              clearTimeout(timeoutId);
              timeoutId = null;
            }
            window.removeEventListener("message", handler);
            resolve({
              output: msg.output,
              error: msg.error,
              diffStats: msg.diffStats,
            });
          }
        };
        window.addEventListener("message", handler);
        timeoutId = setTimeout(() => {
          window.removeEventListener("message", handler);
          resolve({ output: "", error: "Timeout" });
        }, 10000);
      });

      vscodeApi.postMessage({
        command: "runGitStatus",
        requestId,
      });

      const result = await promise;

      if (result.error && result.error !== "Timeout") {
        console.error("[Git] Error from git status:", result.error);
        setGitError(result.error);
        setGitLoading(false);
        return;
      }

      if (result.error === "Timeout") {
        console.error("[Git] Timeout waiting for git status");
        setGitError("Git status timeout. Vui lòng thử lại.");
        setGitLoading(false);
        return;
      }

      const output = result.output || "";
      const diffStats = result.diffStats || {};
      const lines = output.split("\n").filter((l: string) => l.trim());

      if (lines.length === 0 || output.trim() === "") {
        // Git status empty - show empty state with label
        setGitStatus({ items: [], raw: output });
        setShowGitStatusBlock(true);
        setGitLoading(false);
        return;
      }

      // Parse git status output
      const items: { status: string; path: string; staged: boolean }[] = [];
      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        // Format: "?? path", "M  path", "A  path", "M path", etc.
        const parts = trimmed.match(/^([\w?]+)\s+(.*)$/);
        if (parts) {
          const status = parts[1].trim();
          const path = parts[2].trim();
          // Check if staged (no ? in status, and not "??")
          const staged = !status.includes("?") && status !== "??";
          items.push({ status, path, staged });
        } else {
          // Fallback: treat as untracked
          items.push({ status: "?", path: trimmed, staged: false });
        }
      }

      // Add diff stats to items
      const itemsWithStats = items.map((item) => {
        const stats = diffStats[item.path];
        if (stats) {
          return { ...item, added: stats.added, deleted: stats.deleted };
        }
        return { ...item, added: 0, deleted: 0 };
      });

      setGitStatus({ items: itemsWithStats, raw: output, diffStats });

      // Add git status as a tool action using a formatted content string
      // that will be parsed by parseAIResponse
      const toolContent = `<git_status>
<items>${JSON.stringify(itemsWithStats)}</items>
<raw>${JSON.stringify(output)}</raw>
Đã kiểm tra git status. Tìm thấy ${itemsWithStats.length} thay đổi.
</git_status>`;

      const messageId = `msg-git-${Date.now()}`;
      const assistantMessage: Message = {
        id: messageId,
        role: "assistant",
        content: toolContent,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Also update toolOutputs so GitToolRenderer can access the raw output
      const actionId = `${messageId}-action-0`;
      setToolOutputs((prev) => ({
        ...prev,
        [actionId]: {
          output: output,
          isError: false,
        },
      }));
      setGitLoading(false);
    } catch (err) {
      console.error("[Git] Exception in handleGitPullRequest:", err);
      setGitError(err instanceof Error ? err.message : "Unknown error");
      setGitLoading(false);
    }
  }, [gitLoading]);

  const handleGitConfirm = useCallback(
    async (items?: any[]) => {
      console.log("[Git] currentConversationId:", currentConversationId);
      // Use provided items or fall back to gitStatus
      const statusItems = items || gitStatus?.items || [];
      if (statusItems.length === 0) {
        // Empty status - show notification
        const vscodeApi = (window as any).vscodeApi;
        if (vscodeApi) {
          vscodeApi.postMessage({
            command: "showInformation",
            message:
              "Chưa có thay đổi nào để commit. Hãy thêm file với 'git add' trước.",
          });
        }
        setShowGitStatusBlock(false);
        return;
      }

      // Send message to AI to generate commit message
      setGitCommitLoading(true);
      const gitStatusText = statusItems
        .map(
          (item) =>
            `${item.staged ? "[staged]" : "[unstaged]"} ${item.status} ${item.path}`,
        )
        .join("\n");

      // Use the current model and account to send a message
      const modelToUse = enrichedModel ?? currentModel;
      const accountToUse = currentAccount;

      if (!modelToUse || !accountToUse) {
        setGitCommitLoading(false);
        setGitError(
          "Vui lòng chọn model và account trước khi tạo commit message.",
        );
        return;
      }

      // Build prompt for AI using the structured template from prompts/commit-message.ts
      const commitLang = commitMessageLanguage || "vi";
      const formattedPrompt = getCommitMessagePrompt(commitLang, gitStatusText);
      const prompt = `[COMMIT_MESSAGE_REQUEST]\n${formattedPrompt}`;

      try {
        // Use sendMessage to send to AI with uiHidden: true to hide the user message
        // and skipLogic: true to bypass the first request logic
        await wrappedSendMessage(
          prompt,
          undefined, // no files
          modelToUse,
          accountToUse,
          true, // skipFirstRequestLogic = true
          undefined,
          true, // uiHidden = true
        );

        setGitCommitLoading(false);
        // The AI response will be displayed in the chat as a commit_message block
        setShowGitStatusBlock(false);
      } catch (err) {
        setGitCommitLoading(false);
        setGitError(
          err instanceof Error
            ? err.message
            : "Failed to generate commit message",
        );
      }
    },
    [
      gitStatus,
      enrichedModel,
      currentModel,
      currentAccount,
      wrappedSendMessage,
    ],
  );

  const handleGitCancel = useCallback(() => {
    setShowGitStatusBlock(false);
    setGitCommitMessage(null);
    setGitError(null);
    setGitCommitInput("");
  }, []);

  const handleGitRetry = useCallback(async () => {
    if (!gitCommitInput?.trim() || !gitStatus) return;

    setGitCommitLoading(true);
    const gitStatusText = gitStatus.items
      .map(
        (item) =>
          `${item.staged ? "[staged]" : "[unstaged]"} ${item.status} ${item.path}`,
      )
      .join("\n");

    const modelToUse = enrichedModel ?? currentModel;
    const accountToUse = currentAccount;

    if (!modelToUse || !accountToUse) {
      setGitCommitLoading(false);
      setGitError(
        "Vui lòng chọn model và account trước khi tạo commit message.",
      );
      return;
    }

    const prompt = `Hãy tạo một commit message dựa trên danh sách file thay đổi sau:

\`\`\`
${gitStatusText}
\`\`\`

Yêu cầu bổ sung: ${gitCommitInput.trim()}

Yêu cầu:
- Sử dụng cấu trúc: <emoji> <type>(<scope>): <subject>
- Liệt kê các thay đổi chi tiết với dấu "-" ở đầu dòng
- Viết bằng tiếng Việt
- Commit message ngắn gọn, rõ ràng, có ý nghĩa`;

    try {
      await wrappedSendMessage(
        prompt,
        undefined,
        modelToUse,
        accountToUse,
        false,
        undefined,
        undefined,
      );
      setGitCommitLoading(false);
      setGitCommitInput("");
      setShowGitStatusBlock(false);
    } catch (err) {
      setGitCommitLoading(false);
      setGitError(
        err instanceof Error
          ? err.message
          : "Failed to generate commit message",
      );
    }
  }, [
    gitCommitInput,
    gitStatus,
    enrichedModel,
    currentModel,
    currentAccount,
    wrappedSendMessage,
  ]);

  const handleGitCommit = useCallback(async (message: string) => {
    if (!message.trim()) return;
    const vscodeApi = (window as any).vscodeApi;
    if (!vscodeApi) {
      setGitError("Không thể kết nối với VSCode API");
      return;
    }

    setGitCommitLoading(true);
    try {
      const requestId = `git-commit-${Date.now()}`;
      const promise = new Promise<{ success: boolean; error?: string }>(
        (resolve) => {
          const handler = (event: MessageEvent) => {
            const msg = event.data;
            if (
              msg.command === "gitCommitResult" &&
              msg.requestId === requestId
            ) {
              window.removeEventListener("message", handler);
              resolve({ success: msg.success, error: msg.error });
            }
          };
          window.addEventListener("message", handler);
          setTimeout(() => {
            window.removeEventListener("message", handler);
            resolve({ success: false, error: "Timeout" });
          }, 15000);
        },
      );

      vscodeApi.postMessage({
        command: "gitCommitAndPush",
        requestId,
        message: message.trim(),
      });

      const result = await promise;
      setGitCommitLoading(false);
      if (result.success) {
        setGitCommitMessage(null);
        setShowGitStatusBlock(false);
        vscodeApi.postMessage({
          command: "showInformation",
          message: "✅ Commit và push thành công!",
        });
      } else {
        setGitError(result.error || "Commit failed");
      }
    } catch (err) {
      setGitCommitLoading(false);
      setGitError(err instanceof Error ? err.message : "Commit failed");
    }
  }, []);

  // Listen for AI response containing commit message
  useEffect(() => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === "assistant" && !lastMessage.isCancelled) {
      const content = lastMessage.content;
      // Check if this looks like a commit message
      if (content && content.includes(":") && content.includes("-")) {
        const lines = content.split("\n").filter((l) => l.trim());
        // Simple heuristic: has emoji or conventional commit format
        const hasCommitFormat = lines.some(
          (l) => /^[\u{1F300}-\u{1F9FF}]/u.test(l) || /^[a-z]+\(/.test(l),
        );
        if (hasCommitFormat) {
          setGitCommitMessage(content);
        }
      }
    }
  }, [messages]);

  const firstRequestMessage = messages.find((m) => m.role === "user");

  // ChatHeader helpers
  const formatTokens = (num: number) => {
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  };

  const providerId = currentModel?.providerId || "deepseek";
  let faviconUrl =
    "https://www.google.com/s2/favicons?domain=deepseek.com&sz=64";
  if (providerId.toLowerCase().includes("openai"))
    faviconUrl = "https://www.google.com/s2/favicons?domain=openai.com&sz=64";
  else if (providerId.toLowerCase().includes("anthropic"))
    faviconUrl =
      "https://www.google.com/s2/favicons?domain=anthropic.com&sz=64";
  else if (providerId.toLowerCase().includes("google"))
    faviconUrl = "https://www.google.com/s2/favicons?domain=google.com&sz=64";
  else if (providerId.toLowerCase().includes("openrouter"))
    faviconUrl =
      "https://www.google.com/s2/favicons?domain=openrouter.ai&sz=64";

  const totalTokens = contextUsage?.total ?? 0;
  const footerPaddingBottom =
    showBrowserWarning && currentModel?.providerId === "zai-browser"
      ? "20px"
      : "8px";

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
      {/* ─── ChatHeader (inlined) ─── */}
      <div
        style={{
          borderBottom: "1px solid var(--border-color)",
          backgroundColor: "var(--primary-bg)",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <div
          style={{
            padding: "8px 12px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "8px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--primary-text)",
              overflow: "hidden",
            }}
          >
            <img
              src={faviconUrl}
              alt="provider"
              style={{ width: "14px", height: "14px", borderRadius: "2px" }}
            />
            <span style={{ whiteSpace: "nowrap" }}>
              {providerId}/{currentModel?.id || "chat"}
            </span>
            {currentAccount?.email && (
              <span
                style={{
                  opacity: 0.7,
                  fontStyle: "italic",
                  fontWeight: "normal",
                  fontSize: "11px",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: "150px",
                }}
                title={currentAccount.email}
              >
                {currentAccount.email}
              </span>
            )}
            {currentTaskName && (
              <>
                <span style={{ opacity: 0.3 }}>|</span>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    fontSize: "11px",
                    color: "var(--vscode-textLink-foreground)",
                    fontWeight: 500,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: "5px",
                      height: "5px",
                      borderRadius: "50%",
                      backgroundColor: "currentColor",
                      flexShrink: 0,
                    }}
                  />
                  <span
                    style={{
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {currentTaskName}
                  </span>
                </div>
              </>
            )}
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                fontSize: "11px",
                color: "var(--secondary-text)",
                opacity: 0.8,
              }}
            >
              {contextUsage ? formatTokens(contextUsage.total) : "0"}
            </span>
            <button
              onClick={() => {
                setIsSearchOpen((v) => !v);
                if (isSearchOpen) setSearchQuery("");
              }}
              title="Search in chat"
              style={{
                background: isSearchOpen
                  ? "color-mix(in srgb, var(--vscode-button-background) 15%, transparent)"
                  : "transparent",
                border: isSearchOpen
                  ? "1px solid color-mix(in srgb, var(--vscode-button-background) 40%, transparent)"
                  : "1px solid transparent",
                cursor: "pointer",
                padding: "3px 4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: isSearchOpen
                  ? "var(--vscode-button-background, var(--vscode-textLink-foreground))"
                  : "var(--vscode-icon-foreground, var(--secondary-text))",
                opacity: isSearchOpen ? 1 : 0.65,
                borderRadius: "4px",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                if (!isSearchOpen) e.currentTarget.style.opacity = "1";
              }}
              onMouseLeave={(e) => {
                if (!isSearchOpen) e.currentTarget.style.opacity = "0.65";
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m13 13.5 2-2.5-2-2.5" />
                <path d="m21 21-4.3-4.3" />
                <path d="M9 8.5 7 11l2 2.5" />
                <circle cx="11" cy="11" r="8" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* ─── ChatBody ─── */}
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
        onGitConfirm={handleGitConfirm}
        onGitCancel={handleGitCancel}
        gitStatusItems={gitStatus?.items || []}
        isGitProcessing={gitCommitLoading}
      />

      {/* ─── ChatFooter (inlined) ─── */}
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
          paddingBottom: footerPaddingBottom,
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
          onOpenImage={handleOpenImage}
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
            isGitLoading={gitLoading}
          />
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;
