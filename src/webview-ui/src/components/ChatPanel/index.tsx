import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import ChatHeader from "./ChatHeader";
import ChatBody from "./ChatBody";
import ChatFooter from "./ChatFooter";

import { encode } from "gpt-tokenizer";
import { getDefaultPrompt } from "./prompts";

// 🆕 Helper to log conversation to workspace (Centralized)
const logToWorkspace = (conversationId: string, message: any) => {
  const vscodeApi = (window as any).vscodeApi;
  if (!vscodeApi) return;

  const logEntry = {
    ...message, // 🆕 Save full message details (id, usage, etc.)
    timestamp: new Date().toISOString(),
    conversationId,
  };

  vscodeApi.postMessage({
    command: "logConversation",
    conversationId,
    logEntry,
  });
};

// 🆕 Storage helper functions
const STORAGE_PREFIX = "zen-conversation";

interface ConversationMetadata {
  id: string;
  tabId: number;
  folderPath: string | null;
  title: string;
  lastModified: number;
  messageCount: number;
  containerName?: string;
  provider?: "deepseek" | "chatgpt" | "gemini" | "grok";

  createdAt: number;
  totalRequests: number;
  totalContext: number;
}

const calculateTokens = (text: string): number => {
  if (!text) return 0;
  try {
    const count = encode(text).length;
    return count;
  } catch (e) {
    return Math.ceil(text.length / 4);
  }
};

const getConversationKey = (
  tabId: number,
  folderPath: string | null,
  conversationId?: string,
): string => {
  if (conversationId && conversationId.startsWith(STORAGE_PREFIX)) {
    return conversationId;
  }

  const safeFolderPath = folderPath || "global";
  const convId = conversationId || Date.now().toString();
  const fullKey = `${STORAGE_PREFIX}:${tabId}:${safeFolderPath}:${convId}`;
  return fullKey;
};

const saveConversation = async (
  tabId: number,
  folderPath: string | null,
  messages: Message[],
  isFirstRequest: boolean,
  conversationId?: string,
  selectedTab?: TabInfo,
  skipTimestampUpdate?: boolean,
): Promise<string> => {
  try {
    if (!window.storage) {
      // console.error("[ChatPanel] ❌ window.storage not available");
      return "";
    }

    const convId = conversationId || Date.now().toString();
    const key = getConversationKey(tabId, folderPath, convId);

    // Calculate stats
    const totalRequests = messages.filter(
      (m: Message) => m.role === "user",
    ).length;
    const totalContext = messages.reduce(
      (sum: number, m: Message) =>
        sum + (m.usage?.total_tokens || m.contextSize || 0),
      0,
    );

    // Load existing data to preserve createdAt and lastModified
    let existingCreatedAt: number | undefined;
    let existingLastModified: number | undefined;
    try {
      const existingData = await window.storage.get(key, false);
      if (existingData && existingData.value) {
        const parsed = JSON.parse(existingData.value);
        existingCreatedAt = parsed.metadata?.createdAt;
        existingLastModified = parsed.metadata?.lastModified;
      }
    } catch (error) {
      // Ignore errors, will use defaults
    }

    const data = {
      messages,
      isFirstRequest,
      conversationId: convId,
      metadata: {
        id: key,
        tabId,
        folderPath,
        title: messages[0]?.content.substring(0, 100) || "New Conversation",
        lastModified: skipTimestampUpdate
          ? existingLastModified || Date.now()
          : Date.now(),
        messageCount: messages.length,
        containerName: selectedTab?.containerName,
        provider: selectedTab?.provider,
        createdAt: existingCreatedAt || Date.now(),
        totalRequests,
        totalContext,
      } as ConversationMetadata,
    };

    const result = await window.storage.set(key, JSON.stringify(data), false);
    return convId;
  } catch (error) {
    // console.error("[ChatPanel] ❌ Failed to save conversation:", error);
    return "";
  }
};

const deleteConversation = async (
  tabId: number,
  folderPath: string | null,
  conversationId?: string,
): Promise<boolean> => {
  const vscodeApi = (window as any).vscodeApi;
  if (!vscodeApi || !conversationId) return false;

  return new Promise((resolve) => {
    // We can't easily await the result here without a complex correlation ID listener
    // For now, fire and forget (optimistic), or we could wrap in a promise that listeners resolve.
    // Given the UI updates on 'deleteConversationResult' anyway, we can just return true optimistically
    // or implement a proper request-response if needed.
    //
    // However, handleClearChat awaits this. So let's just fire the message.

    vscodeApi.postMessage({
      command: "deleteConversation",
      conversationId: conversationId,
    });
    resolve(true);
  });
};

interface TabInfo {
  tabId: number;
  containerName: string;
  title: string;
  url?: string;
  status: "free" | "busy" | "sleep";
  canAccept: boolean;
  requestCount: number;
  folderPath?: string | null;
  conversationId?: string | null;
  provider?: "deepseek" | "chatgpt" | "gemini" | "grok";
}

import { Message } from "./ChatBody/types";

interface ChatPanelProps {
  selectedTab: TabInfo | null;
  onBack: () => void;
  tabs?: TabInfo[]; // 🆕 Receive all tabs
  onTabSelect?: (tab: TabInfo) => void; // 🆕 Receive tab selection handler
}

// 🆕 Local FileNode definition to avoid complex imports cyclic
interface FileNode {
  name: string;
  path: string;
  type: "file" | "folder";
  size: number;
  status?: "added" | "modified" | "deleted" | "unchanged";
  additions?: number;
  deletions?: number;
  children?: FileNode[];
}

const ChatPanel: React.FC<ChatPanelProps> = ({
  selectedTab,
  onBack,
  tabs, // 🆕 Destructure
  onTabSelect, // 🆕 Destructure
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [currentConversationId, setCurrentConversationId] =
    useState<string>("");
  const [isProcessing, setIsProcessing] = useState(false);
  const [apiUrl, setApiUrl] = useState("http://localhost:8888");
  // 🆕 Quick Model Switcher State
  const [selectedQuickModel, setSelectedQuickModel] = useState<{
    providerId: string;
    modelId: string;
    accountId?: string;
  } | null>(null);

  const [currentModel, setCurrentModel] = useState<any>(null);
  const [currentAccount, setCurrentAccount] = useState<any>(null);

  // Refs for stable access in async handlers (Fixes Stale Closure & 401)
  const messagesRef = useRef<Message[]>([]);
  const currentModelRef = useRef<any>(null);
  const currentAccountRef = useRef<any>(null);
  const currentConversationIdRef = useRef<string | null>(null);
  const parsedMessagesRef = useRef<any[]>([]);
  const clickedActionsRef = useRef<Set<string>>(new Set());

  // Move clickedActions/clearedActions up to fix "used before declaration"
  const [clickedActions, setClickedActions] = useState<Set<string>>(new Set());
  const [clearedActions, setClearedActions] = useState<Set<string>>(new Set());

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    currentModelRef.current = currentModel;
  }, [currentModel]);

  useEffect(() => {
    currentAccountRef.current = currentAccount;
  }, [currentAccount]);

  useEffect(() => {
    currentConversationIdRef.current = currentConversationId;
  }, [currentConversationId]);

  useEffect(() => {
    clickedActionsRef.current = clickedActions;
  }, [clickedActions]);

  // Load API URL
  useEffect(() => {
    const storage = (window as any).storage;
    if (storage) {
      storage.get("backend-api-url").then((res: any) => {
        if (
          res?.value &&
          typeof res.value === "string" &&
          res.value.startsWith("http")
        ) {
          let cleanedUrl = res.value;
          if (cleanedUrl.endsWith("/")) {
            cleanedUrl = cleanedUrl.slice(0, -1);
          }
          setApiUrl(cleanedUrl);
        } else {
          setApiUrl("http://localhost:8888");
        }
      });
    }
  }, []);

  // 🆕 Track current Request ID for validation
  const currentRequestIdRef = useRef<string>("");

  // 🆕 Execution State for Batch Tools
  const [executionState, setExecutionState] = useState<{
    total: number;
    completed: number;
    status: "idle" | "running" | "error" | "done";
  }>({ total: 0, completed: 0, status: "idle" });

  // 🆕 Tool Outputs State
  const [toolOutputs, setToolOutputs] = useState<
    Record<string, { output: string; isError: boolean }>
  >({});

  // 🆕 Pending Tool Resolvers (for blocking execution)
  const pendingToolResolvers = useRef<
    Map<string, (result: string | null) => void>
  >(new Map());

  // 🆕 Track command start times for duration calculation
  const commandStartTimes = useRef<Map<string, number>>(new Map());

  // 🆕 Buffer for tool results to support sequential execution
  // 🆕 Buffer for tool results (to support multi-step tool calls)
  const [availableToolResultsBuffer, setAvailableToolResultsBuffer] = useState<{
    [messageId: string]: string[];
  }>({});
  // Ref for immediate access in handleSendMessage callback without dep cycle or stale closure if feasible
  const toolResultsBufferRef = useRef(availableToolResultsBuffer);

  // Sync ref
  const setToolResultsBuffer = (
    valOrUpdater: React.SetStateAction<Record<string, string[]>>,
  ) => {
    setAvailableToolResultsBuffer((prev: Record<string, string[]>) => {
      const newVal =
        typeof valOrUpdater === "function"
          ? (valOrUpdater as Function)(prev)
          : valOrUpdater;
      toolResultsBufferRef.current = newVal;
      return newVal;
    });
  };

  // 🆕 Detect history mode (viewing conversation from HistoryPanel)
  const [isHistoryMode, setIsHistoryMode] = useState(false);

  useEffect(() => {
    const isHistory =
      !!(selectedTab as any)?.conversationId && !selectedTab?.canAccept;
    setIsHistoryMode(isHistory);
  }, [selectedTab]);

  // 🆕 Import parseAIResponse
  const { parseAIResponse } = require("../../services/ResponseParser");

  // 🆕 Memoize parsed messages
  const parsedMessages = useMemo(() => {
    const result = messages.map((msg: Message) => ({
      ...msg,
      parsed: parseAIResponse(msg.content),
    }));
    parsedMessagesRef.current = result;
    return result;
  }, [messages, parseAIResponse]);

  const handleSendMessage = useCallback(
    async (
      content: string,
      files?: any[],

      model?: any,
      account?: any,
      skipFirstRequestLogic?: boolean,
      actionIds?: string[],
      uiHidden?: boolean,
      thinking?: boolean,
    ) => {
      // Use default values if no tab selected (Standalone Mode)
      const tabId = selectedTab?.tabId || -1;
      const folderPath = selectedTab?.folderPath || null;
      // 🆕 Prepend User Message label and wrap content in code blocks (as requested)
      const fullContent = skipFirstRequestLogic
        ? content
        : `## User Message\n\`\`\`\n${content}\n\`\`\``;

      const userMessage: Message = {
        id: `msg-${Date.now()}-${skipFirstRequestLogic ? "tool" : "user"}`,
        role: "user",
        content: fullContent,
        timestamp: Date.now(),
        isFirstRequest: skipFirstRequestLogic
          ? false
          : messagesRef.current.length === 0, // Derived
        isToolRequest: skipFirstRequestLogic,
        systemPrompt:
          messagesRef.current.length === 0 && !skipFirstRequestLogic
            ? getDefaultPrompt()
            : undefined, // Derived
        contextSize: fullContent.length,
        usage: {
          prompt_tokens: calculateTokens(fullContent),
          completion_tokens: 0,
          total_tokens: calculateTokens(fullContent),
        },
        actionIds: actionIds,
        uiHidden: uiHidden,
      };

      const updatedMessages = [...messagesRef.current, userMessage];
      setMessages((prev) => [...prev, userMessage]);
      setIsProcessing(true);

      // Determine conversation ID to use
      let effectiveConversationId = currentConversationIdRef.current;
      const isNewSession = !effectiveConversationId;

      if (isNewSession) {
        effectiveConversationId = Date.now().toString();
        setCurrentConversationId(effectiveConversationId);
      }

      saveConversation(
        tabId,
        folderPath,
        updatedMessages,
        messagesRef.current.length === 0, // isFirstRequest derived
        effectiveConversationId || undefined,
        selectedTab || undefined,
        false,
      );

      logToWorkspace(effectiveConversationId || "unknown", userMessage);

      try {
        // Fallback to states if undefined (important for Auto-Execution)
        const finalModel = model || currentModelRef.current;
        const finalAccount = account || currentAccountRef.current;
        const effModel = selectedQuickModel
          ? {
              id: selectedQuickModel.modelId,
              providerId: selectedQuickModel.providerId,
            }
          : finalModel;

        const effAccount = selectedQuickModel?.accountId
          ? { id: selectedQuickModel.accountId }
          : finalAccount;

        // Prepare messages payload
        let payloadMessages: { role: string; content: string }[] =
          updatedMessages.map((m) => ({
            role: m.role,
            content: m.content,
          }));

        // Đơn giản hóa: Nếu chỉ có 1 tin nhắn (là tin nhắn user vừa tạo), thì đây là request đầu tiên.
        const isReq1 =
          payloadMessages.length === 1 && payloadMessages[0].role === "user";

        if (isReq1) {
          const systemPrompt = getDefaultPrompt();

          // [New] Fetch Project Context (workspace.md, rules, tree)
          let projectContextStr = "";
          try {
            const vscodeApi = (window as any).vscodeApi;
            if (vscodeApi) {
              const requestId = `ctx-${Date.now()}`;

              const fetchPromise = new Promise<any>((resolve) => {
                const timeoutId = setTimeout(() => {
                  console.warn(
                    "[ChatPanel] getProjectContext TIMEOUT after 10s",
                  );
                  window.removeEventListener("message", handler);
                  resolve(null);
                }, 10000);

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

                vscodeApi.postMessage({
                  command: "getProjectContext",
                  requestId,
                });
              });

              const contextData = await fetchPromise;

              // Always inject context sections, even if empty (Elara behavior)
              const workspaceContent = contextData?.workspace || "";
              const rulesContent = contextData?.rules || "";
              const treeViewContent = contextData?.treeView || "";

              projectContextStr += `\n\n## Project Overview (workspace.md)\n\`\`\`\n${workspaceContent}\n\`\`\``;
              projectContextStr += `\n\n## Project Rules (workspace_rules.md)\n\`\`\`\n${rulesContent}\n\`\`\``;
              projectContextStr += `\n\n## Project Structure\n\`\`\`\n${treeViewContent}\n\`\`\``;
            }
          } catch (e) {
            console.error("Failed to fetch project context", e);
          }

          if (systemPrompt) {
            // Align with Elara: Merge system prompt into the first user message
            // instead of sending a separate 'system' role message.
            payloadMessages[0].content = `${systemPrompt}${projectContextStr}\n\n${payloadMessages[0].content}`;
          } else if (projectContextStr) {
            // If no system prompt but context exists (unlikely given logic, but safe)
            payloadMessages[0].content = `${projectContextStr}\n\n${payloadMessages[0].content}`;
          }
        }

        // Prepare request body
        const body = {
          modelId: effModel?.id,
          providerId: effModel?.providerId,
          accountId: effAccount?.id,
          messages: payloadMessages,
          stream: true,
          conversationId: isNewSession ? "" : effectiveConversationId,
          thinking,
        };

        const response = await fetch(`${apiUrl}/v1/chat/accounts/messages`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(body),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.error(
            "[ChatPanel] API Response Error:",
            response.status,
            errorText,
          );
          throw new Error(`API Error: ${response.status} - ${errorText}`);
        }

        if (!response.body) {
          console.error("[ChatPanel] Response OK but body is null!");
          throw new Error("No response body");
        }

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

                  if (data.meta?.conversation_id) {
                    const realId = data.meta.conversation_id;
                    if (currentConversationIdRef.current !== realId) {
                      const oldId = currentConversationIdRef.current;
                      // 🆕 Rename log file if we were using a temp ID
                      if (oldId && oldId !== realId) {
                        const vscodeApi = (window as any).vscodeApi;
                        if (vscodeApi) {
                          vscodeApi.postMessage({
                            command: "renameConversationLog",
                            oldConversationId: oldId,
                            newConversationId: realId,
                          });
                        }
                      }

                      setCurrentConversationId(realId);
                      effectiveConversationId = realId; // Update local var for next logToWorkspace
                    }
                  }

                  if (data.content) {
                    assistantMessage = {
                      ...assistantMessage,
                      content: assistantMessage.content + data.content,
                    };
                    setMessages((prev) =>
                      prev.map((m) =>
                        m.id === assistantMessage.id ? assistantMessage : m,
                      ),
                    );
                  }
                } catch (e) {
                  // Ignore parse error
                }
              }
            }
          }
        }

        setIsProcessing(false);
        logToWorkspace(effectiveConversationId || "unknown", assistantMessage);
        const finalContent = assistantMessage.content;
        const parsed = parseAIResponse(finalContent);
        if (parsed.actions && parsed.actions.length > 0) {
          handleToolRequest(parsed.actions, assistantMessage);
        }
      } catch (error) {
        const errorMessage: Message = {
          id: `msg-${Date.now()}-error`,
          role: "assistant", // Display as assistant message or system?
          content: `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
          timestamp: Date.now(),
        };
        setMessages((prev) => [...prev, errorMessage]);
        setIsProcessing(false);
      }
    },
    [
      // messages, // Stable via messagesRef
      selectedTab,
      // currentConversationId, // Stable via currentConversationIdRef
      apiUrl,
      isProcessing,
      selectedQuickModel,
    ],
  );

  const handleToolRequest = useCallback(
    async (actionOrActions: any, message: Message) => {
      const actions = (
        Array.isArray(actionOrActions) ? actionOrActions : [actionOrActions]
      ).map((a, idx) => ({
        ...a,
        _index: a._index !== undefined ? a._index : idx,
      }));

      const vscodeApi = (window as any).vscodeApi;

      if (!vscodeApi) {
        console.error("[ChatPanel] vscodeApi not available");
        return;
      }

      const editTools = ["write_to_file", "replace_in_file", "execute_command"];

      const executeSingleAction = (
        action: any,
        skipDiagnostics: boolean = false,
      ): Promise<string | null> => {
        return new Promise((resolve) => {
          switch (action.type) {
            case "read_file": {
              const requestId = `read-${Date.now()}-${Math.random()}`;
              vscodeApi.postMessage({
                command: "readFile",
                path: action.params.path,
                startLine: action.params.start_line
                  ? parseInt(action.params.start_line)
                  : undefined,
                endLine: action.params.end_line
                  ? parseInt(action.params.end_line)
                  : undefined,
                requestId: requestId,
              });

              const handleFileResponse = (event: MessageEvent) => {
                const msg = event.data;
                if (
                  msg.command === "fileContent" &&
                  msg.requestId === requestId
                ) {
                  window.removeEventListener("message", handleFileResponse);
                  if (msg.error) {
                    const errorMsg: Message = {
                      id: `msg-${Date.now()}-error`,
                      role: "assistant",
                      content: `❌ Error reading file '${action.params.path}': ${msg.error}`,
                      timestamp: Date.now(),
                    };
                    setMessages((prev) => [...prev, errorMsg]);

                    let readableError = msg.error;
                    if (
                      readableError.includes("tồn tại") ||
                      readableError.includes("no such file")
                    ) {
                      readableError = "File not found in project";
                    }

                    resolve(
                      `[read_file for '${action.params.path}'] Result: Error - ${readableError}`,
                    );
                  } else {
                    let result = `[read_file for '${action.params.path}'] Result:\n\`\`\`\n${msg.content}\n\`\`\``;
                    if (msg.diagnostics && msg.diagnostics.length > 0) {
                      result += `\n\n⚠️ **Diagnostics Found:**\n${msg.diagnostics.join(
                        "\n",
                      )}`;
                    }
                    resolve(result);
                  }
                }
              };
              window.addEventListener("message", handleFileResponse);
              setTimeout(() => {
                window.removeEventListener("message", handleFileResponse);
                resolve(null); // Timeout
              }, 10000);
              break;
            }

            case "write_to_file": {
              const requestId = `write-${Date.now()}-${Math.random()}`;
              vscodeApi.postMessage({
                command: "writeFile",
                path: action.params.path,
                content: action.params.content,
                requestId: requestId,
                skipDiagnostics,
              });

              const handleResponse = (event: MessageEvent) => {
                const msg = event.data;
                if (
                  msg.command === "writeFileResult" &&
                  msg.requestId === requestId
                ) {
                  window.removeEventListener("message", handleResponse);
                  if (msg.error) {
                    const errorMsg: Message = {
                      id: `msg-${Date.now()}-error`,
                      role: "assistant",
                      content: `❌ Error writing file '${action.params.path}': ${msg.error}`,
                      timestamp: Date.now(),
                    };
                    setMessages((prev) => [...prev, errorMsg]);
                    resolve(
                      `[write_to_file for '${action.params.path}'] Result: Error - ${msg.error}`,
                    );
                  } else {
                    let result = `[write_to_file for '${action.params.path}'] Success: File written successfully`;
                    if (msg.diagnostics && msg.diagnostics.length > 0) {
                      result += `\n\n⚠️ **Diagnostics Found:**\n${msg.diagnostics.join(
                        "\n",
                      )}`;
                    }
                    resolve(result);
                  }
                }
              };
              window.addEventListener("message", handleResponse);
              setTimeout(() => {
                window.removeEventListener("message", handleResponse);
                resolve(null);
              }, 10000);
              break;
            }

            case "replace_in_file": {
              const requestId = `replace-${Date.now()}-${Math.random()}`;
              vscodeApi.postMessage({
                command: "replaceInFile",
                path: action.params.path,
                diff: action.params.diff,
                requestId: requestId,
                skipDiagnostics,
              });

              const handleReplaceResponse = (event: MessageEvent) => {
                const msg = event.data;
                if (
                  msg.command === "replaceInFileResult" &&
                  msg.requestId === requestId
                ) {
                  window.removeEventListener("message", handleReplaceResponse);
                  if (msg.error) {
                    const errorMsg: Message = {
                      id: `msg-${Date.now()}-error`,
                      role: "assistant",
                      content: `❌ Error applying diff to '${action.params.path}': ${msg.error}`,
                      timestamp: Date.now(),
                    };
                    setMessages((prev) => [...prev, errorMsg]);
                    resolve(
                      `[replace_in_file for '${action.params.path}'] Result: Error - ${msg.error}`,
                    );
                  } else {
                    let result = `[replace_in_file for '${action.params.path}'] Success: Diff applied successfully`;
                    if (msg.diagnostics && msg.diagnostics.length > 0) {
                      result += `\n\n⚠️ **Diagnostics Found:**\n${msg.diagnostics.join(
                        "\n",
                      )}`;
                      if (msg.content) {
                        result += `\n\n<current_file_content_post_edit>\n(The following is the full content of '${action.params.path}' AFTER the edit. Please review it to fix the diagnostics.)\n\`\`\`\n${msg.content}\n\`\`\`\n</current_file_content_post_edit>`;
                      }
                    }
                    resolve(result);
                  }
                }
              };
              window.addEventListener("message", handleReplaceResponse);
              setTimeout(() => {
                window.removeEventListener("message", handleReplaceResponse);
                resolve(null);
              }, 10000);
              break;
            }

            case "list_files": {
              const requestId = `list-${Date.now()}-${Math.random()}`;
              vscodeApi.postMessage({
                command: "listFiles",
                path: action.params.path,
                recursive: action.params.recursive, // Pass as is (string or boolean)
                type: action.params.type,
                requestId: requestId,
              });

              const handleListResponse = (event: MessageEvent) => {
                const msg = event.data;
                if (
                  msg.command === "listFilesResult" &&
                  msg.requestId === requestId
                ) {
                  window.removeEventListener("message", handleListResponse);
                  if (msg.error) {
                    const errorMsg: Message = {
                      id: `msg-${Date.now()}-error`,
                      role: "assistant",
                      content: `❌ Error listing files: ${msg.error}`,
                      timestamp: Date.now(),
                    };
                    setMessages((prev) => [...prev, errorMsg]);
                    resolve(
                      `[list_files for '${action.params.path}'] Result: Error - ${msg.error}`,
                    );
                  } else {
                    resolve(
                      `[list_files for '${action.params.path}'] Result:\n\`\`\`\n${msg.files}\n\`\`\``,
                    );
                  }
                }
              };
              window.addEventListener("message", handleListResponse);
              setTimeout(() => {
                window.removeEventListener("message", handleListResponse);
                resolve(null);
              }, 10000);
              break;
            }

            case "search_files": {
              const requestId = `search-${Date.now()}-${Math.random()}`;
              vscodeApi.postMessage({
                command: "searchFiles",
                path: action.params.path,
                regex: action.params.regex,
                filePattern: action.params.filePattern,
                requestId: requestId,
              });

              const handleSearchResponse = (event: MessageEvent) => {
                const msg = event.data;
                if (
                  msg.command === "searchFilesResult" &&
                  msg.requestId === requestId
                ) {
                  window.removeEventListener("message", handleSearchResponse);
                  if (msg.error) {
                    const errorMsg: Message = {
                      id: `msg-${Date.now()}-error`,
                      role: "assistant",
                      content: `❌ Error searching files: ${msg.error}`,
                      timestamp: Date.now(),
                    };
                    setMessages((prev) => [...prev, errorMsg]);
                    resolve(
                      `[search_files for '${action.params.path}'] Result: Error - ${msg.error}`,
                    );
                  } else {
                    resolve(
                      `[search_files for '${action.params.path}'] Result:\n\`\`\`\n${msg.results}\n\`\`\``,
                    );
                  }
                }
              };
              window.addEventListener("message", handleSearchResponse);
              setTimeout(() => {
                window.removeEventListener("message", handleSearchResponse);
                resolve(null);
              }, 10000);
              break;
            }

            case "execute_command": {
              // execute_command typically doesn't wait for output in this implementation
              // or it might send output via a specific channel?
              // Original code just posted 'executeCommand' and broke.
              // We'll preserve that behavior.
              commandStartTimes.current.set(
                (action as any).actionId,
                Date.now(),
              );

              vscodeApi.postMessage({
                command: "executeCommand",
                commandText: action.params.command,
                actionId: (action as any).actionId,
              });

              // Blocking wait for command execution
              pendingToolResolvers.current.set(
                (action as any).actionId,
                resolve,
              );
              // Fallback safety timeout? (optional, user can kill/detach)
              break;
            }

            case "update_codebase_context": {
              vscodeApi.postMessage({
                command: "saveProjectContext",
                context: action.params,
              });
              // Return success message to the AI
              resolve(
                `[update_codebase_context] Success: Project context updated.`,
              );
              break;
            }

            default:
              console.warn(`[ChatPanel] Unknown tool type: ${action.type}`);
              resolve(null);
          }
        });
      };

      // 3. Execute all actions sequentially
      const validResults: string[] = [];

      // Reset execution state
      setExecutionState({
        total: actions.length,
        completed: 0,
        status: "running",
      });

      for (const [index, action] of actions.entries()) {
        const actionId = `${message.id}-action-${action._index}`;
        // Optimization: Skip diagnostics for intermediate edits to the same file
        const isEditAction =
          action.type === "replace_in_file" || action.type === "write_to_file";
        let skipDiagnostics = false;

        if (isEditAction) {
          const currentPath = action.params.path;
          // Check if there's a subsequent edit to the same file in this batch
          const subsequentActions = actions.slice(index + 1);
          const hasMoreEditsToSameFile = subsequentActions.some(
            (a) =>
              (a.type === "replace_in_file" || a.type === "write_to_file") &&
              a.params.path === currentPath,
          );

          if (hasMoreEditsToSameFile) {
            skipDiagnostics = true;
          }
        }

        const result = await executeSingleAction(action, skipDiagnostics);

        if (result !== null) {
          validResults.push(result);

          // 🆕 Update toolOutputs logic for UI feedback
          const actionId = `${message.id}-action-${action._index}`;

          // Extract cleaner output for display
          let cleanOutput = result;
          // Simple regex to remove the standard prefix we added in executeSingleAction
          // e.g. "[read_file for '...'] Result: ..."
          const prefixMatch = result.match(/^\[.*?\] Result:\s*/);
          if (prefixMatch) {
            cleanOutput = result.substring(prefixMatch[0].length);
          }
          // Remove wrapping backticks if present
          if (
            cleanOutput.startsWith("```\n") &&
            cleanOutput.endsWith("\n```")
          ) {
            cleanOutput = cleanOutput.substring(4, cleanOutput.length - 4);
          } else if (
            cleanOutput.startsWith("```") &&
            cleanOutput.endsWith("```")
          ) {
            cleanOutput = cleanOutput.substring(3, cleanOutput.length - 3);
          }

          setToolOutputs(
            (prev: Record<string, { output: string; isError: boolean }>) => ({
              ...prev,
              [actionId]: {
                output: cleanOutput,
                isError: result.includes("Result: Error"),
              },
            }),
          );

          // Update completed count
          setExecutionState(
            (prev: {
              total: number;
              completed: number;
              status: "idle" | "running" | "error" | "done";
            }) => ({
              ...prev,
              completed: prev.completed + 1,
              // If all done, status done (handled after loop or here check)
            }),
          );

          // Notify UI to mark this specific action as clicked or failed
          // actionId already defined above

          if (result.includes("Result: Error")) {
            window.postMessage(
              {
                command: "markActionFailed",
                actionId: actionId,
              },
              "*",
            );
          } else {
            window.postMessage(
              {
                command: "markActionClicked",
                actionId: actionId,
              },
              "*",
            );
          }

          setClickedActions((prev: Set<string>) => {
            const next = new Set(prev).add(actionId);
            clickedActionsRef.current = next;
            return next;
          });
        } else {
          console.warn(
            `[ChatPanel] Unexpected failure. Stopping batch execution.`,
          );
          setExecutionState((prev: any) => ({ ...prev, status: "error" }));
          break;
        }
      }

      setExecutionState((prev: any) => {
        if (prev.status === "error") return prev;
        return { ...prev, status: "done" };
      });

      setToolResultsBuffer((prev: Record<string, string[]>) => {
        const currentBuffer = prev[message.id] || [];
        const newBuffer = [...currentBuffer, ...validResults];
        const nextBuffer = { ...prev, [message.id]: newBuffer };

        // If we stopped due to error (validResults < actions.length), we MUST flush immediately.
        if (validResults.length < actions.length) {
          const textActionIds = actions.map(
            (a) => `${message.id}-action-${a._index}`,
          );
          handleSendMessage(
            newBuffer.join("\n\n"),
            undefined,
            undefined,
            undefined, // account
            true,
            textActionIds,
          );
          return { ...prev, [message.id]: [] }; // Clear buffer after sending
        }

        const newlyClickedIndices = actions.map((a) => a._index);
        const fullMsg = parsedMessagesRef.current.find(
          (m: any) => m.id === message.id,
        );
        const actualTotal = fullMsg?.parsed?.actions?.length || 0;
        const allRelevantIndices = Array.from(Array(actualTotal).keys());

        const isComplete = allRelevantIndices.every((idx) => {
          const actionId = `${message.id}-action-${idx}`;
          const isDone =
            clickedActionsRef.current.has(actionId) ||
            newlyClickedIndices.includes(idx);
          return isDone;
        });

        if (isComplete) {
          const textActionIds = actions.map(
            (a) => `${message.id}-action-${a._index}`,
          );

          handleSendMessage(
            newBuffer.join("\n\n"),
            undefined,
            undefined,
            undefined,
            true,
            textActionIds,
            true, // uiHidden
          );

          return { ...prev, [message.id]: [] };
        } else {
          // Not complete. Buffer and wait.
          return nextBuffer;
        }
      });
    },
    [handleSendMessage],
  );

  // 🆕 Calculate context usage
  const contextUsage = useMemo(() => {
    return messages.reduce(
      (
        acc: { prompt: number; completion: number; total: number },
        msg: Message,
      ) => {
        if (msg.usage) {
          acc.prompt += msg.usage.prompt_tokens || 0;
          acc.completion += msg.usage.completion_tokens || 0;
          acc.total += msg.usage.total_tokens || 0;
        } else if (msg.contextSize) {
          // Fallback mechanism could go here if needed
        }
        return acc;
      },
      { prompt: 0, completion: 0, total: 0 },
    );
  }, [messages]);

  // const [isFirstRequest, setIsFirstRequest] = useState(true); // DEPRECATED: Derived from messages.length instead.

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;

      if (message.command === "markActionCleared" && message.actionId) {
        setClearedActions((prev: Set<string>) =>
          new Set(prev).add(message.actionId),
        );
        // Clear content of messages associated with this action
        setMessages((prev: Message[]) =>
          prev.map((msg: Message) => {
            if (msg.actionIds && msg.actionIds.includes(message.actionId)) {
              return { ...msg, content: "" };
            }
            return msg;
          }),
        );
      } else if (message.command === "commandExecuted") {
        if (message.actionId) {
          setToolOutputs(
            (prev: Record<string, { output: string; isError: boolean }>) => ({
              ...prev,
              [message.actionId]: {
                output: message.output,
                isError: !!message.error,
              },
            }),
          );

          // Resolve blocking promise if exists
          if (pendingToolResolvers.current.has(message.actionId)) {
            const resolver = pendingToolResolvers.current.get(message.actionId);
            if (resolver) {
              const cmdText = message.commandText || "command";
              const outputContent = message.output ? message.output.trim() : "";

              const startTime = commandStartTimes.current.get(message.actionId);
              const duration = startTime
                ? ((Date.now() - startTime) / 1000).toFixed(1)
                : null;

              if (startTime) {
                commandStartTimes.current.delete(message.actionId);
              }

              const timeSuffix = duration ? ` for ${duration}s` : "";

              const resultMsg = message.error
                ? `Output: [execute_command for '${cmdText}']${timeSuffix}\n\`\`\`\nError: ${message.error}\n${outputContent}\n\`\`\``
                : `Output: [execute_command for '${cmdText}']${timeSuffix}\n\`\`\`\n${outputContent}\n\`\`\``;

              resolver(resultMsg);
              pendingToolResolvers.current.delete(message.actionId);
            }
          }
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);
  const [isLoadingConversation, setIsLoadingConversation] = useState(true);

  // 🆕 Auto-save conversation khi có thay đổi
  useEffect(() => {
    if (
      !isLoadingConversation &&
      messages.length > 0 &&
      currentConversationId &&
      selectedTab
    ) {
      const timeoutId = setTimeout(() => {
        saveConversation(
          selectedTab.tabId,
          selectedTab.folderPath || null,
          messages,
          messages.length === 0, // isFirstRequest derived
          currentConversationId,
          selectedTab,
          false, // skipTimestampUpdate = false (normal save)
        ).then((convId: string) => {
          if (convId && !currentConversationId) {
            setCurrentConversationId(convId);
          }
        });
      }, 1000); // Debounce 1s

      return () => clearTimeout(timeoutId);
    }
  }, [
    messages,
    // isFirstRequest, // Removed
    isLoadingConversation,
    selectedTab?.tabId,
    selectedTab?.folderPath,
    currentConversationId,
    selectedTab, // Added selectedTab to dependencies
  ]);

  // 🆕 Load conversation khi mount - Request from extension
  useEffect(() => {
    const requestConversation = async () => {
      if (!selectedTab) return;
      setIsLoadingConversation(true);

      const conversationId = (selectedTab as any).conversationId;

      if (conversationId) {
        // Send request to extension
        const vscodeApi = (window as any).vscodeApi;
        if (vscodeApi) {
          vscodeApi.postMessage({
            command: "getConversation",
            conversationId: conversationId,
            requestId: `conv-${Date.now()}`,
          });
        }
      } else {
        setMessages([]);
        if (!currentConversationId) {
          const newConvId = Date.now().toString();
          setCurrentConversationId(newConvId);
        }
        setIsLoadingConversation(false);
      }
    };

    requestConversation();
  }, [
    selectedTab?.tabId,
    selectedTab?.folderPath,
    (selectedTab as any)?.conversationId,
    selectedTab?.provider,
  ]);

  useEffect(() => {
    const handleIncomingMessage = (data: any) => {
      // 🆕 Handle CONVERSATION PING from ZenTab (with conditions)
      if (data.type === "conversationPing") {
        // WebSocket removed, ignoring pings.
        return;
      }

      // 🔥 Xử lý generationStarted message
      if (data.type === "generationStarted") {
        // 🆕 Validate Request ID
        if (
          currentRequestIdRef.current &&
          data.requestId !== currentRequestIdRef.current
        ) {
          return;
        }

        const statusMessage: Message = {
          id: `msg-${Date.now()}-status`,
          role: "assistant",
          content: "✅ AI đã bắt đầu xử lý request. Đang đợi response...",
          timestamp: Date.now(),
        };

        return;
      }

      if (data.type === "promptResponse") {
        // 🆕 Validate Request ID
        if (
          currentRequestIdRef.current &&
          data.requestId !== currentRequestIdRef.current
        ) {
          return;
        }

        // 🆕 Deduplicate: If we already processed this request ID, ignore
        if ((window as any).__lastProcessedRequestId === data.requestId) {
          return;
        }
        (window as any).__lastProcessedRequestId = data.requestId;

        const timeoutId = (window as any).__chatPanelTimeoutId;
        if (timeoutId) {
          clearTimeout(timeoutId);
          delete (window as any).__chatPanelTimeoutId;
        }

        if (data.success && data.response) {
          try {
            // Parse OpenAI response format
            const parsedResponse = JSON.parse(data.response);
            const rawContent =
              parsedResponse.content ||
              parsedResponse?.choices?.[0]?.delta?.content ||
              data.response;

            const aiUsage = {
              prompt_tokens: 0,
              completion_tokens: calculateTokens(rawContent),
              total_tokens: calculateTokens(rawContent),
            };

            // 🆕 Just add raw content to messages, ChatBody will handle parsing
            const aiMessage: Message = {
              id: `msg-${Date.now()}-assistant`,
              role: "assistant",
              content: rawContent,
              timestamp: Date.now(),
              usage: aiUsage, // 🆕 Store usage
              contextSize: calculateTokens(rawContent), // Backup
            };

            setMessages((prev: Message[]) => {
              const newMessages = [...prev, aiMessage];
              return newMessages;
            });
            setIsProcessing(false);

            // 🆕 Tự động thực thi tool call nếu có
            const parsed = parseAIResponse(rawContent);
            if (parsed.actions && parsed.actions.length > 0) {
              handleToolRequest(parsed.actions, aiMessage);
            }
          } catch (error) {
            // console.error(`[ChatPanel] ❌ Failed to parse response:`, error);
            /* console.error(`[ChatPanel] 🔍 Parse error details:`, {
              errorMessage:
                error instanceof Error ? error.message : String(error),
              rawResponse: data.response?.substring(0, 200),
            }); */

            // Fallback: use raw response
            const aiMessage: Message = {
              id: `msg-${Date.now()}-assistant`,
              role: "assistant",
              content: data.response,
              timestamp: Date.now(),
            };

            setMessages((prev: Message[]) => [...prev, aiMessage]);
            setIsProcessing(false);
          }
        } else {
          /* console.error(`[ChatPanel] ❌ promptResponse FAILED:`, {
            requestId: data.requestId,
            tabId: data.tabId,
            error: data.error,
            errorType: data.errorType,
            hasResponse: !!data.response,
          }); */
          setIsProcessing(false);

          // Build user-friendly error message based on errorType
          let errorContent = "";
          if (data.errorType === "VALIDATION_FAILED") {
            errorContent = `❌ **Lỗi: Tab không hợp lệ**

**Chi tiết:** ${data.error || "Tab validation failed"}

**Nguyên nhân có thể:**
- Tab không phải là DeepSeek/ChatGPT tab
- Tab đã navigate sang trang web khác
- Tab đang bị đóng hoặc không còn tồn tại

**Khuyến nghị:**
1. Quay lại TabPanel và kiểm tra danh sách tabs
2. Chọn lại tab có trạng thái "Free" (màu xanh)
3. Đảm bảo tab vẫn đang mở DeepSeek hoặc ChatGPT

**Thời gian:** ${new Date().toISOString()}
**Request ID:** ${data.requestId}
**Tab ID:** ${data.tabId}`;
          } else {
            errorContent = `❌ **Lỗi xảy ra**

**Chi tiết:** ${data.error || "Unknown error"}

**Request ID:** ${data.requestId}
**Tab ID:** ${data.tabId}
**Thời gian:** ${new Date().toISOString()}`;
          }

          // Add error message
          const errorMessage: Message = {
            id: `msg-${Date.now()}-error`,
            role: "assistant",
            content: errorContent,
            timestamp: Date.now(),
          };
          setMessages((prev: Message[]) => [...prev, errorMessage]);
        }
      } else if (data.type === "contextResponse") {
        // Forward to context response handler
        if ((window as any).__contextResponseHandler) {
          (window as any).__contextResponseHandler(data);
        }
      } else if (data.command === "conversationResult") {
        if (data.data && data.data.messages) {
          const validMessages = data.data.messages.map(
            (msg: Message, index: number) => ({
              ...msg,
              id: msg.id || `restored-${Date.now()}-${index}`,
            }),
          );

          console.groupCollapsed("[ChatPanel] Loaded Conversation Details");
          console.groupEnd();

          setMessages(validMessages);
          if (data.data.conversationId) {
            setCurrentConversationId(data.data.conversationId);
          }
        } else {
          console.warn(
            "[ChatPanel] conversationResult data invalid or missing messages:",
            data,
          );
          if (data.error) {
            const errorMessage: Message = {
              id: `msg-${Date.now()}-error`,
              role: "assistant", // System error shown as assistant message
              content: `❌ Failed to load conversation: ${data.error}`,
              timestamp: Date.now(),
            };
            setMessages([errorMessage]);
          }
        }
        setIsLoadingConversation(false);
        setIsProcessing(false);
      }
    };

    (window as any).__chatPanelMessageHandler = (data: any) => {
      handleIncomingMessage(data);
    };

    const messageListener = (event: MessageEvent) => {
      const message = event.data;
      handleIncomingMessage(message);
    };
    window.addEventListener("message", messageListener);

    return () => {
      delete (window as any).__chatPanelMessageHandler;
      window.removeEventListener("message", messageListener);
    };
  }, [currentConversationIdRef, handleToolRequest, parseAIResponse]);

  const handleClearChat = useCallback(async () => {
    const vscodeApi = (window as any).vscodeApi;
    if (vscodeApi) {
      vscodeApi.postMessage({
        command: "confirmClearChat",
        conversationId: currentConversationId,
      });
    } else if (selectedTab) {
      // Fallback
      await deleteConversation(
        selectedTab.tabId,
        selectedTab.folderPath || null,
        currentConversationId,
      );
      setMessages([]);
      // setIsFirstRequest(true); // DEPRECATED
      setIsProcessing(false);
      setCurrentConversationId(Date.now().toString());
    }
  }, [
    selectedTab?.tabId,
    selectedTab?.folderPath,
    currentConversationId,
    selectedTab?.provider,
  ]);

  // 🆕 Listen for clear chat confirmation
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;

      // Handle clear chat confirmation
      if (
        message.command === "clearChatConfirmed" &&
        message.conversationId === currentConversationId
      ) {
        if (selectedTab) {
          deleteConversation(
            selectedTab.tabId,
            selectedTab.folderPath || null,
            currentConversationId,
          ).then(() => {
            setMessages([]);
            setIsProcessing(false);
            setCurrentConversationId(Date.now().toString());
          });
        } else {
          // Standalone Mode
          setMessages([]);
          setIsProcessing(false);
          setCurrentConversationId(Date.now().toString());
        }
      }

      // Handle commandExecuted message from extension
      if (message.command === "commandExecuted") {
        // Resolve pending promise if any (for batch execution)
        const resolve = pendingToolResolvers.current.get(message.actionId);
        if (resolve) {
          const output = message.output || "No output";
          const error = message.error || null;

          let result = `[execute_command for '${message.commandText}'] Result:\nCommand executed.\n`;
          if (error) {
            result += `Error: ${error}\n`;
          }
          result += `Output:\n${output}`;

          resolve(result);
          pendingToolResolvers.current.delete(message.actionId);
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, [
    currentConversationId,
    selectedTab?.tabId,
    selectedTab?.folderPath,
    handleSendMessage,
  ]);

  const handleExecutePendingBatch = useCallback(() => {
    const currentParsedMessages = parsedMessagesRef.current;
    const currentClickedActions = clickedActionsRef.current;

    for (let i = currentParsedMessages.length - 1; i >= 0; i--) {
      const msg = currentParsedMessages[i];
      if (msg.role === "assistant" && msg.parsed.actions.length > 0) {
        const unclickedActions = msg.parsed.actions
          .map((action: any, index: number) => ({ ...action, _index: index }))
          .filter(
            (action: any) =>
              !currentClickedActions.has(`${msg.id}-action-${action._index}`),
          );

        if (unclickedActions.length > 0) {
          handleToolRequest(unclickedActions, msg);
          return true;
        }
      }
    }
    console.warn("[ChatPanel] No pending batch found to execute.");
    return false;
  }, [handleToolRequest]);

  // 🆕 Check for any pending actions to control "Run All" visibility
  const hasPendingActions = useMemo(() => {
    return parsedMessages.some((msg: any) => {
      if (msg.role !== "assistant" || !msg.parsed?.actions?.length)
        return false;
      // Check if any action in this message is NOT clicked
      return msg.parsed.actions.some(
        (_: any, index: number) =>
          !clickedActions.has(`${msg.id}-action-${index}`),
      );
    });
  }, [parsedMessages, clickedActions]);

  // 🆕 Helper to build file tree from flat paths
  // 🆕 Helper to build file tree from flat paths
  const buildFileTree = useCallback(
    (
      files: { [path: string]: { size: number } },
      changes?: {
        [path: string]: {
          status: "added" | "modified" | "deleted";
          additions: number;
          deletions: number;
        };
      },
    ) => {
      const filePaths = changes ? Object.keys(changes) : Object.keys(files);

      const effectiveFiles: { [path: string]: { size: number } } = {};

      filePaths.forEach((p) => {
        if (files[p]) {
          effectiveFiles[p] = files[p];
        } else if (changes && changes[p]?.status === "deleted") {
          effectiveFiles[p] = { size: 0 };
        }
      });

      const root: FileNode = {
        name: ".",
        path: ".",
        type: "folder",
        size: 0,
        children: [],
      };

      Object.keys(effectiveFiles).forEach((filePath) => {
        const parts = filePath.split("/");
        const size = effectiveFiles[filePath].size;

        let current = root;

        parts.forEach((part, index) => {
          const isLast = index === parts.length - 1;
          const existing = current.children?.find((c: any) => c.name === part);

          if (existing) {
            current = existing;
          } else {
            // 🆕 Correctly access change info map
            const changeInfo = changes ? changes[filePath] : undefined;
            const newNode: FileNode = {
              name: part,
              path: parts.slice(0, index + 1).join("/"),
              type: isLast ? "file" : "folder",
              size: isLast ? size : 0, // CORRECTED: use 'size' not 'info.size'
              status: isLast && changeInfo ? changeInfo.status : undefined,
              additions:
                isLast && changeInfo ? changeInfo.additions : undefined,
              deletions:
                isLast && changeInfo ? changeInfo.deletions : undefined,
              children: isLast ? undefined : [],
            };
            current.children = current.children || [];
            current.children.push(newNode);
            current = newNode;
          }
        });
      });

      const calcSizeAndStatus = (node: FileNode): number => {
        if (node.type === "file") return node.size;
        if (node.children) {
          node.size = node.children.reduce(
            (sum: number, child: FileNode) => sum + calcSizeAndStatus(child),
            0,
          );
        }
        return node.size;
      };
      calcSizeAndStatus(root);

      return root;
    },
    [],
  );

  const firstRequestMessage =
    messages.find((m: Message) => m.isFirstRequest) ||
    messages.find((m: Message) => m.role === "user" && !m.isToolRequest);

  const allTaskProgress = useMemo(() => {
    for (let i = parsedMessages.length - 1; i >= 0; i--) {
      const msg = parsedMessages[i];
      if (msg.parsed.taskProgress && msg.parsed.taskProgress.length > 0) {
        return msg.parsed.taskProgress;
      }
      const actionProgress = msg.parsed.actions.flatMap(
        (action: any) => action.taskProgress || [],
      );
      if (actionProgress.length > 0) {
        return actionProgress;
      }
    }
    return [];
  }, [parsedMessages]);

  // 🆕 Extract current Task Name
  const currentTaskName = useMemo(() => {
    for (let i = parsedMessages.length - 1; i >= 0; i--) {
      const msg = parsedMessages[i];
      if (msg.parsed.taskName) {
        return msg.parsed.taskName;
      }
    }
    return null;
  }, [parsedMessages]);

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
      {messages.length > 0 && (
        <ChatHeader
          selectedTab={
            selectedTab || {
              tabId: -1,
              containerName: "Global",
              title: "New Chat",
              status: "free",
              canAccept: true,
              requestCount: 0,
              provider: "deepseek",
            }
          }
          onBack={onBack}
          onClearChat={handleClearChat}
          isLoadingConversation={isLoadingConversation}
          firstRequestMessage={firstRequestMessage}
          contextUsage={contextUsage}
          taskName={currentTaskName}
        />
      )}
      <ChatBody
        messages={messages}
        isProcessing={isProcessing}
        onSendToolRequest={handleToolRequest}
        onSendMessage={handleSendMessage}
        executionState={executionState}
        toolOutputs={toolOutputs}
        firstRequestMessageId={firstRequestMessage?.id}
      />
      <ChatFooter
        folderPath={selectedTab?.folderPath || null}
        onSendMessage={handleSendMessage}
        isHistoryMode={isHistoryMode}
        messages={messages}
        executionState={executionState}
        onExecutePendingBatch={handleExecutePendingBatch}
        hasPendingActions={hasPendingActions}
        isConversationStarted={messages.length > 0}
        selectedQuickModel={selectedQuickModel}
        onQuickModelSelect={setSelectedQuickModel}
        currentModel={currentModel}
        setCurrentModel={setCurrentModel}
        currentAccount={currentAccount}
        setCurrentAccount={setCurrentAccount}
      />
    </div>
  );
};

export default ChatPanel;
