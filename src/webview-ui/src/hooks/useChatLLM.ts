import { useState, useRef, useCallback, useEffect } from "react";
import { Message } from "../components/ChatPanel/ChatBody/types";
import { TabInfo } from "../types";
import { ToolAction, parseAIResponse } from "../services/ResponseParser";
import { extensionService } from "../services/ExtensionService";
import { getDefaultPrompt } from "../components/ChatPanel/prompts";
import {
  logToWorkspace,
  saveConversation,
  calculateTokens,
  getConversationKey,
} from "../services/ConversationService";

interface UseChatLLMProps {
  apiUrl: string;
  selectedTab: TabInfo | null;
  onConversationIdChange?: (id: string) => void;
  onToolRequest?: (actions: ToolAction[], assistantMessage: Message) => void;
}

export const useChatLLM = ({
  apiUrl,
  selectedTab,
  onConversationIdChange,
  onToolRequest,
}: UseChatLLMProps) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentConversationId, setCurrentConversationId] =
    useState<string>("");

  const messagesRef = useRef<Message[]>([]);
  const currentConversationIdRef = useRef<string>("");
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
    setIsStreaming(false);
    setIsProcessing(false);

    // Stop all processes in the extension
    extensionService.postMessage({
      command: "stopCommand",
      actionId: "all",
      kill: true,
    });
  }, []);

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
      if (isProcessing && !skipFirstRequestLogic) {
        console.warn("[useChatLLM] Already processing a request, ignoring.");
        return;
      }

      const tabId = selectedTab?.tabId || -1;
      const folderPath = selectedTab?.folderPath || null;

      // Clean up ghosted (cancelled) messages
      const currentMessages = messagesRef.current;
      const filteredMessages = currentMessages.filter((m) => !m.isCancelled);

      let effectiveConversationId = currentConversationIdRef.current;
      const isNewSession = !effectiveConversationId;

      if (isNewSession) {
        effectiveConversationId = Date.now().toString();
        setCurrentConversationId(effectiveConversationId);
      }

      const isReq1 = filteredMessages.length === 0 && !skipFirstRequestLogic;
      let systemPrompt = "";
      let projectContextStr = "";

      if (isReq1) {
        systemPrompt = getDefaultPrompt();
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
      const promptTokens = calculateTokens(promptPayload);

      const userMessage: Message = {
        id: `msg-${Date.now()}-${skipFirstRequestLogic ? "tool" : "user"}`,
        role: "user",
        content: fullContent,
        timestamp: Date.now(),
        isFirstRequest: isReq1,
        isToolRequest: skipFirstRequestLogic,
        systemPrompt: isReq1 ? systemPrompt : undefined,
        contextSize: promptPayload.length,
        usage: {
          prompt_tokens: promptTokens,
          completion_tokens: 0,
          total_tokens: promptTokens,
        },
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
        isReq1,
        effectiveConversationId,
        selectedTab || undefined,
      );
      logToWorkspace(effectiveConversationId, userMessage);

      // Start backup watch if new session
      if (isReq1) {
        extensionService.postMessage({
          command: "startBackupWatch",
          conversationId: effectiveConversationId,
        });
      }

      try {
        const effModel = selectedQuickModel
          ? {
              id: selectedQuickModel.modelId,
              providerId: selectedQuickModel.providerId,
            }
          : model;
        const effAccount = selectedQuickModel?.accountId
          ? { id: selectedQuickModel.accountId }
          : account;

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
          conversationId: isNewSession ? "" : effectiveConversationId,
          thinking,
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

                  // Handling conversation rename (ID change)
                  if (data.meta?.conversation_id) {
                    const realId = data.meta.conversation_id;
                    if (effectiveConversationId !== realId) {
                      // Handle rename logic (storage delete/update)
                      // We can delegate this to ConversationService?
                      // ideally we just update our state
                      const oldKey = getConversationKey(
                        tabId,
                        folderPath,
                        effectiveConversationId,
                      );
                      const storage = (window as any).storage; // or extensionService.getStorage()
                      if (storage) {
                        storage.delete(oldKey);
                        // Update logs?
                        extensionService.postMessage({
                          command: "renameConversationLog",
                          oldConversationId: effectiveConversationId,
                          newConversationId: realId,
                        });
                      }

                      effectiveConversationId = realId;
                      setCurrentConversationId(realId);
                    }
                  }

                  if (data.usage) {
                    assistantMessage = {
                      ...assistantMessage,
                      usage: data.usage,
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

        setIsProcessing(false);
        setIsStreaming(false);
        abortControllerRef.current = null;

        logToWorkspace(effectiveConversationId, assistantMessage);

        // Tool Actions parsing
        const parsed = parseAIResponse(assistantMessage.content);
        if (parsed.actions && parsed.actions.length > 0) {
          onToolRequest?.(parsed.actions, assistantMessage);
        } else {
          // Just finished
        }

        // Save final conversation state
        saveConversation(
          tabId,
          folderPath,
          [...updatedMessages, assistantMessage],
          isReq1,
          effectiveConversationId,
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
    isProcessing,
    setIsProcessing,
    isStreaming,
    currentConversationId,
    setCurrentConversationId,
    sendMessage,
    stopGeneration,
  };
};
