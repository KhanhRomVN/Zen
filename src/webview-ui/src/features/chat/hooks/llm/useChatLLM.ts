import React, {
  useState,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { Message, QuestionAnswer } from "../../types/message";
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
import { useStreamingState } from "./useStreamingState";
import { useConversationRefs } from "./useConversationRefs";
import { useMessageHandlers } from "./useMessageHandlers";
import { PromptBuilder } from "../../services/PromptBuilder";
import { StreamingService } from "../../services/StreamingService";
import { TOOL_ACTION_TYPES } from "../../constants/constants";

interface UseChatLLMProps {
  apiUrl: string;
  selectedTab: ChatSession | null;
  onConversationIdChange?: (id: string) => void;
  onToolRequest?: (
    actions: ToolAction[],
    assistantMessage: Message,
    isAutoTrigger?: boolean,
    actionType?: (typeof TOOL_ACTION_TYPES)[keyof typeof TOOL_ACTION_TYPES],
  ) => void;
  onMalformedTool?: (
    actionId: string,
    toolName: string,
    errorMessage: string,
    errorCode: string,
  ) => void;
}

export const parseQuestionAnswerTag = (
  content: string,
): Record<string, QuestionAnswer> | null => {
  const regex = /<question-answer>([\s\S]*?)<\/question-answer>/i;
  const match = regex.exec(content);
  if (!match) return null;

  const innerContent = match[1].trim();
  const answers: Record<string, QuestionAnswer> = {};

  // Parse each line: "N. answer" (without questionId)
  const lines = innerContent.split("\n");
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();

    // Match pattern: "N. answer" or "N. " (empty answer)
    const lineMatch = /^(\d+)\.\s*(.*)$/i.exec(trimmed);
    if (!lineMatch) continue;

    const lineNumber = parseInt(lineMatch[1], 10);
    const answerText = lineMatch[2].trim();

    // Use line number as questionId (matching question.id format: "1", "2", "3", etc.)
    const questionId = String(lineNumber);

    // Skip if empty answer (no value provided)
    if (!answerText) {
      continue;
    }

    // Keep answer as string - QuestionBlock will handle type conversion based on question type
    let parsedValue: string | string[] | boolean = answerText;

    // Only convert explicit "true"/"false" literals to boolean
    if (answerText.toLowerCase() === "true") {
      parsedValue = true;
    } else if (answerText.toLowerCase() === "false") {
      parsedValue = false;
    }
    // Note: "Yes" and "No" remain as strings
    // Note: Do NOT split by comma - QuestionBlock will handle multi-choice parsing

    answers[questionId] = {
      questionId,
      value: parsedValue,
    };
  }

  return Object.keys(answers).length > 0 ? answers : null;
};

export const useChatLLM = ({
  apiUrl,
  selectedTab,
  onConversationIdChange,
  onToolRequest,
  onMalformedTool,
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
  const { treeView } = useProject();
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
      // Cho phép tool results (skipFirstRequestLogic=true) đi qua ngay cả khi đang processing
      // để tránh mất kết quả khi user click nhiều tool liên tiếp
      if (isProcessingRef.current && !skipFirstRequestLogic) {
        console.warn(
          `[Zen][sendMessage] BLOCKED - already processing | skipFirstRequestLogic=${skipFirstRequestLogic} | conversationId=${currentConversationIdRef.current} | content preview: ${content.substring(0, 50)}`,
        );
        return;
      }

      const sessionId = selectedTab?.sessionId || -1;
      const folderPath = selectedTab?.folderPath || null;

      // Filter cancelled messages
      const currentMessages = messagesRef.current;
      let filteredMessages = currentMessages.filter((m) => !m.isCancelled);

      // Check if last message pair is complete; clean up incomplete pairs before sending
      if (!skipFirstRequestLogic && filteredMessages.length > 0) {
        const lastMsg = filteredMessages[filteredMessages.length - 1];

        if (lastMsg.role === "user") {
          // Last message is a user request without assistant response → remove it
          filteredMessages = filteredMessages.slice(0, -1);
          messagesRef.current = filteredMessages;
          setMessages(filteredMessages);
        } else if (lastMsg.role === "assistant" && lastMsg.isError) {
          // Last message is an error assistant → remove both the error + preceding user request
          filteredMessages = filteredMessages.slice(0, -2);
          messagesRef.current = filteredMessages;
          setMessages(filteredMessages);
        }
        // If last message is assistant (success) → pair is complete, proceed normally
      }

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
        // Store uploaded files and attached items with the message
        uploadedFiles: files
          ?.filter((f: any) => f.type?.startsWith("image/") || f.file_id)
          .map((f: any) => ({
            id: f.id,
            name: f.name,
            size: f.size,
            type: f.type,
            content: f.content,
            file_id: f.file_id,
          })),
        attachedItems: files
          ?.filter(
            (f: any) =>
              f.type === "file" ||
              f.type === "external" ||
              f.type === "text-snippet",
          )
          .map((f: any) => ({
            id: f.id,
            path: f.path,
            type: f.type,
            content: f.content,
            lineCount: f.lineCount,
          })),
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

      // Save conversation immediately when sending request (user message only)
      saveConversation(
        sessionId,
        folderPath,
        updatedMessages,
        effectiveChatUuid,
        selectedTab || undefined,
        false,
        undefined,
        backendConversationIdRef.current || undefined,
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
                !f.id?.startsWith("terminal-") &&
                !f.id?.startsWith("snippet-") && // 🚀 FIX: Don't upload text snippets
                !f.id?.startsWith("external-"), // 🚀 FIX: Don't upload external files
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
              onRawContent: (_content) => {
                // PERF: Khong goi setMessages trong streaming nua
                // Thay vao do chi tich luy vao ref, ProcessingIndicator tu hien thi timer
                // Tranh 130+ lan re-render toan bo UI moi khi stream
              },
              onContent: (content) => {
                // Update UI with parsed content (called ONCE at the end with full content)
                setMessages((prev) => {
                  const targetIndex = prev.findIndex(
                    (m) => m.id === assistantMessageId,
                  );
                  if (targetIndex === -1) return prev;

                  const currentMessage = prev[targetIndex];

                  // Replace content and clear thinking
                  const updatedMessage = {
                    ...currentMessage,
                    content: content, // Replace with full parsed content
                    thinking: undefined, // Clear thinking field after parsing
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

        saveConversation(
          sessionId,
          folderPath,
          [...updatedMessages, assistantMessage],
          effectiveChatUuid,
          selectedTab || undefined,
          false,
          undefined,
          backendConversationId || backendConversationIdRef.current,
          undefined,
          undefined,
          undefined,
          false, // skipSave = false → always save response immediately
        );

        // Parse response to extract tool sequence with error handling
        const { parseAIResponse } =
          await import("../../services/ResponseParser");
        let toolSequence = "";
        let parsed: any = null;
        let hasParsingError = false;

        try {
          parsed = parseAIResponse(assistantMessage.content);
          toolSequence = parsed.contentBlocks
            .map((block: any, idx: number) => {
              if (block.type === "tool") {
                return `[${idx + 1}]. ${block.action.type}`;
              } else if (block.type === "thinking") {
                return `[${idx + 1}]. thinking`;
              } else if (block.type === "markdown") {
                return `[${idx + 1}]. markdown`;
              } else if (block.type === "code") {
                return `[${idx + 1}]. code`;
              } else if (block.type === "question") {
                return `[${idx + 1}]. question`;
              }
              return null;
            })
            .filter(Boolean)
            .join(" ");

          // Attach parsed data to assistantMessage
          assistantMessage.parsed = parsed;

          // 📊 Create parseDebugInfo with detailed action parsing info
          const parseDebugActions = parsed.actions.map(
            (action: any, index: number) => {
              // Check if action has error markers
              const hasError = action.isError || action.errorMessage;
              const status = hasError ? "error" : "success";

              // Extract parameter info for debugging
              const extractedParams = Object.entries(action.params).map(
                ([name, value]) => ({
                  name,
                  found: value !== undefined && value !== null && value !== "",
                  length: typeof value === "string" ? value.length : undefined,
                }),
              );

              return {
                index,
                type: action.type,
                params: action.params,
                status,
                errorMessage: action.errorMessage,
                errorCode: action.errorCode,
                extractedParams,
              };
            },
          );

          const successfulActions = parseDebugActions.filter(
            (a: any) => a.status === "success",
          ).length;
          const failedActions = parseDebugActions.filter(
            (a: any) => a.status === "error",
          ).length;

          // Count content blocks by type for debugging
          const contentBlockStats = parsed.contentBlocks.reduce(
            (acc: any, block: any) => {
              acc[block.type] = (acc[block.type] || 0) + 1;
              return acc;
            },
            {},
          );

          assistantMessage.parseDebugInfo = {
            totalActions: parsed.actions.length,
            successfulActions,
            failedActions,
            actions: parseDebugActions,
            contentBlocks: parsed.contentBlocks.map(
              (block: any, index: number) => ({
                index,
                type: block.type,
                contentLength: block.content?.length || 0,
                language: block.language,
                actionIndex: block.actionIndex,
              }),
            ),
            contentBlockStats,
          };

          // Update React state with the parsed data and debug info
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessageId
                ? {
                    ...m,
                    parsed: assistantMessage.parsed,
                    parseDebugInfo: assistantMessage.parseDebugInfo,
                  }
                : m,
            ),
          );
        } catch (parseError) {
          hasParsingError = true;
          // Parsing failed - convert assistant message to error
          console.error("[Zen] Response parsing failed:", parseError);

          const errorDetails =
            parseError instanceof Error
              ? parseError.message
              : "Unknown parsing error";

          // Create error message with details
          const errorContent = `Error: Failed to parse response\n\nDetails: ${errorDetails}\n\n**Note:** The response was received but could not be displayed due to malformed content. This usually happens when tool calls are missing closing tags.\n\nYou can try:\n- Regenerating the response\n- Asking the assistant to fix the issue`;

          // Update the assistant message to error state
          assistantMessage.content = errorContent;
          assistantMessage.isError = true;

          // 📊 Create parseDebugInfo for parse errors
          assistantMessage.parseDebugInfo = {
            totalActions: 0,
            successfulActions: 0,
            failedActions: 0,
            actions: [],
            parseError: {
              message: errorDetails,
              rawContent:
                assistantMessage.content?.substring(0, 500) || "(empty)",
            },
          };

          // Update messages array with error state
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessageId
                ? {
                    ...m,
                    content: errorContent,
                    isError: true,
                    parseDebugInfo: assistantMessage.parseDebugInfo,
                  }
                : m,
            ),
          );
        }

        saveConversation(
          sessionId,
          folderPath,
          [...updatedMessages, assistantMessage],
          effectiveChatUuid,
          selectedTab || undefined,
          false,
          undefined,
          backendConversationId || backendConversationIdRef.current,
          undefined,
          undefined,
          undefined,
          false, // skipSave = false → update with parsed data (or error state)
        );

        // 🚨 DETECT ONLY-THINKING RESPONSE
        // If response has ONLY <thinking> block with no other content or actions,
        // automatically send a follow-up request with reminder
        if (!hasParsingError && parsed && parsed.onlyThinkingDetected) {
          console.warn(
            "[Zen][sendMessage] ⚠️ Only-thinking response detected - sending auto-retry with reminder",
          );

          // Don't trigger tool requests for only-thinking responses
          return;
        }

        // Trigger tool request only if parsing succeeded
        if (
          !hasParsingError &&
          parsed &&
          onToolRequest &&
          parsed.actions?.length > 0
        ) {
          onToolRequest(
            parsed.actions,
            assistantMessage,
            true,
            TOOL_ACTION_TYPES.ACCEPT,
          );
        } else if (parsed && parsed.actions?.length > 0 && hasParsingError) {
          console.warn(
            `[Zen][sendMessage] Skipping onToolRequest due to parsing error`,
          );
        }
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

        // NOTE: Do NOT save conversation on error - only save successful request+response pairs
        setIsProcessingSync(false);
      }
    },
    [
      apiUrl,
      selectedTab,
      aiLanguage,
      permissionMode,
      treeView,
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
      actionType: (typeof TOOL_ACTION_TYPES)[keyof typeof TOOL_ACTION_TYPES],
      toolName?: string,
    ) => {
      // accept_all logic removed — only accept_once (now just "accept") is kept
    },
    [],
  );

  /**
   * Handle select option
   */
  const handleSelectOption = useCallback(
    (messageId: string, option: string) => {
      // Guard: Don't process if already sending a message
      if (isProcessingRef.current) {
        console.warn(
          `[Zen][handleSelectOption] BLOCKED - already processing, skipping option selection`,
        );
        return;
      }

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
          // Check again before triggering sendMessage
          if (isProcessingRef.current) {
            console.warn(
              `[Zen][handleSelectOption] Race condition detected - canceling auto-send`,
            );
            return updatedMessages;
          }

          setTimeout(() => {
            // Final guard check inside timeout
            if (isProcessingRef.current) {
              console.warn(
                `[Zen][handleSelectOption] Timeout guard: still processing, canceling`,
              );
              return;
            }

            const questions = parsedPayload.questions || [];
            const answers = parsedPayload.answers || {};

            const formattedAnswers = questions
              .map((question: any, index: number) => {
                const qId = question.id;
                const answer = answers[qId];
                const number = index + 1;

                // Check if answer is missing or empty (but allow boolean false)
                if (!answer || (answer.value !== false && !answer.value)) {
                  return `${number}. `;
                }

                // Handle boolean values for confirm type
                if (typeof answer.value === "boolean") {
                  return `${number}. ${answer.value ? "Yes" : "No"}`;
                }

                // Handle array values for multi-choice
                const value = Array.isArray(answer.value)
                  ? answer.value.join(", ")
                  : String(answer.value);
                return `${number}. ${value}`;
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
          }, 100); // Increased from 10ms to 100ms for better stability
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
