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

/** Returns only top-level entries from a formatted tree string.
 *  Files keep their "(N lines)" annotation.
 *  Folders show "(N files)" counted from all their descendants. */
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
      // count every non-directory descendant as a file
      if (!line.trimEnd().endsWith("/")) fileCount++;
    }
  }
  flush();
  return result.join("\n");
};

interface UseChatLLMProps {
  apiUrl: string;
  selectedTab: TabInfo | null;
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
  const { language: preferredLanguage, aiLanguage } = useSettings();
  const { workspace, treeView } = useProject();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isStreaming, setIsStreaming] = useState(false);
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

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    currentConversationIdRef.current = currentConversationId;
    onConversationIdChange?.(currentConversationId);
  }, [currentConversationId, onConversationIdChange]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const { command, actionId } = event.data;
      if ((command === "markActionClicked" || command === "markActionFailed") && actionId) {
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
            const tabId = selectedTab?.tabId || -1;
            const folderPath = selectedTab?.folderPath || null;
            saveConversation(
              tabId,
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
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [selectedTab]);

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
    ) => {
      if (isProcessing && !skipFirstRequestLogic) {
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
        } catch (e) {
        }

        const effectiveLang = aiLanguage || preferredLanguage;
        systemPrompt = getDefaultPrompt(effectiveLang);
        // Use real system info if we managed to fetch it, override the default
        if (systemInfo.os !== "Unknown OS") {
          systemPrompt = combinePrompts({
            language: effectiveLang,
            systemInfo,
          });
        }

        try {
          // Use pre-fetched context from ProjectContext, or fetch fresh if not ready yet
          let effectiveTreeView = treeView;
          let effectiveWorkspace = workspace;

          if (!effectiveTreeView.trim()) {
            // treeView not ready yet (race condition on first request) — fetch directly
            const freshContext = await new Promise<{ treeView: string; workspace: string }>((resolve) => {
              const requestId = `req1-tree-${Date.now()}`;
              const timeout = setTimeout(() => resolve({ treeView: "", workspace: effectiveWorkspace }), 5000);
              const handler = (event: MessageEvent) => {
                const msg = event.data;
                if (msg.command === "projectContextResult" && msg.requestId === requestId) {
                  clearTimeout(timeout);
                  window.removeEventListener("message", handler);
                  resolve({ treeView: msg.data?.treeView || "", workspace: msg.data?.workspace || effectiveWorkspace });
                }
              };
              window.addEventListener("message", handler);
              (window as any).vscodeApi?.postMessage({ command: "getProjectContext", requestId });
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
        } catch (e) {
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

      try {
        // Upload any local files first
        const ref_file_ids: string[] = [];
        const localFiles = files
          ? files.filter(
              (f: any) =>
                !f.id?.startsWith("attached-") &&
                !f.id?.startsWith("rule-") &&
                !f.id?.startsWith("terminal-")
            )
          : [];

        if (localFiles.length > 0) {
          for (const file of localFiles) {
            if (file.file_id) {
              ref_file_ids.push(file.file_id);
              continue;
            }

            if (!finalAccount?.id) {
              throw new Error("No active account selected for file upload. Please select/add an account first.");
            }

            try {
              let blob: Blob;
              if (file.content.startsWith("data:")) {
                const arr = file.content.split(",");
                const mime = arr[0].match(/:(.*?);/)?.[1] || file.type || "application/octet-stream";
                const bstr = atob(arr[1]);
                let n = bstr.length;
                const u8arr = new Uint8Array(n);
                while (n--) {
                  u8arr[n] = bstr.charCodeAt(n);
                }
                blob = new Blob([u8arr], { type: mime });
              } else {
                blob = new Blob([file.content], { type: file.type || "text/plain" });
              }

              const formData = new FormData();
              formData.append("file", blob, file.name);

              const uploadRes = await fetch(`${apiUrl}/v1/chat/accounts/${finalAccount.id}/uploads`, {
                method: "POST",
                body: formData,
              });

              if (!uploadRes.ok) {
                throw new Error(`Upload API returned status ${uploadRes.status}`);
              }

              const uploadData = await uploadRes.json();
              if (uploadData.success && uploadData.data?.file_id) {
                ref_file_ids.push(uploadData.data.file_id);
              } else {
                throw new Error(uploadData.error || "Unknown upload error");
              }
            } catch (err) {
              throw new Error(`Failed to upload ${file.name}: ${err instanceof Error ? err.message : String(err)}`);
            }
          }
        }

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
          conversationId:
            backendConversationIdRef.current || (isNewSession ? "" : ""),
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

        const response = await fetch(`${apiUrl}/v1/chat/accounts/messages`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal: abortController.signal,
        });

        if (!response.ok) {
          let errorDetail = `API Error: ${response.status}`;
          try {
            const errBody = await response.json();
            errorDetail = errBody.error || errBody.message || errorDetail;
            if (errBody.error_code) errorDetail = `[${errBody.error_code}] ${errorDetail}`;
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

                  // Handle stream error from server
                  if (data.error) {
                    const code = data.error_code ? `[${data.error_code}] ` : '';
                    throw new Error(`${code}${data.error}`);
                  }

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
                  if (data.thinking) {
                    assistantMessage = {
                      ...assistantMessage,
                      thinking: (assistantMessage.thinking || "") + data.thinking,
                    };
                  }

                  if (data.usage || data.content || data.thinking) {
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
        }

        // Parse for metadata logging only.
        // NOTE: Do NOT call onToolRequest here. Auto-triggering is handled exclusively
        // by useToolActions.ts via parsedMessages useEffect to avoid duplicate triggers.
        // (RES1 may still be streaming when useToolActions triggers tools mid-stream;
        //  calling onToolRequest here after stream-done would cause a double-trigger.)
        const parsed = parseAIResponse(assistantMessage.content);

        // Save final conversation state
        saveConversation(
          tabId,
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

      const tabId = selectedTab?.tabId || -1;
      const folderPath = selectedTab?.folderPath || null;
      saveConversation(
        tabId,
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
