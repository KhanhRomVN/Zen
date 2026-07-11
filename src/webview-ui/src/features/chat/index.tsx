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
import { saveConversation } from "./services/ConversationService";
import { useChatLLM } from "./hooks/llm/useChatLLM";
import { useToolExecution } from "./hooks/tools/useToolExecution";
import { useWorkspaceData } from "./hooks/workspace/useWorkspaceData";
import { useGitOperations } from "./hooks/workspace/useGitOperations";
import { useConversationRestore } from "./hooks/conversation/useConversationRestore";
import { useFileHandling } from "../../hooks/useFileHandling";
import { useMentionSystem } from "./hooks/ui/useMentionSystem";
import { ChatSession } from "./types/chat";
import { Message } from "./types/message";
import { ConversationCache } from "./services/ConversationCache";
import ChatHeader from "./components/ChatHeader";
import ChatBody from "./components/ChatBody";
import ChatFooter from "./components/ChatFooter";
import { ChatErrorBoundary } from "./components/ChatErrorBoundary";
import { parseAIResponse } from "./services/ResponseParser";
import { useTerminalPolling } from "./hooks/tools/useTerminalPolling";
import { CONTEXT_COMPRESSION_THRESHOLD } from "./constants/constants";
import { useBrowserSession } from "./hooks/llm/useBrowserSession";
import { useDraftManagement } from "./hooks/conversation/useDraftManagement";

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

  const { commitMessageLanguage } = useSettings();

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Git state - managed by useGitOperations hook

  // Revert state - managed by useConversationRestore hook
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

  // Revert state — owned by component so useDraftManagement can access it
  const [revertInput, setRevertInput] = useState<{
    value: string;
    nonce: number;
  } | null>(null);
  const revertParentMessageIdRef = useRef<string | null>(null);

  // 🆕 Loaded conversation file stats from history
  const [loadedConversationFileStats, setLoadedConversationFileStats] =
    useState<{
      totalFiles: number;
      totalAdditions: number;
      totalDeletions: number;
    } | null>(null);

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

  // Git operations
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

  // Conversation restore
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

  // Reset hasProcessedInitial whenever a new tab/chat session starts
  useEffect(() => {
    hasProcessedInitial.current = false;
    resetSession();
    setLoadedConversationFileStats(null); // Reset loaded stats for new conversation
  }, [currentChat?.sessionId]);

  // --- Memoized Values ---
  const isHistoryMode = useMemo(() => {
    return !!(currentChat as any)?.conversationId && !currentChat?.canAccept;
  }, [currentChat]);

  // Parse cache — reuse results across renders, avoiding redundant re-parses
  // when only unrelated state changes (same messages array, same content).
  const parseCacheRef = useRef<Map<string, ReturnType<typeof parseAIResponse>>>(
    new Map(),
  );

  const parsedMessages = useMemo(() => {
    const cache = parseCacheRef.current;
    return messages.map((msg: Message) => {
      if (!cache.has(msg.content)) {
        cache.set(msg.content, parseAIResponse(msg.content));
      }
      return { ...msg, parsed: cache.get(msg.content)! };
    });
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

  // Calculate conversation file stats from messages
  const conversationFileStats = useMemo(() => {
    // If we have loaded stats from history and no new messages, use loaded stats
    if (
      loadedConversationFileStats &&
      messages.length > 0 &&
      messages.every(
        (m) =>
          !m.content?.includes("<write_to_file>") &&
          !m.content?.includes("<str_replace>"),
      )
    ) {
      return loadedConversationFileStats;
    }

    const fileChanges = new Map<
      string,
      { additions: number; deletions: number }
    >();

    messages.forEach((msg) => {
      if (msg.role === "assistant" && msg.content) {
        // Match write_to_file
        const writeMatches = msg.content.matchAll(
          /<write_to_file>\s*<file_path>([^<]+)<\/file_path>\s*<content>([\s\S]*?)<\/content>\s*<\/write_to_file>/g,
        );

        for (const match of writeMatches) {
          const filePath = match[1];
          const content = match[2];

          if (filePath) {
            if (!fileChanges.has(filePath)) {
              fileChanges.set(filePath, { additions: 0, deletions: 0 });
            }

            const stats = fileChanges.get(filePath)!;
            const lines = content.split("\n").length;
            stats.additions += lines;
          }
        }

        // Match str_replace
        const replaceMatches = msg.content.matchAll(
          /<str_replace>\s*<file_path>([^<]+)<\/file_path>\s*<old_str>([\s\S]*?)<\/old_str>\s*<new_str>([\s\S]*?)<\/new_str>\s*<\/str_replace>/g,
        );

        for (const match of replaceMatches) {
          const filePath = match[1];
          const oldStr = match[2];
          const newStr = match[3];

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
      }
    });

    const totalFiles = fileChanges.size;
    const totalAdditions = Array.from(fileChanges.values()).reduce(
      (sum, stat) => sum + stat.additions,
      0,
    );
    const totalDeletions = Array.from(fileChanges.values()).reduce(
      (sum, stat) => sum + stat.deletions,
      0,
    );

    return {
      totalFiles,
      totalAdditions,
      totalDeletions,
    };
  }, [messages, loadedConversationFileStats]);

  // Trigger context compression
  const triggerContextCompression = useCallback(() => {
    // Prevent multiple compression requests
    if (isProcessing) {
      console.warn(
        "[Zen][ContextCompression] Already processing - ignoring request",
      );
      return;
    }

    try {
      // Inline CONTEXT_COMPRESSION_PROMPT to avoid dynamic import blocking
      const CONTEXT_COMPRESSION_PROMPT = `<context_compression_request>
You are helping compress a long conversation that has exceeded 100K tokens. Your task is to create a concise but complete summary that preserves all critical information needed to continue the work.

## What to Include in Summary

1. **Current Task/Goal**: What is the user trying to accomplish? What's the main objective?

2. **Progress Made**: What has been completed so far? List key milestones, features implemented, or problems solved.

3. **Current State**: 
   - What files have been created/modified?
   - What is the current architecture or structure?
   - What patterns or conventions are being used?

4. **Active Context**:
   - What are you currently working on?
   - What was the last action taken?
   - Are there any pending tasks or next steps?

5. **Important Decisions**: Any architectural decisions, design choices, or constraints that must be remembered.

6. **Known Issues/Blockers**: Any problems encountered, workarounds applied, or limitations discovered.

## CRITICAL FORMAT REQUIREMENT

You MUST wrap your entire summary inside <conversation_compress></conversation_compress> XML tags.

**IMPORTANT**: There MUST NOT be ANY content after the closing </conversation_compress> tag. End your response immediately after closing the tag.

Structure your summary in clear sections using markdown INSIDE the tags:

<conversation_compress>
# Task Summary

## Objective
[Brief description of what user is trying to achieve]

## Progress Completed
- [Key milestone 1]
- [Key milestone 2]
...

## Current State
- Files modified: [list]
- Architecture: [brief description]
- Key patterns: [list]

## Active Work
[What you're currently doing]

## Next Steps
- [Step 1]
- [Step 2]
...

## Important Notes
[Any critical information, decisions, or constraints]
</conversation_compress>

## Guidelines

- Be concise but complete - aim for 500-1000 words
- Focus on information needed to continue work seamlessly
- Omit chat meta-discussion, off-topic tangents, or failed attempts
- Preserve exact file names, paths, and technical terms
- Include code patterns/conventions if relevant
- Do NOT include greetings or meta-commentary
- **MUST use <conversation_compress> tags to wrap the summary**
- **CRITICAL: Do NOT add any text, explanation, or content after the closing </conversation_compress> tag**

Generate the summary now:
</context_compression_request>`;

      // CRITICAL FIX: Use setTimeout to break out of the current call stack
      // This prevents UI freeze by allowing the browser to process pending updates
      setTimeout(() => {
        // Check if conversation exists
        const hasConversation =
          currentConversationIdRef.current && messages.length > 0;

        if (!hasConversation) {
          console.warn(
            "[Zen][ContextCompression] No active conversation - compression not possible",
          );
          return;
        }

        // Use sendMessage directly instead of wrappedSendMessage to avoid ref issues
        // Use skipFirstRequestLogic=true since this is an internal request for existing conversation
        sendMessage(
          CONTEXT_COMPRESSION_PROMPT,
          undefined,
          currentModelRef.current, // Use ref to get latest model
          currentAccountRef.current, // Use ref to get latest account
          true, // skipFirstRequestLogic=true (conversation already exists)
          undefined,
          true, // uiHidden=true - hide internal compression request
        );
      }, 0);
    } catch (error) {
      console.error(
        "[Zen][ContextCompression] Error triggering compression:",
        error,
      );
    }
  }, [sendMessage, isProcessing]); // Add isProcessing dependency

  const shouldShowCompressionButton = true; // Always show button

  // Handle model switch from MessageInput
  const handleModelSwitch = useCallback(
    (
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
    ) => {
      // Extract user messages from current range
      const currentRange = messages.reduce(
        (acc, msg, idx) => {
          if (msg.role === "user" && !msg.uiHidden) {
            acc.push({
              content: msg.content,
              index: idx,
            });
          }
          return acc;
        },
        [] as Array<{ content: string; index: number }>,
      );

      // Get last few user messages (e.g., last 3)
      const recentUserMessages = currentRange.slice(-3).map((m, i) => ({
        content: m.content,
        responseNumber: currentRange.length - 3 + i + 1,
      }));

      // Update contextData with user messages
      contextData.userMessages = recentUserMessages;

      // Create ModelUsageInfo message as a system message
      const modelSwitchMessage: Message = {
        id: `model-switch-${Date.now()}`,
        role: "system" as const,
        content: `__MODEL_SWITCH__::${JSON.stringify({
          providerId: newModel.providerId,
          modelId: newModel.id,
          email: newAccount.email,
          websiteUrl: providers.find(
            (p: any) => p.provider_id === newModel.providerId,
          )?.website,
        })}`,
        timestamp: Date.now(),
        conversationId: currentConversationId || "",
        token_usage: 0,
      };

      // Add to messages
      setMessages((prev: Message[]) => [...prev, modelSwitchMessage]);

      // Save conversation with new model switch message
      const sessionId = currentChat?.sessionId || -1;
      const folderPath = currentChat?.folderPath || null;
      saveConversation(
        sessionId,
        folderPath,
        [...messages, modelSwitchMessage],
        currentConversationId,
        currentChat || undefined,
        true,
      );
    },
    [messages, currentConversationId, currentChat, providers, setMessages],
  );

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

  // Sync currentModel/currentAccount from initialMessageData whenever it changes.
  // CRITICAL: ChatPanel is never unmounted — App.tsx hides it with display:none
  // so that useState initializers only run once (at first mount). When the user
  // switches models in HomePanel and sends a message, initialMessageData prop
  // changes but currentModel state stays stale (old model). This effect ensures
  // the header and all subsequent interactions use the correct new model.
  useEffect(() => {
    if (initialMessageData?.model) {
      setCurrentModel(initialMessageData.model);
    }
    if (initialMessageData?.account) {
      setCurrentAccount(initialMessageData.account);
    }
  }, [initialMessageData]);

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
        conversationFileStats:
          conversationFileStats.totalFiles > 0
            ? conversationFileStats
            : existing?.conversationFileStats,
      });
    }
  }, [
    messages,
    currentConversationId,
    currentModel,
    currentAccount,
    toolOutputs,
    conversationFileStats,
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

  // Persist conversationFileStats
  useEffect(() => {
    if (!currentConversationId || conversationFileStats.totalFiles === 0)
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
      undefined,
      conversationFileStats,
    );
  }, [conversationFileStats, currentConversationId, currentChat]);

  // Conversation restore is now handled by useConversationRestore hook

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
      } else if (message.command === "createConversationWithSummary") {
        // Context Compression Flow:
        // 1. User clicks "Accept" in ContextCompressionBlock
        // 2. Creates hidden summary message (uiHidden: true) as context
        // 3. Saves conversation with summary
        // 4. Waits for user to send next message
        // 5. When user sends message, hidden summary is included in API context automatically
        //    (useChatLLM.ts only filters isError messages, not uiHidden messages)
        const summary = message.summary;
        if (summary) {
          // Create summary message as hidden context
          const summaryMessage: Message = {
            id: `summary-${Date.now()}`,
            role: "user",
            content: `Context from previous conversation (auto-compressed due to exceeding 100K tokens):\n\n${summary}`,
            timestamp: Date.now(),
            conversationId: currentConversationId || "",
            token_usage: 0,
            uiHidden: true, // Hide from UI but keep in context
          };

          // Add summary message to conversation
          setMessages((prev) => [...prev, summaryMessage]);

          // Save conversation with new summary context
          const sessionId = currentChat?.sessionId || -1;
          const folderPath = currentChat?.folderPath || null;
          saveConversation(
            sessionId,
            folderPath,
            [...messages, summaryMessage],
            currentConversationId,
            currentChat || undefined,
            true,
          );

          // Don't auto-send empty message - wait for user input
          // The hidden summary will be included in context when user sends next message
        }
      }
    };
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [currentChat, currentConversationId, setMessages]);

  // --- Handlers ---
  const handleClearChat = useCallback(() => {
    extensionService.postMessage({
      command: "confirmClearChat",
      conversationId: currentConversationId,
    });
  }, [currentConversationId]);

  const handleStopGeneration = useCallback(() => {
    isStoppedRef.current = true;
    stopGeneration();
    setIsProcessing(false);
    setMessages((prev: any) => {
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

  const handleBackToHome = useCallback(
    (summary: string) => {
      // Navigate back to Home and pass the summary to auto-paste into MessageInput
      onBack(summary);
    },
    [onBack],
  );

  // Listen for AI response containing commit message - using hook's detector
  useEffect(() => {
    handleGitCommitMessageDetected(messages);
  }, [messages, handleGitCommitMessageDetected]);

  const firstRequestMessage = messages.find((m) => m.role === "user");

  // Use enrichedModel (model with full capability flags) for header display,
  // same source as what MessageInput receives — ensures header always matches
  // the model the user has actually selected/switched to.
  const displayedModel = enrichedModel ?? currentModel;

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
        onTriggerCompression={triggerContextCompression}
        gitStatus={gitStatus}
        onOpenGitStatus={() => setShowGitStatusBlock(true)}
        loadedConversationFileStats={loadedConversationFileStats}
        onModelSwitch={handleModelSwitch}
      />
    </div>
  );
};

export default ChatPanel;
