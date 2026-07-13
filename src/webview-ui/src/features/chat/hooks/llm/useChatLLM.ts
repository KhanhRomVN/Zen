import { useState, useCallback, useEffect, useMemo } from "react";
import { Message } from "../../types/message";
import { ToolAction, parseAIResponse } from "../../services/ResponseParser";
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
import { parseQuestionAnswerTag } from "../../utils/messageParser";
import { useStreamingState } from "./useStreamingState";
import { useConversationRefs } from "./useConversationRefs";
import { useMessageHandlers } from "./useMessageHandlers";
import { PromptBuilder } from "../../services/PromptBuilder";
import { StreamingService } from "../../services/StreamingService";

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

export const useChatLLM = ({
  apiUrl,
  selectedTab,
  onConversationIdChange,
  onToolRequest,
}: UseChatLLMProps) => {
  // Use extracted hooks
  const {
    streamingState,
    dispatchStreaming,
    isProcessingRef,
    isContinuingRef,
    setIsProcessingSync,
    setIsContinuingSync,
  } = useStreamingState();

  const {
    messagesRef,
    currentConversationIdRef,
    backendConversationIdRef,
    lastUsedModelRef,
    lastUsedAccountRef,
    abortControllerRef,
    qwenParentIdRef,
    userRequestCountRef,
    renderCountRef,
    prevDepsRef,
  } = useConversationRefs();

  // Track render performance
  const renderStartTime = performance.now();
  renderCountRef.current++;

  // Get context values
  const { aiLanguage, permissionMode } = useSettings();
  const { workspace, treeView } = useProject();
  const { uploadFiles } = useFileUpload(apiUrl);

  // Local state
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentConversationId, setCurrentConversationId] =
    useState<string>("");
  const [conversationToolOverrides, setConversationToolOverrides] = useState<
    Record<string, "auto">
  >({});

  // Sync messages to ref
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  // Sync conversation ID
  useEffect(() => {
    if (
      !currentConversationIdRef.current ||
      currentConversationIdRef.current === currentConversationId
    ) {
      currentConversationIdRef.current = currentConversationId;
    }
    onConversationIdChange?.(currentConversationId);
  }, [currentConversationId, onConversationIdChange]);

  // Track render duration
  useEffect(() => {
    const renderDuration = performance.now() - renderStartTime;
    if (renderDuration > 16) {
      console.warn(
        `[Zen][useChatLLM Render #${renderCountRef.current}] SLOW RENDER: ${renderDuration.toFixed(2)}ms`,
      );
    }
  });

  // Use message handlers hook
  useMessageHandlers({
    selectedTab,
    setMessages,
    currentConversationIdRef,
    backendConversationIdRef,
  });

  /**
   * Reset all session state
   */
  const resetSession = useCallback(() => {
    currentConversationIdRef.current = "";
    backendConversationIdRef.current = "";
    messagesRef.current = [];
    lastUsedModelRef.current = null;
    lastUsedAccountRef.current = null;
    qwenParentIdRef.current = undefined;
    userRequestCountRef.current = 0;
    setCurrentConversationId("");
    setMessages([]);
    setIsProcessingSync(false);
    dispatchStreaming({ type: "STOP_ALL" });
    setConversationToolOverrides({});
  }, [setIsProcessingSync, dispatchStreaming]);

  /**
   * Stop generation
   */
  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Cleanup if first turn of new session
    if (isProcessingRef.current && messagesRef.current.length <= 2) {
      const chatId = currentConversationIdRef.current;
      if (chatId) {
        deleteConversation(chatId);
        setCurrentConversationId("");
        setMessages([]);
        userRequestCountRef.current = 0;
      }
    }

    dispatchStreaming({ type: "STOP_ALL" });

    extensionService.postMessage({
      command: "stopCommand",
      actionId: "all",
      kill: true,
    });
  }, [dispatchStreaming]);

  /**
   * Send message - main chat logic
   */
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
        console.warn(`[Zen][sendMessage] Blocked - already processing`);
        return;
      }

      const sessionId = selectedTab?.sessionId || -1;
      const folderPath = selectedTab?.folderPath || null;

      // Filter cancelled messages
      const currentMessages = messagesRef.current;
      const filteredMessages = currentMessages.filter((m) => !m.isCancelled);

      let effectiveChatUuid = currentConversationIdRef.current;
      const isNewSession = !effectiveChatUuid;

      // Guard: tool results must never create new session
      if (skipFirstRequestLogic && isNewSession) {
        console.warn("[Zen] Tool request on new session - aborting");
        return;
      }

      if (isNewSession) {
        effectiveChatUuid = crypto.randomUUID?.() || Date.now().toString();
        currentConversationIdRef.current = effectiveChatUuid;
        setCurrentConversationId(effectiveChatUuid);
        backendConversationIdRef.current = "";

        if (model) lastUsedModelRef.current = model;
        if (account) lastUsedAccountRef.current = account;
        setConversationToolOverrides({});

        extensionService.postMessage({
          command: "createEmptyChatLog",
          chatUuid: effectiveChatUuid,
        });
      }

      const isReq1 = filteredMessages.length === 0 && !skipFirstRequestLogic;

      // Increment user request counter
      if (!skipFirstRequestLogic) {
        userRequestCountRef.current += 1;
      }

      // Build prompt using PromptBuilder
      const promptPayload = await PromptBuilder.buildPrompt({
        content,
        isReq1,
        skipFirstRequestLogic: skipFirstRequestLogic || false,
        aiLanguage,
        permissionMode,
        treeView,
        workspace,
        files,
        userRequestCount: userRequestCountRef.current,
      });

      const userMessage: Message = {
        id: `msg-${Date.now()}-${skipFirstRequestLogic ? "tool" : "user"}`,
        role: "user",
        content: promptPayload,
        timestamp: Date.now(),
        token_usage: calculateTokens(promptPayload),
        actionIds: actionIds,
        uiHidden: uiHidden,
        conversationId: backendConversationIdRef.current || undefined,
      };

      const updatedMessages = [...filteredMessages, userMessage];

      // Parse question answers
      const parsedAnswers = parseQuestionAnswerTag(content);
      if (parsedAnswers) {
        for (let i = updatedMessages.length - 2; i >= 0; i--) {
          const msg = updatedMessages[i];
          if (msg.role === "assistant") {
            const parsed = parseAIResponse(msg.content);
            if (
              parsed.question &&
              parsed.question.type === "question" &&
              "questions" in parsed.question &&
              parsed.question.questions &&
              parsed.question.questions.length > 0
            ) {
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

      // Save conversation
      saveConversation(
        sessionId,
        folderPath,
        updatedMessages,
        effectiveChatUuid,
        selectedTab || undefined,
        false,
        undefined,
        backendConversationIdRef.current,
      );

      // Resolve model and account
      const oldModel = lastUsedModelRef.current;
      const oldAccount = lastUsedAccountRef.current;
      let finalModel = model || oldModel;
      let finalAccount = account || oldAccount;

      // History fallback for truly fresh session
      if (!finalModel && !oldModel) {
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
        const lastMetadataMsg = [...filteredMessages]
          .reverse()
          .find((m) => m.role === "assistant" && m.accountId);
        if (lastMetadataMsg?.accountId) {
          finalAccount = { id: lastMetadataMsg.accountId };
        }
      }

      if (finalModel) lastUsedModelRef.current = finalModel;
      if (finalAccount) lastUsedAccountRef.current = finalAccount;

      // Model/account switch detection
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
          `[Zen] Model/account switched — resetting backend conversationId`,
        );
        backendConversationIdRef.current = "";
        qwenParentIdRef.current = undefined;
        try {
          sessionStorage.removeItem(`zen-backend-conv:${effectiveChatUuid}`);
        } catch {}
      }

      try {
        // Upload local files
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
            throw new Error("No active account selected for file upload");
          }
          const uploadedIds = await uploadFiles(localFiles, finalAccount.id);
          ref_file_ids.push(...uploadedIds);
        }

        // Prepare messages for API
        let payloadMessages = updatedMessages
          .filter((m) => !m.isError)
          .map((m) => ({
            role: m.role,
            content: m.content,
          }));

        // Effective parent message ID
        const effectiveParentMessageId =
          qwenParentIdRef.current ?? parentMessageId;

        // Conversation ID to send
        const convIdToSend =
          backendConversationIdRef.current ||
          (effectiveChatUuid
            ? sessionStorage.getItem(`zen-backend-conv:${effectiveChatUuid}`) ||
              undefined
            : undefined);

        // Setup abort controller
        const abortController = new AbortController();
        abortControllerRef.current = abortController;
        dispatchStreaming({ type: "SET_STREAMING", payload: true });

        // Save raw request
        updatedMessages[updatedMessages.length - 1].rawRequest =
          userMessage.content;
        setMessages((prev) =>
          prev.map((m) =>
            m.id === userMessage.id
              ? { ...m, rawRequest: userMessage.content }
              : m,
          ),
        );

        // Create placeholder assistant message
        const assistantMessageId = `msg-${Date.now()}-assistant`;
        const placeholderAssistant: Message = {
          id: assistantMessageId,
          role: "assistant",
          content: "",
          timestamp: Date.now(),
        };

        // Add placeholder to messages
        setMessages((prev) => [...prev, placeholderAssistant]);

        // Stream the response using StreamingService
        const { message: assistantMessage, backendConversationId } =
          await StreamingService.streamChat(
            {
              apiUrl,
              model: finalModel,
              account: finalAccount,
              messages: payloadMessages,
              conversationId: convIdToSend,
              parentMessageId: effectiveParentMessageId,
              refFileIds: ref_file_ids,
              abortSignal: abortController.signal,
            },
            {
              onMetadata: (meta) => {
                // Update qwen parent ID
                if (meta.parent_id) {
                  qwenParentIdRef.current = meta.parent_id;
                }

                // Update last used model/account
                if (meta.providerId || meta.modelId) {
                  const serverModelId =
                    meta.modelId || lastUsedModelRef.current?.id;
                  const serverProviderId =
                    meta.providerId || lastUsedModelRef.current?.providerId;
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
                  }
                }

                if (meta.accountId) {
                  lastUsedAccountRef.current = { id: meta.accountId };
                }
              },
              onContinuing: (isContinuing) => {
                setIsContinuingSync(isContinuing);
              },
              onIncompleteToolDetected: (hasPartial, toolType) => {
                dispatchStreaming({
                  type: "SET_INCOMPLETE_TOOL",
                  payload: { hasPartial, toolType },
                });
              },
              onContent: (content) => {
                // Update UI with batched content - use the message ID we created
                setMessages((prev) => {
                  const targetIndex = prev.findIndex(
                    (m) => m.id === assistantMessageId,
                  );
                  if (targetIndex === -1) return prev;

                  const currentMessage = prev[targetIndex];
                  const updatedMessage = {
                    ...currentMessage,
                    content: currentMessage.content + content,
                  };

                  const newArray = prev.slice();
                  newArray[targetIndex] = updatedMessage;
                  return newArray;
                });
              },
            },
          );

        // Merge the final message from StreamingService with our tracked message
        assistantMessage.id = assistantMessageId;

        // Store backend conversation ID
        if (backendConversationId) {
          backendConversationIdRef.current = backendConversationId;
          try {
            sessionStorage.setItem(
              `zen-backend-conv:${effectiveChatUuid}`,
              backendConversationId,
            );
          } catch {}
        }

        // Log messages
        try {
          const userMsgToLog = updatedMessages[updatedMessages.length - 1];
          const finalConversationId =
            backendConversationId || backendConversationIdRef.current;

          userMsgToLog.providerId =
            assistantMessage.providerId || finalModel?.providerId;
          userMsgToLog.modelId = assistantMessage.modelId || finalModel?.id;
          userMsgToLog.accountId =
            assistantMessage.accountId || finalAccount?.id;
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

        // Final state update
        setMessages([...updatedMessages, assistantMessage]);
        setIsProcessingSync(false);
        dispatchStreaming({ type: "RESET_STREAMING" });
        abortControllerRef.current = null;

        console.log(
          "[Stream Complete] Full raw content:",
          assistantMessage.content,
        );

        // Save final conversation
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

        console.error("[Zen sendMessage] error:", error);
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
    [
      apiUrl,
      selectedTab,
      aiLanguage,
      permissionMode,
      treeView,
      workspace,
      uploadFiles,
      setIsProcessingSync,
      setIsContinuingSync,
      dispatchStreaming,
    ],
  );

  /**
   * Handle tool action
   */
  const handleToolAction = useCallback(
    (
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
    [],
  );

  /**
   * Handle select option
   */
  const handleSelectOption = useCallback(
    (messageId: string, option: string) => {
      setMessages((currentMessages) => {
        let updatedMessages = currentMessages.map((m) =>
          m.id === messageId ? { ...m, selectedOption: option } : m,
        );

        let parsedPayload: {
          allAnswered?: boolean;
          answers?: Record<string, any>;
          questions?: any[];
        } | null = null;

        try {
          const parsed = JSON.parse(option);
          if (parsed.allAnswered === true && parsed.answers) {
            parsedPayload = parsed;
            updatedMessages = currentMessages.map((m) =>
              m.id === messageId ? { ...m, selectedOption: option } : m,
            );
          }
        } catch (e) {}

        let convId = currentConversationIdRef.current;
        if (!convId) {
          convId = crypto.randomUUID?.() || Date.now().toString();
          currentConversationIdRef.current = convId;
          setCurrentConversationId(convId);
        }

        const sessionId = selectedTab?.sessionId || -1;
        const folderPath = selectedTab?.folderPath || null;

        saveConversation(
          sessionId,
          folderPath,
          updatedMessages,
          convId,
          selectedTab || undefined,
          true,
          undefined,
          backendConversationIdRef.current,
        );

        if (parsedPayload && parsedPayload.answers) {
          setTimeout(() => {
            const questions = parsedPayload.questions || [];
            const answers = parsedPayload.answers || {};

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
                return `${number}. ${qId}: ${value}`;
              })
              .join("\n");

            const promptText = `<question-answer>\n${formattedAnswers}\n</question-answer>`;

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
    [selectedTab, sendMessage],
  );

  // Memoize return value
  const returnValue = useMemo(
    () => ({
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
      handleToolAction,
      handleSelectOption,
    }),
    [
      messages,
      streamingState,
      currentConversationId,
      sendMessage,
      stopGeneration,
      resetSession,
      setIsProcessingSync,
      conversationToolOverrides,
      handleToolAction,
      handleSelectOption,
    ],
  );

  return returnValue;
};
