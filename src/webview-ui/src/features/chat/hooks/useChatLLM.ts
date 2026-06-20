import { useState, useRef, useCallback, useEffect } from "react";
import { Message } from "../types/message";
import { ToolAction, parseAIResponse } from "../services/ResponseParser";
import { getDefaultPrompt, combinePrompts } from "../prompts";
import {
  PERSISTENT_RULES,
  buildPermissionModeTag,
  buildPermissionModeTagCompact,
} from "../prompts/persistent-rules";
import {
  logChatToWorkspace,
  saveConversation,
  calculateTokens,
  deleteConversation,
} from "../services/ConversationService";
import { useSettings } from "../../../context/SettingsContext";
import { useProject } from "../../../context/ProjectContext";
import { extensionService } from "@/services/ExtensionService";
import { useFileUpload } from "./useFileUpload";
import { ChatSession } from "../types/chat";

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

export const useChatLLM = ({
  apiUrl,
  selectedTab,
  onConversationIdChange,
  onToolRequest,
}: UseChatLLMProps) => {
  const {
    language: preferredLanguage,
    aiLanguage,
    permissionMode,
  } = useSettings();
  const { workspace, treeView } = useProject();
  const { uploadFiles } = useFileUpload(apiUrl);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const isProcessingRef = useRef(false);
  const setIsProcessingSync = useCallback((val: boolean) => {
    isProcessingRef.current = val;
    setIsProcessing(val);
  }, []);
  const [isStreaming, setIsStreaming] = useState(false);
  // DeepSeek: true khi server đang tự động gọi /chat/continue để lấy phần còn lại của response dài
  const [isContinuing, setIsContinuing] = useState(false);
  // Ref để tránh stale closure bên trong sendMessage useCallback
  const isContinuingRef = useRef(false);
  const setIsContinuingSync = (val: boolean) => {
    isContinuingRef.current = val;
    setIsContinuing(val);
  };
  const [incompleteHasPartialTool, setIncompleteHasPartialTool] =
    useState(false);
  const [incompletePartialToolType, setIncompletePartialToolType] = useState<
    string | null
  >(null);
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
    setCurrentConversationId("");
    setMessages([]);
    setIsProcessingSync(false);
    setIsStreaming(false);
    setIsContinuingSync(false);
    setIncompleteHasPartialTool(false);
    setIncompletePartialToolType(null);
    setConversationToolOverrides({});
  }, []);

  const stopGeneration = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    // Cleanup if it was the first turn of a new session
    if (isProcessing && messagesRef.current.length <= 2) {
      const chatId = currentConversationIdRef.current;
      if (chatId) {
        deleteConversation(chatId);
        setCurrentConversationId("");
        setMessages([]);
      }
    }

    setIsStreaming(false);
    setIsContinuingSync(false);
    setIncompleteHasPartialTool(false);
    setIncompletePartialToolType(null);
    setIsProcessingSync(false);

    // Stop all processes in the extension
    extensionService.postMessage({
      command: "stopCommand",
      actionId: "all",
      kill: true,
    });
  }, [isProcessing]);

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
          language: aiLanguage || preferredLanguage,
        };

        try {
          const fetchedInfo = await extensionService.getSystemInfo();
          if (fetchedInfo?.data) {
            systemInfo = {
              ...systemInfo,
              ...fetchedInfo.data,
              language: aiLanguage || preferredLanguage,
            };
          }
        } catch (e) {}

        const effectiveLang = aiLanguage || preferredLanguage;
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

      // Full mode tag (with all 4 mode descriptions) only for user-initiated requests.
      // Auto/tool-flush requests get a compact tag with just the active mode name.
      const permissionModeTag = skipFirstRequestLogic
        ? buildPermissionModeTagCompact(permissionMode)
        : buildPermissionModeTag(permissionMode);
      const promptPayload = isReq1
        ? `${systemPrompt}${projectContextStr}${attachedContextStr}\n\n${PERSISTENT_RULES}\n\n${permissionModeTag}\n\n${fullContent}`
        : `${attachedContextStr}\n\n${PERSISTENT_RULES}\n\n${permissionModeTag}\n\n${fullContent}`;

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
      );
      // User message log will happen after response when we have backendConversationId

      // Persist / Resolve Model and Account
      const effModel = model || lastUsedModelRef.current;
      const effAccount = account || lastUsedAccountRef.current;

      // 🆕 History Fallback: If metadata is still missing (e.g. after restoration), look back at history
      let finalModel = effModel;
      let finalAccount = effAccount;

      if (!finalModel || !finalAccount) {
        const lastMetadataMsg = [...filteredMessages]
          .reverse()
          .find((m) => m.role === "assistant" && m.providerId && m.modelId);

        if (lastMetadataMsg) {
          if (!finalModel) {
            finalModel = {
              id: lastMetadataMsg.modelId!,
              providerId: lastMetadataMsg.providerId!,
            };
          }
          if (!finalAccount && lastMetadataMsg.accountId) {
            finalAccount = { id: lastMetadataMsg.accountId };
          }
        }
      }

      if (finalModel) lastUsedModelRef.current = finalModel;
      if (finalAccount) lastUsedAccountRef.current = finalAccount;

      // 🔄 Model/Account switch detection: if the user changed provider or account
      // mid-session, the old backendConversationId belongs to a different provider
      // and must NOT be sent to the new one (it would cause session-not-found errors).
      const prevModel = effModel; // value before we set lastUsedModelRef
      const prevAccount = effAccount;
      const modelSwitched =
        !skipFirstRequestLogic &&
        prevModel &&
        finalModel &&
        (prevModel.id !== finalModel.id ||
          prevModel.providerId !== finalModel.providerId);
      const accountSwitched =
        !skipFirstRequestLogic &&
        prevAccount &&
        finalAccount &&
        prevAccount.id !== finalAccount.id;

      if (modelSwitched || accountSwitched) {
        console.warn(
          `[Zen] Model/account switched — resetting backend conversationId and qwenParentId`,
          { prevModel, finalModel, prevAccount, finalAccount },
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
            ? sessionStorage.getItem(`zen-backend-conv:${effectiveChatUuid}`) || undefined
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
        setIsStreaming(true);

        const headers = { "Content-Type": "application/json" };
        const bodyStr = JSON.stringify(body);
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
                    } else if (metaObj.continuing === false) {
                      // Dùng ref để tránh stale closure — isContinuing state có thể chưa update vào closure
                      if (isContinuingRef.current) {
                        setIsContinuingSync(false);
                      }
                    }

                    // DeepSeek: server phát hiện response INCOMPLETE có partial toolcall
                    if (metaObj.incomplete_has_partial_tool !== undefined) {
                      setIncompleteHasPartialTool(
                        metaObj.incomplete_has_partial_tool,
                      );
                      setIncompletePartialToolType(
                        metaObj.incomplete_partial_tool_type ?? null,
                      );
                    }

                    // DeepSeek: tất cả continuations đã hoàn thành — reset partial tool state
                    if (metaObj.continuation_complete === true) {
                      setIncompleteHasPartialTool(false);
                      setIncompletePartialToolType(null);
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

                  if (data.usage) {
                    assistantMessage = {
                      ...assistantMessage,
                      usage: data.usage,
                      token_usage: data.usage.total_tokens,
                    };
                  }
                  if (data.content) {
                    assistantMessage = {
                      ...assistantMessage,
                      content: assistantMessage.content + data.content,
                    };
                  }
                  if (data.thinking) {
                    assistantMessage = {
                      ...assistantMessage,
                      thinking:
                        (assistantMessage.thinking || "") + data.thinking,
                    };
                  }

                  if (data.usage || data.content || data.thinking) {
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantMessage.id ? assistantMessage : m,
                      ),
                    );
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

        if (isContinuing) {
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

            if (data.usage) {
              assistantMessage = {
                ...assistantMessage,
                usage: data.usage,
                token_usage: data.usage.total_tokens,
              };
            }
            if (data.content) {
              assistantMessage = {
                ...assistantMessage,
                content: assistantMessage.content + data.content,
              };
            }
            if (data.thinking) {
              assistantMessage = {
                ...assistantMessage,
                thinking: (assistantMessage.thinking || "") + data.thinking,
              };
            }
          } catch (e) {}
        }

        // Final fallback: if token_usage is still missing, calculate it manually
        if (!assistantMessage.token_usage && assistantMessage.content) {
          assistantMessage.token_usage = calculateTokens(
            assistantMessage.content,
          );
        }

        // Final state update to ensure UI and subsequent logic see the latest usage info
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMessage.id ? assistantMessage : m,
          ),
        );

        setIsProcessingSync(false);
        setIsStreaming(false);
        setIsContinuingSync(false);
        setIncompleteHasPartialTool(false);
        setIncompletePartialToolType(null);
        abortControllerRef.current = null;

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
        setIsStreaming(false);
        setIsContinuingSync(false);
        setIncompleteHasPartialTool(false);
        setIncompletePartialToolType(null);
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
    isProcessing,
    setIsProcessing: setIsProcessingSync,
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
      const updatedMessages = messagesRef.current.map((m) =>
        m.id === messageId ? { ...m, selectedOption: option } : m,
      );
      setMessages(updatedMessages);

      const sessionId = selectedTab?.sessionId || -1;
      const folderPath = selectedTab?.folderPath || null;
      saveConversation(
        sessionId,
        folderPath,
        updatedMessages,
        currentConversationIdRef.current,
        selectedTab || undefined,
        true, // skipTimestampUpdate
        undefined,
        backendConversationIdRef.current,
      );
    },
  };
};
