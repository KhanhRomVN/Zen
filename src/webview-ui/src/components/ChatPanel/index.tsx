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
  onWsConnectedChange: (connected: boolean) => void;
  onWsMessage: (message: any) => void;
}

const ChatPanel: React.FC<ChatPanelProps> = ({
  selectedTab,
  onBack,
  wsConnected,
  onWsConnectedChange,
  onWsMessage,
}) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);

  // 🆕 Listen for WebSocket messages (promptResponse)
  useEffect(() => {
    const handleIncomingMessage = (data: any) => {
      console.log(`[ChatPanel] 📥 Received WebSocket message:`, data.type);

      if (data.type === "promptResponse") {
        console.log(`[ChatPanel] ✅ Received promptResponse:`, {
          requestId: data.requestId,
          success: data.success,
          hasResponse: !!data.response,
        });

        if (data.success && data.response) {
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

          // Add error message
          const errorMessage: Message = {
            id: `msg-${Date.now()}-error`,
            role: "assistant",
            content: `Error: ${data.error || "Failed to get response"}`,
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
    console.log(`[ChatPanel] 📤 Sending message:`, content);

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

    console.log(
      `[ChatPanel] 📡 Sending sendPrompt via WebSocket:`,
      sendPromptMessage
    );

    // Post message to parent window (will be sent via WebSocket in TabFooter)
    window.postMessage(
      {
        command: "sendWebSocketMessage",
        data: sendPromptMessage,
      },
      "*"
    );
  };

  return (
    <div className="chat-panel">
      <ChatHeader selectedTab={selectedTab} onBack={onBack} />
      <ChatBody messages={messages} isProcessing={isProcessing} />
      <ChatFooter
        onSendMessage={handleSendMessage}
        wsConnected={wsConnected}
        onWsConnectedChange={onWsConnectedChange}
        onWsMessage={(data) => {
          // Forward to handleIncomingMessage
          if ((window as any).__chatPanelMessageHandler) {
            (window as any).__chatPanelMessageHandler(data);
          }
        }}
      />
    </div>
  );
};

export default ChatPanel;
