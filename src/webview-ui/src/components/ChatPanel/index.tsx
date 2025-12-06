import React, { useState, useEffect, useCallback } from "react";
import ChatHeader from "./ChatHeader";
import ChatBody from "./ChatBody";
import ChatFooter from "./ChatFooter";

// 🆕 Storage helper functions
const STORAGE_PREFIX = "zen-conversation";

interface ConversationMetadata {
  id: string;
  tabId: number;
  folderPath: string | null;
  title: string;
  lastModified: number;
  messageCount: number;
}

const getConversationKey = (
  tabId: number,
  folderPath: string | null
): string => {
  const safeFolderPath = folderPath || "global";
  return `${STORAGE_PREFIX}:${tabId}:${safeFolderPath}`;
};

const saveConversation = async (
  tabId: number,
  folderPath: string | null,
  messages: Message[],
  isFirstRequest: boolean
): Promise<boolean> => {
  try {
    if (!window.storage) {
      console.warn("[ChatPanel] window.storage not available");
      return false;
    }

    const key = getConversationKey(tabId, folderPath);
    const data = {
      messages,
      isFirstRequest,
      metadata: {
        id: key,
        tabId,
        folderPath,
        title: messages[0]?.content.substring(0, 100) || "New Conversation",
        lastModified: Date.now(),
        messageCount: messages.length,
      } as ConversationMetadata,
    };

    const result = await window.storage.set(key, JSON.stringify(data), false);
    return !!result;
  } catch (error) {
    console.error("[ChatPanel] Failed to save conversation:", error);
    return false;
  }
};

const loadConversation = async (
  tabId: number,
  folderPath: string | null
): Promise<{ messages: Message[]; isFirstRequest: boolean } | null> => {
  try {
    if (!window.storage) {
      console.warn("[ChatPanel] window.storage not available");
      return null;
    }

    const key = getConversationKey(tabId, folderPath);
    const result = await window.storage.get(key, false);

    if (!result || !result.value) {
      return null;
    }

    const data = JSON.parse(result.value);
    return {
      messages: data.messages || [],
      isFirstRequest: data.isFirstRequest ?? true,
    };
  } catch (error) {
    console.error("[ChatPanel] Failed to load conversation:", error);
    return null;
  }
};

const deleteConversation = async (
  tabId: number,
  folderPath: string | null
): Promise<boolean> => {
  try {
    if (!window.storage) {
      return false;
    }

    const key = getConversationKey(tabId, folderPath);
    const result = await window.storage.delete(key, false);
    return !!result;
  } catch (error) {
    console.error("[ChatPanel] Failed to delete conversation:", error);
    return false;
  }
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
  conversationId?: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: number;
  isFirstRequest?: boolean;
  systemPrompt?: string;
  contextSize?: number;
}

interface ChatPanelProps {
  selectedTab: TabInfo;
  onBack: () => void;
  wsConnected: boolean;
  onWsMessage: (message: any) => void;
  wsInstance?: WebSocket | null;
}

const ChatPanel: React.FC<ChatPanelProps> = ({
  selectedTab,
  onBack,
  wsConnected,
  onWsMessage,
  wsInstance,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isFirstRequest, setIsFirstRequest] = useState(true);
  const [checkpoints, setCheckpoints] = useState<string[]>([]);
  const [isLoadingConversation, setIsLoadingConversation] = useState(true);

  // 🆕 Auto-save conversation khi có thay đổi
  useEffect(() => {
    if (!isLoadingConversation && messages.length > 0) {
      const timeoutId = setTimeout(() => {
        saveConversation(
          selectedTab.tabId,
          selectedTab.folderPath || null,
          messages,
          isFirstRequest
        ).then((success) => {
          if (success) {
          }
        });
      }, 1000); // Debounce 1s

      return () => clearTimeout(timeoutId);
    }
  }, [
    messages,
    isFirstRequest,
    isLoadingConversation,
    selectedTab.tabId,
    selectedTab.folderPath,
  ]);

  // 🆕 Load conversation khi mount - CHỈ load khi có conversationId prop
  useEffect(() => {
    const loadExistingConversation = async () => {
      setIsLoadingConversation(true);
      const shouldLoadExisting = (selectedTab as any).conversationId;

      if (shouldLoadExisting) {
        const saved = await loadConversation(
          selectedTab.tabId,
          selectedTab.folderPath || null
        );

        if (saved && saved.messages.length > 0) {
          setMessages(saved.messages);
          setIsFirstRequest(saved.isFirstRequest);
        } else {
          setMessages([]);
          setIsFirstRequest(true);
        }
      } else {
        setMessages([]);
        setIsFirstRequest(true);
      }

      setIsLoadingConversation(false);
    };

    loadExistingConversation();
  }, [selectedTab.tabId, selectedTab.folderPath]);

  useEffect(() => {
    const handleIncomingMessage = (data: any) => {
      if (data.type === "promptResponse") {
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
              parsedResponse?.choices?.[0]?.delta?.content || data.response;

            // 🆕 Just add raw content to messages, ChatBody will handle parsing
            const aiMessage: Message = {
              id: `msg-${Date.now()}-assistant`,
              role: "assistant",
              content: rawContent,
              timestamp: Date.now(),
            };

            setMessages((prev) => {
              const newMessages = [...prev, aiMessage];
              return newMessages;
            });
            setIsProcessing(false);
          } catch (error) {
            console.error(`[ChatPanel] ❌ Failed to parse response:`, error);
            console.error(`[ChatPanel] 🔍 Parse error details:`, {
              errorMessage:
                error instanceof Error ? error.message : String(error),
              rawResponse: data.response?.substring(0, 200),
            });

            // Fallback: use raw response
            const aiMessage: Message = {
              id: `msg-${Date.now()}-assistant`,
              role: "assistant",
              content: data.response,
              timestamp: Date.now(),
            };

            setMessages((prev) => [...prev, aiMessage]);
            setIsProcessing(false);
          }
        } else {
          console.error(`[ChatPanel] ❌ promptResponse FAILED:`, {
            requestId: data.requestId,
            tabId: data.tabId,
            error: data.error,
            errorType: data.errorType,
            hasResponse: !!data.response,
          });
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
          setMessages((prev) => [...prev, errorMessage]);
        }
      } else if (data.type === "contextResponse") {
        // Forward to context response handler
        if ((window as any).__contextResponseHandler) {
          (window as any).__contextResponseHandler(data);
        }
      }

      // Forward all messages to parent
      onWsMessage(data);
    };

    // Subscribe to WebSocket messages bằng cách wrap onWsMessage
    const originalOnWsMessage = onWsMessage;
    (window as any).__chatPanelMessageHandler = handleIncomingMessage;

    return () => {
      delete (window as any).__chatPanelMessageHandler;
    };
  }, [onWsMessage]);

  const handleSendMessage = async (
    content: string,
    files?: any[],
    agentOptions?: any
  ) => {
    const requestId = `ctx-${Date.now()}`;
    const originalUserMessage = content; // 🆕 Store original user message
    let systemPrompt: string | null = null; // 🆕 Store system prompt

    // Send agent permissions update to extension
    if (agentOptions) {
      const vscodeApi = (window as any).vscodeApi;
      if (vscodeApi) {
        vscodeApi.postMessage({
          command: "updateAgentPermissions",
          permissions: agentOptions,
        });
      }
    }

    // 🆕 Get DEFAULT_RULE_PROMPT for first request only
    if (isFirstRequest) {
      try {
        const {
          combinePrompts,
        } = require("../../components/SettingsPanel/prompts");
        systemPrompt = combinePrompts();
      } catch (error) {
        console.error(`[ChatPanel] ❌ Failed to load rule prompt:`, error);
      }
    }

    // Send context request via WebSocket
    // Send context request via VS Code API (extension will handle it)
    const vscodeApi = (window as any).vscodeApi;
    if (vscodeApi) {
      // Wait for context response (with timeout)
      const contextPromise = new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Context request timeout"));
        }, 10000); // 10s timeout

        const handleContextResponse = (event: MessageEvent) => {
          const data = event.data;
          if (
            data.command === "contextResponse" &&
            data.requestId === requestId
          ) {
            clearTimeout(timeout);
            if (data.error) {
              reject(new Error(data.error));
            } else {
              resolve(data.context);
            }
            // Cleanup listener
            window.removeEventListener("message", handleContextResponse);
          }
        };

        window.addEventListener("message", handleContextResponse);

        // Send request
        vscodeApi.postMessage({
          command: "requestContext",
          task: content,
          requestId: requestId,
        });
      });

      try {
        const contextString = await contextPromise;
        // 🆕 Combine system prompt + context + user message for first request
        if (isFirstRequest && systemPrompt) {
          content = `${systemPrompt}\n\n${contextString}\n\nUser Request: ${originalUserMessage}`;
        } else {
          content = contextString;
        }
      } catch (error) {
        console.error(`[ChatPanel] ❌ Failed to get context:`, error);
        // Continue without context
      }
    }

    // 🆕 VALIDATION 1: Check tab status trước
    if (!selectedTab.canAccept) {
      console.error(`[ChatPanel] ❌ Cannot send - Tab cannot accept request:`, {
        tabId: selectedTab.tabId,
        status: selectedTab.status,
        canAccept: selectedTab.canAccept,
      });

      // Hiển thị error cho user
      let errorContent = "";
      if (selectedTab.status === "busy") {
        errorContent = `❌ **Lỗi: Tab đang bận**

Tab ${selectedTab.tabId} hiện đang xử lý một request khác.

**Khuyến nghị:**
- Đợi tab xử lý xong (status chuyển sang "Free")
- Hoặc chọn tab khác có status "Free"`;
      } else if (selectedTab.status === "sleep") {
        errorContent = `❌ **Lỗi: Tab đang ngủ**

Tab ${selectedTab.tabId} hiện đang ở chế độ ngủ (sleep mode).

**Khuyến nghị:**
- Click vào tab trong ZenTab extension để wake up
- Hoặc chọn tab khác có status "Free"`;
      } else {
        errorContent = `❌ **Lỗi: Tab không thể nhận request**

Tab ${selectedTab.tabId} hiện không thể nhận request mới.

**Khuyến nghị:**
- Quay lại TabPanel và chọn tab khác
- Chỉ chọn tabs có status "Free" (màu xanh)`;
      }

      const errorMessage: Message = {
        id: `msg-${Date.now()}-error`,
        role: "assistant",
        content: errorContent,
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      return;
    }

    // 🔥 VALIDATION 2: Check WebSocket connection
    if (!wsInstance || wsInstance.readyState !== WebSocket.OPEN) {
      console.error(`[ChatPanel] ❌ Cannot send - WebSocket not ready:`, {
        hasWsInstance: !!wsInstance,
        readyState: wsInstance?.readyState,
        expectedState: WebSocket.OPEN,
        readyStateText:
          wsInstance?.readyState === 0
            ? "CONNECTING"
            : wsInstance?.readyState === 1
            ? "OPEN"
            : wsInstance?.readyState === 2
            ? "CLOSING"
            : wsInstance?.readyState === 3
            ? "CLOSED"
            : "NULL",
      });

      // Hiển thị error cho user
      const errorMessage: Message = {
        id: `msg-${Date.now()}-error`,
        role: "assistant",
        content:
          "❌ Lỗi: WebSocket chưa kết nối. Vui lòng kiểm tra connection status ở TabPanel footer.",
        timestamp: Date.now(),
      };
      setMessages((prev) => [...prev, errorMessage]);
      setIsProcessing(false);
      return;
    }

    // Add user message to UI
    const userMessage: Message = {
      id: `msg-${Date.now()}-user`,
      role: "user",
      content: originalUserMessage,
      timestamp: Date.now(),
      isFirstRequest: isFirstRequest,
      systemPrompt: isFirstRequest ? systemPrompt || undefined : undefined,
      contextSize: content.length,
    };

    // 🆕 Save conversation immediately (before waiting for response)
    const updatedMessages = [...messages, userMessage];
    saveConversation(
      selectedTab.tabId,
      selectedTab.folderPath || null,
      updatedMessages,
      isFirstRequest
    ).then((success) => {
      if (success) {
      }
    });

    setMessages((prev) => [...prev, userMessage]);
    setIsProcessing(true);

    if (isFirstRequest) {
      setIsFirstRequest(false);
    }

    // Send via WebSocket (will be forwarded to ZenTab)
    const sendPromptMessage = {
      type: "sendPrompt",
      tabId: selectedTab.tabId,
      prompt: content,
      requestId: `req-${Date.now()}`,
      isNewTask: isFirstRequest,
      folderPath: (window as any).__zenWorkspaceFolderPath || null,
      containerName: selectedTab.containerName || null,
      timestamp: Date.now(),
    };

    // Post message to parent window (will be sent via WebSocket in TabFooter)
    const postMessageTimestamp = Date.now();

    window.postMessage(
      {
        command: "sendWebSocketMessage",
        data: sendPromptMessage,
      },
      "*"
    );

    const timeoutId = setTimeout(() => {
      setIsProcessing((current) => {
        if (current) {
          console.error(`[ChatPanel] ⏱️ Timeout waiting for response`);
          const timeoutMessage: Message = {
            id: `msg-${Date.now()}-timeout`,
            role: "assistant",
            content:
              "⏱️ Timeout: Không nhận được response từ ZenTab sau 30s. Vui lòng thử lại.",
            timestamp: Date.now(),
          };
          setMessages((prev) => [...prev, timeoutMessage]);
          return false;
        }
        return current;
      });
    }, 30000); // 30 seconds timeout

    // Store timeout ID để có thể clear khi nhận response
    (window as any).__chatPanelTimeoutId = timeoutId;
  };

  // 🆕 Handler cho Clear Chat
  const handleClearChat = useCallback(async () => {
    const confirmed = window.confirm(
      "Delete this conversation permanently? This cannot be undone."
    );

    if (confirmed) {
      await deleteConversation(
        selectedTab.tabId,
        selectedTab.folderPath || null
      );
      setMessages([]);
      setIsFirstRequest(true);
      setIsProcessing(false);
    }
  }, [selectedTab.tabId, selectedTab.folderPath]);

  return (
    <div className="chat-panel">
      <ChatHeader
        selectedTab={selectedTab}
        onBack={onBack}
        onClearChat={handleClearChat}
        isLoadingConversation={isLoadingConversation}
      />
      <ChatBody
        messages={messages}
        isProcessing={isProcessing}
        checkpoints={checkpoints}
      />
      <ChatFooter
        onSendMessage={handleSendMessage}
        wsConnected={wsConnected}
        onWsMessage={(data) => {
          // Forward to handleIncomingMessage
          if ((window as any).__chatPanelMessageHandler) {
            (window as any).__chatPanelMessageHandler(data);
          }
        }}
        wsInstance={wsInstance}
      />
    </div>
  );
};

export default ChatPanel;
