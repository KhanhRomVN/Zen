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

  useEffect(() => {
    console.log(
      `[ChatPanel] 🎧 Registering handleIncomingMessage for tab ${selectedTab.tabId}`
    );

    const handleIncomingMessage = (data: any) => {
      console.log(`[ChatPanel] 📨 handleIncomingMessage called:`, {
        type: data.type,
        requestId: data.requestId,
        tabId: data.tabId,
        success: data.success,
        hasResponse: !!data.response,
        error: data.error,
        timestamp: Date.now(),
      });

      if (data.type === "promptResponse") {
        console.log(`[ChatPanel] ✅ Processing promptResponse:`, {
          requestId: data.requestId,
          tabId: data.tabId,
          expectedTabId: selectedTab.tabId,
          success: data.success,
        });

        // 🆕 CLEAR TIMEOUT khi nhận response
        const timeoutId = (window as any).__chatPanelTimeoutId;
        if (timeoutId) {
          clearTimeout(timeoutId);
          delete (window as any).__chatPanelTimeoutId;
          console.log(`[ChatPanel] ⏱️ Timeout cleared - response received`);
        }

        if (data.success && data.response) {
          console.log(`[ChatPanel] 🔍 Parsing response:`, {
            responseLength: data.response?.length || 0,
            responsePreview: data.response?.substring(0, 100),
          });
          try {
            // Parse OpenAI response format
            const parsedResponse = JSON.parse(data.response);
            const content =
              parsedResponse?.choices?.[0]?.delta?.content || data.response;

            // Add AI response to messages
            const aiMessage: Message = {
              id: `msg-${Date.now()}-assistant`,
              role: "assistant",
              content: content,
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

  const handleSendMessage = (content: string) => {
    console.log(`[ChatPanel] 📤 User sending message:`, {
      content: content.substring(0, 100),
      contentLength: content.length,
      selectedTabId: selectedTab.tabId,
      folderPath: selectedTab.folderPath,
      canAccept: selectedTab.canAccept,
      status: selectedTab.status,
    });

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
      content: content,
      timestamp: Date.now(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setIsProcessing(true);

    // Send via WebSocket (will be forwarded to ZenTab)
    const sendPromptMessage = {
      type: "sendPrompt",
      tabId: selectedTab.tabId,
      systemPrompt: null,
      userPrompt: content,
      requestId: `req-${Date.now()}`,
      isNewTask: false,
      folderPath: selectedTab.folderPath || null,
      timestamp: Date.now(),
    };

    console.log(`[ChatPanel] 🔄 Posting message to window:`, {
      command: "sendWebSocketMessage",
      messageType: sendPromptMessage.type,
      requestId: sendPromptMessage.requestId,
      tabId: sendPromptMessage.tabId,
    });
    console.log(`[ChatPanel] 📦 Full message payload:`, sendPromptMessage);
    console.log(
      `[ChatPanel] 🔍 Message size: ${
        JSON.stringify(sendPromptMessage).length
      } bytes`
    );

    // Post message to parent window (will be sent via WebSocket in TabFooter)
    const postMessageTimestamp = Date.now();
    console.log(
      `[ChatPanel] 📞 Calling window.postMessage() at ${postMessageTimestamp}...`
    );

    window.postMessage(
      {
        command: "sendWebSocketMessage",
        data: sendPromptMessage,
      },
      "*"
    );

    console.log(
      `[ChatPanel] ✅ window.postMessage() completed (${
        Date.now() - postMessageTimestamp
      }ms)`
    );
    console.log(
      `[ChatPanel] 💡 Message should now be picked up by ChatFooter listener`
    );
    console.log(`[ChatPanel] 🔍 ChatPanel message handler registered:`, {
      hasHandler: !!(window as any).__chatPanelMessageHandler,
      handlerType: typeof (window as any).__chatPanelMessageHandler,
    });

    // 🆕 TIMEOUT: Nếu sau 30s chưa nhận response → show error
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
      <ChatBody messages={messages} isProcessing={isProcessing} />
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
