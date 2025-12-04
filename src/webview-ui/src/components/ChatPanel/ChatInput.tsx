import React, { useState, useRef, useEffect } from "react";
import { useModels } from "../../hooks/useModels";

// CRITICAL: VS Code API chỉ có thể acquire một lần duy nhất
let vscodeApi: any = null;
try {
  vscodeApi = (window as any).acquireVsCodeApi();
} catch (error) {
  // VS Code API not available or already acquired
}

interface ChatInputProps {
  onWsConnectedChange?: (connected: boolean) => void;
  onWsMessage?: (message: any) => void;
}

const ChatInput: React.FC<ChatInputProps> = ({
  onWsConnectedChange,
  onWsMessage,
}) => {
  const {
    models: availableModels,
    selectedModel,
    setSelectedModel,
  } = useModels();
  const [message, setMessage] = useState("");
  const [rows, setRows] = useState(3);
  const [port, setPort] = useState(0);
  const [showModelDrawer, setShowModelDrawer] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [isPortChecking, setIsPortChecking] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const activePortRef = useRef<number>(0);
  const cleanupSignalRef = useRef<boolean>(false);
  const connectionTimestampRef = useRef<number>(0);
  const MIN_ROWS = 2;
  const MAX_ROWS = 8;

  const generateRandomPort = async () => {
    setIsPortChecking(true);

    if (!vscodeApi) {
      setIsPortChecking(false);
      return;
    }

    try {
      const messageHandler = (event: MessageEvent) => {
        const message = event.data;
        if (message.command === "workspacePort" && message.port) {
          // Signal cleanup for old WebSocket before updating port
          if (port !== 0 && port !== message.port) {
            cleanupSignalRef.current = true;
          }

          // Update activePortRef immediately before setPort
          activePortRef.current = message.port;

          setPort(message.port);
          setIsPortChecking(false);
          window.removeEventListener("message", messageHandler);
        }
      };

      window.addEventListener("message", messageHandler);

      if (port === 0) {
        vscodeApi.postMessage({
          command: "getWorkspacePort",
        });
      } else {
        vscodeApi.postMessage({
          command: "restartServer",
        });
      }

      setTimeout(() => {
        window.removeEventListener("message", messageHandler);
        if (isPortChecking) {
          setIsPortChecking(false);
        }
      }, 2000);
    } catch (error) {
      setIsPortChecking(false);
    }
  };

  useEffect(() => {
    if (port === 0) return;

    let ws: WebSocket | null = null;
    let connectionVerified = false;
    const currentPort = port;
    const isCleanupSignaled = cleanupSignalRef.current;

    // Chỉ setup WebSocket nếu đây là port đang active
    if (activePortRef.current !== currentPort) {
      // Clear cleanup signal nếu có
      if (isCleanupSignaled) {
        cleanupSignalRef.current = false;
      }
      return;
    }

    // Clear cleanup signal sau khi verify đây là active port
    if (isCleanupSignaled) {
      cleanupSignalRef.current = false;
    }

    // Reset wsConnected trước khi tạo connection mới
    setWsConnected(false);

    // Set timestamp cho connection mới
    const connectionTimestamp = Date.now();
    connectionTimestampRef.current = connectionTimestamp;

    try {
      console.log(
        `[ChatInput] 🚀 Creating WebSocket to: ws://localhost:${currentPort}`
      );
      ws = new WebSocket(`ws://localhost:${port}`);

      ws.onopen = () => {
        console.log(`[ChatInput] ✅ WebSocket OPENED for port ${currentPort}`);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);

          console.log(
            `[ChatInput] 📥 Received message on port ${currentPort}:`,
            {
              type: data.type,
              dataLength: Array.isArray(data.data) ? data.data.length : "N/A",
              timestamp: data.timestamp,
              currentActivePort: activePortRef.current,
            }
          );

          // 🆕 CRITICAL: Ignore old messages (older than connection timestamp)
          if (data.timestamp && data.timestamp < connectionTimestamp) {
            console.warn(
              `[ChatInput] ⚠️ Ignoring old message (age: ${
                connectionTimestamp - data.timestamp
              }ms)`,
              data.type
            );
            return;
          }

          // 🆕 CRITICAL: Ignore old messages (older than connection timestamp)
          if (data.timestamp && data.timestamp < connectionTimestamp) {
            console.warn(
              `[ChatInput] ⚠️ Ignoring old message (age: ${
                connectionTimestamp - data.timestamp
              }ms)`,
              data.type
            );
            return;
          }

          // 🆕 CRITICAL: Forward all messages to parent component FIRST
          if (onWsMessage) {
            onWsMessage(data);
          }

          if (data.type === "connection-established") {
            // connection-established từ server - KHÔNG set wsConnected
            // Chỉ để verify connection đã thiết lập thành công
            connectionVerified = true;
          } else if (data.type === "ping") {
            // 🆕 PING RECEIVED: Reply with pong to maintain connection
            if (ws && ws.readyState === WebSocket.OPEN) {
              ws.send(
                JSON.stringify({
                  type: "pong",
                  timestamp: Date.now(),
                })
              );
            }
          } else if (data.type === "response" || data.type === "pong") {
            // Nhận được response hoặc pong từ external client
            // Đây là bằng chứng của external client connection
            setWsConnected(true);
            onWsConnectedChange?.(true);
          } else if (data.type === "focusedTabsUpdate") {
            console.log(`[ChatInput] 🔍 focusedTabsUpdate DETAILS:`, {
              isArray: Array.isArray(data.data),
              length: Array.isArray(data.data) ? data.data.length : "N/A",
              dataSample:
                Array.isArray(data.data) && data.data.length > 0
                  ? data.data[0]
                  : "empty",
              timestamp: data.timestamp,
              wsConnected: wsConnected,
            });

            // 🆕 CRITICAL: Kiểm tra data array - nếu EMPTY thì là disconnect signal
            if (Array.isArray(data.data) && data.data.length === 0) {
              console.log(
                `[ChatInput] 🔴 Received EMPTY focusedTabsUpdate - ZenTab disconnected`
              );
              console.log(
                `[ChatInput] 📊 Setting wsConnected = false, prev=${wsConnected}`
              );

              // 🆕 FIX: Force update state immediately
              setWsConnected((prev) => {
                if (prev !== false) {
                  console.log(
                    `[ChatInput] 🔄 State updated: wsConnected ${prev} → false`
                  );
                }
                return false;
              });
              onWsConnectedChange?.(false);
            } else if (Array.isArray(data.data) && data.data.length > 0) {
              // Nhận được focusedTabsUpdate với tabs → ZenTab connected
              console.log(
                `[ChatInput] ✅ Received ${data.data.length} tabs - ZenTab connected`
              );

              // 🆕 FIX: Force update state immediately
              setWsConnected((prev) => {
                if (prev !== true) {
                  console.log(
                    `[ChatInput] 🔄 State updated: wsConnected ${prev} → true`
                  );
                }
                return true;
              });
              onWsConnectedChange?.(true);
            }
          }
        } catch (error) {
          // Error parsing message
        }
      };

      ws.onclose = (event) => {
        console.log(
          `[ChatInput] 🔴 WebSocket CLOSED for port ${currentPort}:`,
          {
            code: event.code,
            reason: event.reason,
            wasClean: event.wasClean,
            activePort: activePortRef.current,
          }
        );

        if (activePortRef.current === currentPort) {
          console.log(
            `[ChatInput] 🔄 Setting wsConnected = false (close event)`
          );
          setWsConnected(false);
          onWsConnectedChange?.(false);
        }
      };

      ws.onerror = (error) => {
        console.error(
          `[ChatInput] ❌ WebSocket ERROR for port ${currentPort}:`,
          error
        );
        if (activePortRef.current === currentPort) {
          console.log(
            `[ChatInput] 🔄 Setting wsConnected = false (error event)`
          );
          setWsConnected(false);
          onWsConnectedChange?.(false);
        }
      };
    } catch (error) {
      console.error(`[ChatInput] ❌ Exception creating WebSocket:`, error);
      if (activePortRef.current === currentPort) {
        setWsConnected(false);
      }
    }

    return () => {
      if (ws) {
        ws.close();
      }
    };
  }, [port]);

  useEffect(() => {
    generateRandomPort();
  }, []);

  const handleInput = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target;
    setMessage(textarea.value);

    textarea.style.height = "auto";
    const lineHeight = parseInt(getComputedStyle(textarea).lineHeight);
    const padding =
      parseInt(getComputedStyle(textarea).paddingTop) +
      parseInt(getComputedStyle(textarea).paddingBottom);

    const contentHeight = textarea.scrollHeight - padding;
    const calculatedRows = Math.floor(contentHeight / lineHeight);

    const newRows = Math.max(MIN_ROWS, Math.min(MAX_ROWS, calculatedRows));
    setRows(newRows);
    textarea.style.height = "auto";
    textarea.style.height = newRows * lineHeight + padding + "px";
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim()) {
      setMessage("");
      setRows(MIN_ROWS);
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
        const lineHeight = parseInt(
          getComputedStyle(textareaRef.current).lineHeight
        );
        const paddingTop = parseInt(
          getComputedStyle(textareaRef.current).paddingTop
        );
        const paddingBottom = parseInt(
          getComputedStyle(textareaRef.current).paddingBottom
        );
        textareaRef.current.style.height =
          MIN_ROWS * lineHeight + paddingTop + paddingBottom + "px";
      }
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const SendIcon = () => (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      style={{
        cursor: "pointer",
        color: "var(--accent-text)",
        transition: "color 0.2s",
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.color = "var(--button-primary-hover)")
      }
      onMouseLeave={(e) => (e.currentTarget.style.color = "var(--accent-text)")}
    >
      <path d="M22 2L11 13" />
      <path d="M22 2L15 22L11 13L2 9L22 2Z" />
    </svg>
  );

  const RefreshIcon = () => (
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
      <path d="M21 2v6h-6" />
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M3 22v-6h6" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
    </svg>
  );

  const Icon = () => (
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
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );

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

  const PortToClipboard = () => {
    const text = "localhost:" + port;
    navigator.clipboard.writeText(text).then(
      () => {
        // Copied to clipboard
      },
      (err) => {
        // Failed to copy
      }
    );
  };

  const handleModelSelect = (modelId: string) => {
    setSelectedModel(modelId);
    setShowModelDrawer(false);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Không làm gì nếu drawer đang đóng
      if (!showModelDrawer) return;

      // Kiểm tra xem click có nằm trong drawer hay backdrop không
      const target = event.target as HTMLElement;
      const drawer = document.querySelector('[data-model-drawer="true"]');

      // Nếu click vào backdrop (không phải drawer content), đóng drawer
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
      <form
        className="chat-input-form"
        onSubmit={handleSubmit}
        style={{
          position: "relative",
          width: "100%",
          padding:
            "var(--spacing-sm) var(--spacing-lg) var(--spacing-sm) var(--spacing-lg)",
          backgroundColor: "var(--secondary-bg)",
        }}
      >
        <div style={{ position: "relative" }}>
          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            rows={rows}
            placeholder="Type your message here... (Press Enter to send, Shift+Enter for new line)"
            style={{
              width: "100%",
              minHeight: MIN_ROWS * 18 + "px",
              maxHeight: MAX_ROWS * 18 + "px",
              resize: "none",
              padding:
                "var(--spacing-sm) var(--spacing-md) 35px var(--spacing-md)",
              backgroundColor: "var(--input-bg-light, var(--input-bg))",
              color: "var(--primary-text)",
              border: "1px solid var(--border-color)",
              borderRadius: "var(--border-radius)",
              fontSize: "var(--font-size-md)",
              lineHeight: "1.5",
              fontFamily: "inherit",
              outline: "none",
              transition: "border-color 0.2s, box-shadow 0.2s",
              boxSizing: "border-box",
            }}
            onFocus={(e) => {
              e.target.style.borderColor = "var(--accent-text)";
              e.target.style.boxShadow = "0 0 0 1px var(--accent-text)";
            }}
            onBlur={(e) => {
              e.target.style.borderColor = "var(--border-color)";
              e.target.style.boxShadow = "none";
            }}
          />
          <div
            style={{
              position: "absolute",
              right: "12px",
              bottom: "12px",
              display: "flex",
              alignItems: "center",
              gap: "var(--spacing-sm)",
            }}
            onClick={handleSubmit}
          >
            <div
              style={{
                fontSize: "var(--font-size-xs)",
                color: "var(--secondary-text)",
                opacity: message.trim() ? 1 : 0.5,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <SendIcon />
            </div>
          </div>
        </div>
      </form>

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
              color: wsConnected ? "#4ade80" : "var(--secondary-text)",
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

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--spacing-md)",
          }}
        >
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
            onClick={PortToClipboard}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--hover-bg)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <Icon />
            <span
              style={{
                color: wsConnected ? "#4ade80" : "inherit",
                fontWeight: wsConnected ? 600 : 400,
              }}
            >
              localhost:{port}
            </span>
          </div>

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
              opacity: isPortChecking ? 0.5 : 1,
              pointerEvents: isPortChecking ? "none" : "auto",
            }}
            onClick={() => {
              if (!isPortChecking) {
                generateRandomPort();
              }
            }}
            onMouseEnter={(e) => {
              if (!isPortChecking) {
                e.currentTarget.style.backgroundColor = "var(--hover-bg)";
              }
            }}
            onMouseLeave={(e) => {
              if (!isPortChecking) {
                e.currentTarget.style.backgroundColor = "transparent";
              }
            }}
          >
            <RefreshIcon />
            {isPortChecking && (
              <span
                style={{ fontSize: "var(--font-size-xxs)", marginLeft: "4px" }}
              >
                checking...
              </span>
            )}
          </div>
        </div>
      </div>

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

export default ChatInput;
