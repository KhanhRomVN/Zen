import React, { useState, useRef, useEffect } from "react";
import { useModels } from "../../hooks/useModels";

interface ChatFooterProps {
  onSendMessage: (message: string) => void;
  wsConnected: boolean;
  onWsConnectedChange: (connected: boolean) => void;
  onWsMessage: (message: any) => void;
}

const ChatFooter: React.FC<ChatFooterProps> = ({
  onSendMessage,
  wsConnected,
  onWsConnectedChange,
  onWsMessage,
}) => {
  const {
    models: availableModels,
    selectedModel,
    setSelectedModel,
  } = useModels();
  const [message, setMessage] = useState("");
  const [showModelDrawer, setShowModelDrawer] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    if (message.trim()) {
      onSendMessage(message);
      setMessage("");
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  // 🆕 Listen for messages from ChatPanel to send via WebSocket
  useEffect(() => {
    const handlePostMessage = (event: MessageEvent) => {
      console.log(`[ChatFooter] 📨 Received postMessage:`, {
        command: event.data?.command,
        hasData: !!event.data?.data,
        dataType: event.data?.data?.type,
      });

      if (event.data.command === "sendWebSocketMessage") {
        const messageData = event.data.data;
        console.log(`[ChatFooter] 🔍 Message data:`, {
          type: messageData.type,
          tabId: messageData.tabId,
          requestId: messageData.requestId,
          hasUserPrompt: !!messageData.userPrompt,
          userPromptLength: messageData.userPrompt?.length || 0,
        });

        // TODO: Gửi message qua WebSocket ở đây
        console.log(
          `[ChatFooter] ⚠️ Message received but NOT sent via WebSocket yet!`
        );
      }
    };

    window.addEventListener("message", handlePostMessage);
    return () => window.removeEventListener("message", handlePostMessage);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);

    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        200
      )}px`;
    }
  };

  const ChevronDownIcon = () => (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );

  const SendIcon = () => (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );

  const handleModelSelect = (modelId: string) => {
    setSelectedModel(modelId);
    setShowModelDrawer(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!showModelDrawer) return;
      const target = event.target as HTMLElement;
      const drawer = document.querySelector('[data-model-drawer="true"]');
      if (drawer && !drawer.contains(target)) {
        setShowModelDrawer(false);
      }
    };

    if (showModelDrawer) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showModelDrawer]);

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        display: "flex",
        flexDirection: "column",
        width: "100%",
        backgroundColor: "var(--secondary-bg)",
        zIndex: 100,
      }}
    >
      {/* Message Input Area */}
      <div
        style={{
          padding: "var(--spacing-md) var(--spacing-lg)",
          borderTop: "1px solid var(--border-color)",
          backgroundColor: "var(--secondary-bg)",
        }}
      >
        <div
          style={{
            position: "relative",
            backgroundColor: "var(--input-bg)",
            borderRadius: "var(--border-radius-lg)",
            border: "1px solid var(--border-color)",
            transition: "border-color 0.2s",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--accent-text)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border-color)";
          }}
        >
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            placeholder="Type your message here... (Shift+Enter for new line)"
            style={{
              width: "100%",
              minHeight: "60px",
              maxHeight: "200px",
              padding: "var(--spacing-md)",
              paddingRight: "50px",
              backgroundColor: "transparent",
              border: "none",
              outline: "none",
              color: "var(--primary-text)",
              fontSize: "var(--font-size-md)",
              fontFamily: "inherit",
              resize: "none",
              overflow: "auto",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: "var(--spacing-sm)",
              right: "var(--spacing-sm)",
              cursor: message.trim() ? "pointer" : "not-allowed",
              opacity: message.trim() ? 1 : 0.5,
              padding: "var(--spacing-xs)",
              borderRadius: "var(--border-radius)",
              transition: "background-color 0.2s",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: message.trim()
                ? "var(--accent-text)"
                : "var(--secondary-text)",
            }}
            onClick={handleSend}
            onMouseEnter={(e) => {
              if (message.trim()) {
                e.currentTarget.style.backgroundColor = "var(--hover-bg)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <SendIcon />
          </div>
        </div>
      </div>

      {/* Model Selection Bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "var(--spacing-sm) var(--spacing-lg)",
          backgroundColor: "var(--secondary-bg)",
          borderTop: "1px solid var(--border-color)",
          fontSize: "var(--font-size-xs)",
          color: "var(--secondary-text)",
          position: "relative",
          minHeight: "36px",
        }}
      >
        <div style={{ position: "relative", zIndex: 1001 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--spacing-xs)",
              cursor: "pointer",
              padding: "var(--spacing-xs) var(--spacing-sm)",
              borderRadius: "var(--border-radius)",
              transition: "background-color 0.2s",
              userSelect: "none",
            }}
            onClick={() => setShowModelDrawer(!showModelDrawer)}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--hover-bg)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <span>
              Model:{" "}
              {availableModels.find((m) => m.id === selectedModel)?.name ||
                selectedModel}
            </span>
            <ChevronDownIcon />
          </div>
        </div>
      </div>

      {/* Model Drawer */}
      {showModelDrawer && (
        <div
          data-model-drawer="true"
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: "var(--primary-bg)",
            borderTop: "1px solid var(--border-color)",
            borderTopLeftRadius: "12px",
            borderTopRightRadius: "12px",
            padding: "var(--spacing-lg)",
            zIndex: 999,
            boxShadow: "0 -4px 20px rgba(0, 0, 0, 0.15)",
            transform: "translateY(0)",
            animation: "slideUp 0.3s ease-out",
            maxHeight: "70vh",
            overflowY: "auto",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "var(--spacing-lg)",
              paddingBottom: "var(--spacing-sm)",
              borderBottom: "1px solid var(--border-color)",
            }}
          >
            <div
              style={{
                fontSize: "var(--font-size-lg)",
                fontWeight: 600,
                color: "var(--primary-text)",
              }}
            >
              Select Model
            </div>
            <div
              style={{
                cursor: "pointer",
                padding: "var(--spacing-xs)",
                borderRadius: "var(--border-radius)",
                transition: "background-color 0.2s",
              }}
              onClick={() => setShowModelDrawer(false)}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "var(--hover-bg)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--spacing-sm)",
            }}
          >
            {availableModels.map((model) => (
              <div
                key={model.id}
                style={{
                  padding: "var(--spacing-md) var(--spacing-lg)",
                  borderRadius: "var(--border-radius)",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  backgroundColor:
                    selectedModel === model.id
                      ? "var(--accent-bg)"
                      : "var(--secondary-bg)",
                  color:
                    selectedModel === model.id
                      ? "var(--accent-text)"
                      : "var(--primary-text)",
                  border:
                    selectedModel === model.id
                      ? "1px solid var(--accent-text)"
                      : "1px solid transparent",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
                onClick={() => handleModelSelect(model.id)}
                onMouseEnter={(e) => {
                  if (selectedModel !== model.id) {
                    e.currentTarget.style.backgroundColor = "var(--hover-bg)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedModel !== model.id) {
                    e.currentTarget.style.backgroundColor =
                      "var(--secondary-bg)";
                  }
                }}
              >
                <span
                  style={{ fontWeight: selectedModel === model.id ? 600 : 400 }}
                >
                  {model.name}
                </span>
                {selectedModel === model.id && (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: "var(--spacing-lg)",
              paddingTop: "var(--spacing-md)",
              borderTop: "1px solid var(--border-color)",
              fontSize: "var(--font-size-xs)",
              color: "var(--secondary-text)",
              textAlign: "center",
            }}
          >
            Model determines the AI behavior and capabilities
          </div>
        </div>
      )}

      {showModelDrawer && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            zIndex: 998,
          }}
          onClick={() => setShowModelDrawer(false)}
        />
      )}

      <style>
        {`@keyframes slideUp {
 from {
 transform: translateY(100%);
 }
 to {
 transform: translateY(0);
 }
 }`}
      </style>
    </div>
  );
};

export default ChatFooter;
