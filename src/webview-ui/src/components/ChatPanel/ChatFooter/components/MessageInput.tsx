import React from "react";
import { UploadedFile } from "../types";
import ChangesTree from "../../ChangesTree";
import { PlusIcon, ChevronDownIcon, SendIcon } from "./Icons";
import { Check, Cpu, Search, X } from "lucide-react";

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
  executionState?: {
    total: number;
    completed: number;
    status: "idle" | "running" | "error" | "done";
  };
  onExecutePendingBatch?: () => void;
  hasPendingActions?: boolean;
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
  executionState,
  onExecutePendingBatch,
  hasPendingActions,
  folderPath,
  isConversationStarted,
  selectedQuickModel,
  onQuickModelSelect,
  currentModel,
  setCurrentModel,
  currentAccount,
  setCurrentAccount,
}) => {
  const [apiUrl, setApiUrl] = React.useState("http://localhost:8888");
  const [providers, setProviders] = React.useState<any[]>([]);
  const [accounts, setAccounts] = React.useState<any[]>([]);
  // const [selectedModel, setSelectedModel] = React.useState<any>(null); // Replaced by props
  // const [selectedAccount, setSelectedAccount] = React.useState<any>(null); // Replaced by props
  const [showModelDropdown, setShowModelDropdown] = React.useState(false);
  const [showAccountDropdown, setShowAccountDropdown] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState("");
  const pendingAccountIdRef = React.useRef<string | null>(null);

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

  // Load saved selection
  React.useEffect(() => {
    const loadSelection = async () => {
      const storage = (window as any).storage;
      if (!storage) return;

      const key = `zen-model-selection:${folderPath || "global"}`;
      try {
        const res = await storage.get(key);
        if (res?.value) {
          const saved = JSON.parse(res.value);
          if (saved.model) setCurrentModel(saved.model);
          // Account will be selected after model is set and accounts fetched
          if (saved.accountId) {
            pendingAccountIdRef.current = saved.accountId;
          }
        } else {
          // Reset selection if no saved data for this folder
          // This might be debated, but usually if I switch folders I expect to see that folder's state.
          // If no state, maybe default? For now let's keep current behavior (controlled by state).
          // But wait, if I switch tabs, MessageInput re-mounts?
          // If ChatFooter re-renders, MessageInput might not unmount if keys dont change.
          // But folderPath changes.
          // If I switch to a new folder that has no saved state, I probably want to reset or keep default.
          // Current logic: only sets if res.value exists. If not, it keeps whatever state (which might be from previous folder if component didn't unmount).
          // We should probably reset if no saved state found to avoid confusion.
          // BUT, if initial load, state is null.
          // Let's stick to: if saved found, apply it. If not, do nothing (let default logic take over).
        }
      } catch (e) {
        // console.error("Failed to load model selection", e);
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

      <div style={{ display: "flex", flexDirection: "column" }}>
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
          {/* Quick Model Continuity Banner */}
          {selectedQuickModel && (
            <div
              style={{
                position: "absolute",
                top: "-28px",
                left: "8px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "4px 10px",
                borderTopLeftRadius: "8px",
                borderTopRightRadius: "8px",
                borderLeft: "1px solid var(--border-color)",
                borderTop: "1px solid var(--border-color)",
                borderRight: "1px solid var(--border-color)",
                backgroundColor: "var(--vscode-editor-background)", // Match editor bg or slight contrast
                fontSize: "10px",
                fontWeight: 700,
                color: "var(--primary-text)",
                opacity: 0.9,
                zIndex: 10,
                boxShadow: "0 -2px 4px rgba(0,0,0,0.05)",
              }}
            >
              <span style={{ opacity: 0.6 }}>Continue conversation with</span>
              <div
                style={{ display: "flex", alignItems: "center", gap: "6px" }}
              >
                {allModels.find((m) => m.id === selectedQuickModel.modelId)
                  ?.favicon && (
                  <img
                    src={
                      allModels.find(
                        (m) => m.id === selectedQuickModel.modelId,
                      )!.favicon!
                    }
                    style={{
                      width: "12px",
                      height: "12px",
                      objectFit: "contain",
                      opacity: 0.8,
                      filter: "grayscale(100%)",
                    }}
                    alt=""
                  />
                )}
                <span
                  style={{
                    maxWidth: "150px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {
                    allModels.find((m) => m.id === selectedQuickModel.modelId)
                      ?.providerName
                  }{" "}
                  /{" "}
                  {allModels.find((m) => m.id === selectedQuickModel.modelId)
                    ?.name || selectedQuickModel.modelId}
                </span>
              </div>
            </div>
          )}
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
          {/* Quick Model Continuity Banner */}
          {selectedQuickModel && (
            <div
              style={{
                position: "absolute",
                top: "-28px",
                left: "8px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "4px 10px",
                borderTopLeftRadius: "8px",
                borderTopRightRadius: "8px",
                borderLeft: "1px solid var(--border-color)",
                borderTop: "1px solid var(--border-color)",
                borderRight: "1px solid var(--border-color)",
                backgroundColor: "var(--vscode-editor-background)", // Match editor bg or slight contrast
                fontSize: "10px",
                fontWeight: 700,
                color: "var(--primary-text)",
                opacity: 0.9,
                zIndex: 10,
                boxShadow: "0 -2px 4px rgba(0,0,0,0.05)",
              }}
            >
              <span style={{ opacity: 0.6 }}>Continue conversation with</span>
              <div
                style={{ display: "flex", alignItems: "center", gap: "6px" }}
              >
                {allModels.find((m) => m.id === selectedQuickModel.modelId)
                  ?.favicon && (
                  <img
                    src={
                      allModels.find(
                        (m) => m.id === selectedQuickModel.modelId,
                      )!.favicon!
                    }
                    style={{
                      width: "12px",
                      height: "12px",
                      objectFit: "contain",
                      opacity: 0.8,
                      filter: "grayscale(100%)",
                    }}
                    alt=""
                  />
                )}
                <span
                  style={{
                    maxWidth: "150px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {
                    allModels.find((m) => m.id === selectedQuickModel.modelId)
                      ?.providerName
                  }{" "}
                  /{" "}
                  {allModels.find((m) => m.id === selectedQuickModel.modelId)
                    ?.name || selectedQuickModel.modelId}
                </span>
              </div>
            </div>
          )}
          {/* Execution Progress Badge */}
          {executionState && executionState.status === "running" && (
            <div
              style={{
                position: "absolute",
                top: "-24px",
                right: "0",
                backgroundColor: "var(--vscode-badge-background)",
                color: "var(--vscode-badge-foreground)",
                fontSize: "10px",
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: "10px",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                zIndex: 10,
                boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                cursor: "pointer",
              }}
              onClick={onExecutePendingBatch}
              title="Click to execute pending commands"
            >
              <div
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  backgroundColor: "white",
                  opacity: 0.8,
                }}
              />
              Execute {executionState.completed}/{executionState.total}
            </div>
          )}

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
                : "Type @ to mention files, folders, or rules..."
            }
            disabled={isHistoryMode}
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
              opacity: isHistoryMode ? 0.6 : 1,
              cursor: isHistoryMode ? "not-allowed" : "text",
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
            {/* Quick Model Switcher (CPU Icon) */}
            {onQuickModelSelect && (
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
            {!isConversationStarted && (
              <div style={{ position: "relative" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "4px 8px",
                    backgroundColor: "transparent",
                    borderRadius: "14px",
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
                    borderRadius: "14px",
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
            <div
              style={{
                cursor: isHistoryMode
                  ? "not-allowed"
                  : message.trim() || uploadedFiles.length > 0
                    ? "pointer"
                    : "not-allowed",
                opacity: isHistoryMode
                  ? 0.5
                  : message.trim() || uploadedFiles.length > 0
                    ? 1
                    : 0.5,
                padding: "var(--spacing-xs)",
                borderRadius: "var(--border-radius)",
                transition: "background-color 0.2s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: isHistoryMode
                  ? "var(--secondary-text)"
                  : message.trim() || uploadedFiles.length > 0
                    ? "var(--accent-text)"
                    : "var(--secondary-text)",
                pointerEvents: isHistoryMode ? "none" : "auto",
              }}
              onClick={() => {
                if (!currentModel) {
                  // Alert user or show dropdown
                  setShowModelDropdown(true);
                  if (providers.length === 0) fetchProviders();
                  return;
                }
                handleSend(currentModel, currentAccount);
              }}
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
  );
};

export default MessageInput;
