import React, { useState, useEffect } from "react";
import ChatHeader from "./ChatHeader";
import ChatBody from "./ChatBody";
import ChatFooter from "./ChatFooter";

interface TabInfo {
  tabId: number;
  containerName: string;
  title: string;
  url?: string;
  status: "free" | "busy" | "sleep";
  canAccept: boolean;
  requestCount: number;
  folderPath?: string | null;
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
            // 🆕 Import ResponseParser
            const {
              parseAIResponse,
              formatActionForDisplay,
            } = require("../../services/ResponseParser");

            // Parse OpenAI response format
            const parsedResponse = JSON.parse(data.response);
            const rawContent =
              parsedResponse?.choices?.[0]?.delta?.content || data.response;

            // 🆕 Parse response to extract actions
            const parsed = parseAIResponse(rawContent);

            // 🆕 Check for file operations to create checkpoints
            const hasFileOperation = parsed.actions.some(
              (action: { type: string }) =>
                action.type === "file_edit" ||
                action.type === "file_add" ||
                action.type === "file_read"
            );

            if (hasFileOperation) {
              setCheckpoints((prev) => [...prev, `checkpoint-${Date.now()}`]);
            }

            // 🆕 Format content with actions
            const formattedContent = parsed.actions
              .map((action: any) => formatActionForDisplay(action))
              .join("\n\n");

            // Add AI response to messages
            const aiMessage: Message = {
              id: `msg-${Date.now()}-assistant`,
              role: "assistant",
              content: formattedContent,
              timestamp: Date.now(),
            };

            setMessages((prev) => [...prev, aiMessage]);
            setIsProcessing(false);
          } catch (error) {
            console.error(`[ChatPanel] ❌ Failed to parse response:`, error);

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
          console.error(`[ChatPanel] ❌ promptResponse failed:`, data.error);
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
    if (wsInstance && wsInstance.readyState === WebSocket.OPEN) {
      wsInstance.send(
        JSON.stringify({
          type: "requestContext",
          task: content,
          requestId: requestId,
          timestamp: Date.now(),
        })
      );

      // Wait for context response (with timeout)
      const contextPromise = new Promise<string>((resolve, reject) => {
        const timeout = setTimeout(() => {
          reject(new Error("Context request timeout"));
        }, 5000); // 5s timeout

        const handleContextResponse = (data: any) => {
          if (data.type === "contextResponse" && data.requestId === requestId) {
            clearTimeout(timeout);
            if (data.error) {
              reject(new Error(data.error));
            } else {
              resolve(data.context);
            }
            // Cleanup listener
            delete (window as any).__contextResponseHandler;
          }
        };

        (window as any).__contextResponseHandler = handleContextResponse;
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

    setMessages((prev) => [...prev, userMessage]);
    setIsProcessing(true);

    if (isFirstRequest) {
      setIsFirstRequest(false);
    }

    // Send via WebSocket (will be forwarded to ZenTab)
    const sendPromptMessage = {
      type: "sendPrompt",
      tabId: selectedTab.tabId,
      systemPrompt: isFirstRequest ? systemPrompt : null, // 🆕 Only send system prompt on first request
      userPrompt: content,
      requestId: `req-${Date.now()}`,
      isNewTask: false,
      folderPath: selectedTab.folderPath || null,
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

  return (
    <div className="chat-panel">
      <ChatHeader selectedTab={selectedTab} onBack={onBack} />
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
