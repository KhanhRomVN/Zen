import React from "react";
import { UploadedFile } from "../types";
import ChangesTree from "../../ChangesTree";
import {
  PlusIcon,
  ChevronDownIcon,
  SendIcon,
  SquareTerminalIcon,
} from "./Icons";
import { Check, Cpu, Search, X, Clock, Ban } from "lucide-react";
import { useBackendConnection } from "../../../../context/BackendConnectionContext";
import { LANGUAGES } from "../../../SettingsPanel/LanguageSelector";
import { useSettings } from "../../../../context/SettingsContext";
import QuickSwitchDrawer from "./QuickSwitchDrawer";

interface MessageInputProps {
  message: string;
  setMessage: React.Dispatch<React.SetStateAction<string>>;
  isHistoryMode?: boolean;
  uploadedFiles: UploadedFile[];
  textareaRef: React.RefObject<HTMLTextAreaElement>;
  handleTextareaChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  handleKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => void;
  handlePaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
  handleDragOver: (e: React.DragEvent) => void;
  handleDrop: (e: React.DragEvent) => void;
  setShowAtMenu: (show: boolean) => void;
  handleFileSelect: () => void;
  onOpenProjectStructure: () => void;
  showChangesDropdown: boolean;
  setShowChangesDropdown: (show: boolean) => void;
  messages: any[];
  handleGitCommit: () => void;
  handleSend: (model: any, account: any, thinking?: boolean) => void;
  hasProjectContext: boolean;
  onOpenProjectContext: () => void;
  folderPath?: string | null;
  isConversationStarted?: boolean;
  selectedQuickModel?: {
    providerId: string;
    modelId: string;
    modelName?: string;
    accountId?: string;
    favicon?: string;
    email?: string;
  } | null;
  onQuickModelSelect?: (
    model: {
      providerId: string;
      modelId: string;
      modelName?: string;
      accountId?: string;
      favicon?: string;
      email?: string;
    } | null,
  ) => void;
  currentModel: any;
  setCurrentModel: (model: any) => void;
  currentAccount: any;
  setCurrentAccount: (account: any) => void;
  onToggleTaskDrawer?: () => void;
  hasTaskProgress?: boolean;
  isProcessing?: boolean;
  // 🆕 Stop Generation Props
  isStreaming?: boolean;
  onStopGeneration?: () => void;
  // 🆕 Backup Props
  onToggleBackupDrawer?: () => void;
  hasBackupEvents?: boolean;
  backupEventCount?: number;
  // 🆕 Blacklist Props
  onToggleBlacklistDrawer?: () => void;
  // 🆕 Terminal Props
  onToggleTerminalDrawer?: () => void;
}

const MessageInput: React.FC<MessageInputProps> = ({
  message,
  setMessage,
  isHistoryMode = false,
  uploadedFiles,
  textareaRef,
  handleTextareaChange,
  handleKeyDown,
  handlePaste,
  handleDragOver,
  handleDrop,
  setShowAtMenu,
  handleFileSelect,
  onOpenProjectStructure,
  showChangesDropdown,
  setShowChangesDropdown,
  messages,
  handleGitCommit,
  handleSend,
  hasProjectContext,
  onOpenProjectContext,
  folderPath,
  isConversationStarted,
  selectedQuickModel,
  onQuickModelSelect,
  currentModel,
  setCurrentModel,
  currentAccount,
  setCurrentAccount,
  onToggleTaskDrawer,
  hasTaskProgress,
  isProcessing,
  isStreaming,
  onStopGeneration,
  onToggleBackupDrawer,
  hasBackupEvents,
  backupEventCount,
  onToggleBlacklistDrawer,
  onToggleTerminalDrawer,
}) => {
  const { isConnected, isElaraMismatch } = useBackendConnection();
  const [apiUrl, setApiUrl] = React.useState("http://localhost:8888");
  const [providers, setProviders] = React.useState<any[]>([]);
  const [isLoadingCache, setIsLoadingCache] = React.useState(true);
  const { language: preferredLanguage } = useSettings();
  const pendingAccountIdRef = React.useRef<string | null>(null);

  // 🆕 Quick Model Switcher Logic
  const [isQuickModelDropdownOpen, setIsQuickModelDropdownOpen] =
    React.useState(false);

  // 🆕 Capabilities Logic
  const [thinkingEnabled, setThinkingEnabled] = React.useState(false);

  // Derive current provider config
  const currentProviderConfig = React.useMemo(() => {
    if (!currentModel?.providerId) return null;
    return providers.find(
      (p) =>
        p.provider_id?.toLowerCase() === currentModel.providerId?.toLowerCase(),
    );
  }, [currentModel, providers]);

  const supportsUpload = React.useMemo(() => {
    if (!currentProviderConfig) return false;
    return !!currentProviderConfig.is_upload;
  }, [currentProviderConfig]);

  const supportsThinking = React.useMemo(() => {
    if (!currentModel) return false;
    // Check if model supports thinking (usually inferred from ID or specific config)
    // For DeepSeek R1, it's often implicit or via regex on ID
    // or if the model object has a 'capabilities' field (mocked for now)
    // Assuming DeepSeek Reasoner models contain "reasoner" or "r1"
    const modelId = (currentModel.id || "").toLowerCase();
    const modelName = (currentModel.name || "").toLowerCase();
    return (
      modelId.includes("reasoner") ||
      modelId.includes("r1") ||
      modelName.includes("reasoner") ||
      modelName.includes("r1")
    );
    // TODO: In future, this should come from API model definition
  }, [currentModel]);

  const quickModelDropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        quickModelDropdownRef.current &&
        !quickModelDropdownRef.current.contains(event.target as Node)
      ) {
        setIsQuickModelDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const formatWorkspacePath = (path: string) => {
    if (!path) return "";
    const parts = path.split(/[/\\]/).filter(Boolean);
    if (parts.length <= 5) return path;
    const lastFive = parts.slice(-5).join("/");
    return `../${lastFive}`;
  };

  // ... (rest of the file until rendering)

  // NOTE: Logic to hide dropdowns is applied in the render method below
  // We need to look further down for the return statement to modify the render.
  // Since replace_file_content handles contiguous blocks, I will target the props definition first.

  // Load API URL
  React.useEffect(() => {
    const storage = (window as any).storage;
    if (storage) {
      storage.get("backend-api-url").then((res: any) => {
        if (res?.value) {
          setApiUrl(res.value);
        }
      });
    }
  }, []);

  // Fetch providers function
  const fetchProviders = React.useCallback(async () => {
    try {
      const response = await fetch(`${apiUrl}/v1/providers`);
      const result = await response.json();
      if (result.success) {
        setProviders(result.data.filter((p: any) => p.is_enabled));
      }
    } catch (error) {
      // console.error("Failed to fetch providers:", error);
    }
  }, [apiUrl]);

  // Initial fetch
  React.useEffect(() => {
    fetchProviders();
  }, [fetchProviders]);

  // Load saved selection and language
  React.useEffect(() => {
    const loadSelection = async () => {
      const storage = (window as any).storage;
      if (!storage) {
        setIsLoadingCache(false);
        return;
      }

      setIsLoadingCache(true);
      const key = `zen-model-selection:${folderPath || "global"}`;
      try {
        const [selectionRes] = await Promise.all([storage.get(key)]);

        if (selectionRes?.value) {
          const saved = JSON.parse(selectionRes.value);
          if (saved.model) setCurrentModel(saved.model);
          if (saved.accountId) {
            pendingAccountIdRef.current = saved.accountId;
          }
        }
      } catch (e) {
        // console.error("Failed to load selection", e);
      } finally {
        setIsLoadingCache(false);
      }
    };
    loadSelection();
  }, [folderPath]);

  // Save selection
  React.useEffect(() => {
    if (currentModel) {
      const storage = (window as any).storage;
      if (storage) {
        const key = `zen-model-selection:${folderPath || "global"}`;
        const data = {
          model: currentModel,
          accountId: currentAccount?.id,
        };
        storage.set(key, JSON.stringify(data));
      }
    }
  }, [
    currentModel,
    currentAccount,
    folderPath,
    setCurrentModel,
    setCurrentAccount,
  ]);

  return (
    <div
      style={{
        padding: "var(--spacing-md) var(--spacing-lg)",
        backgroundColor: "var(--secondary-bg)",
        position: "relative",
      }}
    >
      {showChangesDropdown && (
        <ChangesTree
          messages={messages}
          onCommit={handleGitCommit}
          onClose={() => setShowChangesDropdown(false)}
        />
      )}

      {/* 🆕 QUICK SWITCH BADGE (Top-Left) */}
      {selectedQuickModel && (
        <div
          style={{
            position: "absolute",
            top: "-24px",
            left: "8px",
            backgroundColor: "var(--accent-bg-transparent)",
            color: "var(--accent-color)",
            padding: "4px 8px",
            fontSize: "11px",
            fontWeight: 600,
            borderTopLeftRadius: "var(--border-radius)",
            borderTopRightRadius: "var(--border-radius)",
            borderBottomLeftRadius: "0",
            borderBottomRightRadius: "0",
            border: "1px solid var(--accent-color)",
            borderBottom: "none",
            zIndex: 20,
            display: "flex",
            alignItems: "center",
            gap: "6px",
            boxShadow: "0 -2px 4px rgba(0,0,0,0.1)",
          }}
          title="Quick Switch Model is Active"
        >
          {selectedQuickModel.favicon ? (
            <img
              src={selectedQuickModel.favicon}
              alt="favicon"
              style={{
                width: "12px",
                height: "12px",
                borderRadius: "2px",
              }}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <span
              className="codicon codicon-server-process"
              style={{ fontSize: "12px" }}
            />
          )}

          <span
            style={{
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: "150px",
            }}
          >
            {selectedQuickModel.providerId}/{selectedQuickModel.modelId}
          </span>

          {selectedQuickModel.email && (
            <span
              style={{
                opacity: 0.7,
                fontStyle: "italic",
                fontWeight: "normal",
                marginLeft: "2px",
                maxWidth: "120px",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              &lt;{selectedQuickModel.email}&gt;
            </span>
          )}

          <div
            style={{
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              marginLeft: "4px",
              opacity: 0.7,
            }}
            onClick={() => onQuickModelSelect?.(null)}
          >
            <X size={12} strokeWidth={2.5} />
          </div>
        </div>
      )}

      {/* 🆕 HOME PANEL BADGE (Top-Left) - Only when !isConversationStarted */}
      {!isConversationStarted && (
        <div
          onClick={() => setIsQuickModelDropdownOpen(true)}
          style={{
            position: "absolute",
            top: "-28px",
            left: "8px",
            backgroundColor: "var(--input-bg)",
            color: "var(--primary-text)",
            padding: "5px 10px",
            fontSize: "11px",
            fontWeight: 600,
            borderTopLeftRadius: "8px",
            borderTopRightRadius: "8px",
            borderBottomLeftRadius: "0",
            borderBottomRightRadius: "0",
            border: "1px solid var(--border-color)",
            borderBottom: "none",
            zIndex: 20,
            display: "flex",
            alignItems: "center",
            gap: "8px",
            cursor: "pointer",
            boxShadow: "0 -2px 6px rgba(0,0,0,0.1)",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--hover-bg)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "var(--input-bg)";
          }}
          title="Click to select Model and Account"
        >
          {currentModel ? (
            <>
              {currentModel.favicon ? (
                <img
                  src={currentModel.favicon}
                  alt="favicon"
                  style={{
                    width: "12px",
                    height: "12px",
                    borderRadius: "2px",
                  }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : (
                <span
                  className="codicon codicon-server-process"
                  style={{ fontSize: "12px" }}
                />
              )}
              {currentModel.providerId}/{currentModel.id}
              {currentAccount?.email && (
                <span
                  style={{
                    opacity: 0.8,
                    fontStyle: "italic",
                    marginLeft: "2px",
                  }}
                >
                  &lt;{currentAccount.email}&gt;
                </span>
              )}
              <ChevronDownIcon size={12} />
            </>
          ) : (
            <>
              <span
                className="codicon codicon-server-process"
                style={{ fontSize: "12px" }}
              />
              Select Model
              <ChevronDownIcon size={12} />
            </>
          )}
        </div>
      )}

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          position: "relative",
          borderRadius: "var(--border-radius)",
          border: !isConnected ? "1px solid #f44336" : "1px solid transparent",
          transition: "border 0.3s ease",
        }}
      >
        <div
          style={{
            position: "relative",
            backgroundColor: "var(--input-bg)",
            borderTopLeftRadius: "var(--border-radius)",
            borderTopRightRadius: "var(--border-radius)",
            padding: "12px",
          }}
        >
          <style>{`
          .custom-scrollbar::-webkit-scrollbar {
            width: 6px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background-color: var(--scrollbar-thumb);
            border-radius: 10px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background-color: var(--scrollbar-thumb-hover);
          }
        `}</style>

          <textarea
            ref={textareaRef}
            value={message}
            onChange={handleTextareaChange}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (!currentModel) {
                  setIsQuickModelDropdownOpen(true);
                  if (providers.length === 0) fetchProviders();
                  return;
                }
                handleSend(currentModel, currentAccount, thinkingEnabled);
              } else {
                handleKeyDown(e);
              }
            }}
            onPaste={(e) => {
              if (!supportsUpload && e.clipboardData.files.length > 0) {
                e.preventDefault();
                // Optional: Show toast "Upload not supported by this provider"
                return;
              }
              handlePaste(e);
            }}
            onDragOver={handleDragOver}
            onDrop={(e) => {
              if (!supportsUpload) {
                e.preventDefault();
                return;
              }
              handleDrop(e);
            }}
            onFocus={(e) => {
              e.target.style.border = "none";
              e.target.style.boxShadow = "none";
            }}
            placeholder={
              isHistoryMode
                ? "History mode - sending messages is disabled"
                : !isConnected
                  ? "Đang lỗi kết nối với backend..."
                  : isLoadingCache
                    ? "Đang tải dữ liệu từ cache..."
                    : isProcessing
                      ? "Assistant is thinking..."
                      : "Type @ to mention files, folders, or rules..."
            }
            disabled={
              isHistoryMode || !isConnected || isLoadingCache || isProcessing
            }
            rows={1}
            style={{
              width: "100%",
              minHeight: "24px",
              maxHeight: "240px",
              border: "none",
              outline: "none",
              resize: "none",
              fontFamily: "inherit",
              fontSize: "var(--font-size-sm)",
              backgroundColor: "transparent",
              color: "var(--primary-text)",
              overflow: "auto",
              opacity:
                isHistoryMode || !isConnected || isLoadingCache || isProcessing
                  ? 0.6
                  : 1,
              cursor:
                isHistoryMode || !isConnected || isLoadingCache || isProcessing
                  ? "not-allowed"
                  : "text",
            }}
          />
        </div>

        {/* Bottom Part: Toolbar */}
        <div
          style={{
            backgroundColor: "var(--input-bg)",
            borderBottomLeftRadius: "var(--border-radius)",
            borderBottomRightRadius: "var(--border-radius)",
            padding: "8px 12px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          {/* Left Icons */}
          <div style={{ display: "flex", gap: "var(--spacing-xs)" }}>
            {supportsUpload && (
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
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = "var(--hover-bg)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = "transparent")
                }
                title="Attach files"
              >
                <PlusIcon />
              </div>
            )}

            {/* Task Progress Toggle */}
            {isConversationStarted && hasTaskProgress && (
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
                onClick={onToggleTaskDrawer}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = "var(--hover-bg)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = "transparent")
                }
                title="Task Progress"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M13 5h8" />
                  <path d="M13 12h8" />
                  <path d="M13 19h8" />
                  <path d="m3 17 2 2 4-4" />
                  <rect x="3" y="4" width="6" height="6" rx="1" />
                </svg>
              </div>
            )}

            {/* Backup History Toggle */}
            {isConversationStarted && onToggleBackupDrawer && (
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
                  position: "relative",
                }}
                onClick={onToggleBackupDrawer}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = "var(--hover-bg)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = "transparent")
                }
                title="Code Backup History"
              >
                <Clock size={16} />
                {hasBackupEvents &&
                  backupEventCount &&
                  backupEventCount > 0 && (
                    <div
                      style={{
                        position: "absolute",
                        top: -2,
                        right: -2,
                        width: 8,
                        height: 8,
                        borderRadius: "50%",
                        backgroundColor: "var(--accent-color)",
                      }}
                    />
                  )}
              </div>
            )}

            {/* 🆕 Backup Blacklist Toggle */}
            {onToggleBlacklistDrawer && (
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
                onClick={onToggleBlacklistDrawer}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = "var(--hover-bg)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = "transparent")
                }
                title="Backup Blacklist"
              >
                <Ban size={16} />
              </div>
            )}

            {/* Thinking Mode Toggle */}
            {supportsThinking && (
              <div
                style={{
                  cursor: "pointer",
                  padding: "var(--spacing-xs)",
                  borderRadius: "var(--border-radius)",
                  transition: "background-color 0.2s",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: thinkingEnabled
                    ? "var(--accent-color)"
                    : "var(--secondary-text)",
                  backgroundColor: thinkingEnabled
                    ? "var(--accent-bg-transparent)"
                    : "transparent",
                }}
                onClick={() => setThinkingEnabled(!thinkingEnabled)}
                onMouseEnter={(e) => {
                  if (!thinkingEnabled)
                    e.currentTarget.style.backgroundColor = "var(--hover-bg)";
                }}
                onMouseLeave={(e) => {
                  if (!thinkingEnabled)
                    e.currentTarget.style.backgroundColor = "transparent";
                }}
                title={
                  thinkingEnabled ? "Thinking Mode On" : "Thinking Mode Off"
                }
              >
                <div style={{ position: "relative" }}>
                  <Cpu size={16} />
                  {thinkingEnabled && (
                    <div
                      style={{
                        position: "absolute",
                        bottom: -2,
                        right: -2,
                        width: 6,
                        height: 6,
                        borderRadius: "50%",
                        backgroundColor: "var(--accent-color)",
                        border: "1px solid var(--input-bg)",
                      }}
                    />
                  )}
                </div>
              </div>
            )}

            {/* 🆕 Terminal Drawer Toggle */}
            {onToggleTerminalDrawer && (
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
                onClick={onToggleTerminalDrawer}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = "var(--hover-bg)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = "transparent")
                }
                title="Manage Terminals"
              >
                <SquareTerminalIcon size={16} />
              </div>
            )}

            {/* Quick Model Switcher (CPU Icon) */}
            {isConversationStarted && onQuickModelSelect && (
              <div
                style={{
                  cursor: "pointer",
                  padding: "var(--spacing-xs)",
                  borderRadius: "var(--border-radius)",
                  transition: "background-color 0.2s",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: selectedQuickModel
                    ? "var(--accent-color)"
                    : "var(--secondary-text)",
                  backgroundColor: selectedQuickModel
                    ? "var(--accent-bg-transparent)"
                    : "transparent",
                }}
                onClick={() => setIsQuickModelDropdownOpen(true)}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = selectedQuickModel
                    ? "var(--accent-bg-transparent-hover)"
                    : "var(--hover-bg)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = selectedQuickModel
                    ? "var(--accent-bg-transparent)"
                    : "transparent")
                }
                title="Quick Switch Model"
              >
                <Cpu size={16} />
              </div>
            )}
          </div>

          {/* Right Icons */}
          <div style={{ display: "flex", gap: "var(--spacing-xs)" }}>
            {/* Send / Stop Button */}
            <div
              style={{
                cursor:
                  isHistoryMode || isLoadingCache
                    ? "not-allowed"
                    : isStreaming
                      ? "pointer"
                      : message.trim() || uploadedFiles.length > 0
                        ? "pointer"
                        : "default",
                padding: "var(--spacing-xs)",
                borderRadius: "var(--border-radius)",
                transition: "background-color 0.2s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color:
                  isHistoryMode || isLoadingCache
                    ? "var(--secondary-text)"
                    : isStreaming
                      ? "#f44336" // Red color for stop
                      : message.trim() || uploadedFiles.length > 0
                        ? "var(--accent-text)"
                        : "var(--secondary-text)",
                pointerEvents:
                  isHistoryMode || isLoadingCache ? "none" : "auto",
              }}
              onClick={() => {
                if (isStreaming && onStopGeneration) {
                  // Stop generation
                  onStopGeneration();
                  return;
                }

                if (!currentModel) {
                  // Alert user or show dropdown
                  setIsQuickModelDropdownOpen(true);
                  if (providers.length === 0) fetchProviders();
                  return;
                }
                handleSend(currentModel, currentAccount);
              }}
              onMouseEnter={(e) => {
                if (isStreaming || message.trim() || uploadedFiles.length > 0) {
                  e.currentTarget.style.backgroundColor = "var(--hover-bg)";
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
              title={isStreaming ? "Stop Generation" : "Send Message"}
            >
              {isStreaming ? <X size={16} strokeWidth={2.5} /> : <SendIcon />}
            </div>
          </div>
        </div>

        {/* Language Badge */}
        {isConnected &&
          !isElaraMismatch &&
          LANGUAGES.some((l) => l.code === preferredLanguage) && (
            <div
              style={{
                position: "absolute",
                top: "8px",
                right: "8px",
                backgroundColor: "var(--vscode-badge-background)",
                color: "var(--vscode-badge-foreground)",
                padding: "2px 6px",
                borderRadius: "4px",
                fontSize: "10px",
                fontWeight: 600,
                display: "flex",
                alignItems: "center",
                gap: "4px",
                zIndex: 5,
                opacity: 0.8,
                pointerEvents: "none",
              }}
            >
              <span>
                {LANGUAGES.find((l: any) => l.code === preferredLanguage)
                  ?.flag || "🇺🇸"}{" "}
                {preferredLanguage.toUpperCase()}
              </span>
            </div>
          )}

        {/* Health / Elara Badges */}
        {!isConnected && (
          <div
            style={{
              position: "absolute",
              top: "-24px",
              right: "8px",
              backgroundColor: "rgba(244, 67, 54, 0.1)",
              color: "#f44336",
              padding: "4px 12px",
              fontSize: "11px",
              fontWeight: 600,
              borderTopLeftRadius: "var(--border-radius)",
              borderTopRightRadius: "var(--border-radius)",
              borderBottomLeftRadius: "0",
              borderBottomRightRadius: "0",
              cursor: "pointer",
              zIndex: 20,
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
            onClick={() => {
              // Open Settings Panel
              window.postMessage({ command: "showSettings" }, "*");
            }}
          >
            Connection Error
          </div>
        )}
        {isConnected && isElaraMismatch && (
          <div
            style={{
              position: "absolute",
              top: "-24px",
              right: "8px",
              backgroundColor: "rgba(255, 152, 0, 0.1)",
              color: "#ff9800",
              padding: "4px 12px",
              fontSize: "11px",
              fontWeight: 600,
              borderTopLeftRadius: "var(--border-radius)",
              borderTopRightRadius: "var(--border-radius)",
              borderBottomLeftRadius: "0",
              borderBottomRightRadius: "0",
              cursor: "pointer",
              zIndex: 20,
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
            onClick={() => {
              const vscodeApi = (window as any).vscodeApi;
              if (vscodeApi) {
                vscodeApi.postMessage({
                  command: "openExternal",
                  url: "https://github.com/KhanhRomVN/Elara",
                });
              }
            }}
          >
            Elara Version Mismatch
          </div>
        )}
      </div>
      <div ref={quickModelDropdownRef}>
        <QuickSwitchDrawer
          isOpen={isQuickModelDropdownOpen}
          onClose={() => setIsQuickModelDropdownOpen(false)}
          providers={providers}
          apiUrl={apiUrl}
          onSelect={(selected) => {
            // Find provider and model to extract name and favicon
            const prov = providers.find(
              (p: any) => p.provider_id === selected.providerId,
            );
            const modelObj = prov?.models?.find(
              (m: any) => m.id === selected.modelId,
            );
            const modelName = modelObj?.name || selected.modelId;

            let faviconUrl = "";
            if (prov?.website) {
              try {
                const u = new URL(prov.website);
                faviconUrl = `${u.origin}/favicon.ico`;
              } catch {
                // ignore
              }
            }

            if (
              !isConversationStarted &&
              setCurrentModel &&
              setCurrentAccount
            ) {
              setCurrentModel({
                ...selected,
                id: selected.modelId,
                name: modelName,
                favicon: faviconUrl,
              });
              setCurrentAccount({
                id: selected.accountId,
                email: selected.email,
              });
            } else if (onQuickModelSelect) {
              onQuickModelSelect({
                ...selected,
                modelName: modelName,
                email: selected.email,
                favicon: faviconUrl,
              });
            }
          }}
        />
      </div>
    </div>
  );
};

export default MessageInput;
