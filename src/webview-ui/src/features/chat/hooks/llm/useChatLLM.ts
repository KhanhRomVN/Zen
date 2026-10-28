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
import { processClaudeContent } from "../../services/ClaudeContentProcessor";
import { processDeepseekContent } from "../../services/DeepseekDSMLParser";
import {
  FORMAT_REMINDER_XML,
  FORMAT_REMINDER_JSON,
} from "../../prompts/format-reminder";

// DSML detection marker (still used in ResponseParser unparsed block detection)
const DSML_ANY_MARKER_RE = /<\/?[｜|]{1,2}DSML[｜|]{1,2}/;

import { TOOL_ACTION_TYPES } from "../../constants/constants";

interface ConversationOverrides {
  diagnosticEnabled?: boolean;
  useSkillEnabled?: boolean;
  memoryEnabled?: boolean;
  toolFormat?: "xml" | "json";
}

interface UseChatLLMProps {
  apiUrl: string;
  selectedTab: ChatSession | null;
  /** Per-conversation feature overrides from Home panel */
  conversationOverrides?: ConversationOverrides;
  /** Cờ anti_system_prompt_injection từ provider config — thay cho hardcode providerId === "claude" */
  antiSystemPromptInjection?: boolean;
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
  /** Callback khi AI trả về <conversation_title> — cập nhật header ngay lập tức */
  onConversationTitleChange?: (title: string) => void;
  /**
   * Callback thông báo toàn bộ lượt trả lời đã kết thúc (markdown-only xong,
   * hoặc chuỗi tool execution dừng hẳn).
   */
  onTurnComplete?: () => void;
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
  conversationOverrides,
  antiSystemPromptInjection = false,
  onConversationIdChange,
  onToolRequest,
  onMalformedTool,
  onConversationTitleChange,
  onTurnComplete,
}: UseChatLLMProps) => {
  // Ref to hold per-conversation overrides (from Home panel or restored from metadata).
  // Only update if the new value is not undefined — prevents initialMessageData clear
  // from wiping out overrides that were already captured.
  const conversationOverridesRef = useRef<ConversationOverrides | undefined>(
    conversationOverrides,
  );
  const prevSelectedTabIdRef = useRef<string | number | undefined>(
    selectedTab?.sessionId,
  );
  useEffect(() => {
    const currentTabId = selectedTab?.sessionId;
    const tabChanged = currentTabId !== prevSelectedTabIdRef.current;
    prevSelectedTabIdRef.current = currentTabId;

    if (tabChanged) {
      // New conversation loaded — always sync (even if undefined = no overrides)
      conversationOverridesRef.current = conversationOverrides;
    } else if (conversationOverrides !== undefined) {
      // Same conversation — only update if new value is not undefined,
      // so clearing initialMessageData doesn't wipe out captured overrides.
      conversationOverridesRef.current = conversationOverrides;
    }
  }, [conversationOverrides, selectedTab?.sessionId]);
  // Ref giữ onTurnComplete luôn mới nhất (tránh stale closure trong sendMessage async)
  const onTurnCompleteRef = useRef(onTurnComplete);
  useEffect(() => {
    onTurnCompleteRef.current = onTurnComplete;
  }, [onTurnComplete]);

  // Track pending format retry after partial parse
  const pendingFormatRetryRef = useRef<{
    unparsedBlocks: string[];
    validActionCount: number;
    formatReminder: string;
  } | null>(null);

  const lastStreamEndRef = useRef(0);

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
  const {
    aiLanguage,
    systemPromptMode,
    promptLengthMode,
    useSkillEnabled,
    memoryEnabled,
  } = useSettings();
  const { treeView, rootPath } = useProject();
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
   * Gửi command "zipWorkspace" tới extension host và đợi kết quả.
   * Dùng Promise-based pattern với requestId để match response.
   * Timeout 60 giây (workspace lớn có thể mất thời gian).
   */
  const requestWorkspaceZip = useCallback((): Promise<{
    base64: string;
    mimeType: string;
    fileName: string;
    fileCount: number;
    skippedCount: number;
    sizeBytes: number;
  } | null> => {
    return new Promise((resolve) => {
      const requestId = `zip-${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const TIMEOUT_MS = 60_000;

      const timer = setTimeout(() => {
        window.removeEventListener("message", handler);
        console.warn("[Zen][Claude] Workspace zip timed out");
        resolve(null);
      }, TIMEOUT_MS);

      const handler = (event: MessageEvent) => {
        const msg = event.data;
        if (
          msg.command === "zipWorkspaceResult" &&
          msg.requestId === requestId
        ) {
          clearTimeout(timer);
          window.removeEventListener("message", handler);
          if (msg.error) {
            console.error("[Zen][Claude] zipWorkspaceResult error:", msg.error);
            resolve(null);
          } else {
            resolve(msg.data);
          }
        }
      };

      window.addEventListener("message", handler);
      extensionService.postMessage({ command: "zipWorkspace", requestId });
    });
  }, []);

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
      extraOptions?: {
        user_action?: string;
        edit_message_id?: string;
        parent_message_id?: string;
      },
    ) => {
      if (isProcessingRef.current && !skipFirstRequestLogic) {
        return;
      }

      const sessionId = selectedTab?.sessionId || -1;
      const folderPath = selectedTab?.folderPath || null;

      // Filter cancelled messages
      const currentMessages = messagesRef.current;
      let filteredMessages = currentMessages.filter((m) => !m.isCancelled);

      // For Qwen edit/regenerate: trim UI messages so only history up to (and including)
      // the edited user message is kept. Qwen handles server-side deletion of children.
      if (
        extraOptions?.user_action === "edit" &&
        extraOptions.edit_message_id
      ) {
        const editFid = extraOptions.edit_message_id;
        const editIdx = filteredMessages.findIndex(
          (m) => m.role === "user" && m.providerFid === editFid,
        );

        if (editIdx !== -1) {
          filteredMessages = filteredMessages.slice(0, editIdx + 1);
          messagesRef.current = filteredMessages;
          setMessages(filteredMessages);
        }
      }

      // Check if last message pair is complete; clean up incomplete pairs before sending
      const isEditFlow = extraOptions?.user_action === "edit";
      if (
        !skipFirstRequestLogic &&
        !isEditFlow &&
        filteredMessages.length > 0
      ) {
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
      // Cờ anti-injection lấy từ provider config (backend constant), thay cho hardcode providerId === "claude".
      // Khi true: dùng claude-system-prompt riêng, tắt SKILL/Memory, ép toolFormat='xml'.
      const isAntiInjection = antiSystemPromptInjection;

      // Per-conversation overrides take priority over global settings
      const effectiveUseSkill =
        conversationOverridesRef.current?.useSkillEnabled !== undefined
          ? conversationOverridesRef.current.useSkillEnabled
          : useSkillEnabled;
      const effectiveDiagnostic =
        conversationOverridesRef.current?.diagnosticEnabled !== undefined
          ? conversationOverridesRef.current.diagnosticEnabled
          : undefined; // undefined = use default (true) in PromptBuilder
      const effectiveMemory =
        conversationOverridesRef.current?.memoryEnabled !== undefined
          ? conversationOverridesRef.current.memoryEnabled
          : memoryEnabled;
      const effectiveToolFormat =
        conversationOverridesRef.current?.toolFormat ?? "xml";

      const promptPayload = await PromptBuilder.buildPrompt({
        content,
        isReq1,
        skipFirstRequestLogic: skipFirstRequestLogic || false,
        aiLanguage,
        treeView,
        files,
        userRequestCount: userRequestCountRef.current,
        systemPromptMode,
        promptLengthMode,
        useSkillEnabled: isAntiInjection ? false : effectiveUseSkill,
        diagnosticEnabled: effectiveDiagnostic,
        memoryEnabled: isAntiInjection ? false : effectiveMemory,
        providerId: model?.providerId ?? lastUsedModelRef.current?.providerId,
        antiSystemPromptInjection: isAntiInjection,
        toolFormat: isAntiInjection ? "xml" : effectiveToolFormat,
      });

      // ─── Check for pending format retry (partial parse) ────────────────────
      // If this is a tool-result message and we have pending format retry,
      // merge the format reminder into the content.
      let finalContent = promptPayload;
      if (skipFirstRequestLogic && pendingFormatRetryRef.current) {
        const pending = pendingFormatRetryRef.current;
        const unparsedSummary = `The following blocks from your previous response could not be parsed:\n\n${pending.unparsedBlocks.map((b: string, i: number) => `Block ${i + 1}:\n${b.slice(0, 200)}${b.length > 200 ? "..." : ""}`).join("\n\n")}\n\n`;

        finalContent = `${promptPayload}\n\n${pending.formatReminder}\n\n${unparsedSummary}\nPrevious response had ${pending.validActionCount} valid tool calls (results above). Please re-emit ONLY the ${pending.unparsedBlocks.length} failed blocks above using the correct format.`;

        console.log(
          "[Zen][sendMessage] ✅ Merged tool-result + format-reminder",
          {
            toolResultLength: promptPayload.length,
            unparsedBlocks: pending.unparsedBlocks.length,
          },
        );

        // Clear pending state after merge
        pendingFormatRetryRef.current = null;
      }
      // ─────────────────────────────────────────────────────────────────────────

      const userMessage: Message = {
        id: `msg-${Date.now()}-${skipFirstRequestLogic ? "tool" : "user"}`,
        role: "user",
        content: finalContent,
        timestamp: Date.now(),
        token_usage: calculateTokens(finalContent),
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
            const parsed = parseAIResponse(msg.content, effectiveToolFormat);
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

      // When promptLengthMode is "none", system prompt is not sent so
      // diagnostic and skill are effectively disabled regardless of toggles.
      const effectiveConversationOverrides: typeof conversationOverridesRef.current =
        promptLengthMode === "none"
          ? {
              diagnosticEnabled: false,
              useSkillEnabled: false,
              memoryEnabled: false,
              toolFormat: conversationOverridesRef.current?.toolFormat,
            }
          : conversationOverridesRef.current;

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
        undefined,
        undefined,
        undefined,
        false,
        effectiveConversationOverrides,
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
        const ref_file_ids: Array<{
          file_id: string;
          conversation_id?: string;
          url: string;
          type?: string;
          name?: string;
          file_type?: string;
        }> = [];
        const localFiles = files
          ? files.filter(
              (f: any) =>
                !f.id?.startsWith("attached-") &&
                !f.id?.startsWith("skill-") &&
                !f.id?.startsWith("terminal-") &&
                !f.id?.startsWith("snippet-") && // 🚀 FIX: Don't upload text snippets
                !f.id?.startsWith("external-"), // 🚀 FIX: Don't upload external files
            )
          : [];

        // ── Claude: sinh conversationId TRƯỚC KHI upload ─────────────────
        // Claude gắn file với conversation tại thời điểm upload. Nếu upload
        // và gửi message dùng 2 conversationId khác nhau → server không tìm
        // thấy file. Giải pháp: sinh UUID ở đây, dùng cho cả upload lẫn
        // streamChat. Nếu đã có backendConversationId (conversation cũ) thì
        // dùng lại nó.
        const antiInjectionConvId: string | undefined = isAntiInjection
          ? backendConversationIdRef.current ||
            (effectiveChatUuid
              ? sessionStorage.getItem(
                  `zen-backend-conv:${effectiveChatUuid}`,
                ) || undefined
              : undefined) ||
            crypto.randomUUID()
          : undefined;

        // ── Anti-injection provider: zip workspace và gửi kèm message đầu tiên ──
        // isReq1 = true nghĩa là đây là message đầu tiên của conversation mới.
        // Chỉ zip khi không phải tool result (skipFirstRequestLogic = false).
        if (isAntiInjection && isReq1 && !skipFirstRequestLogic) {
          try {
            const zipResult = await requestWorkspaceZip();
            if (zipResult) {
              const zipFile = {
                id: `file-workspace-zip-${Date.now()}`,
                name: zipResult.fileName,
                size: zipResult.sizeBytes,
                type: zipResult.mimeType,
                content: `data:${zipResult.mimeType};base64,${zipResult.base64}`,
              };

              // Upload zip riêng — lỗi ở đây không block gửi message
              if (finalAccount?.id) {
                try {
                  const zipUploaded = await uploadFiles(
                    [zipFile],
                    finalAccount.id,
                    antiInjectionConvId,
                  );
                  ref_file_ids.push(...zipUploaded);
                } catch (zipUploadErr) {
                  console.warn(
                    "[Zen][AntiInjection] Workspace zip upload failed (non-fatal, sending message without zip):",
                    zipUploadErr,
                  );
                }
              }
            }
          } catch (zipErr) {
            console.warn(
              "[Zen][AntiInjection] Failed to zip workspace (non-fatal):",
              zipErr,
            );
          }
        }

        if (localFiles.length > 0) {
          if (!finalAccount?.id) {
            console.error(
              `[Zen] No active account selected for file upload | finalAccount=${JSON.stringify(finalAccount)}`,
            );
            throw new Error("No active account selected for file upload");
          }

          try {
            const uploadedObjects = await uploadFiles(
              localFiles,
              finalAccount.id,
              antiInjectionConvId,
            );
            ref_file_ids.push(...uploadedObjects);
          } catch (uploadErr) {
            console.error(`[Zen] Upload failed with error:`, uploadErr);
            console.error(
              `[Zen] Upload error stack:`,
              uploadErr instanceof Error ? uploadErr.stack : "No stack",
            );
            throw uploadErr;
          }
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
        // Anti-injection provider: dùng antiInjectionConvId (đã sinh trước upload)
        // để đảm bảo file và message dùng cùng 1 conversationId.
        const convIdToSend =
          (isAntiInjection && antiInjectionConvId) ||
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

        // For Qwen regenerate support: save the fid and parentId used for this message
        // so that handleRegenerateRequest can pass them back as edit_message_id / parent_message_id.
        const isQwenProvider =
          (finalModel?.providerId ?? "").toLowerCase() === "qwen";
        // Pre-generate fid for Qwen messages (both normal chat and edit).
        // This fid is passed to the provider so the server stores the exact same UUID,
        // allowing us to reference it later for regenerate/edit.
        const qwenMessageFid =
          isQwenProvider && !skipFirstRequestLogic
            ? crypto.randomUUID()
            : undefined;

        if (qwenMessageFid) {
          userMessage.providerFid = qwenMessageFid;
          userMessage.providerParentId = effectiveParentMessageId ?? undefined;
          setMessages((prev) =>
            prev.map((m) =>
              m.id === userMessage.id
                ? {
                    ...m,
                    providerFid: qwenMessageFid,
                    providerParentId: effectiveParentMessageId ?? undefined,
                  }
                : m,
            ),
          );
        }

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

        // Ref để bridge finalContent từ onContent callback sang sau khi streamChat return
        // (assistantMessage chưa tồn tại khi callback được định nghĩa)
        const claudeParsedContentRef = { value: "" };
        let dsmlParseFailed = false;

        let streamResult: Awaited<
          ReturnType<typeof StreamingService.streamChat>
        >;
        const runStream = (messagesToSend: typeof payloadMessages) =>
          StreamingService.streamChat(
            {
              apiUrl,
              model: finalModel,
              account: finalAccount,
              messages: messagesToSend,
              conversationId: convIdToSend,
              parentMessageId: effectiveParentMessageId,
              refFileIds: ref_file_ids,
              abortSignal: abortController.signal,
              // Pass the pre-generated fid so the provider stores the exact UUID we saved.
              // For edit flow: editMessageId is the fid to overwrite (same value as messageFid).
              // For chat flow: messageFid ensures the stored fid matches what Qwen server uses.
              ...(qwenMessageFid ? { messageFid: qwenMessageFid } : {}),
              ...(extraOptions?.user_action
                ? { userAction: extraOptions.user_action }
                : {}),
              ...(extraOptions?.edit_message_id
                ? { editMessageId: extraOptions.edit_message_id }
                : {}),
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
              onRawContent: (content) => {
                setMessages((prev) => {
                  const targetIndex = prev.findIndex(
                    (m) => m.id === assistantMessageId,
                  );
                  if (targetIndex === -1) return prev;

                  const currentMessage = prev[targetIndex];
                  const newArray = prev.slice();
                  newArray[targetIndex] = {
                    ...currentMessage,
                    thinking: (currentMessage.thinking || "") + content,
                  };
                  return newArray;
                });
              },
              onContent: (content) => {
                // Anti-injection provider → strip conversation_title + parse tool markers.
                // Path mapping luôn bật vì claude.ai web dùng sandbox path
                // /home/claude/work/... cần convert về workspace.
                let finalContent = content;
                if (antiSystemPromptInjection) {
                  const processed = processClaudeContent(content, rootPath);
                  finalContent = processed.content;
                } else if (
                  (finalModel?.providerId ?? "").toLowerCase() === "deepseek"
                ) {
                  const processed = processDeepseekContent(
                    content,
                    conversationOverridesRef.current?.toolFormat ?? "xml",
                  );
                  if (processed.convertedToolCount > 0) {
                    finalContent = processed.content;
                  }
                  // DSML detection no longer triggers immediate retry —
                  // unparsed DSML blocks will be caught by ResponseParser
                  // and handled via next-request flow.
                }

                // Lưu vào ref để apply vào assistantMessage sau khi streamChat return
                claudeParsedContentRef.value = finalContent;

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
                    content: finalContent, // Replace with full parsed content
                    thinking: undefined, // Clear thinking field after parsing
                  };
                  const newArray = prev.slice();
                  newArray[targetIndex] = updatedMessage;
                  return newArray;
                });
              },
            },
          );

        try {
          streamResult = await runStream(payloadMessages);
          // DSML retry removed — now handled via next-request flow (safer, no race condition)
        } catch (error) {
          throw error;
        }

        const { message: assistantMessage, backendConversationId } =
          streamResult;

        lastStreamEndRef.current = Date.now();

        // Merge the final message from StreamingService with our tracked message
        assistantMessage.id = assistantMessageId;

        // Apply parsed content (claude provider: strip markers + convert tools)
        if (claudeParsedContentRef.value) {
          assistantMessage.content = claudeParsedContentRef.value;
          // rawResponse được dùng bởi parseAIResponse — cần sync lại
          assistantMessage.rawResponse = assistantMessage.thinking
            ? `${assistantMessage.thinking}\n\n${claudeParsedContentRef.value}`
            : claudeParsedContentRef.value;
        }

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
          assistantMessage.antiSystemPromptInjection = isAntiInjection;
          userMsgToLog.antiSystemPromptInjection = isAntiInjection;
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

        // ─────────────────────────────────────────────────────────────────
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
          effectiveConversationOverrides,
        );

        // Parse response to extract tool sequence with error handling
        const { parseAIResponse } =
          await import("../../services/ResponseParser");
        let toolSequence = "";
        let parsed: any = null;
        let hasParsingError = false;

        // Define contentToParse outside try block so it's available in catch
        const contentToParse =
          assistantMessage.rawResponse || assistantMessage.content;
        const currentToolFormat =
          conversationOverridesRef.current?.toolFormat ?? "xml";

        try {
          // 🔧 FIX: Parse rawResponse (includes thinking) instead of content

          parsed = parseAIResponse(contentToParse, currentToolFormat);
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
          const errorDetails =
            parseError instanceof Error
              ? parseError.message
              : "Unknown parsing error";

          console.error("[Zen][sendMessage] ❌ Full parse error detected:", {
            error: errorDetails,
            contentLength: contentToParse.length,
            contentPreview: contentToParse.substring(0, 200),
            toolFormat: currentToolFormat,
          });

          // Mark message as awaiting format retry instead of error
          assistantMessage.isAwaitingFormatRetry = true;
          assistantMessage.unparsedContent = contentToParse;

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

          // Update messages array with retry flag
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessageId
                ? {
                    ...m,
                    isAwaitingFormatRetry: true,
                    unparsedContent: contentToParse,
                    parseDebugInfo: assistantMessage.parseDebugInfo,
                  }
                : m,
            ),
          );
        }

        const conversationTitleBlock = parsed?.contentBlocks?.find(
          (b: any) => b.type === "conversation_title",
        );
        const conversationTitle = conversationTitleBlock?.content;

        // Cập nhật header title ngay lập tức khi AI trả về <conversation_title>
        if (conversationTitle && onConversationTitleChange) {
          onConversationTitleChange(conversationTitle);
        }

        // ─────────────────────────────────────────────────────────────────

        saveConversation(
          sessionId,
          folderPath,
          [...updatedMessages, assistantMessage],
          effectiveChatUuid,
          selectedTab || undefined,
          false,
          conversationTitle,
          backendConversationId || backendConversationIdRef.current,
          undefined,
          undefined,
          undefined,
          false, // skipSave = false → update with parsed data (or error state)
          effectiveConversationOverrides,
        );

        // ─── HANDLE PARSE ERRORS & PARTIAL PARSE (next-request) ─────────────────
        // If parse completely failed OR partial parse with unparsed blocks,
        // trigger next-request with format reminder instead of showing error.
        if (hasParsingError) {
          // Full parse error — send format reminder and ask to re-emit all tools
          const currentToolFormat =
            conversationOverridesRef.current?.toolFormat ?? "xml";
          const formatReminder =
            currentToolFormat === "json"
              ? FORMAT_REMINDER_JSON
              : FORMAT_REMINDER_XML;

          const nextRequestContent = `${formatReminder}\n\nYour previous response could not be parsed. Please re-emit all tool calls using the correct format above.`;

          console.error("[Zen][sendMessage] ❌ Full parse error → auto-retry", {
            toolFormat: currentToolFormat,
            contentLength: contentToParse.length,
          });

          // Trigger next-request (hidden user message + auto-send)
          setTimeout(() => {
            if (isProcessingRef.current) {
              return;
            }
            sendMessage(
              nextRequestContent,
              undefined,
              undefined,
              undefined,
              true, // skipFirstRequestLogic
              undefined,
              true, // uiHidden
            );
          }, 100);

          return; // Stop here, don't trigger tool execution
        }

        if (!hasParsingError && parsed && parsed.hasUnparsedContent) {
          // Execute valid actions first (will happen below in normal flow)
          // After tool execution completes, onToolRequest callback should trigger next-request
          // by checking parsed.hasUnparsedContent flag.
          // Store unparsed blocks in assistantMessage for later retrieval
          assistantMessage.unparsedContent =
            parsed.unparsedBlocks?.join("\n\n---\n\n");

          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantMessageId
                ? {
                    ...m,
                    unparsedContent: assistantMessage.unparsedContent,
                  }
                : m,
            ),
          );

          // Partial parse handling will be triggered after tool execution in onToolRequest
        }
        // ─────────────────────────────────────────────────────────────────────────

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

        if (
          !hasParsingError &&
          parsed &&
          onToolRequest &&
          parsed.actions?.length > 0
        ) {
          // Claude provider logic for tool execution filtering:
          // 1. Always allow: write_to_file, replace_in_file (for applying changes locally).
          // 2. Conditional allow: run_command ONLY IF it's NOT a sandbox command (_is_sandbox !== true).
          //    - Sandbox commands are display-only (handled by TagRouter/Renderer).
          //    - Local commands (mapped from workspace paths) should execute to perform actual work.
          // 3. Block others: read_file, list_files, etc. (usually redundant or handled differently).

          // Lọc tool execution riêng cho anti-injection provider (sandbox path mapping).
          // Dùng cờ từ provider config thay vì hardcode providerId === "claude".
          const isAntiInjectionConversation = antiSystemPromptInjection;

          // Ensure each action carries its ORIGINAL index from parsed.actions
          // so that useToolExecution generates correct actionIds matching the UI renderer keys.
          const indexedActions = parsed.actions.map(
            (a: ToolAction, idx: number) => ({
              ...a,
              _index: idx,
            }),
          );

          const executableActions = isAntiInjectionConversation
            ? indexedActions.filter((a: ToolAction & { _index: number }) => {
                if (
                  a.type === "write_to_file" ||
                  a.type === "replace_in_file"
                ) {
                  return true;
                }

                if (a.type === "run_command") {
                  // Execute only if it's marked as local (not sandbox)
                  const isSandbox = a.params?._is_sandbox === true;
                  return !isSandbox;
                }

                return false;
              })
            : indexedActions;

          if (executableActions.length > 0) {
            const isAutoTrigger = true;

            onToolRequest(
              executableActions,
              assistantMessage,
              isAutoTrigger,
              TOOL_ACTION_TYPES.ACCEPT,
            );

            // ─── Partial parse: store metadata for later merge ──────────────────
            // Instead of immediate next-request, store metadata and wait for
            // tool execution completion. The merged message (tool results +
            // format reminder) will be sent via onTurnComplete callback.
            if (parsed.hasUnparsedContent && parsed.unparsedBlocks) {
              const currentToolFormat =
                conversationOverridesRef.current?.toolFormat ?? "xml";
              const formatReminder =
                currentToolFormat === "json"
                  ? FORMAT_REMINDER_JSON
                  : FORMAT_REMINDER_XML;

              pendingFormatRetryRef.current = {
                unparsedBlocks: parsed.unparsedBlocks,
                validActionCount: parsed.actions.length,
                formatReminder,
              };

              console.warn(
                "[Zen][sendMessage] ⚠️ Partial parse → will merge with tool results",
                {
                  validActions: parsed.actions.length,
                  unparsedBlocks: parsed.unparsedBlocks.length,
                },
              );
            }
            // ─────────────────────────────────────────────────────────────────────
          } else {
            onTurnCompleteRef.current?.();
          }
        } else {
          onTurnCompleteRef.current?.();
        }

        if (hasParsingError) {
          console.warn(
            `[Zen][sendMessage] Parsing error occurred but turn complete notified`,
          );
        }
      } catch (error) {
        dispatchStreaming({ type: "RESET_STREAMING" });
        abortControllerRef.current = null;

        if (error instanceof Error && error.name === "AbortError") {
          setIsProcessingSync(false);
          return;
        }

        // Fallback: nếu vòng lặp tool-result bị lỗi, vẫn phải notify turn complete
        onTurnCompleteRef.current?.();

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
        const effectiveOverridesForSelect =
          promptLengthMode === "none"
            ? {
                diagnosticEnabled: false,
                useSkillEnabled: false,
                memoryEnabled: false,
              }
            : conversationOverridesRef.current;

        saveConversation(
          sessionId,
          folderPath,
          updatedMessages,
          convId,
          selectedTab || undefined,
          true,
          undefined,
          backendConversationIdRef.current,
          undefined,
          undefined,
          undefined,
          false,
          effectiveOverridesForSelect,
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
