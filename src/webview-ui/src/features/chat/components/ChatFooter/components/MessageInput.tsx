import React from "react";
import { UploadedFile } from "../../../types/index";
import { PlusIcon, SendIcon } from "./Icons";
import { X, Zap, ShieldCheck, Eye } from "lucide-react";
import { useBackendConnection } from "../../../../../context/BackendConnectionContext";
import { LANGUAGES } from "../../../../setting/components/LanguageSelector";
import { useSettings } from "../../../../../context/SettingsContext";
import QuickSwitchDrawer from "./QuickSwitchDrawer";
import { useI18n } from "@/hooks/useI18n";

const BrainCogIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="11"
    height="11"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="lucide lucide-brain-cog-icon lucide-brain-cog"
  >
    <path d="m10.852 14.772-.383.923" />
    <path d="m10.852 9.228-.383-.923" />
    <path d="m13.148 14.772.382.924" />
    <path d="m13.531 8.305-.383.923" />
    <path d="m14.772 10.852.923-.383" />
    <path d="m14.772 13.148.923.383" />
    <path d="M17.598 6.5A3 3 0 1 0 12 5a3 3 0 0 0-5.63-1.446 3 3 0 0 0-.368 1.571 4 4 0 0 0-2.525 5.771" />
    <path d="M17.998 5.125a4 4 0 0 1 2.525 5.771" />
    <path d="M19.505 10.294a4 4 0 0 1-1.5 7.706" />
    <path d="M4.032 17.483A4 4 0 0 0 11.464 20c.18-.311.892-.311 1.072 0a4 4 0 0 0 7.432-2.516" />
    <path d="M4.5 10.291A4 4 0 0 0 6 18" />
    <path d="M6.002 5.125a3 3 0 0 0 .4 1.375" />
    <path d="m9.228 10.852-.923-.383" />
    <path d="m9.228 13.148-.923.383" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const GlobeIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="11"
    height="11"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="lucide lucide-globe-icon lucide-globe"
  >
    <circle cx="12" cy="12" r="10" />
    <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
    <path d="M2 12h20" />
  </svg>
);

const MemoryIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="11"
    height="11"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className="lucide lucide-database-icon lucide-database"
  >
    <ellipse cx="12" cy="5" rx="9" ry="3" />
    <path d="M3 12a9 3 0 0 0 18 0" />
    <path d="M3 5v14a9 3 0 0 0 18 0V5" />
  </svg>
);

interface ToggleButtonProps {
  isOn: boolean;
  onClick: () => void;
  title: string;
}

const ThinkingButton: React.FC<ToggleButtonProps> = ({
  isOn,
  onClick,
  title,
}) => {
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
          ? isHovered
            ? "color-mix(in srgb, var(--vscode-editorBracketHighlight-foreground2, #a855f7) 20%, transparent)"
            : "color-mix(in srgb, var(--vscode-editorBracketHighlight-foreground2, #a855f7) 12%, transparent)"
          : isHovered
            ? "rgba(128, 128, 128, 0.2)"
            : "rgba(128, 128, 128, 0.12)",
        color: isOn
          ? "var(--vscode-editorBracketHighlight-foreground2, #a855f7)"
          : "var(--vscode-foreground)",
        opacity: isOn ? 1 : isHovered ? 0.9 : 0.7,
        lineHeight: 1,
        verticalAlign: "middle",
      }}
      title={title}
    >
      <BrainCogIcon />
      <span
        style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.3px" }}
      >
        Thinking
      </span>
    </button>
  );
};

const SearchButton: React.FC<ToggleButtonProps> = ({
  isOn,
  onClick,
  title,
}) => {
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
          ? isHovered
            ? "color-mix(in srgb, var(--vscode-editorBracketHighlight-foreground1, #0ea5e9) 20%, transparent)"
            : "color-mix(in srgb, var(--vscode-editorBracketHighlight-foreground1, #0ea5e9) 12%, transparent)"
          : isHovered
            ? "rgba(128, 128, 128, 0.2)"
            : "rgba(128, 128, 128, 0.12)",
        color: isOn
          ? "var(--vscode-editorBracketHighlight-foreground1, #0ea5e9)"
          : "var(--vscode-foreground)",
        opacity: isOn ? 1 : isHovered ? 0.9 : 0.7,
        lineHeight: 1,
        verticalAlign: "middle",
      }}
      title={title}
    >
      <GlobeIcon />
      <span
        style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.3px" }}
      >
        Search
      </span>
    </button>
  );
};

const MemoryButton: React.FC<ToggleButtonProps> = ({
  isOn,
  onClick,
  title,
}) => {
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
          ? "1px solid var(--vscode-editorBracketHighlight-foreground3, rgba(139, 92, 246, 0.4))"
          : "1px solid rgba(128, 128, 128, 0.2)",
        background: isOn
          ? isHovered
            ? "color-mix(in srgb, var(--vscode-editorBracketHighlight-foreground3, #8b5cf6) 20%, transparent)"
            : "color-mix(in srgb, var(--vscode-editorBracketHighlight-foreground3, #8b5cf6) 12%, transparent)"
          : isHovered
            ? "rgba(128, 128, 128, 0.2)"
            : "rgba(128, 128, 128, 0.12)",
        color: isOn
          ? "var(--vscode-editorBracketHighlight-foreground3, #8b5cf6)"
          : "var(--vscode-foreground)",
        opacity: isOn ? 1 : isHovered ? 0.9 : 0.7,
        lineHeight: 1,
        verticalAlign: "middle",
      }}
      title={title}
    >
      <MemoryIcon />
      <span
        style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.3px" }}
      >
        Memory
      </span>
    </button>
  );
};

const GlobalPermissionButton: React.FC = () => {
  const { permissionMode, setPermissionMode } = useSettings();
  const { t } = useI18n();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = React.useState(false);
  const [tooltip, setTooltip] = React.useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const tooltipTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  React.useEffect(() => {
    if (!open) {
      setTooltip(null);
      if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
    }
  }, [open]);

  const MODE_METADATA: Record<
    string,
    { label: string; desc: string; icon: React.ReactNode; color: string }
  > = {
    fullAccess: {
      label: t("permission.fullAccess"),
      desc: t("settings.fullAccessDesc"),
      icon: <Zap size={11} />,
      color: "var(--vscode-editorBracketHighlight-foreground3, #f59e0b)",
    },
    approval: {
      label: t("permission.approval"),
      desc: t("settings.approvalDesc"),
      icon: <ShieldCheck size={11} />,
      color: "var(--vscode-symbolIcon-interfaceForeground, #3b82f6)",
    },
    readOnly: {
      label: t("permission.readOnly"),
      desc: t("settings.readOnlyDesc"),
      icon: <Eye size={11} />,
      color: "var(--vscode-symbolIcon-classForeground, #8b5cf6)",
    },
  };

  const handleItemMouseEnter = (
    id: string,
    e: React.MouseEvent<HTMLButtonElement>,
  ) => {
    if (!e.currentTarget.parentElement) return;
    if (
      !e.currentTarget.style.backgroundColor ||
      e.currentTarget.style.backgroundColor === "transparent"
    ) {
      e.currentTarget.style.backgroundColor =
        "var(--vscode-list-hoverBackground)";
    }
    const rect = e.currentTarget.getBoundingClientRect();
    tooltipTimer.current = setTimeout(() => {
      setTooltip({ id, x: rect.right + 6, y: rect.top });
    }, 500);
  };

  const handleItemMouseLeave = (
    isSelected: boolean,
    e: React.MouseEvent<HTMLButtonElement>,
  ) => {
    if (!isSelected) e.currentTarget.style.backgroundColor = "transparent";
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
    setTooltip(null);
  };

  const metadata = MODE_METADATA[permissionMode] || MODE_METADATA.fullAccess;

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
        <span
          style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.3px" }}
        >
          {metadata.label}
        </span>
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 4px)",
            left: 0,
            zIndex: 1000,
            backgroundColor:
              "color-mix(in srgb, var(--input-bg) 100%, black 15%)",
            border: "1px solid var(--vscode-widget-border)",
            borderRadius: "6px",
            overflow: "hidden",
            boxShadow: "0 -4px 12px rgba(0,0,0,0.2)",
            minWidth: "180px",
          }}
        >
          {Object.entries(MODE_METADATA).map(([modeId, meta]) => {
            const isSelected = permissionMode === modeId;
            return (
              <button
                key={modeId}
                onClick={() => {
                  setPermissionMode(modeId as any);
                  setOpen(false);
                  setTooltip(null);
                  if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
                }}
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
                  background: isSelected
                    ? "var(--vscode-button-background)"
                    : "transparent",
                  color: isSelected
                    ? "var(--vscode-button-foreground)"
                    : "var(--vscode-foreground)",
                }}
                onMouseEnter={(e) => handleItemMouseEnter(modeId, e)}
                onMouseLeave={(e) => handleItemMouseLeave(isSelected, e)}
              >
                <span
                  style={{
                    color: isSelected ? "inherit" : meta.color,
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  {meta.icon}
                </span>
                {meta.label}
              </button>
            );
          })}
        </div>
      )}
      {tooltip && MODE_METADATA[tooltip.id] && (
        <div
          style={{
            position: "fixed",
            left: tooltip.x,
            top: tooltip.y,
            zIndex: 9999,
            backgroundColor:
              "var(--vscode-editorHoverWidget-background, #1e1e1e)",
            border: "1px solid var(--vscode-editorHoverWidget-border, #454545)",
            borderRadius: "6px",
            padding: "8px 10px",
            maxWidth: "220px",
            fontSize: "11px",
            color: "var(--vscode-foreground)",
            lineHeight: 1.5,
            pointerEvents: "none",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          }}
        >
          <div
            style={{
              fontWeight: 600,
              marginBottom: "3px",
              color: MODE_METADATA[tooltip.id].color,
            }}
          >
            {MODE_METADATA[tooltip.id].label}
          </div>
          {MODE_METADATA[tooltip.id].desc}
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
  isProcessing?: boolean;
  // 🆕 Stop Generation Props
  isStreaming?: boolean;
  onStopGeneration?: () => void;
  showBrowserWarning?: boolean;
  isLaunchingBrowser?: boolean;
  onLaunchBrowserSession?: () => void;
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
  showBrowserWarning = false,
  isLaunchingBrowser = false,
  onLaunchBrowserSession,
}) => {
  const { isConnected, isElaraMismatch, apiUrl } = useBackendConnection();
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

  const [isMemory, setIsMemory] = React.useState(() => {
    try {
      return localStorage.getItem("zen-memory-enabled") === "true";
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

  const toggleMemory = async () => {
    if (!currentAccount?.id) {
      console.warn("No account selected, cannot toggle memory");
      return;
    }

    const newState = !isMemory;
    // Optimistic update
    setIsMemory(newState);
    localStorage.setItem("zen-memory-enabled", String(newState));

    // Sync to server
    try {
      const response = await fetch(
        `${apiUrl}/v1/accounts/${currentAccount.id}/memory`,
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_memory_enabled: newState }),
        },
      );
      const result = await response.json();
      if (!result.success) {
        // Rollback on error
        setIsMemory(!newState);
        localStorage.setItem("zen-memory-enabled", String(!newState));
        console.error(
          "Failed to update memory state on server:",
          result.message,
        );
      }
    } catch (error) {
      // Rollback on network error
      setIsMemory(!newState);
      localStorage.setItem("zen-memory-enabled", String(!newState));
      console.error("Failed to sync memory state with server:", error);
    }
  };

  const displayAccount = React.useMemo(() => {
    return currentAccount || null;
  }, [currentAccount]);

  // 🆕 Tool Settings Drawer Logic removed - now per-tool dropdown in ToolItem
  const currentProviderConfig = React.useMemo(() => {
    if (!currentModel?.providerId) {
      return null;
    }
    const found = providers.find(
      (p) =>
        p.provider_id?.toLowerCase() === currentModel.providerId?.toLowerCase(),
    );
    return found ?? null;
  }, [currentModel, providers]);

  const currentModelConfig = React.useMemo(() => {
    if (!currentProviderConfig || !currentModel?.id) {
      return null;
    }
    const found = currentProviderConfig.models?.find(
      (m: any) => m.id?.toLowerCase() === currentModel.id?.toLowerCase(),
    );
    return found ?? null;
  }, [currentProviderConfig, currentModel]);

  const showThinkingButton = React.useMemo(() => {
    // Prefer fields on currentModel directly (already enriched), fallback to config lookup
    const result =
      currentModel?.is_thinking !== undefined
        ? !!currentModel.is_thinking
        : !!currentModelConfig?.is_thinking;
    return result;
  }, [currentModel, currentModelConfig]);

  const showSearchButton = React.useMemo(() => {
    // Priority: model-level > provider-level
    // Only fall through to the next level if the current level is undefined (not set),
    // never let provider-level override an explicit model-level false.
    let result: boolean;
    if (currentModel?.is_search !== undefined) {
      // Model object already enriched with capability flags — trust it exclusively
      result = !!currentModel.is_search;
    } else if (currentModelConfig?.is_search !== undefined) {
      // Model config from providers list has the flag
      result = !!currentModelConfig.is_search;
    } else {
      // Neither model nor modelConfig has the flag — fall back to provider-level
      result = !!currentProviderConfig?.is_search;
    }
    return result;
  }, [currentModel, currentModelConfig, currentProviderConfig]);

  const showMemoryButton = React.useMemo(() => {
    // Check if model supports memory (is_memory flag)
    const result = currentModel?.is_memory === true;
    return result;
  }, [currentModel]);

  // Sync thinking and search toggles when model changes
  React.useEffect(() => {
    if (providers.length === 0 || !currentModel) return;
    const hasThinking =
      currentModel?.is_thinking !== undefined
        ? !!currentModel.is_thinking
        : !!currentModelConfig?.is_thinking;
    const hasSearch =
      currentModel?.is_search !== undefined
        ? !!currentModel.is_search || !!currentProviderConfig?.is_search
        : !!currentModelConfig?.is_search || !!currentProviderConfig?.is_search;

    if (!hasThinking && isThinking) {
      setIsThinking(false);
      try {
        localStorage.setItem("zen-thinking-enabled", "false");
      } catch {}
    }
    if (!hasSearch && isSearch) {
      setIsSearch(false);
      try {
        localStorage.setItem("zen-search-enabled", "false");
      } catch {}
    }
  }, [
    currentModel,
    currentModelConfig,
    currentProviderConfig,
    providers,
    isThinking,
    isSearch,
  ]);

  const supportsUpload = React.useMemo(() => {
    // Priority: model-level > modelConfig-level > provider-level (strict cascade, no OR merging)
    let result: boolean;
    if (currentModel?.is_upload !== undefined) {
      result = !!currentModel.is_upload;
    } else if (currentModelConfig?.is_upload !== undefined) {
      result = !!currentModelConfig.is_upload;
    } else {
      result = !!currentProviderConfig?.is_upload;
    }
    return result;
  }, [currentModel, currentProviderConfig, currentModelConfig]);

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
    let cancelled = false;
    setIsLoadingCache(true);
    const key = `zen-model-selection:${folderPath || "global"}`;

    const applyCache = (saved: any) => {
      if (cancelled) return;
      if (saved.model) setCurrentModel(saved.model);
      if (saved.accountId) {
        pendingAccountIdRef.current = saved.accountId;
        if (saved.email) {
          setCurrentAccount({ id: saved.accountId, email: saved.email });
        }
      }
    };

    try {
      const savedStr = localStorage.getItem(key);
      if (savedStr) {
        const saved = JSON.parse(savedStr);
        applyCache(saved);
        setIsLoadingCache(false);
      } else {
        const storage = (window as any).storage;
        if (storage) {
          storage
            .get(key)
            .then((res: any) => {
              if (cancelled) return;
              if (res?.value) {
                const saved = JSON.parse(res.value);
                applyCache(saved);
                try {
                  localStorage.setItem(key, res.value);
                } catch {}
              }
              setIsLoadingCache(false);
            })
            .catch(() => {
              if (!cancelled) setIsLoadingCache(false);
            });
        } else {
          setIsLoadingCache(false);
        }
      }
    } catch (e) {
      setIsLoadingCache(false);
    }

    return () => {
      cancelled = true;
    };
  }, [folderPath]);

  // Save selection
  React.useEffect(() => {
    if (currentModel) {
      const key = `zen-model-selection:${folderPath || "global"}`;
      const data = {
        model: currentModel,
        accountId: currentAccount?.id,
        email: currentAccount?.email,
      };
      const dataStr = JSON.stringify(data);
      try {
        localStorage.setItem(key, dataStr);
      } catch (e) {}

      const storage = (window as any).storage;
      if (storage) {
        storage.set(key, dataStr);
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
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          position: "relative",
          borderRadius: "var(--border-radius)",
          border: !isConnected
            ? "1px solid var(--vscode-errorForeground, #f44336)"
            : "1px solid transparent",
          transition: "border 0.3s ease",
          marginTop:
            !isConversationStarted || (isConnected && isElaraMismatch)
              ? "24px"
              : "0px", // Space for badges sticking up
        }}
      >
        {/* 🆕 HOME PANEL BADGE (Stuck to Border) - Only when !isConversationStarted */}
        {!isConversationStarted && (
          <div
            onClick={() => {
              if (providers.length === 0) fetchProviders();
              setShowModelDrawer((v) => !v);
            }}
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
              const prov = providers.find(
                (p: any) => p.provider_id === selected.providerId,
              );
              const modelObj = prov?.models?.find(
                (m: any) => m.id === selected.modelId,
              );
              let faviconUrl = "";
              if (prov?.website) {
                try {
                  faviconUrl = `${new URL(prov.website).origin}/favicon.ico`;
                } catch {}
              }

              const newModel = {
                ...selected,
                id: selected.modelId,
                name: modelObj?.name || selected.modelId,
                favicon: faviconUrl,
                is_thinking: modelObj?.is_thinking ?? false,
                is_search: modelObj?.is_search ?? false,
                is_upload: modelObj?.is_upload ?? false,
                is_memory: modelObj?.is_memory ?? prov?.is_memory ?? false,
              };
              setCurrentModel(newModel);
              setCurrentAccount({
                id: selected.accountId,
                email: selected.email,
              });

              // Fetch memory state from server
              const fetchMemoryState = async () => {
                try {
                  const response = await fetch(
                    `${apiUrl}/v1/accounts/${selected.accountId}/memory`,
                  );
                  const result = await response.json();
                  if (result.success && result.data) {
                    setIsMemory(result.data.is_memory_enabled);
                    // Sync to localStorage
                    localStorage.setItem(
                      "zen-memory-enabled",
                      String(result.data.is_memory_enabled),
                    );
                  }
                } catch (error) {
                  console.error("Failed to fetch memory state:", error);
                }
              };
              fetchMemoryState();
              setShowModelDrawer(false);
            }}
          />
        )}
        {/* Browser session warning - bottom right inside MessageInput */}
        {showBrowserWarning && currentModel?.providerId === "zai-browser" && (
          <div
            onClick={isLaunchingBrowser ? undefined : onLaunchBrowserSession}
            style={{
              position: "absolute",
              top: "100%",
              right: "8px",
              backgroundColor: "rgba(251, 146, 60, 0.15)",
              padding: "4px 10px",
              fontSize: "11px",
              fontWeight: 500,
              borderBottomLeftRadius: "8px",
              borderBottomRightRadius: "8px",
              border: "1px solid rgba(251, 146, 60, 0.3)",
              borderTop: "none",
              zIndex: 20,
              display: "flex",
              alignItems: "center",
              gap: "6px",
              cursor: isLaunchingBrowser ? "not-allowed" : "pointer",
              marginTop: "-1px",
              opacity: isLaunchingBrowser ? 0.6 : 1,
            }}
            onMouseEnter={(e) => {
              if (!isLaunchingBrowser) {
                e.currentTarget.style.backgroundColor =
                  "rgba(251, 146, 60, 0.25)";
              }
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor =
                "rgba(251, 146, 60, 0.15)";
            }}
          >
            <span style={{ fontSize: "11px", fontWeight: 500 }}>
              {isLaunchingBrowser
                ? "Launching browser session..."
                : "Browser session not ready. Click here"}
            </span>
          </div>
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
              if (!supportsUpload && e.clipboardData.files.length > 0) {
                console.warn(
                  "[Zen Log] MessageInput onPaste: Upload is not supported, preventing paste.",
                );
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
                ? t("chat.inputHistoryMode")
                : !isConnected
                  ? t("chat.connectionErrorPlaceholder")
                  : isLoadingCache
                    ? t("chat.inputLoadingCache")
                    : isProcessing
                      ? t("chat.inputProcessing")
                      : t("chat.inputMentionHint")
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
              whiteSpace: "pre-wrap",
              wordWrap: "break-word",
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
          <div
            style={{
              display: "flex",
              gap: "var(--spacing-xs)",
              alignItems: "center",
            }}
          >
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
                  background: isPlusHovered
                    ? "rgba(128, 128, 128, 0.2)"
                    : "rgba(128, 128, 128, 0.12)",
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

            {/* Memory Toggle */}
            {showMemoryButton && (
              <MemoryButton
                isOn={isMemory}
                onClick={toggleMemory}
                title="Toggle Memory Reference (Saved memories & chat history)"
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
                      : isStreaming || isProcessing
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
                      : isStreaming || isProcessing
                        ? "var(--vscode-errorForeground, #f44336)" // Red color for stop
                        : message.trim() || uploadedFiles.length > 0
                          ? "var(--accent-text)"
                          : "var(--secondary-text)",
                  pointerEvents:
                    isHistoryMode || isLoadingCache ? "none" : "auto",
                }}
                onClick={() => {
                  if ((isStreaming || isProcessing) && onStopGeneration) {
                    // Stop generation
                    onStopGeneration();
                    return;
                  }

                  if (!currentModel) {
                    console.warn(
                      "[Zen] MessageInput send: no model selected, aborting",
                    );
                    return;
                  }
                  handleSend(currentModel, currentAccount);
                }}
                onMouseEnter={(e) => {
                  if (
                    isStreaming ||
                    isProcessing ||
                    message.trim() ||
                    uploadedFiles.length > 0
                  ) {
                    e.currentTarget.style.backgroundColor = "var(--hover-bg)";
                  }
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
                title={
                  isStreaming || isProcessing
                    ? "Stop Generation"
                    : "Send Message"
                }
              >
                {isStreaming || isProcessing ? (
                  <X size={16} strokeWidth={2.5} />
                ) : (
                  <SendIcon />
                )}
              </div>
            )}
          </div>
        </div>

        {/* Language Badge - HomePanel only */}
        {!isConversationStarted &&
          isConnected &&
          !isElaraMismatch &&
          LANGUAGES.some(
            (l: { code: string }) => l.code === preferredLanguage,
          ) && (
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
              color: "var(--vscode-editorWarning-foreground, #ff9800)",
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
