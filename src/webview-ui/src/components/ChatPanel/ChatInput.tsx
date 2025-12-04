import React, { useState, useRef, useEffect } from "react";
import { useModels } from "../../hooks/useModels";

// CRITICAL: VS Code API chỉ có thể acquire một lần duy nhất
let vscodeApi: any = null;
try {
  vscodeApi = (window as any).acquireVsCodeApi();
} catch (error) {
  console.log("VS Code API not available or already acquired");
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
    console.log(
      "[generateRandomPort] Starting - Current port:",
      port,
      "Active port ref:",
      activePortRef.current
    );
    setIsPortChecking(true);

    if (!vscodeApi) {
      console.error("VS Code API not available");
      setIsPortChecking(false);
      return;
    }

    try {
      const messageHandler = (event: MessageEvent) => {
        const message = event.data;
        if (message.command === "workspacePort" && message.port) {
          console.log(
            "[generateRandomPort] Received workspace port: " + message.port
          );

          // Signal cleanup for old WebSocket before updating port
          if (port !== 0 && port !== message.port) {
            console.log(
              "[generateRandomPort] Setting cleanup signal for old port:",
              port
            );
            cleanupSignalRef.current = true;
          }

          // Update activePortRef immediately before setPort
          activePortRef.current = message.port;
          console.log(
            "[generateRandomPort] Updated activePortRef to:",
            message.port
          );

          setPort(message.port);
          setIsPortChecking(false);
          window.removeEventListener("message", messageHandler);
        }
      };

      window.addEventListener("message", messageHandler);

      if (port === 0) {
        console.log("[generateRandomPort] Initial port request...");
        vscodeApi.postMessage({
          command: "getWorkspacePort",
        });
      } else {
        console.log(
          "[generateRandomPort] Requesting server restart with new port..."
        );
        vscodeApi.postMessage({
          command: "restartServer",
        });
      }

      setTimeout(() => {
        window.removeEventListener("message", messageHandler);
        if (isPortChecking) {
          console.warn("[generateRandomPort] Port request timeout");
          setIsPortChecking(false);
        }
      }, 2000);
    } catch (error) {
      console.error(
        "[generateRandomPort] Failed to get/restart workspace port:",
        error
      );
      setIsPortChecking(false);
    }
  };

  useEffect(() => {
    if (port === 0) return;

    let ws: WebSocket | null = null;
    let connectionVerified = false;
    const currentPort = port;
    const isCleanupSignaled = cleanupSignalRef.current;

    // activePortRef is already updated in generateRandomPort before setPort
    console.log(
      `[WebSocket Effect] Setting up for port ${currentPort}, activePortRef: ${activePortRef.current}, cleanupSignaled: ${isCleanupSignaled}`
    );

    // Chỉ setup WebSocket nếu đây là port đang active
    if (activePortRef.current !== currentPort) {
      console.log(
        `[WebSocket Effect] SKIPPING setup - port ${currentPort} is not active port (activePortRef: ${activePortRef.current})`
      );
      // Clear cleanup signal nếu có
      if (isCleanupSignaled) {
        cleanupSignalRef.current = false;
      }
      return;
    }

    // Clear cleanup signal sau khi verify đây là active port
    if (isCleanupSignaled) {
      cleanupSignalRef.current = false;
      console.log(
        `[WebSocket Effect] Cleared cleanup signal for port ${currentPort}`
      );
    }

    // Reset wsConnected trước khi tạo connection mới
    setWsConnected(false);

    // Set timestamp cho connection mới
    const connectionTimestamp = Date.now();
    connectionTimestampRef.current = connectionTimestamp;
    console.log(
      `[WebSocket Effect] Created new connection with timestamp: ${connectionTimestamp}`
    );

    try {
      ws = new WebSocket(`ws://localhost:${port}`);

      ws.onopen = () => {
        console.log(
          `[WebSocket onopen] Port ${port}, activePortRef: ${activePortRef.current}`
        );
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log(
            `[WebSocket onmessage] Port ${port}, data:`,
            data,
            "activePortRef:",
            activePortRef.current,
            "connectionVerified:",
            connectionVerified,
            "connectionTimestamp:",
            connectionTimestamp,
            "currentTimestamp:",
            connectionTimestampRef.current
          );

          // 🆕 CRITICAL: Forward all messages to parent component FIRST
          console.log(
            `[WebSocket onmessage] Forwarding message to parent, onWsMessage exists:`,
            !!onWsMessage
          );
          if (onWsMessage) {
            console.log(
              `[WebSocket onmessage] Calling onWsMessage with data:`,
              JSON.stringify(data)
            );
            onWsMessage(data);
            console.log(
              `[WebSocket onmessage] onWsMessage called successfully`
            );
          } else {
            console.warn(
              `[WebSocket onmessage] onWsMessage callback is NOT defined!`
            );
          }

          if (data.type === "connection-established") {
            // connection-established từ server - KHÔNG set wsConnected
            // Chỉ để verify connection đã thiết lập thành công
            connectionVerified = true;
            console.log(
              `[WebSocket onmessage] Received connection-established (server handshake), NOT setting wsConnected`
            );
          } else if (data.type === "response" || data.type === "pong") {
            // Nhận được response hoặc pong từ external client
            // Đây là bằng chứng của external client connection
            console.log(
              `[WebSocket onmessage] External client detected via ${data.type}, setting wsConnected to TRUE`
            );
            setWsConnected(true);
            onWsConnectedChange?.(true);
          } else if (data.type === "focusedTabsUpdate") {
            // Nhận được focusedTabsUpdate từ external client
            console.log(
              `[WebSocket onmessage] External client detected via focusedTabsUpdate, setting wsConnected to TRUE`
            );
            setWsConnected(true);
            onWsConnectedChange?.(true);
          } else {
            console.log(
              `[WebSocket onmessage] Other message type: ${data.type}, verified: ${connectionVerified}`
            );
          }
        } catch (error) {
          console.error(
            `[WebSocket onmessage] Error parsing message on port ${port}:`,
            error
          );
        }
      };

      ws.onclose = () => {
        console.log(
          `[WebSocket onclose] Port ${port}, activePortRef: ${activePortRef.current}, connectionVerified: ${connectionVerified}, currentPort: ${currentPort}`
        );

        // Set false nếu đây là active port (bất kể connectionVerified)
        if (activePortRef.current === currentPort) {
          console.log(
            `[WebSocket onclose] Setting wsConnected to FALSE for port ${port}`
          );
          setWsConnected(false);
          onWsConnectedChange?.(false);
        } else {
          console.log(
            `[WebSocket onclose] NOT setting wsConnected to false - not active port`
          );
        }
      };

      ws.onerror = (error) => {
        console.error(
          `[WebSocket onerror] Port ${port}, activePortRef: ${activePortRef.current}:`,
          error
        );

        // Chỉ set false nếu port này vẫn là active port
        if (activePortRef.current === currentPort) {
          console.log(
            `[WebSocket onerror] Setting wsConnected to FALSE for port ${port}`
          );
          setWsConnected(false);
        }
      };
    } catch (error) {
      console.error(
        `[WebSocket Effect] Failed to connect WebSocket on port ${port}:`,
        error
      );
      if (activePortRef.current === currentPort) {
        setWsConnected(false);
      }
    }

    return () => {
      console.log(
        `[WebSocket cleanup] Cleaning up WebSocket for port ${currentPort}, activePortRef: ${activePortRef.current}`
      );
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
      console.log("Sending message:", message);
      console.log("Using model:", selectedModel);
      console.log("WebSocket server on port:", port);
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
        console.log("Copied to clipboard:", text);
      },
      (err) => {
        console.error("Failed to :", err);
      }
    );
  };

  const handleModelSelect = (modelId: string) => {
    console.log("Model selecting:", modelId);
    setSelectedModel(modelId);
    setShowModelDrawer(false);
    console.log("Model selected:", modelId);
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
