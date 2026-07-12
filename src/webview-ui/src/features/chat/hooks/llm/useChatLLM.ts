import { useState, useRef, useCallback, useEffect, useReducer } from "react";
import { Message, QuestionAnswer } from "../../types/message";
import { ToolAction, parseAIResponse } from "../../services/ResponseParser";
import { getDefaultPrompt, combinePrompts } from "../../prompts";
import {
  CHECKPOINT_REMINDER,
  CHECKPOINT_INTERVAL,
  buildPermissionModeTag,
} from "../../prompts";
import {
  logChatToWorkspace,
  saveConversation,
  calculateTokens,
  deleteConversation,
} from "../../services/ConversationService";
import { useSettings } from "../../../../context/SettingsContext";
import { useProject } from "../../../../context/ProjectContext";
import { extensionService } from "@/services/ExtensionService";
import { useFileUpload } from "../workspace/useFileUpload";
import { ChatSession } from "../../types/chat";

/**
 * Parse <question-answer> tag from user message content
 * Format: <question-answer>\n1. {questionId}: {answer}\n2. {questionId}: {answer}\n</question-answer>
 * Returns Record<questionId, QuestionAnswer>
 */
const parseQuestionAnswerTag = (
  content: string,
): Record<string, QuestionAnswer> | null => {
  const regex = /<question-answer>([\s\S]*?)<\/question-answer>/i;
  const match = regex.exec(content);
  if (!match) return null;

  const innerContent = match[1].trim();
  const answers: Record<string, QuestionAnswer> = {};

  // Parse each line: "1. {questionId}: {answer}"
  const lines = innerContent.split("\n");
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed === "No answer") continue;

    // Match pattern: "N. questionId: answer"
    const lineMatch = /^\d+\.\s+([^:]+):\s+(.+)$/i.exec(trimmed);
    if (!lineMatch) continue;

    const questionId = lineMatch[1].trim();
    const answerValue = lineMatch[2].trim();

    // Parse answer value (could be array for multi-choice)
    let parsedValue: string | string[] | boolean = answerValue;

    // Check if it's a boolean (for confirm type)
    if (answerValue.toLowerCase() === "true") {
      parsedValue = true;
    } else if (answerValue.toLowerCase() === "false") {
      parsedValue = false;
    } else if (answerValue.includes(",")) {
      // Array for multi-choice
      parsedValue = answerValue.split(",").map((v) => v.trim());
    }

    answers[questionId] = {
      questionId,
      value: parsedValue,
    };
  }

  return Object.keys(answers).length > 0 ? answers : null;
};

/** Returns only top-level entries from a formatted tree string. */
const getShallowTree = (tree: string): string => {
  const lines = tree.split("\n");
  const result: string[] = [];
  let currentFolder: string | null = null;
  let fileCount = 0;

  const flush = () => {
    if (currentFolder !== null) {
      result.push(`${currentFolder} (${fileCount} files)`);
      currentFolder = null;
      fileCount = 0;
    }
  };

  for (const line of lines) {
    if (!line.trim()) continue;
    const isTopLevel = !/^ /.test(line);
    if (isTopLevel) {
      flush();
      if (line.trimEnd().endsWith("/")) {
        currentFolder = line.trimEnd();
      } else {
        result.push(line);
      }
    } else if (currentFolder !== null) {
      if (!line.trimEnd().endsWith("/")) fileCount++;
    }
  }
  flush();
  return result.join("\n");
};

interface UseChatLLMProps {
  apiUrl: string;
  selectedTab: ChatSession | null;
  onConversationIdChange?: (id: string) => void;
  onToolRequest?: (
    actions: ToolAction[],
    assistantMessage: Message,
    isAutoTrigger?: boolean,
    actionType?: "accept_all" | "accept_once" | "reject",
  ) => void;
}

// Streaming state combined into single object to reduce re-renders
interface StreamingState {
  isProcessing: boolean;
  isStreaming: boolean;
  isContinuing: boolean;
  incompleteHasPartialTool: boolean;
  incompletePartialToolType: string | null;
}

type StreamingAction =
  | { type: "SET_PROCESSING"; payload: boolean }
  | { type: "SET_STREAMING"; payload: boolean }
  | { type: "SET_CONTINUING"; payload: boolean }
  | { type: "SET_INCOMPLETE_TOOL"; payload: { hasPartial: boolean; toolType: string | null } }
  | { type: "RESET_STREAMING" }
  | { type: "STOP_ALL" };

const streamingReducer = (state: StreamingState, action: StreamingAction): StreamingState => {
  switch (action.type) {
    case "SET_PROCESSING":
      return { ...state, isProcessing: action.payload };
    case "SET_STREAMING":
      return { ...state, isStreaming: action.payload };
    case "SET_CONTINUING":
      return { ...state, isContinuing: action.payload };
    case "SET_INCOMPLETE_TOOL":
      return {
        ...state,
        incompleteHasPartialTool: action.payload.hasPartial,
        incompletePartialToolType: action.payload.toolType,
      };
    case "RESET_STREAMING":
      return {
        ...state,
        isStreaming: false,
        isContinuing: false,
        incompleteHasPartialTool: false,
        incompletePartialToolType: null,
      };
    case "STOP_ALL":
      return {
        isProcessing: false,
        isStreaming: false,
        isContinuing: false,
        incompleteHasPartialTool: false,
        incompletePartialToolType: null,
      };
    default:
      return state;
  }
};

export const useChatLLM = ({
  apiUrl,
  selectedTab,
  onConversationIdChange,
  onToolRequest,
}: UseChatLLMProps) => {
  // Track render count for performance monitoring
  const renderCountRef = useRef(0);
  const prevDepsRef = useRef<any>({});
  renderCountRef.current++;
  
  // Get context values
  const { aiLanguage, permissionMode } = useSettings();
  const { workspace, treeView } = useProject();
  const { uploadFiles } = useFileUpload(apiUrl);
  const [messages, setMessages] = useState<Message[]>([]);
  
  // Replace multiple state variables with single reducer
  const [streamingState, dispatchStreaming] = useReducer(streamingReducer, {
    isProcessing: false,
    isStreaming: false,
    isContinuing: false,
    incompleteHasPartialTool: false,
    incompletePartialToolType: null,
  });
  
  // Debug logging - track what triggers re-renders
  const deps: Record<string, any> = {
    messagesLen: messages.length,
    isProcessing: streamingState.isProcessing,
    isStreaming: streamingState.isStreaming,
    isContinuing: streamingState.isContinuing,
    aiLanguage,
    permissionMode,
    workspaceLen: workspace?.length || 0,
    treeViewLen: treeView?.length || 0,
  };
  
  if (renderCountRef.current > 1) {
    const prev = prevDepsRef.current;
    const changed = Object.keys(deps).filter(k => deps[k] !== prev[k]);
    if (changed.length > 0) {
      console.log(`[ZEN-PERF] 🔄 useChatLLM - Render #${renderCountRef.current} - Changed:`, 
        changed.map(k => `${k}: ${prev[k]} → ${deps[k]}`).join(', '));
    }
  }
  prevDepsRef.current = deps;
  
  const isProcessingRef = useRef(false);
  const setIsProcessingSync = useCallback((val: boolean) => {
    isProcessingRef.current = val;
    dispatchStreaming({ type: "SET_PROCESSING", payload: val });
  }, []);
  
  // DeepSeek: true khi server đang tự động gọi /chat/continue để lấy phần còn lại của response dài
  // Ref để tránh stale closure bên trong sendMessage useCallback
  const isContinuingRef = useRef(false);
  const setIsContinuingSync = (val: boolean) => {
    isContinuingRef.current = val;
    dispatchStreaming({ type: "SET_CONTINUING", payload: val });
  };
  const [currentConversationId, setCurrentConversationId] =
    useState<string>("");
  const [conversationToolOverrides, setConversationToolOverrides] = useState<
    Record<string, "auto">
  >({});

  const messagesRef = useRef<Message[]>([]);
  const currentConversationIdRef = useRef<string>("");
  const backendConversationIdRef = useRef<string>(""); // real conversation_id from backend API
  const lastUsedModelRef = useRef<any>(null);
  const lastUsedAccountRef = useRef<any>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  // Qwen: lưu parent_id từ stream metadata để gửi cho request tiếp theo
  // Chỉ dùng cho Qwen — provider khác server sẽ bỏ qua field này
  const qwenParentIdRef = useRef<string | undefined>(undefined);
  // Track user request count for checkpoint reminder injection
  const userRequestCountRef = useRef<number>(0);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    // Only sync state → ref if ref is empty or matches (avoid overwriting a newer sync set)
    if (
      !currentConversationIdRef.current ||
      currentConversationIdRef.current === currentConversationId
    ) {
      currentConversationIdRef.current = currentConversationId;
    }
    onConversationIdChange?.(currentConversationId);
  }, [currentConversationId, onConversationIdChange]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const { command, actionId } = event.data;
      if (
        (command === "markActionClicked" || command === "markActionFailed") &&
        actionId
      ) {
        const messageId = actionId.split("-action-")[0];
        if (messageId) {
          setMessages((prev) => {
            const updated = prev.map((m) => {
              if (m.id === messageId) {
                const currentClicked = m.clickedActions || [];
                if (!currentClicked.includes(actionId)) {
                  return {
                    ...m,
                    clickedActions: [...currentClicked, actionId],
                  };
                }
              }
              return m;
            });

            // Persist the changes
            const sessionId = selectedTab?.sessionId || -1;
            const folderPath = selectedTab?.folderPath || null;
            saveConversation(
              sessionId,
              folderPath,
              updated,
              currentConversationIdRef.current,
              selectedTab || undefined,
              true, // skipTimestampUpdate
              undefined,
              backendConversationIdRef.current,
            );

            return updated;
          });
        }
      }

      if (command === "markActionRejected" && actionId) {
        const messageId = actionId.split("-action-")[0];
        if (messageId) {
          setMessages((prev) => {
            const updated = prev.map((m) => {
              if (m.id === messageId) {
                const currentRejected = m.rejectedActions || [];
                if (!currentRejected.includes(actionId)) {
                  return {
                    ...m,
                    rejectedActions: [...currentRejected, actionId],
                  };
                }
              }
              return m;
            });

            const sessionId = selectedTab?.sessionId || -1;
            const folderPath = selectedTab?.folderPath || null;
            saveConversation(
              sessionId,
              folderPath,
              updated,
              currentConversationIdRef.current,
              selectedTab || undefined,
              true,
              undefined,
              backendConversationIdRef.current,
            );

            return updated;
          });
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [selectedTab]);

  /**
   * Synchronously reset all session state and refs.
   * Call this when starting a brand-new chat so sendMessage sees isNewSession=true.
   */
  const resetSession = useCallback(() => {
    currentConversationIdRef.current = "";
    backendConversationIdRef.current = "";
    messagesRef.current = [];
    lastUsedModelRef.current = null;
    lastUsedAccountRef.current = null;
    qwenParentIdRef.current = undefined;
    userRequestCountRef.current = 0; // Reset checkpoint counter
    setCurrentConversationId("");
    setMessages([]);
    setIsProcessingSync(false);
    dispatchStreaming({ type: "STOP_ALL" });
    setConversationToolOverrides({});
  }, []);

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Cleanup if it was the first turn of a new session
    if (streamingState.isProcessing && messagesRef.current.length <= 2) {
      const chatId = currentConversationIdRef.current;
      if (chatId) {
        deleteConversation(chatId);
        setCurrentConversationId("");
        setMessages([]);
        userRequestCountRef.current = 0; // Reset checkpoint counter
      }
    }

    dispatchStreaming({ type: "STOP_ALL" });

    // Stop all processes in the extension
    extensionService.postMessage({
      command: "stopCommand",
      actionId: "all",
      kill: true,
    });
  }, [streamingState.isProcessing]);

  const sendMessage = useCallback(
    async (
      content: string,
      files?: any[],
      model?: any,
      account?: any,
      skipFirstRequestLogic?: boolean,
      actionIds?: string[],
      uiHidden?: boolean,
      parentMessageId?: string,
    ) => {
      if (isProcessingRef.current && !skipFirstRequestLogic) {
        return;
      }

      const sessionId = selectedTab?.sessionId || -1;
      const folderPath = selectedTab?.folderPath || null;

      // Clean up ghosted (cancelled) messages
      const currentMessages = messagesRef.current;
      const filteredMessages = currentMessages.filter((m) => !m.isCancelled);

      let effectiveChatUuid = currentConversationIdRef.current;
      const isNewSession = !effectiveChatUuid;

      // GUARD: tool results must never create a new session — they belong to the current one
      if (skipFirstRequestLogic && isNewSession) {
        console.warn(
          "[Zen][useChatLLM][sendMessage] Tool request on new session - aborting",
        );
        return;
      }
      if (isNewSession) {
        effectiveChatUuid = crypto.randomUUID?.() || Date.now().toString();
        currentConversationIdRef.current = effectiveChatUuid; // sync update immediately
        setCurrentConversationId(effectiveChatUuid);
        backendConversationIdRef.current = ""; // reset for new session
        // Pin model/account from caller immediately — before any async ops.
        // This prevents resetSession() race or stream metadata from overwriting
        // the model the user just selected.
        if (model) lastUsedModelRef.current = model;
        if (account) lastUsedAccountRef.current = account;
        setConversationToolOverrides({});

        // Tell extension to create an empty log file
        extensionService.postMessage({
          command: "createEmptyChatLog",
          chatUuid: effectiveChatUuid,
        });
      }

      const isReq1 = filteredMessages.length === 0 && !skipFirstRequestLogic;
      let systemPrompt = "";
      let projectContextStr = "";

      if (isReq1) {
        let systemInfo = {
          os: "Unknown OS",
          ide: "Zen IDE",
          shell: "unknown",
          homeDir: "~",
          cwd: ".",
          language: aiLanguage || aiLanguage,
        };

        try {
          const fetchedInfo = await extensionService.getSystemInfo();
          if (fetchedInfo?.data) {
            systemInfo = {
              ...systemInfo,
              ...fetchedInfo.data,
              language: aiLanguage || aiLanguage,
            };
          }
        } catch (e) {}

        const effectiveLang = aiLanguage || aiLanguage;
        systemPrompt = getDefaultPrompt(effectiveLang);
        // Use real system info if we managed to fetch it, override the default
        if (systemInfo.os !== "Unknown OS") {
          systemPrompt = combinePrompts({
            language: effectiveLang,
            systemInfo,
            permissionMode,
          });
        }

        try {
          // Use pre-fetched context from ProjectContext, or fetch fresh if not ready yet
          let effectiveTreeView = treeView;
          let effectiveWorkspace = workspace;

          if (!effectiveTreeView.trim()) {
            // treeView not ready yet (race condition on first request) — fetch directly
            const freshContext = await new Promise<{
              treeView: string;
              workspace: string;
            }>((resolve) => {
              const requestId = `req1-tree-${Date.now()}`;
              const timeout = setTimeout(
                () => resolve({ treeView: "", workspace: effectiveWorkspace }),
                5000,
              );
              const handler = (event: MessageEvent) => {
                const msg = event.data;
                if (
                  msg.command === "projectContextResult" &&
                  msg.requestId === requestId
                ) {
                  clearTimeout(timeout);
                  window.removeEventListener("message", handler);
                  resolve({
                    treeView: msg.data?.treeView || "",
                    workspace: msg.data?.workspace || effectiveWorkspace,
                  });
                }
              };
              window.addEventListener("message", handler);
              (window as any).vscodeApi?.postMessage({
                command: "getProjectContext",
                requestId,
              });
            });
            effectiveTreeView = freshContext.treeView;
            effectiveWorkspace = freshContext.workspace || effectiveWorkspace;
          }

          if (effectiveTreeView && effectiveTreeView.trim()) {
            projectContextStr += `\n\n## Project Structure\n\`\`\`\n${getShallowTree(effectiveTreeView)}\n\`\`\``;
          }
          if (effectiveWorkspace && effectiveWorkspace.trim()) {
            projectContextStr += `\n\n## WORKSPACE EXPERIENCE (workspace.md)\n\`\`\`\n${effectiveWorkspace}\n\`\`\``;
          }
        } catch (e) {}
      }

      // Resolve attached items into formatted context
      let attachedContextStr = "";
      if (files && files.length > 0) {
        const attachedItems = files.filter(
          (f: any) =>
            f.id?.startsWith("attached-") ||
            f.id?.startsWith("rule-") ||
            f.id?.startsWith("terminal-"),
        );
        if (attachedItems.length > 0) {
          attachedContextStr = "\n\n## Attached Context\n";

          const fileItems = attachedItems.filter((f: any) => f.type === "file");
          const folderItems = attachedItems.filter(
            (f: any) => f.type === "folder",
          );
          const terminalItems = attachedItems.filter(
            (f: any) => f.type === "terminal",
          );

          if (fileItems.length > 0) {
            attachedContextStr += "\n### Files\n";
            fileItems.forEach((f: any) => {
              attachedContextStr += `- ${f.path}\n`;
            });
          }

          if (folderItems.length > 0) {
            attachedContextStr += "\n### Folders (Tree Structure)\n";
            for (const f of folderItems) {
              const requestId = `folder-tree-${Date.now()}-${Math.random()}`;
              const treeData: any = await new Promise((resolve) => {
                const timeoutId = setTimeout(() => resolve(null), 3000);
                const handler = (event: MessageEvent) => {
                  const msg = event.data;
                  if (
                    msg.command === "getFolderTreeResult" &&
                    msg.requestId === requestId
                  ) {
                    clearTimeout(timeoutId);
                    window.removeEventListener("message", handler);
                    resolve(msg.tree);
                  }
                };
                window.addEventListener("message", handler);
                extensionService.postMessage({
                  command: "getFolderTree",
                  requestId,
                  path: f.path,
                });
              });
              attachedContextStr += `#### ${f.path}\n\`\`\`\n${treeData || "Error fetching tree structure"}\n\`\`\`\n`;
            }
          }

          if (terminalItems.length > 0) {
            attachedContextStr += "\n### Terminals\n";
            terminalItems.forEach((f: any) => {
              attachedContextStr += `- terminal_id: ${f.path}\n`;
            });
          }
        }
      }

      const fullContent = skipFirstRequestLogic
        ? content
        : `## User Message\n<zen-user-content>\n${content}\n</zen-user-content>`;

      if (skipFirstRequestLogic) {
        // Detailed trace for tool results to catch duplicates
        const lastToolMsg = [...messagesRef.current]
          .reverse()
          .find((m) => m.role === "user" && m.actionIds);

        if (lastToolMsg && lastToolMsg.content === fullContent) {
          stopGeneration();

          // Mark the assistant message that was responding to the previous identical request as cancelled
          let lastAssistantIdx = -1;
          for (let i = messagesRef.current.length - 1; i >= 0; i--) {
            if (messagesRef.current[i].role === "assistant") {
              lastAssistantIdx = i;
              break;
            }
          }

          if (lastAssistantIdx !== -1) {
            const updated = [...messagesRef.current];
            updated[lastAssistantIdx] = {
              ...updated[lastAssistantIdx],
              isCancelled: true,
            };
            setMessages(updated);
            // Update messagesRef immediately so filteredMessages below is accurate
            messagesRef.current = updated;
          }
        }
      }

      // Permission mode tag for all requests
      const permissionModeTag = buildPermissionModeTag(permissionMode);

      // Inject checkpoint reminder every N user requests (not for auto/tool requests)
      let checkpointReminder = "";
      if (!skipFirstRequestLogic) {
        userRequestCountRef.current += 1;
        if (userRequestCountRef.current % CHECKPOINT_INTERVAL === 0) {
          checkpointReminder = `\n\n${CHECKPOINT_REMINDER}`;
        }
      }

      const promptPayload = isReq1
        ? `${systemPrompt}${projectContextStr}${attachedContextStr}\n\n${permissionModeTag}${checkpointReminder}\n\n${fullContent}`
        : `${attachedContextStr}\n\n${permissionModeTag}${checkpointReminder}\n\n${fullContent}`;

      // In the new schema, req1 content includes system prompt
      const finalContent = promptPayload;

      const userMessage: Message = {
        id: `msg-${Date.now()}-${skipFirstRequestLogic ? "tool" : "user"}`,
        role: "user",
        content: finalContent,
        timestamp: Date.now(),
        token_usage: calculateTokens(promptPayload),
        actionIds: actionIds,
        uiHidden: uiHidden,
        conversationId: backendConversationIdRef.current || undefined,
      };

      // Log token count for every request (user-initiated and auto/tool)
      const reqTokens = calculateTokens(promptPayload);
      const reqType = skipFirstRequestLogic
        ? "autoReq (tool flush)"
        : isReq1
          ? "req1 (first turn)"
          : "user req";

      const updatedMessages = [...filteredMessages, userMessage];

      // Parse <question-answer> from user message and inject into previous AI message
      const parsedAnswers = parseQuestionAnswerTag(content);
      if (parsedAnswers) {
        // Find the last assistant message with questions
        for (let i = updatedMessages.length - 2; i >= 0; i--) {
          const msg = updatedMessages[i];
          if (msg.role === "assistant") {
            // Parse the assistant message to check if it has questions
            const parsed = parseAIResponse(msg.content);

            // Type guard: check if question block has the questions array
            if (
              parsed.question &&
              parsed.question.type === "question" &&
              "questions" in parsed.question &&
              parsed.question.questions &&
              parsed.question.questions.length > 0
            ) {
              // Inject answers into this message
              updatedMessages[i] = {
                ...msg,
                questionAnswers: parsedAnswers,
              };
              break;
            }
          }
        }
      }

      setMessages(updatedMessages);

      setIsProcessingSync(true);

      // Save & Log
      saveConversation(
        sessionId,
        folderPath,
        updatedMessages,
        effectiveChatUuid,
        selectedTab || undefined,
        false,
        undefined,
        backendConversationIdRef.current,
        undefined, // toolOutputs
        undefined, // singleLineReviewActions
        undefined, // conversationFileStats
      );
      // User message log will happen after response when we have backendConversationId

      // Save old model and account to detect switches before they are updated
      const oldModel = lastUsedModelRef.current;
      const oldAccount = lastUsedAccountRef.current;

      // Persist / Resolve Model and Account
      // Priority: explicit param > lastUsedRef (persisted from prior turn)
      const effModel = model || oldModel;
      const effAccount = account || oldAccount;

      // 🆕 History Fallback: Only apply when BOTH the explicit param AND the tracked ref
      // are null — meaning this is a truly fresh session with zero model context.
      // IMPORTANT: Do NOT apply history fallback if oldModel exists, because that would
      // mask a model switch (user switched model → new model not yet in ref → param is null
      // → fallback restores old model from history → switch detection sees no change → BUG).
      let finalModel = effModel;
      let finalAccount = effAccount;

      if (!finalModel && !oldModel) {
        // Truly fresh session — safe to restore model from last assistant message
        const lastMetadataMsg = [...filteredMessages]
          .reverse()
          .find((m) => m.role === "assistant" && m.providerId && m.modelId);

        if (lastMetadataMsg) {
          finalModel = {
            id: lastMetadataMsg.modelId!,
            providerId: lastMetadataMsg.providerId!,
          };
        }
      }

      if (!finalAccount && !oldAccount) {
        // Truly fresh session — safe to restore account from last assistant message
        const lastMetadataMsg = [...filteredMessages]
          .reverse()
          .find((m) => m.role === "assistant" && m.accountId);

        if (lastMetadataMsg?.accountId) {
          finalAccount = { id: lastMetadataMsg.accountId };
        }
      }

      if (finalModel) lastUsedModelRef.current = finalModel;
      if (finalAccount) lastUsedAccountRef.current = finalAccount;

      // 🔄 Model/Account switch detection: if the user changed provider or account
      // mid-session, the old backendConversationId belongs to a different provider
      // and must NOT be sent to the new one (it would cause session-not-found errors).
      //
      // Switch detection compares `oldModel` (ref before this request) vs `finalModel`.
      // Because history fallback above is now guarded by `!oldModel`, it can no longer
      // silently restore the old model from history and mask a switch.
      const modelSwitched =
        !skipFirstRequestLogic &&
        oldModel &&
        finalModel &&
        (oldModel.id !== finalModel.id ||
          oldModel.providerId !== finalModel.providerId);
      const accountSwitched =
        !skipFirstRequestLogic &&
        oldAccount &&
        finalAccount &&
        oldAccount.id !== finalAccount.id;

      if (modelSwitched || accountSwitched) {
        console.warn(
          `[Zen] Model/account switched — resetting backend conversationId and qwenParentId`,
          {
            prevModel: oldModel,
            finalModel,
            prevAccount: oldAccount,
            finalAccount,
          },
        );
        backendConversationIdRef.current = "";
        qwenParentIdRef.current = undefined;
        try {
          sessionStorage.removeItem(`zen-backend-conv:${effectiveChatUuid}`);
        } catch {}
      }

      try {
        // Upload any local files first
        const ref_file_ids: string[] = [];
        const localFiles = files
          ? files.filter(
              (f: any) =>
                !f.id?.startsWith("attached-") &&
                !f.id?.startsWith("rule-") &&
                !f.id?.startsWith("terminal-"),
            )
          : [];

        if (localFiles.length > 0) {
          if (!finalAccount?.id) {
            throw new Error(
              "No active account selected for file upload. Please select/add an account first.",
            );
          }
          const uploadedIds = await uploadFiles(localFiles, finalAccount.id);
          ref_file_ids.push(...uploadedIds);
        }

        const effPromptPayload = isReq1
          ? `${systemPrompt}${projectContextStr}\n\n${fullContent}`
          : fullContent;

        const errorMsgCount = updatedMessages.filter((m) => m.isError).length;
        let payloadMessages = updatedMessages
          .filter((m) => !m.isError) // exclude error messages — they are UI-only, not part of conversation history
          .map((m) => ({
            role: m.role,
            content: m.content,
          }));
        if (isReq1) {
          payloadMessages[0].content = promptPayload;
        }

        let finalPayloadMessages = payloadMessages;

        // Qwen: ưu tiên qwenParentIdRef (lưu từ stream turn trước), fallback về tham số parentMessageId
        // Note: qwenParentIdRef is cleared above if model/account switched.
        const effectiveParentMessageId =
          qwenParentIdRef.current ?? parentMessageId;

        // Only reuse backend conversationId if model/account did NOT switch.
        // If they switched, backendConversationIdRef was already cleared above.
        const convIdToSend =
          backendConversationIdRef.current ||
          (effectiveChatUuid
            ? sessionStorage.getItem(`zen-backend-conv:${effectiveChatUuid}`) ||
              undefined
            : undefined);

        const body = {
          modelId: finalModel?.id,
          providerId: finalModel?.providerId,
          accountId: finalAccount?.id,
          messages: finalPayloadMessages,
          stream: true,
          ...(convIdToSend ? { conversationId: convIdToSend } : {}),
          ...(effectiveParentMessageId
            ? { parent_message_id: effectiveParentMessageId }
            : {}),
          is_thinking: localStorage.getItem("zen-thinking-enabled") === "true",
          is_search: localStorage.getItem("zen-search-enabled") === "true",
          thinking: localStorage.getItem("zen-thinking-enabled") === "true",
          search: localStorage.getItem("zen-search-enabled") === "true",
          ...(ref_file_ids.length > 0 ? { ref_file_ids } : {}),
        };

        const abortController = new AbortController();
        abortControllerRef.current = abortController;
        dispatchStreaming({ type: "SET_STREAMING", payload: true });

        const headers = { "Content-Type": "application/json" };
        const bodyStr = JSON.stringify(body);

        // Lưu rawRequest vào user message (toàn bộ nội dung request bao gồm permission-mode, user content và các metadata khác)
        updatedMessages[updatedMessages.length - 1].rawRequest = userMessage.content;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === userMessage.id ? { ...m, rawRequest: userMessage.content } : m,
          ),
        );

        const response = await fetch(`${apiUrl}/v1/chat/accounts/messages`, {
          method: "POST",
          headers,
          body: bodyStr,
          signal: abortController.signal,
        });

        if (!response.ok) {
          let errorDetail = `API Error: ${response.status}`;
          try {
            const errBody = await response.json();
            const raw = errBody.error || errBody.message;
            const msg = typeof raw === "string" ? raw : JSON.stringify(raw);
            errorDetail = msg || errorDetail;
            if (errBody.error_code)
              errorDetail = `[${errBody.error_code}] ${errorDetail}`;
          } catch {}
          throw new Error(errorDetail);
        }
        if (!response.body) throw new Error("No response body");

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let assistantMessage: Message = {
          id: `msg-${Date.now()}-assistant`,
          role: "assistant",
          content: "",
          timestamp: Date.now(),
        };

        let backendConversationId = "";

        setMessages((prev) => [...prev, assistantMessage]);

        let done = false;
        let buffer = "";
        
        // Batching: Accumulate updates and flush periodically
        let updateBatch = { content: "", thinking: "" };
        let lastFlushTime = Date.now();
        const FLUSH_INTERVAL_MS = 100; // Increased from 50ms to 100ms to reduce update frequency
        
        // Track metadata updates separately to avoid triggering state changes
        let pendingMetadataUpdate = false;

        // First-chunk timeout: if no SSE data arrives within 5 minutes, abort the stream.
        // The Elara server has its own 5-minute timeout and sends an error event — this is
        // a client-side safety net for cases where the TCP connection stays open but
        // the server is completely silent (e.g. hung upstream, network black hole).
        let firstChunkReceived = false;
        const FIRST_CHUNK_TIMEOUT_MS = 305_000; // 5 min + 5s buffer
        const firstChunkTimer = setTimeout(() => {
          if (!firstChunkReceived) {
            abortController.abort();
          }
        }, FIRST_CHUNK_TIMEOUT_MS);

        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) {
            if (!firstChunkReceived) {
              firstChunkReceived = true;
              clearTimeout(firstChunkTimer);
            }
            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const dataStr = line.slice(6).trim();
                if (dataStr === "[DONE]") continue;
                // Backend may stream a raw UUID line as conversation_id
                if (
                  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
                    dataStr,
                  )
                ) {
                  backendConversationId = dataStr;
                  backendConversationIdRef.current = dataStr;
                  continue;
                }
                try {
                  const data = JSON.parse(dataStr);

                  // Handle stream error from server
                  if (data.error) {
                    const code = data.error_code ? `[${data.error_code}] ` : "";
                    const err = new Error(`${code}${data.error}`);
                    console.error("[Zen Stream] server error in SSE:", data);
                    (err as any).isServerError = true;
                    throw err;
                  }

                  // Capture the real backend conversation_id for subsequent requests
                  const recvConvId =
                    data.meta?.conversation_id || data.conversation_id;
                  if (recvConvId) {
                    backendConversationId = recvConvId;
                    backendConversationIdRef.current = recvConvId;
                    assistantMessage.conversationId = recvConvId;
                    // Persist so it survives resetSession() race conditions
                    try {
                      sessionStorage.setItem(
                        `zen-backend-conv:${effectiveChatUuid}`,
                        recvConvId,
                      );
                    } catch {}
                  }

                  const metaObj = data.meta || data.metadata;
                  if (metaObj) {
                    if (metaObj.providerId)
                      assistantMessage.providerId = metaObj.providerId;
                    if (metaObj.modelId)
                      assistantMessage.modelId = metaObj.modelId;
                    if (metaObj.accountId)
                      assistantMessage.accountId = metaObj.accountId;
                    if (metaObj.websiteUrl)
                      assistantMessage.websiteUrl = metaObj.websiteUrl;
                    if (metaObj.email) assistantMessage.email = metaObj.email;
                    if (metaObj.response_message_id)
                      assistantMessage.response_message_id =
                        metaObj.response_message_id;

                    // Qwen: lưu parent_id để dùng cho request tiếp theo
                    // Server forward event này từ response.created của Qwen
                    if (metaObj.parent_id) {
                      qwenParentIdRef.current = metaObj.parent_id;
                    }

                    // DeepSeek: server đang auto-continue response bị ngắt giữa chừng
                    if (metaObj.continuing === true) {
                      setIsContinuingSync(true);
                      pendingMetadataUpdate = true;
                    } else if (metaObj.continuing === false) {
                      // Dùng ref để tránh stale closure — isContinuing state có thể chưa update vào closure
                      if (isContinuingRef.current) {
                        setIsContinuingSync(false);
                        pendingMetadataUpdate = true;
                      }
                    }

                    // DeepSeek: server phát hiện response INCOMPLETE có partial toolcall
                    if (metaObj.incomplete_has_partial_tool !== undefined) {
                      dispatchStreaming({
                        type: "SET_INCOMPLETE_TOOL",
                        payload: {
                          hasPartial: metaObj.incomplete_has_partial_tool,
                          toolType: metaObj.incomplete_partial_tool_type ?? null,
                        },
                      });
                      pendingMetadataUpdate = true;
                    }

                    // DeepSeek: tất cả continuations đã hoàn thành — reset partial tool state
                    if (metaObj.continuation_complete === true) {
                      dispatchStreaming({
                        type: "SET_INCOMPLETE_TOOL",
                        payload: { hasPartial: false, toolType: null },
                      });
                      pendingMetadataUpdate = true;
                    }

                    // Sync metadata to lastUsed refs for subsequent tool execution requests.
                    // IMPORTANT: Only update if server confirms the same model that was sent
                    // (finalModel). Never let server metadata silently overwrite a user's
                    // model switch — that is the root cause of the model race-condition bug.
                    if (metaObj.providerId || metaObj.modelId) {
                      const serverModelId =
                        metaObj.modelId || lastUsedModelRef.current?.id;
                      const serverProviderId =
                        metaObj.providerId ||
                        lastUsedModelRef.current?.providerId;
                      // Only write back if it matches what we sent, or if ref is empty
                      const sentModelId = finalModel?.id;
                      const sentProviderId = finalModel?.providerId;
                      if (
                        !lastUsedModelRef.current ||
                        (serverModelId === sentModelId &&
                          serverProviderId === sentProviderId)
                      ) {
                        lastUsedModelRef.current = {
                          id: serverModelId,
                          providerId: serverProviderId,
                        };
                      } else {
                        console.warn(
                          `[Zen][stream] metadata REJECTED (mismatch) | server=${serverProviderId}/${serverModelId} | sent=${sentProviderId}/${sentModelId} | keeping=${lastUsedModelRef.current?.providerId}/${lastUsedModelRef.current?.id}`,
                        );
                      }
                      // Always keep the account in sync (account confirmation from server is safe)
                    }
                    if (metaObj.accountId) {
                      lastUsedAccountRef.current = { id: metaObj.accountId };
                    }
                  }

                  // PERF FIX: Mutate message object directly instead of creating new objects
                  // This preserves object reference for memo comparison
                  if (data.usage) {
                    assistantMessage.usage = data.usage;
                    assistantMessage.token_usage = data.usage.total_tokens;
                  }
                  if (data.content) {
                    assistantMessage.content = assistantMessage.content + data.content;
                  }
                  if (data.thinking) {
                    assistantMessage.thinking = (assistantMessage.thinking || "") + data.thinking;
                  }

                  // Batch updates instead of immediate setState
                  if (data.content) {
                    updateBatch.content += data.content;
                  }
                  if (data.thinking) {
                    updateBatch.thinking += data.thinking;
                  }
                  
                  // Flush batch if interval passed or if we have usage data (final chunk)
                  const now = Date.now();
                  const shouldFlush = (now - lastFlushTime >= FLUSH_INTERVAL_MS) || data.usage;
                  
                  if (shouldFlush && (updateBatch.content || updateBatch.thinking || data.usage)) {
                    // PERF FIX: Preserve message object references for unchanged messages
                    // This prevents cascade re-renders in ChatPanel memo comparison
                    setMessages((prev) => {
                      const newArray = prev.slice(); // Shallow copy array
                      const targetIndex = prev.findIndex(m => m.id === assistantMessage.id);
                      
                      if (targetIndex !== -1) {
                        // Replace only the target message, reuse all others
                        newArray[targetIndex] = assistantMessage;
                      }
                      
                      return newArray;
                    });
                    updateBatch = { content: "", thinking: "" };
                    lastFlushTime = now;
                  }
                } catch (e) {
                  if (e instanceof Error && (e as any).isServerError) throw e;
                  // Some backends stream raw non-JSON lines (e.g. plain UUID) — ignore silently
                }
              }
            }
          }
        }

        // Process any remaining data in buffer after stream ends
        // Stream ended — clear first-chunk timer if still pending
        clearTimeout(firstChunkTimer);
        
        // Flush any pending batch updates
        if (updateBatch.content || updateBatch.thinking) {
          // PERF FIX: Mutate instead of recreate
          assistantMessage.content = assistantMessage.content + updateBatch.content;
          assistantMessage.thinking = (assistantMessage.thinking || "") + updateBatch.thinking;
          
          setMessages((prev) => {
            const newArray = prev.slice();
            const targetIndex = prev.findIndex(m => m.id === assistantMessage.id);
            if (targetIndex !== -1) {
              newArray[targetIndex] = assistantMessage;
            }
            return newArray;
          });
        }

        if (streamingState.isContinuing) {
          console.warn(
            `[Zen] Stream ended but isContinuing is still true — server may not have sent continuing:false | conversationId=${backendConversationId || currentConversationIdRef.current || "none"}`,
          );
        }
        const remainingLines = buffer
          .split("\n")
          .filter((l) => l.trim().startsWith("data: "));
        for (const line of remainingLines) {
          const dataStr = line.slice(6).trim();
          if (dataStr === "[DONE]") continue;
          try {
            const data = JSON.parse(dataStr);

            const metaObj = data.meta || data.metadata;
            if (metaObj) {
              if (metaObj.providerId)
                assistantMessage.providerId = metaObj.providerId;
              if (metaObj.modelId) assistantMessage.modelId = metaObj.modelId;
              if (metaObj.accountId)
                assistantMessage.accountId = metaObj.accountId;
              if (metaObj.websiteUrl)
                assistantMessage.websiteUrl = metaObj.websiteUrl;
              if (metaObj.email) assistantMessage.email = metaObj.email;

              // Qwen: cập nhật parent_id từ buffer cleanup nếu stream chính chưa nhận được
              if (metaObj.parent_id) {
                qwenParentIdRef.current = metaObj.parent_id;
              }

              // Sync metadata during buffer cleanup — same guard as main stream loop
              if (metaObj.providerId || metaObj.modelId) {
                const serverModelId =
                  metaObj.modelId || lastUsedModelRef.current?.id;
                const serverProviderId =
                  metaObj.providerId || lastUsedModelRef.current?.providerId;
                const sentModelId = finalModel?.id;
                const sentProviderId = finalModel?.providerId;
                if (
                  !lastUsedModelRef.current ||
                  (serverModelId === sentModelId &&
                    serverProviderId === sentProviderId)
                ) {
                  lastUsedModelRef.current = {
                    id: serverModelId,
                    providerId: serverProviderId,
                  };
                } else {
                  console.warn(
                    `[Zen][buffer-cleanup] metadata REJECTED | server=${serverProviderId}/${serverModelId} | sent=${sentProviderId}/${sentModelId}`,
                  );
                }
              }
              if (metaObj.accountId) {
                lastUsedAccountRef.current = { id: metaObj.accountId };
              }
            }

            // PERF FIX: Mutate instead of recreate
            if (data.usage) {
              assistantMessage.usage = data.usage;
              assistantMessage.token_usage = data.usage.total_tokens;
            }
            if (data.content) {
              assistantMessage.content = assistantMessage.content + data.content;
            }
            if (data.thinking) {
              assistantMessage.thinking = (assistantMessage.thinking || "") + data.thinking;
            }
          } catch (e) {}
        }

        // Final fallback: if token_usage is still missing, calculate it manually
        if (!assistantMessage.token_usage && assistantMessage.content) {
          assistantMessage.token_usage = calculateTokens(
            assistantMessage.content,
          );
        }

        // Log user message first, then assistant message, both with the real conversationId
        try {
          const userMsgToLog = updatedMessages[updatedMessages.length - 1];
          const finalConversationId =
            backendConversationId || backendConversationIdRef.current;

          userMsgToLog.providerId =
            assistantMessage.providerId || effModel?.providerId;
          userMsgToLog.modelId = assistantMessage.modelId || effModel?.id;
          userMsgToLog.accountId = assistantMessage.accountId || effAccount?.id;
          if (assistantMessage.websiteUrl)
            userMsgToLog.websiteUrl = assistantMessage.websiteUrl;
          if (assistantMessage.email)
            userMsgToLog.email = assistantMessage.email;

          assistantMessage.providerId = userMsgToLog.providerId;
          assistantMessage.modelId = userMsgToLog.modelId;
          assistantMessage.accountId = userMsgToLog.accountId;
          if (userMsgToLog.websiteUrl)
            assistantMessage.websiteUrl = userMsgToLog.websiteUrl;
          if (userMsgToLog.email) assistantMessage.email = userMsgToLog.email;

          logChatToWorkspace(effectiveChatUuid, {
            ...userMsgToLog,
            conversationId: finalConversationId,
          });

          logChatToWorkspace(effectiveChatUuid, {
            ...assistantMessage,
            conversationId: finalConversationId,
          });
        } catch (logErr) {}

        // Lưu rawResponse vào assistant message để hiển thị raw content trong UI
        assistantMessage.rawResponse = assistantMessage.content;

        // Final state update to ensure UI and subsequent logic see the latest usage info (with correct metadata)
        setMessages([...updatedMessages, assistantMessage]);

        setIsProcessingSync(false);
        dispatchStreaming({ type: "RESET_STREAMING" });
        abortControllerRef.current = null;

        // 🔍 LOG: Full response content after stream completion (before parsing)
        console.log(
          "[Zen][Stream Complete] Full raw content:",
          assistantMessage.content,
        );

        // Parse for metadata logging only.
        // NOTE: Do NOT call onToolRequest here. Auto-triggering is handled exclusively
        // by useToolActions.ts via parsedMessages useEffect to avoid duplicate triggers.
        // (RES1 may still be streaming when useToolActions triggers tools mid-stream;
        //  calling onToolRequest here after stream-done would cause a double-trigger.)
        const parsed = parseAIResponse(assistantMessage.content);

        // Save final conversation state
        saveConversation(
          sessionId,
          folderPath,
          [...updatedMessages, assistantMessage],
          effectiveChatUuid,
          selectedTab || undefined,
          false,
          undefined,
          backendConversationId || backendConversationIdRef.current,
        );
      } catch (error) {
        dispatchStreaming({ type: "RESET_STREAMING" });
        abortControllerRef.current = null;
        if (error instanceof Error && error.name === "AbortError") {
          setIsProcessingSync(false);
          return;
        }
        console.error("[Zen sendMessage] caught error:", error);
        const errorMessage: Message = {
          id: `msg-${Date.now()}-error`,
          role: "assistant",
          content: `Error: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
          timestamp: Date.now(),
          isError: true,
        };
        const messagesWithError = [
          ...messagesRef.current.filter((m) => !m.isCancelled),
          errorMessage,
        ];
        setMessages(messagesWithError);
        messagesRef.current = messagesWithError;

        // Persist error message so it shows up when loading conversation history
        if (effectiveChatUuid) {
          try {
            saveConversation(
              sessionId,
              folderPath,
              messagesWithError,
              effectiveChatUuid,
              selectedTab || undefined,
              false,
              undefined,
              backendConversationIdRef.current,
            );
          } catch (saveErr) {}
        }

        setIsProcessingSync(false);
      }
    },
    [apiUrl, selectedTab, onToolRequest],
  );

  return {
    messages,
    setMessages,
    messagesRef,
    isProcessing: streamingState.isProcessing,
    setIsProcessing: setIsProcessingSync,
    isStreaming: streamingState.isStreaming,
    isContinuing: streamingState.isContinuing,
    incompleteHasPartialTool: streamingState.incompleteHasPartialTool,
    incompletePartialToolType: streamingState.incompletePartialToolType,
    currentConversationId,
    setCurrentConversationId,
    currentConversationIdRef,
    sendMessage,
    stopGeneration,
    resetSession,
    setBackendConversationId: (
      id: string,
      meta?: { providerId?: string; modelId?: string; accountId?: string },
    ) => {
      backendConversationIdRef.current = id;
      if (meta) {
        if (meta.providerId && meta.modelId) {
          lastUsedModelRef.current = {
            id: meta.modelId,
            providerId: meta.providerId,
          };
        }
        if (meta.accountId) {
          lastUsedAccountRef.current = { id: meta.accountId };
        }
      }
    },
    conversationToolOverrides,
    setConversationToolOverrides,
    handleToolAction: (
      actionId: string,
      actionType: "accept_all" | "accept_once" | "reject",
      toolName?: string,
    ) => {
      if (actionType === "accept_all" && toolName) {
        setConversationToolOverrides((prev) => ({
          ...prev,
          [toolName]: "auto",
        }));
      }
    },
    handleSelectOption: (messageId: string, option: string) => {
      // Use setMessages with a callback to get the latest state
      setMessages((currentMessages) => {
        let updatedMessages = currentMessages.map((m) =>
          m.id === messageId ? { ...m, selectedOption: option } : m,
        );

        let parsedPayload: {
          allAnswered?: boolean;
          answers?: Record<string, any>;
          questions?: any[];
        } | null = null;

        // Check if this is a paginated question "all answered" payload
        try {
          const parsed = JSON.parse(option);
          if (parsed.allAnswered === true && parsed.answers) {
            parsedPayload = parsed;
            // Update the message with selectedOption only (questionAnswers saved separately at root level)
            updatedMessages = currentMessages.map((m) =>
              m.id === messageId
                ? {
                    ...m,
                    selectedOption: option,
                    // Do NOT add questionAnswers to message - saved at root level
                  }
                : m,
            );
          }
        } catch (e) {}

        // Ensure conversation ID exists before saving
        let convId = currentConversationIdRef.current;
        if (!convId) {
          convId = crypto.randomUUID?.() || Date.now().toString();
          currentConversationIdRef.current = convId;
          setCurrentConversationId(convId);
        }

        // Log the message state after update
        const sessionId = selectedTab?.sessionId || -1;
        const folderPath = selectedTab?.folderPath || null;

        saveConversation(
          sessionId,
          folderPath,
          updatedMessages,
          convId,
          selectedTab || undefined,
          true, // skipTimestampUpdate
          undefined,
          backendConversationIdRef.current,
          undefined, // toolOutputs
          undefined, // singleLineReviewActions
          undefined, // questionAnswers - REMOVED: no longer saved
        );

        // After state update, if this was an allAnswered payload, auto-submit the answers
        // Use setTimeout with a small delay to ensure React has committed the state update
        // and messagesRef.current has been synced via the useEffect.
        if (parsedPayload && parsedPayload.answers) {
          setTimeout(() => {
            const questions = parsedPayload.questions || [];
            const answers = parsedPayload.answers || {};

            // Format: <question-answer>\n1. <answer>\n2. No answer\n</question-answer>
            // New format includes question IDs for proper answer tracking
            const formattedAnswers = questions
              .map((question: any, index: number) => {
                const qId = question.id;
                const answer = answers[qId];
                const number = index + 1;

                if (!answer || !answer.value) {
                  return `${number}. No answer`;
                }

                const value = Array.isArray(answer.value)
                  ? answer.value.join(", ")
                  : String(answer.value);
                // Include question ID in format: "1. {questionId}: {answer}"
                return `${number}. ${qId}: ${value}`;
              })
              .join("\n");

            const promptText = `<question-answer>\n${formattedAnswers}\n</question-answer>`;

            // Use sendMessage directly - it will use the latest messagesRef
            sendMessage(
              promptText,
              undefined,
              undefined,
              undefined,
              true,
              undefined,
              true,
            );
          }, 10);
        }

        return updatedMessages;
      });
    },
  };
};
