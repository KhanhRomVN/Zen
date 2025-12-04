import React, { useState, useRef, useEffect } from "react";

const ChatInput: React.FC = () => {
  const [message, setMessage] = useState("");
  const [rows, setRows] = useState(3);
  const [selectedModel, setSelectedModel] = useState("gpt-4");
  const [port, setPort] = useState(3000);
  const [showModelDrawer, setShowModelDrawer] = useState(false);
  const [isPortChecking, setIsPortChecking] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const MIN_ROWS = 3;
  const MAX_ROWS = 10;

  const availableModels = [
    { id: "gpt-4", name: "GPT-4" },
    { id: "gpt-3.5-turbo", name: "GPT-3.5 Turbo" },
    { id: "claude-3", name: "Claude 3" },
    { id: "gemini-pro", name: "Gemini Pro" },
    { id: "llama-3", name: "Llama 3" },
  ];

  const checkPortAvailability = async (port: number): Promise<boolean> => {
    try {
      console.log("Checking port " + port + " availability...");

      const commonlyUsedPorts = [
        3000, 3001, 3002, 3003, 3004, 3005, 3006, 8080, 8081,
      ];

      if (commonlyUsedPorts.includes(port)) {
        console.log("Port " + port + " might be in use (commonly used port)");
        return false;
      }

      await new Promise((resolve) => setTimeout(resolve, 100));
      console.log("Port " + port + " appears to be available");
      return true;
    } catch (error) {
      console.error("Error checking port:", error);
      return false;
    }
  };

  const generateRandomPort = async () => {
    setIsPortChecking(true);
    const min = 3000;
    const max = 9999;
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      const newPort = Math.floor(Math.random() * (max - min + 1)) + min;
      console.log("Attempt " + (attempts + 1) + ": Trying port " + newPort);

      const isAvailable = await checkPortAvailability(newPort);

      if (isAvailable) {
        setPort(newPort);
        console.log("Port " + newPort + " selected and available");
        setIsPortChecking(false);
        return;
      }

      attempts++;
      console.log("Port " + newPort + " not available, trying again...");
    }

    const fallbackPort = 9999;
    setPort(fallbackPort);
    console.log(
      "Could not find available port after " +
        maxAttempts +
        " attempts, using fallback: " +
        fallbackPort
    );
    setIsPortChecking(false);
  };

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

  const CopyIcon = () => (
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

  const copyPortToClipboard = () => {
    const text = "localhost:" + port;
    navigator.clipboard.writeText(text).then(
      () => {
        console.log("Copied to clipboard:", text);
      },
      (err) => {
        console.error("Failed to copy:", err);
      }
    );
  };

  const handleModelSelect = (modelId: string) => {
    setSelectedModel(modelId);
    setShowModelDrawer(false);
    console.log("Model selected:", modelId);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (showModelDrawer) {
        setShowModelDrawer(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showModelDrawer]);

  return (
    <div style={{ display: "flex", flexDirection: "column", width: "100%" }}>
      <form
        className="chat-input-form"
        onSubmit={handleSubmit}
        style={{
          position: "relative",
          width: "100%",
          padding: "var(--spacing-md) var(--spacing-lg) 60px var(--spacing-lg)",
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
              minHeight: MIN_ROWS * 20 + "px",
              maxHeight: MAX_ROWS * 20 + "px",
              resize: "none",
              padding:
                "var(--spacing-md) var(--spacing-lg) 40px var(--spacing-lg)",
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
            onClick={copyPortToClipboard}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--hover-bg)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <CopyIcon />
            <span>localhost:{port}</span>
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
            onClick={generateRandomPort}
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
            zIndex: 1000,
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

      <div
        style={{
          fontSize: "var(--font-size-xs)",
          color: "var(--secondary-text)",
          textAlign: "center",
          padding: "0 var(--spacing-sm) var(--spacing-sm) var(--spacing-sm)",
          backgroundColor: "var(--secondary-bg)",
        }}
      >
        Press Enter to send • Shift+Enter for new line
      </div>

      {showModelDrawer && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            zIndex: 999,
          }}
          onClick={() => setShowModelDrawer(false)}
        />
      )}

      <style>
        {`@keyframes slideUp {
          from {
            transform: translateY(100%);
          }re
          to {
            transform: translateY(0);
          }
        }`}
      </style>
    </div>
  );
};

export default ChatInput;
