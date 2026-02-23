import { useState, useRef, useCallback, useEffect } from "react";
import { Message } from "../components/ChatPanel/ChatBody/types";
import { TabInfo } from "../types";
import { ToolAction, parseAIResponse } from "../services/ResponseParser";
import { extensionService } from "../services/ExtensionService";
import {
  getDefaultPrompt,
  combinePrompts,
} from "../components/ChatPanel/prompts";
import {
  logChatToWorkspace,
  saveConversation,
  calculateTokens,
  getConversationKey,
  deleteConversation,
} from "../services/ConversationService";
import { useSettings } from "../context/SettingsContext";

interface UseChatLLMProps {
  apiUrl: string;
  selectedTab: TabInfo | null;
  isBackupEnabled?: boolean;
  onConversationIdChange?: (id: string) => void;
  onToolRequest?: (
    actions: ToolAction[],
    assistantMessage: Message,
    isAutoTrigger?: boolean,
  ) => void;
}

export const useChatLLM = ({
  apiUrl,
  selectedTab,
  isBackupEnabled = true,
  onConversationIdChange,
  onToolRequest,
}: UseChatLLMProps) => {
  const { language: preferredLanguage } = useSettings();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentConversationId, setCurrentConversationId] =
    useState<string>("");

  const messagesRef = useRef<Message[]>([]);
  const currentConversationIdRef = useRef<string>("");
  const backendConversationIdRef = useRef<string>(""); // real conversation_id from backend API
  const lastUsedModelRef = useRef<any>(null);
  const lastUsedAccountRef = useRef<any>(null);
  const lastUsedThinkingRef = useRef<boolean>(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    currentConversationIdRef.current = currentConversationId;
    onConversationIdChange?.(currentConversationId);
  }, [currentConversationId, onConversationIdChange]);

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
    setIsProcessing(false);

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
      thinking?: boolean,
      selectedQuickModel?: {
        providerId: string;
        modelId: string;
        accountId?: string;
      } | null,
    ) => {
      if (!skipFirstRequestLogic) {
        // Detailed trace for user-initiated requests to catch duplicates
        console.trace("[useChatLLM] sendMessage Stack Trace");
      }

      if (isProcessing && !skipFirstRequestLogic) {
        console.warn("[useChatLLM] Already processing a request, ignoring.");
        return;
      }

      const tabId = selectedTab?.tabId || -1;
      const folderPath = selectedTab?.folderPath || null;

      // Clean up ghosted (cancelled) messages
      const currentMessages = messagesRef.current;
      const filteredMessages = currentMessages.filter((m) => !m.isCancelled);

      let effectiveChatUuid = currentConversationIdRef.current;
      const isNewSession = !effectiveChatUuid;

      if (isNewSession) {
        effectiveChatUuid = crypto.randomUUID?.() || Date.now().toString();
        setCurrentConversationId(effectiveChatUuid);
        backendConversationIdRef.current = ""; // reset for new session
        lastUsedModelRef.current = null;
        lastUsedAccountRef.current = null;
        lastUsedThinkingRef.current = false;

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
          language: preferredLanguage,
        };

        try {
          const fetchedInfo = await extensionService.getSystemInfo();
          if (fetchedInfo?.data) {
            systemInfo = {
              ...systemInfo,
              ...fetchedInfo.data,
              language: preferredLanguage,
            };
          }
        } catch (e) {
          console.error("Failed to fetch system info", e);
        }

        systemPrompt = getDefaultPrompt(preferredLanguage);
        // Use real system info if we managed to fetch it, override the default
        if (systemInfo.os !== "Unknown OS") {
          systemPrompt = combinePrompts({
            language: preferredLanguage,
            systemInfo,
          });
        }

        try {
          // Fetch project context
          // We can move this to a service helper too, but let's keep it here for now or use ExtensionService
          const requestId = `ctx-${Date.now()}`;
          // We need a way to await response from extension service.
          // ExtensionService.postMessage doesn't return promise for custom events easily unless we add it.
          // But we can use the window.vscodeApi directly via ExtensionService if we expose it?
          // Actually ExtensionService has getStorage but not generic request.
          // Let's assume we can implementation a generic request in proper refactor.
          // For now, let's implement the promise wrapper here or add it to ExtensionService.

          // I'll skip the elaborate context fetching refactor for this specific step to avoid breaking logic.
          // I will assume we might need to implement `request` in ExtensionService later.

          // ... Context fetching logic ...
          // For brevity, I will use a simplified version or assume `content` includes it if prepared.
          // But actually ChatPanel Logic had this.

          // Let's implement a quick helper for context since it's important.
          const contextData: any = await new Promise((resolve) => {
            const timeoutId = setTimeout(() => resolve(null), 5000);
            const handler = (event: MessageEvent) => {
              const msg = event.data;
              if (
                msg.command === "projectContextResult" &&
                msg.requestId === requestId
              ) {
                clearTimeout(timeoutId);
                window.removeEventListener("message", handler);
                resolve(msg.data);
              }
            };
            window.addEventListener("message", handler);
            extensionService.postMessage({
              command: "getProjectContext",
              requestId,
            });
          });

          if (contextData) {
            const { workspace, rules, treeView } = contextData;
            projectContextStr += `\n\n## Project Overview (workspace.md)\n\`\`\`\n${workspace || ""}\n\`\`\``;
            projectContextStr += `\n\n## Project Rules (workspace_rules.md)\n\`\`\`\n${rules || ""}\n\`\`\``;
            projectContextStr += `\n\n## Project Structure\n\`\`\`\n${treeView || ""}\n\`\`\``;
          }
        } catch (e) {
          console.error("Failed to fetch project context", e);
        }
      }

      const fullContent = skipFirstRequestLogic
        ? content
        : `## User Message\n\`\`\`\n${content}\n\`\`\``;

      const promptPayload = isReq1
        ? `${systemPrompt}${projectContextStr}\n\n${fullContent}`
        : fullContent;

      // In the new schema, req1 content includes system prompt
      const finalContent = isReq1 ? promptPayload : fullContent;

      const userMessage: Message = {
        id: `msg-${Date.now()}-${skipFirstRequestLogic ? "tool" : "user"}`,
        role: "user",
        content: finalContent,
        timestamp: Date.now(),
        token_usage: calculateTokens(promptPayload),
        actionIds: actionIds,
        uiHidden: uiHidden,
      };

      const updatedMessages = [...filteredMessages, userMessage];
      setMessages(updatedMessages);
      setIsProcessing(true);

      // Save & Log
      saveConversation(
        tabId,
        folderPath,
        updatedMessages,
        effectiveChatUuid,
        selectedTab || undefined,
      );
      // User message log will happen after response when we have backendConversationId

      // Start backup watch if new session and enabled
      if (isReq1 && isBackupEnabled) {
        extensionService.postMessage({
          command: "startBackupWatch",
          conversationId: effectiveChatUuid,
        });
      }

      // Persist / Resolve Model and Account
      const effModel = selectedQuickModel
        ? {
            id: selectedQuickModel.modelId,
            providerId: selectedQuickModel.providerId,
          }
        : model || lastUsedModelRef.current;

      const effAccount = selectedQuickModel?.accountId
        ? { id: selectedQuickModel.accountId }
        : account || lastUsedAccountRef.current;

      const effThinking = thinking ?? lastUsedThinkingRef.current;

      if (effModel) lastUsedModelRef.current = effModel;
      if (effAccount) lastUsedAccountRef.current = effAccount;
      lastUsedThinkingRef.current = effThinking;

      try {
        const effPromptPayload = isReq1
          ? `${systemPrompt}${projectContextStr}\n\n${fullContent}`
          : fullContent;

        let payloadMessages = updatedMessages.map((m) => ({
          role: m.role,
          content: m.content,
        }));
        if (isReq1) {
          payloadMessages[0].content = promptPayload;
        }

        const body = {
          modelId: effModel?.id,
          providerId: effModel?.providerId,
          accountId: effAccount?.id,
          messages: payloadMessages,
          stream: true,
          // Use the real backend conversationId if we have it (req2+), otherwise empty (req1)
          conversationId:
            backendConversationIdRef.current || (isNewSession ? "" : ""),
          thinking: effThinking,
        };

        const abortController = new AbortController();
        abortControllerRef.current = abortController;
        setIsStreaming(true);

        const response = await fetch(`${apiUrl}/v1/chat/accounts/messages`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error(`API Error: ${response.status}`);
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

        while (!done) {
          const { value, done: readerDone } = await reader.read();
          done = readerDone;
          if (value) {
            const chunk = decoder.decode(value, { stream: true });
            buffer += chunk;
            const lines = buffer.split("\n");
            buffer = lines.pop() || "";

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                const dataStr = line.slice(6).trim();
                if (dataStr === "[DONE]") continue;
                try {
                  const data = JSON.parse(dataStr);

                  // Capture the real backend conversation_id for subsequent requests
                  const recvConvId =
                    data.meta?.conversation_id || data.conversation_id;
                  if (recvConvId) {
                    backendConversationId = recvConvId;
                    backendConversationIdRef.current = recvConvId;
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

                  if (data.usage || data.content) {
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantMessage.id ? assistantMessage : m,
                      ),
                    );
                  }
                } catch (e) {}
              }
            }
          }
        }

        // Process any remaining data in buffer after stream ends
        const remainingLines = buffer
          .split("\n")
          .filter((l) => l.trim().startsWith("data: "));
        for (const line of remainingLines) {
          const dataStr = line.slice(6).trim();
          if (dataStr === "[DONE]") continue;
          try {
            const data = JSON.parse(dataStr);
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

        setIsProcessing(false);
        setIsStreaming(false);
        abortControllerRef.current = null;

        // Log user message first, then assistant message, both with the real conversationId
        try {
          const userMsgToLog = updatedMessages[updatedMessages.length - 1];
          const finalConversationId =
            backendConversationId || backendConversationIdRef.current;
          logChatToWorkspace(effectiveChatUuid, {
            ...userMsgToLog,
            conversationId: finalConversationId,
          });

          logChatToWorkspace(effectiveChatUuid, {
            ...assistantMessage,
            conversationId: finalConversationId,
          });
        } catch (logErr) {
          console.error(`[useChatLLM] Critical error during log call:`, logErr);
        }

        // Tool Actions parsing
        const parsed = parseAIResponse(assistantMessage.content);
        if (parsed.actions && parsed.actions.length > 0) {
          onToolRequest?.(parsed.actions, assistantMessage, true);
        } else {
          // Just finished
        }

        // Save final conversation state
        saveConversation(
          tabId,
          folderPath,
          [...updatedMessages, assistantMessage],
          effectiveChatUuid,
          selectedTab || undefined,
        );
      } catch (error) {
        setIsStreaming(false);
        abortControllerRef.current = null;
        if (error instanceof Error && error.name === "AbortError") {
          setIsProcessing(false);
          return;
        }

        const errorMessage: Message = {
          id: `msg-${Date.now()}-error`,
          role: "assistant",
          content: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errorMessage]);
        setIsProcessing(false);
      }
    },
    [apiUrl, selectedTab, isProcessing, onToolRequest, currentConversationId],
  );

  return {
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
    setBackendConversationId: (id: string) => {
      backendConversationIdRef.current = id;
    },
  };
};
