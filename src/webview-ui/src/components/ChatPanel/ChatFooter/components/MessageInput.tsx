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
    accountId?: string;
  } | null;
  onQuickModelSelect?: (
    model: { providerId: string; modelId: string; accountId?: string } | null,
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
  const [accounts, setAccounts] = React.useState<any[]>([]);
  // const [selectedModel, setSelectedModel] = React.useState<any>(null); // Replaced by props
  // const [selectedAccount, setSelectedAccount] = React.useState<any>(null); // Replaced by props
  const [showModelDropdown, setShowModelDropdown] = React.useState(false);
  const [showAccountDropdown, setShowAccountDropdown] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const pendingAccountIdRef = React.useRef<string | null>(null);
  const [isLoadingCache, setIsLoadingCache] = React.useState(true);
  const { language: preferredLanguage } = useSettings();

  // 🆕 Capabilities Logic
  const [thinkingEnabled, setThinkingEnabled] = React.useState(false);

  // Derive current provider config
  const currentProviderConfig = React.useMemo(() => {
    if (!currentModel) return null;
    return providers.find(
      (p) =>
        p.provider_id.toLowerCase() === currentModel.providerId.toLowerCase(),
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
    const modelId = currentModel.id.toLowerCase();
    const modelName = currentModel.name.toLowerCase();
    return (
      modelId.includes("reasoner") ||
      modelId.includes("r1") ||
      modelName.includes("reasoner") ||
      modelName.includes("r1")
    );
    // TODO: In future, this should come from API model definition
  }, [currentModel]);

  // 🆕 Quick Model Switcher Logic
  const [isQuickModelDropdownOpen, setIsQuickModelDropdownOpen] =
    React.useState(false);
  const [modelSearch, setModelSearch] = React.useState("");
  const quickModelDropdownRef = React.useRef<HTMLDivElement>(null);
  const modelSelectorRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        quickModelDropdownRef.current &&
        !quickModelDropdownRef.current.contains(event.target as Node)
      ) {
        setIsQuickModelDropdownOpen(false);
      }
      if (
        modelSelectorRef.current &&
        !modelSelectorRef.current.contains(event.target as Node)
      ) {
        setShowModelDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const allModels = React.useMemo(() => {
    return (providers || []).flatMap((provider) =>
      (provider.models || []).map((m: any) => {
        // Find default account for this provider
        const defaultAccount = accounts.find(
          (acc) =>
            acc.provider_id.toLowerCase() ===
            provider.provider_id.toLowerCase(),
        );

        return {
          ...m,
          providerId: provider.provider_id,
          providerName: provider.provider_name || provider.provider_id,
          accountId: defaultAccount?.id,
          favicon: provider.website
            ? `https://www.google.com/s2/favicons?domain=${new URL(provider.website).hostname}&sz=64`
            : null,
        };
      }),
    );
  }, [providers, accounts]);

  const filteredModels = React.useMemo(() => {
    return allModels.filter(
      (m) =>
        m.name.toLowerCase().includes(modelSearch.toLowerCase()) ||
        m.providerName.toLowerCase().includes(modelSearch.toLowerCase()),
    );
  }, [allModels, modelSearch]);

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

  // Fetch accounts when model/provider changes
  React.useEffect(() => {
    if (!currentModel) {
      setAccounts([]);
      setCurrentAccount(null);
      return;
    }

    const fetchAccounts = async () => {
      try {
        const response = await fetch(
          `${apiUrl}/v1/accounts?page=1&limit=50&provider_id=${currentModel.providerId}`,
        );
        const result = await response.json();
        if (result.success) {
          const accs = result.data.accounts;
          setAccounts(accs);

          // Auto-select pending account or first one
          if (pendingAccountIdRef.current) {
            const found = accs.find(
              (a: any) => a.id === pendingAccountIdRef.current,
            );
            if (found) {
              setCurrentAccount(found);
            } else if (accs.length > 0) {
              setCurrentAccount(accs[0]);
            }
            pendingAccountIdRef.current = null;
          } else if (accs.length > 0) {
            // Only set default if no account is currently selected (or we just switched models)
            setCurrentAccount(accs[0]);
          }
        }
      } catch (error) {
        // console.error("Failed to fetch accounts:", error);
      }
    };
    fetchAccounts();
  }, [currentModel, apiUrl, setCurrentAccount]);

  // Group models by provider based on search
  const groupedModels = React.useMemo(() => {
    const groups: any[] = [];
    providers.forEach((provider) => {
      const providerModels =
        provider.models?.filter((model: any) =>
          model.name.toLowerCase().includes(searchQuery.toLowerCase()),
        ) || [];

      if (
        providerModels.length > 0 ||
        provider.provider_name.toLowerCase().includes(searchQuery.toLowerCase())
      ) {
        // If provider name matches, include all its models (or filtered ones)
        const modelsToShow =
          providerModels.length > 0 ? providerModels : provider.models || [];
        const getFavicon = (url: string) => {
          try {
            const domain = new URL(url).hostname;
            return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
          } catch {
            return "";
          }
        };

        const providerFavicon = getFavicon(provider.website);

        groups.push({
          providerId: provider.provider_id,
          providerName: provider.provider_name,
          favicon: providerFavicon,
          models: modelsToShow.map((m: any) => ({
            ...m,
            providerId: provider.provider_id,
            providerName: provider.provider_name,
            favicon: providerFavicon,
          })),
        });
      }
    });
    return groups;
  }, [providers, searchQuery, apiUrl]);

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
                  setShowModelDropdown(true);
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
              <div style={{ position: "relative" }} ref={quickModelDropdownRef}>
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
                      ? "var(--accent-color)" // Highlight if active
                      : "var(--secondary-text)",
                    backgroundColor: selectedQuickModel
                      ? "var(--accent-bg-transparent)" // Subtle bg if active
                      : "transparent",
                  }}
                  onClick={() => {
                    if (selectedQuickModel) {
                      onQuickModelSelect(null);
                      setIsQuickModelDropdownOpen(false);
                    } else {
                      setIsQuickModelDropdownOpen(!isQuickModelDropdownOpen);
                      if (!isQuickModelDropdownOpen) setModelSearch("");
                    }
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = selectedQuickModel
                      ? "var(--accent-bg-transparent-hover)"
                      : "var(--hover-bg)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = selectedQuickModel
                      ? "var(--accent-bg-transparent)"
                      : "transparent";
                  }}
                  title={
                    selectedQuickModel
                      ? "Quick Model Active (Click to Reset)"
                      : "Quick Switch Model"
                  }
                >
                  <Cpu size={16} />
                </div>

                {/* Dropdown */}
                {isQuickModelDropdownOpen && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: "100%",
                      left: "0",
                      marginBottom: "8px",
                      backgroundColor: "var(--vscode-editor-background)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "8px",
                      padding: "0",
                      width: "280px",
                      maxHeight: "360px",
                      overflow: "hidden",
                      display: "flex",
                      flexDirection: "column",
                      boxShadow: "0 8px 16px rgba(0,0,0,0.3)",
                      zIndex: 1000,
                    }}
                  >
                    {/* Search */}
                    <div
                      style={{
                        padding: "8px",
                        borderBottom: "1px solid var(--border-color)",
                      }}
                    >
                      <div
                        style={{
                          position: "relative",
                          display: "flex",
                          alignItems: "center",
                        }}
                      >
                        <Search
                          size={12}
                          style={{
                            position: "absolute",
                            left: "8px",
                            color: "var(--secondary-text)",
                          }}
                        />
                        <input
                          autoFocus
                          type="text"
                          placeholder="Search models..."
                          value={modelSearch}
                          onChange={(e) => setModelSearch(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "6px 8px 6px 24px",
                            borderRadius: "4px",
                            border: "1px solid var(--border-color)",
                            backgroundColor: "var(--input-bg)",
                            color: "var(--primary-text)",
                            fontSize: "12px",
                            outline: "none",
                          }}
                        />
                      </div>
                    </div>

                    <div
                      className="custom-scrollbar"
                      style={{ overflowY: "auto", flex: 1, padding: "4px" }}
                    >
                      {selectedQuickModel && (
                        <div
                          style={{
                            padding: "8px",
                            cursor: "pointer",
                            color: "var(--vscode-errorForeground)",
                            fontSize: "12px",
                            fontWeight: 600,
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            borderRadius: "4px",
                          }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.backgroundColor =
                              "var(--hover-bg)")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.backgroundColor =
                              "transparent")
                          }
                          onClick={() => {
                            onQuickModelSelect(null);
                            setIsQuickModelDropdownOpen(false);
                          }}
                        >
                          <X size={14} />
                          Reset to Default Model
                        </div>
                      )}

                      {filteredModels.length > 0 ? (
                        // Group by Provider
                        Array.from(
                          new Set(filteredModels.map((m) => m.providerId)),
                        ).map((providerId) => (
                          <div key={providerId} style={{ marginBottom: "4px" }}>
                            <div
                              style={{
                                padding: "4px 8px",
                                fontSize: "10px",
                                fontWeight: 700,
                                color: "var(--secondary-text)",
                                textTransform: "uppercase",
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                              }}
                            >
                              {filteredModels.find(
                                (m) => m.providerId === providerId,
                              )?.favicon && (
                                <img
                                  src={
                                    filteredModels.find(
                                      (m) => m.providerId === providerId,
                                    )!.favicon!
                                  }
                                  style={{ width: "12px", height: "12px" }}
                                  alt=""
                                />
                              )}
                              {
                                filteredModels.find(
                                  (m) => m.providerId === providerId,
                                )?.providerName
                              }
                            </div>
                            {filteredModels
                              .filter((m) => m.providerId === providerId)
                              .map((model) => (
                                <div
                                  key={`${model.providerId}-${model.id}`}
                                  style={{
                                    padding: "6px 8px 6px 24px",
                                    cursor: "pointer",
                                    fontSize: "12px",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "space-between",
                                    borderRadius: "4px",
                                    backgroundColor:
                                      selectedQuickModel?.modelId === model.id
                                        ? "var(--hover-bg)"
                                        : "transparent",
                                    color:
                                      selectedQuickModel?.modelId === model.id
                                        ? "var(--accent-color)"
                                        : "var(--primary-text)",
                                  }}
                                  onClick={() => {
                                    onQuickModelSelect({
                                      providerId: model.providerId,
                                      modelId: model.id,
                                      accountId: model.accountId, // Helper logic picked default account
                                    });
                                    setIsQuickModelDropdownOpen(false);
                                  }}
                                  onMouseEnter={(e) => {
                                    if (
                                      selectedQuickModel?.modelId !== model.id
                                    )
                                      e.currentTarget.style.backgroundColor =
                                        "var(--hover-bg)";
                                  }}
                                  onMouseLeave={(e) => {
                                    if (
                                      selectedQuickModel?.modelId !== model.id
                                    )
                                      e.currentTarget.style.backgroundColor =
                                        "transparent";
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      flexDirection: "column",
                                    }}
                                  >
                                    <span>{model.name}</span>
                                  </div>
                                  {selectedQuickModel?.modelId === model.id && (
                                    <Check size={14} />
                                  )}
                                </div>
                              ))}
                          </div>
                        ))
                      ) : (
                        <div
                          style={{
                            padding: "12px",
                            textAlign: "center",
                            color: "var(--secondary-text)",
                            fontSize: "12px",
                          }}
                        >
                          No models found
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Model Selector Badge */}
            {!isConversationStarted && isConnected && (
              <div style={{ position: "relative" }} ref={modelSelectorRef}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "4px 8px",
                    backgroundColor: "transparent",
                    borderRadius: "6px",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "var(--primary-text)",
                    transition: "all 0.2s",
                  }}
                  onClick={() => {
                    if (!showModelDropdown && providers.length === 0) {
                      fetchProviders();
                    }
                    setShowModelDropdown(!showModelDropdown);
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--hover-bg)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  {currentModel ? (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        marginTop: "1px", // Nhích xuống 1 chút
                      }}
                    >
                      <img
                        src={currentModel.favicon}
                        alt=""
                        style={{ width: "12px", height: "12px" }}
                        onError={(e) =>
                          (e.currentTarget.style.display = "none")
                        }
                      />
                      <span>{currentModel.name}</span>
                    </div>
                  ) : (
                    <span>Select model</span>
                  )}
                  <ChevronDownIcon size={12} />
                </div>

                {showModelDropdown && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: "100%",
                      left: "0",
                      marginBottom: "8px",
                      backgroundColor: "var(--vscode-editor-background)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "8px",
                      padding: "8px 0",
                      minWidth: "240px",
                      maxHeight: "360px",
                      overflow: "hidden",
                      display: "flex",
                      flexDirection: "column",
                      boxShadow: "0 8px 16px rgba(0,0,0,0.3)",
                      zIndex: 1000,
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Search Bar */}
                    <div style={{ padding: "0 8px 8px 8px" }}>
                      <input
                        type="text"
                        placeholder="Search models..."
                        autoFocus
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "6px 10px",
                          backgroundColor: "var(--input-bg)",
                          border: "1px solid var(--border-color)",
                          borderRadius: "4px",
                          color: "var(--primary-text)",
                          fontSize: "12px",
                          outline: "none",
                        }}
                      />
                    </div>

                    {/* Models List */}
                    <div style={{ overflowY: "auto", flex: 1 }}>
                      {groupedModels.length > 0 ? (
                        groupedModels.map((group) => (
                          <div key={group.providerId}>
                            {/* Provider Header */}
                            <div
                              style={{
                                padding: "8px 12px 4px 12px",
                                fontSize: "10px",
                                fontWeight: 700,
                                color: "var(--secondary-text)",
                                textTransform: "uppercase",
                                letterSpacing: "0.5px",
                                display: "flex",
                                alignItems: "center",
                                gap: "6px",
                                opacity: 0.8,
                              }}
                            >
                              <img
                                src={group.favicon}
                                alt=""
                                style={{ width: "10px", height: "10px" }}
                                onError={(e) =>
                                  (e.currentTarget.style.display = "none")
                                }
                              />
                              {group.providerName}
                            </div>

                            {/* Models in Group */}
                            {group.models.map((model: any) => (
                              <div
                                key={`${model.providerId}-${model.id}`}
                                style={{
                                  padding: "8px 12px 8px 24px",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "8px",
                                  cursor: "pointer",
                                  backgroundColor:
                                    currentModel?.id === model.id &&
                                    currentModel?.providerId ===
                                      model.providerId
                                      ? "var(--hover-bg)"
                                      : "transparent",
                                }}
                                onClick={() => {
                                  setCurrentModel(model);
                                  setShowModelDropdown(false);
                                  setSearchQuery("");
                                }}
                                onMouseEnter={(e) =>
                                  (e.currentTarget.style.backgroundColor =
                                    "var(--hover-bg)")
                                }
                                onMouseLeave={(e) => {
                                  if (
                                    currentModel?.id !== model.id ||
                                    currentModel?.providerId !==
                                      model.providerId
                                  ) {
                                    e.currentTarget.style.backgroundColor =
                                      "transparent";
                                  }
                                }}
                              >
                                <div
                                  style={{
                                    fontSize: "12px",
                                    fontWeight: 500,
                                    color: "var(--primary-text)",
                                  }}
                                >
                                  {model.name}
                                </div>
                              </div>
                            ))}
                          </div>
                        ))
                      ) : (
                        <div
                          style={{
                            padding: "20px",
                            textAlign: "center",
                            fontSize: "12px",
                            color: "var(--secondary-text)",
                          }}
                        >
                          No models found
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Account Selector Badge (Only if model selected and provider has accounts) */}
            {!isConversationStarted && currentModel && accounts.length > 0 && (
              <div style={{ position: "relative" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "4px 8px",
                    backgroundColor: "transparent",
                    borderRadius: "6px",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "var(--primary-text)",
                    transition: "all 0.2s",
                  }}
                  onClick={() => setShowAccountDropdown(!showAccountDropdown)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = "var(--hover-bg)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }}
                >
                  <span
                    style={{
                      maxWidth: "120px",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      marginTop: "1px", // Nhích xuống 1 chút
                    }}
                  >
                    {currentAccount?.email || "Select account"}
                  </span>
                  <ChevronDownIcon size={12} />
                </div>

                {showAccountDropdown && (
                  <div
                    style={{
                      position: "absolute",
                      bottom: "100%",
                      left: "0",
                      marginBottom: "8px",
                      backgroundColor: "var(--vscode-editor-background)",
                      border: "1px solid var(--border-color)",
                      borderRadius: "8px",
                      padding: "8px 0",
                      minWidth: "180px",
                      boxShadow: "0 8px 16px rgba(0,0,0,0.3)",
                      zIndex: 1000,
                    }}
                  >
                    {accounts.map((acc) => (
                      <div
                        key={acc.id}
                        style={{
                          padding: "8px 12px",
                          fontSize: "12px",
                          cursor: "pointer",
                          color: "var(--primary-text)",
                          backgroundColor:
                            currentAccount?.id === acc.id
                              ? "var(--hover-bg)"
                              : "transparent",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                        onClick={() => {
                          setCurrentAccount(acc);
                          setShowAccountDropdown(false);
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.backgroundColor =
                            "var(--hover-bg)")
                        }
                        onMouseLeave={(e) => {
                          if (currentAccount?.id !== acc.id) {
                            e.currentTarget.style.backgroundColor =
                              "transparent";
                          }
                        }}
                      >
                        {acc.email}
                      </div>
                    ))}
                  </div>
                )}
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
                  setShowModelDropdown(true);
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
    </div>
  );
};

export default MessageInput;
