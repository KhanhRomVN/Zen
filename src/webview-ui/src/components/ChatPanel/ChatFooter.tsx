import React, { useState, useRef, useEffect } from "react";

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  content: string; // Base64 hoặc text content
}

interface AgentOptions {
  readProjectFile: boolean;
  readAllFile: boolean;
  editProjectFiles: boolean;
  editAddFile: boolean;
  executeSafeCommand: boolean;
  executeAllCommands: boolean;
}

interface ChatFooterProps {
  onSendMessage: (
    message: string,
    files?: UploadedFile[],
    options?: AgentOptions
  ) => void;
  wsConnected: boolean;
  onWsMessage: (message: any) => void;
  wsInstance?: WebSocket | null;
}

const ChatFooter: React.FC<ChatFooterProps> = ({
  onSendMessage,
  wsConnected,
  onWsMessage,
  wsInstance,
}) => {
  const [message, setMessage] = useState("");
  const [showAtMenu, setShowAtMenu] = useState(false);
  const [showOptionsDrawer, setShowOptionsDrawer] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [options, setOptions] = useState<AgentOptions>(() => {
    const saved = localStorage.getItem("zen-agent-options");
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return {
          readProjectFile: false,
          readAllFile: false,
          editProjectFiles: false,
          editAddFile: false,
          executeSafeCommand: false,
          executeAllCommands: false,
        };
      }
    }
    return {
      readProjectFile: false,
      readAllFile: false,
      editProjectFiles: false,
      editAddFile: false,
      executeSafeCommand: false,
      executeAllCommands: false,
    };
  });
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 🔥 FIX: Dùng useRef để store WebSocket instance (tránh stale closure)
  const wsRef = useRef<WebSocket | null>(null);

  const handleSend = () => {
    if (message.trim() || uploadedFiles.length > 0) {
      // Send permissions update to extension
      const vscodeApi = (window as any).vscodeApi;
      if (vscodeApi) {
        vscodeApi.postMessage({
          command: "updateAgentPermissions",
          permissions: options,
        });
      }

      onSendMessage(message, uploadedFiles, options);
      setMessage("");
      setUploadedFiles([]);
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    }
  };

  // Update ref khi wsInstance thay đổi
  useEffect(() => {
    wsRef.current = wsInstance || null;
  }, [wsInstance]);

  // Listen for messages from ChatPanel - KHÔNG depend on wsInstance
  useEffect(() => {
    const handlePostMessage = (event: MessageEvent) => {
      if (event.data.command === "sendWebSocketMessage") {
        const messageData = event.data.data;
        const ws = wsRef.current;

        console.log(`[ChatFooter] 📤 Attempting to send WebSocket message:`, {
          messageType: messageData.type,
          hasRequestId: !!messageData.requestId,
          requestId: messageData.requestId,
          wsReady: !!(ws && ws.readyState === WebSocket.OPEN),
          wsReadyState: ws?.readyState,
        });

        if (ws && ws.readyState === WebSocket.OPEN) {
          try {
            const messageStr = JSON.stringify(messageData);
            const sendStart = Date.now();
            ws.send(messageStr);
            const sendDuration = Date.now() - sendStart;

            console.log(
              `[ChatFooter] ✅ WebSocket message SENT successfully:`,
              {
                messageType: messageData.type,
                requestId: messageData.requestId,
                sendDuration: `${sendDuration}ms`,
                messageSize: messageStr.length,
              }
            );
          } catch (error) {
            console.error(`[ChatFooter] ❌ Exception in ws.send():`, error);
            console.error(`[ChatFooter] 🔍 Error details:`, {
              errorType:
                error instanceof Error ? error.constructor.name : typeof error,
              errorMessage:
                error instanceof Error ? error.message : String(error),
            });
          }
        } else {
          console.error(`[ChatFooter] ❌ WebSocket not ready:`, {
            hasWs: !!ws,
            readyState: ws?.readyState,
            expectedState: WebSocket.OPEN,
            actualState:
              ws?.readyState === 0
                ? "CONNECTING"
                : ws?.readyState === 1
                ? "OPEN"
                : ws?.readyState === 2
                ? "CLOSING"
                : ws?.readyState === 3
                ? "CLOSED"
                : "UNKNOWN",
          });
        }
      }
    };

    window.addEventListener("message", handlePostMessage);
    return () => {
      window.removeEventListener("message", handlePostMessage);
    };
  }, []); // ✅ Empty dependency - listener không bị stale

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value;
    setMessage(value);

    // Check if user typed "@" at the end
    if (value.endsWith("@")) {
      setShowAtMenu(true);
    } else if (showAtMenu && !value.includes("@")) {
      setShowAtMenu(false);
    }

    // Auto-resize textarea
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(
        textareaRef.current.scrollHeight,
        240
      )}px`;
    }
  };

  const handleAtMenuSelect = (option: string) => {
    setMessage((prev) => prev + option);
    setShowAtMenu(false);
    textareaRef.current?.focus();
  };

  const handleFileSelect = async () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileInputChange = async (
    e: React.ChangeEvent<HTMLInputElement>
  ) => {
    const files = e.target.files;
    if (!files) return;

    const newFiles: UploadedFile[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const reader = new FileReader();

      await new Promise<void>((resolve) => {
        reader.onload = () => {
          const content = reader.result as string;
          newFiles.push({
            id: `file-${Date.now()}-${i}`,
            name: file.name,
            size: file.size,
            type: file.type,
            content: content,
          });
          resolve();
        };

        if (file.type.startsWith("image/")) {
          reader.readAsDataURL(file);
        } else {
          reader.readAsText(file);
        }
      });
    }

    setUploadedFiles((prev) => [...prev, ...newFiles]);

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const removeFile = (fileId: string) => {
    setUploadedFiles((prev) => prev.filter((f) => f.id !== fileId));
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const toggleOption = (key: keyof AgentOptions) => {
    setOptions((prev) => {
      const newOptions = { ...prev, [key]: !prev[key] };
      localStorage.setItem("zen-agent-options", JSON.stringify(newOptions));
      return newOptions;
    });
  };

  const AtIcon = () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M16 8v5a3 3 0 0 0 6 0v-1a10 10 0 1 0-3.92 7.94" />
    </svg>
  );

  const PlusIcon = () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <line x1="12" y1="5" x2="12" y2="19" />
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );

  const SettingsIcon = () => (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="3" />
      <path d="M12 1v6m0 6v6m-9-9h6m6 0h6" />
      <path d="m16.24 7.76 4.24-4.24m-12.96 0 4.24 4.24m0 8.48-4.24 4.24m12.96 0-4.24-4.24" />
    </svg>
  );

  const SendIcon = () => (
    <svg
      width="14"
      height="14"
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

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      if (showAtMenu) {
        const menu = document.querySelector('[data-at-menu="true"]');
        if (menu && !menu.contains(target) && target !== textareaRef.current) {
          setShowAtMenu(false);
        }
      }

      if (showOptionsDrawer) {
        const drawer = document.querySelector('[data-options-drawer="true"]');
        if (drawer && !drawer.contains(target)) {
          setShowOptionsDrawer(false);
        }
      }
    };

    if (showAtMenu || showOptionsDrawer) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showAtMenu, showOptionsDrawer]);

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
      {/* Hidden File Input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: "none" }}
        onChange={handleFileInputChange}
        accept="*/*"
      />

      {/* Uploaded Files Preview */}
      {uploadedFiles.length > 0 && (
        <div
          style={{
            padding: "var(--spacing-sm) var(--spacing-lg)",
            borderTop: "1px solid var(--border-color)",
            backgroundColor: "var(--primary-bg)",
            display: "flex",
            flexWrap: "wrap",
            gap: "var(--spacing-xs)",
            maxHeight: "120px",
            overflowY: "auto",
          }}
        >
          {uploadedFiles.map((file) => (
            <div
              key={file.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--spacing-xs)",
                padding: "var(--spacing-xs) var(--spacing-sm)",
                backgroundColor: "var(--secondary-bg)",
                border: "1px solid var(--border-color)",
                borderRadius: "var(--border-radius)",
                fontSize: "var(--font-size-xs)",
                color: "var(--primary-text)",
              }}
            >
              <span>📎</span>
              <span
                style={{
                  maxWidth: "150px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
                title={file.name}
              >
                {file.name}
              </span>
              <span style={{ color: "var(--secondary-text)" }}>
                ({formatFileSize(file.size)})
              </span>
              <div
                style={{
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "2px",
                }}
                onClick={() => removeFile(file.id)}
              >
                <svg
                  width="12"
                  height="12"
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
          ))}
        </div>
      )}

      {/* Message Input Area */}
      <div
        style={{
          padding: "var(--spacing-md) var(--spacing-lg)",
          borderTop: "1px solid var(--border-color)",
          backgroundColor: "var(--secondary-bg)",
          position: "relative",
        }}
      >
        {/* @ Menu Dropdown */}
        {showAtMenu && (
          <div
            data-at-menu="true"
            style={{
              position: "absolute",
              bottom: "100%",
              left: "var(--spacing-lg)",
              marginBottom: "var(--spacing-xs)",
              backgroundColor: "var(--primary-bg)",
              border: "1px solid var(--border-color)",
              borderRadius: "var(--border-radius)",
              boxShadow: "0 -2px 8px rgba(0, 0, 0, 0.15)",
              zIndex: 1000,
              minWidth: "200px",
            }}
          >
            {[
              "Problems",
              "Terminal",
              "Git Commits",
              "Add Folder",
              "Add File",
            ].map((option) => (
              <div
                key={option}
                style={{
                  padding: "var(--spacing-sm) var(--spacing-md)",
                  cursor: "pointer",
                  transition: "background-color 0.2s",
                  fontSize: "var(--font-size-sm)",
                  color: "var(--primary-text)",
                }}
                onClick={() => handleAtMenuSelect(option)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--hover-bg)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                {option}
              </div>
            ))}
          </div>
        )}

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
              minHeight: "100px",
              maxHeight: "280px",
              padding: "var(--spacing-md)",
              paddingRight: "50px",
              paddingBottom: "40px",
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

          {/* Bottom Action Bar */}
          <div
            style={{
              position: "absolute",
              bottom: "var(--spacing-xs)",
              left: "var(--spacing-sm)",
              right: "var(--spacing-sm)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            {/* Left Icons */}
            <div style={{ display: "flex", gap: "var(--spacing-xs)" }}>
              <div
                style={{
                  cursor: "pointer",
                  padding: "var(--spacing-xs)",
                  borderRadius: "var(--border-radius)",
                  transition: "background-color 0.2s",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--secondary-text)",
                }}
                onClick={() => {
                  setMessage((prev) => prev + "@");
                  setShowAtMenu(true);
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--hover-bg)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <AtIcon />
              </div>

              <div
                style={{
                  cursor: "pointer",
                  padding: "var(--spacing-xs)",
                  borderRadius: "var(--border-radius)",
                  transition: "background-color 0.2s",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--secondary-text)",
                }}
                onClick={handleFileSelect}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--hover-bg)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <PlusIcon />
              </div>
            </div>

            {/* Right Icons */}
            <div style={{ display: "flex", gap: "var(--spacing-xs)" }}>
              <div
                style={{
                  cursor: "pointer",
                  padding: "var(--spacing-xs)",
                  borderRadius: "var(--border-radius)",
                  transition: "background-color 0.2s",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--secondary-text)",
                }}
                onClick={() => setShowOptionsDrawer(true)}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--hover-bg)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <SettingsIcon />
              </div>

              <div
                style={{
                  cursor:
                    message.trim() || uploadedFiles.length > 0
                      ? "pointer"
                      : "not-allowed",
                  opacity: message.trim() || uploadedFiles.length > 0 ? 1 : 0.5,
                  padding: "var(--spacing-xs)",
                  borderRadius: "var(--border-radius)",
                  transition: "background-color 0.2s",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color:
                    message.trim() || uploadedFiles.length > 0
                      ? "var(--accent-text)"
                      : "var(--secondary-text)",
                }}
                onClick={handleSend}
                onMouseEnter={(e) => {
                  if (message.trim() || uploadedFiles.length > 0) {
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
        </div>
      </div>

      {/* Options Drawer */}
      {showOptionsDrawer && (
        <>
          <div
            data-options-drawer="true"
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
              zIndex: 1001,
              boxShadow: "0 -4px 20px rgba(0, 0, 0, 0.15)",
              transform: "translateY(0)",
              animation: "slideUp 0.3s ease-out",
              maxHeight: "60vh",
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
                Agent Options
              </div>
              <div
                style={{
                  cursor: "pointer",
                  padding: "var(--spacing-xs)",
                  borderRadius: "var(--border-radius)",
                  transition: "background-color 0.2s",
                }}
                onClick={() => setShowOptionsDrawer(false)}
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
                gap: "var(--spacing-md)",
              }}
            >
              {(
                Object.entries({
                  readProjectFile: "Read Project Files",
                  readAllFile: "Read All Files",
                  editProjectFiles: "Edit Project Files",
                  editAddFile: "Edit & Add Files",
                  executeSafeCommand: "Execute Safe Commands",
                  executeAllCommands: "Execute All Commands",
                }) as [keyof AgentOptions, string][]
              ).map(([key, label]) => (
                <div
                  key={key}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "var(--spacing-sm) 0",
                  }}
                >
                  <span
                    style={{
                      fontSize: "var(--font-size-md)",
                      color: "var(--primary-text)",
                    }}
                  >
                    {label}
                  </span>
                  <div
                    style={{
                      width: "44px",
                      height: "24px",
                      borderRadius: "12px",
                      backgroundColor: options[key]
                        ? "var(--accent-text)"
                        : "var(--border-color)",
                      position: "relative",
                      cursor: "pointer",
                      transition: "background-color 0.2s",
                    }}
                    onClick={() => toggleOption(key)}
                  >
                    <div
                      style={{
                        width: "20px",
                        height: "20px",
                        borderRadius: "50%",
                        backgroundColor: "white",
                        position: "absolute",
                        top: "2px",
                        left: options[key] ? "22px" : "2px",
                        transition: "left 0.2s",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                      }}
                    />
                  </div>
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
              <div style={{ marginBottom: "var(--spacing-xs)" }}>
                Configure agent permissions and capabilities
              </div>
              <div style={{ fontSize: "10px", color: "var(--accent-text)" }}>
                {Object.values(options).filter(Boolean).length} of 6 options
                enabled
              </div>
            </div>
          </div>

          <div
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0, 0, 0, 0.5)",
              zIndex: 1000,
            }}
            onClick={() => setShowOptionsDrawer(false)}
          />
        </>
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
