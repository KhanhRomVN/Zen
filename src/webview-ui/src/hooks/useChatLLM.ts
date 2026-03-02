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
import { useProject } from "../context/ProjectContext";

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
  const { workspace, treeView } = useProject();
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
          // Use pre-fetched context from ProjectContext
          if (treeView && treeView.trim()) {
            projectContextStr += `\n\n## Project Structure\n\`\`\`\n${treeView}\n\`\`\``;
          }
          if (workspace && workspace.trim()) {
            projectContextStr += `\n\n## WORKSPACE EXPERIENCE (workspace.md)\n\`\`\`\n${workspace}\n\`\`\``;
          }
        } catch (e) {
          console.error(
            "[useChatLLM] Failed to use pre-fetched project context",
            e,
          );
        }
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
        : `## User Message\n\`\`\`\n${content}\n\`\`\``;

      const promptPayload = isReq1
        ? `${systemPrompt}${projectContextStr}${attachedContextStr}\n\n${fullContent}`
        : `${attachedContextStr}\n\n${fullContent}`;

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
        false,
        undefined,
        backendConversationIdRef.current,
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
          modelId: finalModel?.id,
          providerId: finalModel?.providerId,
          accountId: finalAccount?.id,
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

        const headers = { "Content-Type": "application/json" };

        const response = await fetch(`${apiUrl}/v1/chat/accounts/messages`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal: abortController.signal,
        });

        if (!response.ok) {
          console.error(
            `[useChatLLM] API Error ${response.status}:`,
            response.statusText,
          );
          try {
            const errorData = await response.clone().json();
            console.error("[useChatLLM] Error Response Details:", errorData);
          } catch (e) {
            const text = await response.clone().text();
            console.error("[useChatLLM] Error Response Text:", text);
          }
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
                    assistantMessage.conversationId = recvConvId;
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

                    // 🆕 Sync metadata to lastUsed refs for subsequent tool execution requests
                    if (metaObj.providerId || metaObj.modelId) {
                      lastUsedModelRef.current = {
                        id: metaObj.modelId || lastUsedModelRef.current?.id,
                        providerId:
                          metaObj.providerId ||
                          lastUsedModelRef.current?.providerId,
                      };
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

              // 🆕 Sync metadata during buffer cleanup
              if (metaObj.providerId || metaObj.modelId) {
                lastUsedModelRef.current = {
                  id: metaObj.modelId || lastUsedModelRef.current?.id,
                  providerId:
                    metaObj.providerId || lastUsedModelRef.current?.providerId,
                };
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
          false,
          parsed.conversationName || undefined,
          backendConversationId || backendConversationIdRef.current,
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
          isError: true,
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
    revertToMessage: async (messageId: string) => {
      const currentMessages = messagesRef.current;
      const targetIndex = currentMessages.findIndex((m) => m.id === messageId);
      if (targetIndex === -1) return null;

      let userMessageIndex = targetIndex;
      while (
        userMessageIndex >= 0 &&
        currentMessages[userMessageIndex].role !== "user"
      ) {
        userMessageIndex--;
      }

      if (userMessageIndex === -1) return null;

      const userMessage = currentMessages[userMessageIndex];
      let contentToReturn = userMessage.content;
      if (contentToReturn.startsWith("## User Message")) {
        const match = contentToReturn.match(
          /^## User Message\n```\n([\s\S]*?)\n```$/,
        );
        if (match) contentToReturn = match[1];
      }

      const newMessages = currentMessages.slice(0, userMessageIndex);
      setMessages(newMessages);

      if (currentConversationIdRef.current) {
        extensionService.postMessage({
          command: "rollbackConversationLog",
          conversationId: currentConversationIdRef.current,
          // Since we might have logged both user and assistant messages to the array,
          // we need to know how many entries to keep.
          // Wait, logChattoWorkspace saves each as an entry.
          // newMessages.length accurately reflects the number of messages to keep IF
          // each message in UI corresponds to one entry in JSON.
          // It does!
          keepCount: newMessages.length,
        });

        const tabId = selectedTab?.tabId || -1;
        const folderPath = selectedTab?.folderPath || null;
        saveConversation(
          tabId,
          folderPath,
          newMessages,
          currentConversationIdRef.current,
          selectedTab || undefined,
          false,
          undefined,
          backendConversationIdRef.current,
        );
      }

      return contentToReturn;
    },
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
  };
};
