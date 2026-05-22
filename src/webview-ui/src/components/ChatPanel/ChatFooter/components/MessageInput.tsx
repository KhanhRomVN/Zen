import React from "react";
import { UploadedFile } from "../types";
import ChangesTree from "../../ChangesTree";
import { PlusIcon, SendIcon } from "./Icons";
import {
  X,
  Zap,
  FileCode,
  Brain,
  ShieldCheck,
  Ban,
  Eye,
} from "lucide-react";
import { useBackendConnection } from "../../../../context/BackendConnectionContext";
import { LANGUAGES } from "../../../SettingsPanel/LanguageSelector";
import { useSettings } from "../../../../context/SettingsContext";
import QuickSwitchDrawer from "./QuickSwitchDrawer";
import { useI18n } from "@/hooks/useI18n";



const BrainCogIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-brain-cog-icon lucide-brain-cog">
    <path d="m10.852 14.772-.383.923"/>
    <path d="m10.852 9.228-.383-.923"/>
    <path d="m13.148 14.772.382.924"/>
    <path d="m13.531 8.305-.383.923"/>
    <path d="m14.772 10.852.923-.383"/>
    <path d="m14.772 13.148.923.383"/>
    <path d="M17.598 6.5A3 3 0 1 0 12 5a3 3 0 0 0-5.63-1.446 3 3 0 0 0-.368 1.571 4 4 0 0 0-2.525 5.771"/>
    <path d="M17.998 5.125a4 4 0 0 1 2.525 5.771"/>
    <path d="M19.505 10.294a4 4 0 0 1-1.5 7.706"/>
    <path d="M4.032 17.483A4 4 0 0 0 11.464 20c.18-.311.892-.311 1.072 0a4 4 0 0 0 7.432-2.516"/>
    <path d="M4.5 10.291A4 4 0 0 0 6 18"/>
    <path d="M6.002 5.125a3 3 0 0 0 .4 1.375"/>
    <path d="m9.228 10.852-.923-.383"/>
    <path d="m9.228 13.148-.923.383"/>
    <circle cx="12" cy="12" r="3"/>
  </svg>
);

const GlobeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-globe-icon lucide-globe">
    <circle cx="12" cy="12" r="10"/>
    <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/>
    <path d="M2 12h20"/>
  </svg>
);

interface ToggleButtonProps {
  isOn: boolean;
  onClick: () => void;
  title: string;
}

const SimpleModeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="10"/>
    <circle cx="12" cy="12" r="1"/>
  </svg>
);

const FullModeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect width="8" height="8" x="3" y="3" rx="2"/>
    <path d="M7 11v4a2 2 0 0 0 2 2h4"/>
    <rect width="8" height="8" x="13" y="13" rx="2"/>
  </svg>
);

interface ModeButtonProps {
  isSimpleMode: boolean;
  onClick?: () => void;
}

const ModeButton: React.FC<ModeButtonProps> = ({ isSimpleMode, onClick }) => {
  const [isHovered, setIsHovered] = React.useState(false);
  const isOn = !isSimpleMode; // Full mode is "on"

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "4px",
        padding: "0 8px",
        height: "22px",
        boxSizing: "border-box",
        borderRadius: "4px",
        cursor: "pointer",
        fontSize: "11px",
        fontWeight: 600,
        letterSpacing: "0.3px",
        transition: "all 0.2s ease-in-out",
        border: isOn
          ? "1px solid var(--vscode-editorBracketHighlight-foreground4, rgba(16, 185, 129, 0.4))"
          : "1px solid rgba(128, 128, 128, 0.2)",
        background: isOn
          ? (isHovered
              ? "color-mix(in srgb, var(--vscode-editorBracketHighlight-foreground4, #10b981) 20%, transparent)"
              : "color-mix(in srgb, var(--vscode-editorBracketHighlight-foreground4, #10b981) 12%, transparent)")
          : (isHovered
              ? "rgba(128, 128, 128, 0.2)"
              : "rgba(128, 128, 128, 0.12)"),
        color: isOn
          ? "var(--vscode-editorBracketHighlight-foreground4, #10b981)"
          : "var(--vscode-foreground)",
        opacity: isOn ? 1 : (isHovered ? 0.9 : 0.7),
        lineHeight: 1,
        verticalAlign: "middle",
      }}
      title={isSimpleMode ? "Simple mode: showing WRITE & RUN only. Click for Full mode" : "Full mode: showing all tools. Click for Simple mode"}
    >
      {isSimpleMode ? <SimpleModeIcon /> : <FullModeIcon />}
      <span style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.3px" }}>
        {isSimpleMode ? "Simple" : "Full"}
      </span>
    </button>
  );
};

const ThinkingButton: React.FC<ToggleButtonProps> = ({ isOn, onClick, title }) => {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "4px",
        padding: "0 8px",
        height: "22px",
        boxSizing: "border-box",
        borderRadius: "4px",
        cursor: "pointer",
        fontSize: "11px",
        fontWeight: 600,
        letterSpacing: "0.3px",
        transition: "all 0.2s ease-in-out",
        border: isOn
          ? "1px solid var(--vscode-editorBracketHighlight-foreground2, rgba(168, 85, 247, 0.4))"
          : "1px solid rgba(128, 128, 128, 0.2)",
        background: isOn
          ? (isHovered
              ? "color-mix(in srgb, var(--vscode-editorBracketHighlight-foreground2, #a855f7) 20%, transparent)"
              : "color-mix(in srgb, var(--vscode-editorBracketHighlight-foreground2, #a855f7) 12%, transparent)")
          : (isHovered
              ? "rgba(128, 128, 128, 0.2)"
              : "rgba(128, 128, 128, 0.12)"),
        color: isOn
          ? "var(--vscode-editorBracketHighlight-foreground2, #a855f7)"
          : "var(--vscode-foreground)",
        opacity: isOn ? 1 : (isHovered ? 0.9 : 0.7),
        lineHeight: 1,
        verticalAlign: "middle",
      }}
      title={title}
    >
      <BrainCogIcon />
      <span style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.3px" }}>Thinking</span>
    </button>
  );
};

const SearchButton: React.FC<ToggleButtonProps> = ({ isOn, onClick, title }) => {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "4px",
        padding: "0 8px",
        height: "22px",
        boxSizing: "border-box",
        borderRadius: "4px",
        cursor: "pointer",
        fontSize: "11px",
        fontWeight: 600,
        letterSpacing: "0.3px",
        transition: "all 0.2s ease-in-out",
        border: isOn
          ? "1px solid var(--vscode-editorBracketHighlight-foreground1, rgba(14, 165, 233, 0.4))"
          : "1px solid rgba(128, 128, 128, 0.2)",
        background: isOn
          ? (isHovered
              ? "color-mix(in srgb, var(--vscode-editorBracketHighlight-foreground1, #0ea5e9) 20%, transparent)"
              : "color-mix(in srgb, var(--vscode-editorBracketHighlight-foreground1, #0ea5e9) 12%, transparent)")
          : (isHovered
              ? "rgba(128, 128, 128, 0.2)"
              : "rgba(128, 128, 128, 0.12)"),
        color: isOn
          ? "var(--vscode-editorBracketHighlight-foreground1, #0ea5e9)"
          : "var(--vscode-foreground)",
        opacity: isOn ? 1 : (isHovered ? 0.9 : 0.7),
        lineHeight: 1,
        verticalAlign: "middle",
      }}
      title={title}
    >
      <GlobeIcon />
      <span style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.3px" }}>Search</span>
    </button>
  );
};

const GlobalPermissionButton: React.FC = () => {
  const { permissionMode, setPermissionMode, language } = useSettings();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = React.useState(false);
  const isVi = language === "vi";

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const MODE_METADATA: Record<string, { label: string; icon: React.ReactNode; color: string }> = {
    bypassPermissions: {
      label: isVi ? "Cho phép toàn bộ" : "Full Access",
      icon: <Zap size={11} />,
      color: "var(--vscode-editorBracketHighlight-foreground3, #f59e0b)",
    },
    acceptEdits: {
      label: isVi ? "Tự động sửa File" : "Auto Edits",
      icon: <FileCode size={11} />,
      color: "var(--vscode-symbolIcon-interfaceForeground, #3b82f6)",
    },
    auto: {
      label: isVi ? "Tự động Đọc" : "Auto Reads",
      icon: <Brain size={11} />,
      color: "var(--vscode-symbolIcon-constructorForeground, #10b981)",
    },
    default: {
      label: isVi ? "Hỏi mọi lúc" : "Ask Every Time",
      icon: <ShieldCheck size={11} />,
      color: "var(--vscode-disabledForeground, #a3a3a3)",
    },
    dontAsk: {
      label: isVi ? "Chặn toàn bộ" : "Deny All",
      icon: <Ban size={11} />,
      color: "var(--vscode-errorForeground, #ef4444)",
    },
    plan: {
      label: isVi ? "Chỉ đọc" : "Read Only",
      icon: <Eye size={11} />,
      color: "var(--vscode-symbolIcon-classForeground, #8b5cf6)",
    },
  };

  const metadata = MODE_METADATA[permissionMode] || MODE_METADATA.default;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
          padding: "0 8px",
          height: "22px",
          boxSizing: "border-box",
          borderRadius: "4px",
          cursor: "pointer",
          fontSize: "11px",
          fontWeight: 600,
          letterSpacing: "0.3px",
          transition: "all 0.2s ease-in-out",
          border: `1px solid ${metadata.color}40`,
          background: isHovered
            ? `color-mix(in srgb, ${metadata.color} 20%, transparent)`
            : `color-mix(in srgb, ${metadata.color} 12%, transparent)`,
          color: metadata.color,
          opacity: 1,
          lineHeight: 1,
          verticalAlign: "middle",
        }}
        title="Tool permission mode"
      >
        {metadata.icon}
        <span style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.3px" }}>
          {metadata.label}
        </span>
      </button>
      {open && (
        <div style={{
          position: "absolute",
          bottom: "calc(100% + 4px)",
          left: 0,
          zIndex: 1000,
          backgroundColor: "color-mix(in srgb, var(--input-bg) 100%, black 15%)",
          border: "1px solid var(--vscode-widget-border)",
          borderRadius: "6px",
          overflow: "hidden",
          boxShadow: "0 -4px 12px rgba(0,0,0,0.2)",
          minWidth: "180px",
        }}>
          {Object.entries(MODE_METADATA).map(([modeId, meta]) => {
            const isSelected = permissionMode === modeId;
            return (
              <button
                key={modeId}
                onClick={() => { setPermissionMode(modeId as any); setOpen(false); }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  width: "100%",
                  padding: "7px 12px",
                  fontSize: "11.5px",
                  fontWeight: 500,
                  textAlign: "left",
                  border: "none",
                  cursor: "pointer",
                  background: isSelected ? "var(--vscode-button-background)" : "transparent",
                  color: isSelected ? "var(--vscode-button-foreground)" : "var(--vscode-foreground)",
                }}
                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = "var(--vscode-list-hoverBackground)"; }}
                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = "transparent"; }}
              >
                <span style={{ color: isSelected ? "inherit" : meta.color, display: "flex", alignItems: "center" }}>
                  {meta.icon}
                </span>
                {meta.label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

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
  handleSend: (model: any, account: any) => void;
  hasProjectContext: boolean;
  onOpenProjectContext: () => void;
  folderPath?: string | null;
  isConversationStarted?: boolean;
  currentModel: any;
  setCurrentModel: (model: any) => void;
  currentAccount: any;
  setCurrentAccount: (account: any) => void;
  onToggleTaskDrawer?: () => void;
  isProcessing?: boolean;
  // 🆕 Stop Generation Props
  isStreaming?: boolean;
  onStopGeneration?: () => void;
  isSimpleMode?: boolean;
  onToggleSimpleMode?: () => void;
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
  handleSend,
  hasProjectContext,
  onOpenProjectContext,
  folderPath,
  isConversationStarted,
  currentModel,
  setCurrentModel,
  currentAccount,
  setCurrentAccount,
  isProcessing,
  isStreaming,
  onStopGeneration,
  isSimpleMode = true,
  onToggleSimpleMode,
}) => {
  const { isConnected, isElaraMismatch } = useBackendConnection();
  const [apiUrl, setApiUrl] = React.useState("http://localhost:8888");
  const [providers, setProviders] = React.useState<any[]>([]);
  const [isLoadingCache, setIsLoadingCache] = React.useState(true);
  const { language: preferredLanguage } = useSettings();
  const { t } = useI18n();
  const pendingAccountIdRef = React.useRef<string | null>(null);
  const [showModelDrawer, setShowModelDrawer] = React.useState(false);

  const displayModel = React.useMemo(() => {
    return currentModel || null;
  }, [currentModel]);

  const [isThinking, setIsThinking] = React.useState(() => {
    try {
      return localStorage.getItem("zen-thinking-enabled") === "true";
    } catch {
      return false;
    }
  });

  const [isSearch, setIsSearch] = React.useState(() => {
    try {
      return localStorage.getItem("zen-search-enabled") === "true";
    } catch {
      return false;
    }
  });

  const [isPlusHovered, setIsPlusHovered] = React.useState(false);

  const toggleThinking = () => {
    setIsThinking((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("zen-thinking-enabled", String(next));
      } catch {}
      return next;
    });
  };

  const toggleSearch = () => {
    setIsSearch((prev) => {
      const next = !prev;
      try {
        localStorage.setItem("zen-search-enabled", String(next));
      } catch {}
      return next;
    });
  };

  const displayAccount = React.useMemo(() => {
    return currentAccount || null;
  }, [currentAccount]);

  // 🆕 Tool Settings Drawer Logic removed - now per-tool dropdown in ToolItem
  const currentProviderConfig = React.useMemo(() => {
    if (!currentModel?.providerId) return null;
    return providers.find(
      (p) =>
        p.provider_id?.toLowerCase() === currentModel.providerId?.toLowerCase(),
    );
  }, [currentModel, providers]);

  const currentModelConfig = React.useMemo(() => {
    if (!currentProviderConfig || !currentModel?.id) return null;
    return currentProviderConfig.models?.find(
      (m: any) => m.id?.toLowerCase() === currentModel.id?.toLowerCase(),
    );
  }, [currentProviderConfig, currentModel]);

  const showThinkingButton = React.useMemo(() => {
    return !!currentModelConfig?.is_thinking;
  }, [currentModelConfig]);

  const showSearchButton = React.useMemo(() => {
    return !!currentModelConfig?.is_search || !!currentProviderConfig?.is_search;
  }, [currentModelConfig, currentProviderConfig]);

  // Sync thinking and search toggles when model changes
  React.useEffect(() => {
    if (providers.length === 0 || !currentModel) return;

    const hasThinking = !!currentModelConfig?.is_thinking;
    const hasSearch = !!currentModelConfig?.is_search || !!currentProviderConfig?.is_search;

    if (!hasThinking && isThinking) {
      setIsThinking(false);
      try { localStorage.setItem("zen-thinking-enabled", "false"); } catch {}
    }
    if (!hasSearch && isSearch) {
      setIsSearch(false);
      try { localStorage.setItem("zen-search-enabled", "false"); } catch {}
    }
  }, [currentModel, currentModelConfig, currentProviderConfig, providers, isThinking, isSearch]);

  const supportsUpload = React.useMemo(() => {
    if (!currentProviderConfig) return false;
    return !!currentProviderConfig.is_upload;
  }, [currentProviderConfig]);

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
            if (saved.email) {
              setCurrentAccount({ id: saved.accountId, email: saved.email });
            }
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
          email: currentAccount?.email,
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

  // Handle auto-selection of account from cache once providers are loaded
  React.useEffect(() => {
    if (
      pendingAccountIdRef.current &&
      providers.length > 0 &&
      !currentAccount?.email &&
      currentModel?.providerId
    ) {
      const fetchAccountsForProvider = async () => {
        try {
          const response = await fetch(
            `${apiUrl}/v1/accounts?page=1&limit=50&provider_id=${currentModel.providerId}`,
          );
          const result = await response.json();
          if (result.success && result.data?.accounts) {
            const acc = result.data.accounts.find(
              (a: any) => a.id === pendingAccountIdRef.current,
            );
            if (acc) {
              setCurrentAccount({ id: acc.id, email: acc.email });
              pendingAccountIdRef.current = null; // Mark as resolved
            }
          }
        } catch (error) {
          // ignore
        }
      };
      fetchAccountsForProvider();
    }
  }, [providers, currentModel, currentAccount, apiUrl, setCurrentAccount]);

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
          marginTop: "24px", // Space for badges sticking up
        }}
      >
        {/* 🆕 HOME PANEL BADGE (Stuck to Border) - Only when !isConversationStarted */}
        {!isConversationStarted && (
          <div
            onClick={() => { if (providers.length === 0) fetchProviders(); setShowModelDrawer((v) => !v); }}
            style={{
              position: "absolute",
              bottom: !isConnected ? "calc(100% + 2px)" : "100%",
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
              borderBottom: !isConnected
                ? "1px solid var(--border-color)"
                : "none",
              zIndex: 20,
              display: "flex",
              alignItems: "center",
              gap: "8px",
              cursor: "pointer",
              boxShadow: "0 -2px 6px rgba(0,0,0,0.1)",
              transition: "all 0.2s ease",
              marginBottom: isConnected ? "-1px" : "0", // avoid inheriting red border when disconnected
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--hover-bg)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "var(--input-bg)";
            }}
            title="Click to select Model and Account"
          >
            {displayModel ? (
              <>
                {displayModel.favicon ? (
                  <img
                    src={displayModel.favicon}
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
                {displayModel.providerId}/{displayModel.id}
                {displayAccount?.email && (
                  <span
                    style={{
                      opacity: 0.8,
                      fontStyle: "italic",
                      marginLeft: "2px",
                    }}
                  >
                    {displayAccount.email}
                  </span>
                )}
              </>
            ) : (
              <>
                <span
                  className="codicon codicon-server-process"
                  style={{ fontSize: "12px" }}
                />
                Select Model
              </>
            )}
          </div>
        )}
        {showModelDrawer && (
          <QuickSwitchDrawer
            isOpen={showModelDrawer}
            onClose={() => setShowModelDrawer(false)}
            providers={providers}
            apiUrl={apiUrl}
            onSelect={(selected) => {
              const prov = providers.find((p: any) => p.provider_id === selected.providerId);
              const modelObj = prov?.models?.find((m: any) => m.id === selected.modelId);
              let faviconUrl = "";
              if (prov?.website) {
                try { faviconUrl = `${new URL(prov.website).origin}/favicon.ico`; } catch {}
              }
              setCurrentModel({
                ...selected,
                id: selected.modelId,
                name: modelObj?.name || selected.modelId,
                favicon: faviconUrl,
              });
              setCurrentAccount({ id: selected.accountId, email: selected.email });
              setShowModelDrawer(false);
            }}
          />
        )}
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
                handleSend(currentModel, currentAccount);
              } else {
                handleKeyDown(e);
              }
            }}
            onPaste={(e) => {
              console.log("[Zen Log] MessageInput onPaste triggered. supportsUpload:", supportsUpload, "files length:", e.clipboardData.files?.length, "items length:", e.clipboardData.items?.length);
              if (!supportsUpload && e.clipboardData.files.length > 0) {
                console.warn("[Zen Log] MessageInput onPaste: Upload is not supported, preventing paste.");
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
                  ? t("chat.connectionErrorPlaceholder")
                  : isLoadingCache
                    ? "Đang tải dữ liệu từ cache..."
                    : isProcessing
                      ? "Assistant is processing..."
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
          <div style={{ display: "flex", gap: "var(--spacing-xs)", alignItems: "center" }}>
            {supportsUpload && (
              <div
                onClick={handleFileSelect}
                onMouseEnter={() => setIsPlusHovered(true)}
                onMouseLeave={() => setIsPlusHovered(false)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  height: "22px",
                  width: "22px",
                  boxSizing: "border-box",
                  borderRadius: "4px",
                  cursor: "pointer",
                  transition: "all 0.2s ease-in-out",
                  border: "1px solid rgba(128, 128, 128, 0.2)",
                  background: isPlusHovered ? "rgba(128, 128, 128, 0.2)" : "rgba(128, 128, 128, 0.12)",
                  color: "var(--vscode-foreground)",
                  opacity: isPlusHovered ? 0.9 : 0.7,
                }}
                title="Attach files"
              >
                <PlusIcon />
              </div>
            )}

            {/* Global Tool Permission */}
            <GlobalPermissionButton />

            {/* Thinking Toggle */}
            {showThinkingButton && (
              <ThinkingButton
                isOn={isThinking}
                onClick={toggleThinking}
                title="Toggle AI Thinking Process"
              />
            )}

            {/* Search Toggle */}
            {showSearchButton && (
              <SearchButton
                isOn={isSearch}
                onClick={toggleSearch}
                title="Toggle Web Search Grounding"
              />
            )}

            {/* Simple / Full mode toggle */}
            {isConversationStarted && (
              <ModeButton
                isSimpleMode={isSimpleMode}
                onClick={onToggleSimpleMode}
              />
            )}
          </div>

          {/* Right Icons */}
          <div style={{ display: "flex", gap: "var(--spacing-xs)" }}>
            {/* Send / Stop Button */}
            {isConnected && (
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
                    return;
                  }
                  handleSend(currentModel, currentAccount);
                }}
                onMouseEnter={(e) => {
                  if (
                    isStreaming ||
                    message.trim() ||
                    uploadedFiles.length > 0
                  ) {
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
            )}
          </div>
        </div>

        {/* Language Badge - HomePanel only */}
        {!isConversationStarted &&
          isConnected &&
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

        {/* Health / Elara Badges (Stuck to Border) */}
        {isConnected && isElaraMismatch && (
          <div
            style={{
              position: "absolute",
              bottom: "100%",
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
              border: "1px solid rgba(255, 152, 0, 0.2)",
              borderBottom: "none",
              cursor: "pointer",
              zIndex: 20,
              display: "flex",
              alignItems: "center",
              gap: "4px",
              boxShadow: "0 -2px 4px rgba(0,0,0,0.1)",
              marginBottom: "-1px",
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
