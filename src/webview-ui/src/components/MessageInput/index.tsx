import React from "react";
import { PlusIcon, SendIcon } from "@/icons/Icon";
import { X, GitPullRequestArrow } from "lucide-react";
import { useBackendConnection } from "../../context/BackendConnectionContext";
import { LANGUAGES } from "../../features/setting/components/LanguageSelector";
import { useSettings } from "../../context/SettingsContext";
import ModelAccountDrawer from "./ModelAccountDrawer";
import DiffSummaryBar from "./DiffSummaryBar";
import LogDrawer from "../LogDrawer";
import type {
  MessageInputProps,
  UploadedFile,
  ToggleButtonProps,
} from "./types";
import { PERMISSION_MODE } from "../../features/chat/constants/constants";

export type { UploadedFile };

// ============================================================================
// ICONS
// ============================================================================

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

// ============================================================================
// CUSTOM HOOKS
// ============================================================================

const useToggleState = (key: string, defaultValue: boolean = false) => {
  const [state, setState] = React.useState(() => {
    try {
      return localStorage.getItem(key) === "true";
    } catch {
      return defaultValue;
    }
  });

  const toggle = React.useCallback(() => {
    setState((prev) => {
      const next = !prev;
      try {
        localStorage.setItem(key, String(next));
      } catch {}
      return next;
    });
  }, [key]);

  return [state, toggle, setState] as const;
};

const useModelCapabilities = (
  currentModel: any,
  currentModelConfig: any,
  currentProviderConfig: any,
) => {
  const showThinkingButton = React.useMemo(() => {
    return currentModel?.is_thinking !== undefined
      ? !!currentModel.is_thinking
      : !!currentModelConfig?.is_thinking;
  }, [currentModel, currentModelConfig]);

  const showSearchButton = React.useMemo(() => {
    let result: boolean;
    if (currentModel?.is_search !== undefined) {
      result = !!currentModel.is_search;
    } else if (currentModelConfig?.is_search !== undefined) {
      result = !!currentModelConfig.is_search;
    } else {
      result = !!currentProviderConfig?.is_search;
    }
    return result;
  }, [currentModel, currentModelConfig, currentProviderConfig]);

  const showMemoryButton = React.useMemo(() => {
    return currentModel?.is_memory === true;
  }, [currentModel]);

  const supportsUpload = React.useMemo(() => {
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

  return {
    showThinkingButton,
    showSearchButton,
    showMemoryButton,
    supportsUpload,
  };
};

const useProvidersConfig = (currentModel: any, providers: any[]) => {
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

  return { currentProviderConfig, currentModelConfig };
};

const useTextareaAutoResize = (
  textareaRef: React.RefObject<HTMLTextAreaElement>,
  message: string,
) => {
  const rafIdRef = React.useRef<number | null>(null);
  const resizeCountRef = React.useRef(0);
  const lastResizeTime = React.useRef(performance.now());

  React.useEffect(() => {
    resizeCountRef.current += 1;
    const msgLength = message?.length || 0;
    const now = performance.now();
    const timeSinceLastResize = now - lastResizeTime.current;

    // Cancel any pending resize
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current);
    }

    // 🚀 OPTIMIZATION: Skip auto-resize for very large text (>50k chars)
    // Let it use fixed max height with scroll instead
    const isVeryLargeText = msgLength > 50000;

    if (isVeryLargeText) {
      const el = textareaRef.current;
      if (el) {
        el.style.height = "240px"; // max height
        el.style.overflowY = "auto";
      }
      lastResizeTime.current = performance.now();
      return;
    }

    // Schedule resize in next animation frame for normal text
    rafIdRef.current = requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (!el) return;

      el.style.height = "auto";
      const maxHeight = 240;
      el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
      el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";

      rafIdRef.current = null;
      lastResizeTime.current = performance.now();
    });

    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
    };
  }, [message, textareaRef]);
};

const useModelSelection = (
  folderPath: string | null | undefined,
  setCurrentModel: (model: any) => void,
  setCurrentAccount: (account: any) => void,
  currentModel: any,
  currentAccount: any,
) => {
  const [isLoadingCache, setIsLoadingCache] = React.useState(true);
  const pendingAccountIdRef = React.useRef<string | null>(null);
  const currentModelRef = React.useRef<any>(null);
  const currentAccountRef = React.useRef<any>(null);

  currentModelRef.current = currentModel;
  currentAccountRef.current = currentAccount;

  // Load saved selection
  React.useEffect(() => {
    let cancelled = false;
    setIsLoadingCache(true);
    const key = `zen-model-selection:${folderPath || "global"}`;

    const applyCache = (saved: any) => {
      if (cancelled) return;
      if (saved.model && !currentModelRef.current) setCurrentModel(saved.model);
      if (saved.accountId && !currentAccountRef.current) {
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
  }, [folderPath, setCurrentModel, setCurrentAccount]);

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
  }, [currentModel, currentAccount, folderPath]);

  return {
    isLoadingCache,
    pendingAccountIdRef,
  };
};

// ============================================================================
// TOGGLE BUTTONS
// ============================================================================

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
        border: "none",
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
        border: "none",
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

// ============================================================================
// GLOBAL PERMISSION BUTTON
// ============================================================================

const GlobalPermissionButton: React.FC = () => {
  const { permissionMode, setPermissionMode } = useSettings();
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

  const metadata =
    PERMISSION_MODE[permissionMode] || PERMISSION_MODE.fullAccess;

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
          {Object.entries(PERMISSION_MODE).map(([modeId, meta]) => {
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
      {tooltip && PERMISSION_MODE[tooltip.id] && (
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
              color: PERMISSION_MODE[tooltip.id].color,
            }}
          >
            {PERMISSION_MODE[tooltip.id].label}
          </div>
          {PERMISSION_MODE[tooltip.id].desc}
        </div>
      )}
    </div>
  );
};

const MessageInput: React.FC<MessageInputProps> = React.memo(
  ({
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
    fileInputRef,
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
    onGitPullRequest,
    isGitLoading = false,
    isGitStatusVisible = false,
    gitStatus,
    onOpenGitStatus,
    conversationFileStats,
    onReviewClick,
    responseRange,
    responseRanges = [],
    onModelSwitch,
    onRevertConversation,
    autoScrollPaused = false,
    scrollToBottom,
  }) => {
    // 🔍 PERFORMANCE DEBUG LOGS
    const renderCountRef = React.useRef(0);
    renderCountRef.current++;

    const { isConnected, isElaraMismatch, apiUrl } = useBackendConnection();
    const { aiLanguage: preferredLanguage } = useSettings();
    const [providers, setProviders] = React.useState<any[]>([]);
    const [showModelDrawer, setShowModelDrawer] = React.useState(false);
    const [pendingModelSwitch, setPendingModelSwitch] = React.useState<{
      model: any;
      account: any;
    } | null>(null);
    const [isModelSwitchMode, setIsModelSwitchMode] = React.useState(false);
    const [isPlusHovered, setIsPlusHovered] = React.useState(false);
    const [isGitHovered, setIsGitHovered] = React.useState(false);
    const [showLogDrawer, setShowLogDrawer] = React.useState(false);

    // Use custom hooks
    const [isThinking, toggleThinking, setIsThinking] = useToggleState(
      "zen-thinking-enabled",
    );
    const [isSearch, toggleSearch, setIsSearch] =
      useToggleState("zen-search-enabled");
    const [isMemory, , setIsMemory] = useToggleState("zen-memory-enabled");

    const { isLoadingCache, pendingAccountIdRef } = useModelSelection(
      folderPath,
      setCurrentModel,
      setCurrentAccount,
      currentModel,
      currentAccount,
    );

    const { currentProviderConfig, currentModelConfig } = useProvidersConfig(
      currentModel,
      providers,
    );

    const {
      showThinkingButton,
      showSearchButton,
      showMemoryButton,
      supportsUpload,
    } = useModelCapabilities(
      currentModel,
      currentModelConfig,
      currentProviderConfig,
    );

    useTextareaAutoResize(textareaRef, message);

    const displayModel = React.useMemo(() => {
      return currentModel || null;
    }, [currentModel]);

    const displayAccount = React.useMemo(() => {
      return currentAccount || null;
    }, [currentAccount]);

    const toggleMemory = async () => {
      if (!currentAccount?.id) {
        console.warn("No account selected, cannot toggle memory");
        return;
      }

      const newState = !isMemory;
      setIsMemory(newState);
      localStorage.setItem("zen-memory-enabled", String(newState));

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
          setIsMemory(!newState);
          localStorage.setItem("zen-memory-enabled", String(!newState));
          console.error(
            "Failed to update memory state on server:",
            result.message,
          );
        }
      } catch (error) {
        setIsMemory(!newState);
        localStorage.setItem("zen-memory-enabled", String(!newState));
        console.error("Failed to sync memory state with server:", error);
      }
    };

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

    // Sync thinking and search toggles when model changes
    React.useEffect(() => {
      if (providers.length === 0 || !currentModel) {
        return;
      }
      const hasThinking =
        currentModel?.is_thinking !== undefined
          ? !!currentModel.is_thinking
          : !!currentModelConfig?.is_thinking;
      const hasSearch =
        currentModel?.is_search !== undefined
          ? !!currentModel.is_search || !!currentProviderConfig?.is_search
          : !!currentModelConfig?.is_search ||
            !!currentProviderConfig?.is_search;

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
      setIsThinking,
      setIsSearch,
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

    // TRACK PROPS CHANGES - removed for performance

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
              : "1px solid var(--vscode-widget-border, rgba(255,255,255,0.08))",
            transition: "border 0.3s ease",
            marginTop:
              !isConversationStarted ||
              (isConnected && isElaraMismatch) ||
              isConversationStarted
                ? "24px"
                : "0px", // Space for badges/DiffSummaryBar sticking up
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

          {/* 🆕 CHAT PANEL DIFF SUMMARY BAR (Stuck to Border) - Only when isConversationStarted */}
          {isConversationStarted && (
            <div
              style={{
                position: "absolute",
                bottom: "100%",
                left: "50%",
                transform: "translateX(-50%)",
                width: "98%",
                zIndex: 20,
              }}
            >
              <DiffSummaryBar
                totalChanges={conversationFileStats?.totalFiles || 0}
                addedLines={conversationFileStats?.totalAdditions || 0}
                removedLines={conversationFileStats?.totalDeletions || 0}
                onClick={onOpenGitStatus}
                onReviewClick={onReviewClick}
                onRevert={onRevertConversation}
                responseRange={responseRange}
                responseRanges={responseRanges}
                autoScrollPaused={autoScrollPaused}
                scrollToBottom={scrollToBottom}
              />
            </div>
          )}
          {showModelDrawer && (
            <ModelAccountDrawer
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

                const newAccount = {
                  id: selected.accountId,
                  email: selected.email,
                };

                if (isModelSwitchMode) {
                  // Switch mode: show confirmation dialog
                  setPendingModelSwitch({
                    model: newModel,
                    account: newAccount,
                  });
                  setShowModelDrawer(false);
                  setIsModelSwitchMode(false); // Reset flag
                } else {
                  // Normal mode: apply immediately
                  setCurrentModel(newModel);
                  setCurrentAccount(newAccount);

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
                }
              }}
            />
          )}

          {/* Model Switch Confirmation Dialog */}
          {pendingModelSwitch && (
            <div
              style={{
                position: "fixed",
                top: 0,
                left: 0,
                right: 0,
                bottom: 0,
                backgroundColor: "rgba(0, 0, 0, 0.5)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                zIndex: 10001,
              }}
              onClick={() => setPendingModelSwitch(null)}
            >
              <div
                onClick={(e) => e.stopPropagation()}
                style={{
                  backgroundColor: "var(--vscode-editor-background)",
                  border: "1px solid var(--vscode-widget-border)",
                  borderRadius: "8px",
                  padding: "20px",
                  maxWidth: "400px",
                  width: "90%",
                }}
              >
                <div
                  style={{
                    fontSize: "16px",
                    fontWeight: 600,
                    marginBottom: "12px",
                    color: "var(--vscode-foreground)",
                  }}
                >
                  Switch Model?
                </div>
                <div
                  style={{
                    fontSize: "13px",
                    marginBottom: "16px",
                    color: "var(--vscode-descriptionForeground)",
                    lineHeight: 1.5,
                  }}
                >
                  You're about to switch to:
                  <div
                    style={{
                      marginTop: "8px",
                      padding: "8px 12px",
                      backgroundColor: "var(--vscode-input-background)",
                      borderRadius: "4px",
                      fontSize: "12px",
                      fontFamily: "var(--vscode-editor-font-family, monospace)",
                    }}
                  >
                    <strong>
                      {pendingModelSwitch.model.providerId}/
                      {pendingModelSwitch.model.id}
                    </strong>
                    {pendingModelSwitch.account.email && (
                      <div style={{ marginTop: "4px", opacity: 0.8 }}>
                        {pendingModelSwitch.account.email}
                      </div>
                    )}
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: "8px",
                    justifyContent: "flex-end",
                  }}
                >
                  <button
                    onClick={() => setPendingModelSwitch(null)}
                    style={{
                      padding: "6px 16px",
                      borderRadius: "4px",
                      border: "1px solid var(--vscode-widget-border)",
                      backgroundColor: "transparent",
                      color: "var(--vscode-foreground)",
                      fontSize: "13px",
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor =
                        "var(--vscode-list-hoverBackground)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      // Prepare context data from current range
                      const currentRange = responseRanges.find(
                        (r) => r.isCurrent,
                      );

                      // Extract user messages from current range
                      const userMessagesInRange: Array<{
                        content: string;
                        responseNumber: number;
                      }> = [];
                      if (currentRange) {
                        // Find user messages in the current response range
                        let responseCount = 0;
                        for (const msg of messages) {
                          if (msg.role === "assistant") {
                            responseCount++;
                          }
                          if (
                            msg.role === "user" &&
                            responseCount >= currentRange.start - 1 &&
                            responseCount <= currentRange.end
                          ) {
                            userMessagesInRange.push({
                              content: msg.content,
                              responseNumber: responseCount,
                            });
                          }
                        }
                      }

                      const contextData = {
                        fileChanges: currentRange
                          ? Array.from(currentRange.fileChanges.entries()).map(
                              ([path, stats]) => ({
                                path,
                                additions: stats.additions,
                                deletions: stats.deletions,
                              }),
                            )
                          : [],
                        userMessages: userMessagesInRange,
                      };

                      // Call parent handler
                      if (onModelSwitch) {
                        onModelSwitch(
                          pendingModelSwitch.model,
                          pendingModelSwitch.account,
                          contextData,
                        );
                      }

                      // Apply model switch
                      setCurrentModel(pendingModelSwitch.model);
                      setCurrentAccount(pendingModelSwitch.account);

                      // Clear pending
                      setPendingModelSwitch(null);
                    }}
                    style={{
                      padding: "6px 16px",
                      borderRadius: "4px",
                      border: "none",
                      backgroundColor: "var(--vscode-button-background)",
                      color: "var(--vscode-button-foreground)",
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor =
                        "var(--vscode-button-hoverBackground)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor =
                        "var(--vscode-button-background)";
                    }}
                  >
                    Confirm Switch
                  </button>
                </div>
              </div>
            </div>
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
                  // Only send if not history mode, connected, not loading, not processing
                  if (
                    !isHistoryMode &&
                    isConnected &&
                    !isLoadingCache &&
                    !isProcessing
                  ) {
                    handleSend(currentModel, currentAccount);
                  }
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
                  ? "History mode - enter a search query"
                  : !isConnected
                    ? "Connecting to backend..."
                    : isLoadingCache
                      ? "Loading cache..."
                      : isProcessing
                        ? "Processing..."
                        : "Message @agent (Alt+@)"
              }
              disabled={false}
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
                overflow: "hidden",
                whiteSpace: "pre-wrap",
                wordWrap: "break-word",
                opacity: 1,
                cursor: "text",
                boxSizing: "border-box",
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
              <div
                onClick={() => {
                  // Use the file input ref from parent
                  if (fileInputRef?.current) {
                    // Store textOnly flag on the input element for the change handler to use
                    (fileInputRef.current as any).dataset.textOnly =
                      String(!supportsUpload);
                    fileInputRef.current.click();
                  } else {
                    // Fallback: use handleFileSelect
                    handleFileSelect();
                  }
                }}
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
                title={
                  supportsUpload ? "Attach files" : "Attach text files only"
                }
              >
                <PlusIcon />
              </div>

              {/* Git Status Button */}
              {onGitPullRequest && (
                <div
                  onClick={() => {
                    if (!isGitLoading && !isProcessing && !isGitStatusVisible) {
                      onGitPullRequest();
                    }
                  }}
                  onMouseEnter={() => setIsGitHovered(true)}
                  onMouseLeave={() => setIsGitHovered(false)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    height: "22px",
                    width: "22px",
                    boxSizing: "border-box",
                    borderRadius: "4px",
                    cursor:
                      isGitLoading || isProcessing || isGitStatusVisible
                        ? "default"
                        : "pointer",
                    transition: "all 0.2s ease-in-out",
                    border: "1px solid rgba(128, 128, 128, 0.2)",
                    background:
                      isGitHovered &&
                      !isGitLoading &&
                      !isProcessing &&
                      !isGitStatusVisible
                        ? "rgba(128, 128, 128, 0.2)"
                        : "rgba(128, 128, 128, 0.12)",
                    color:
                      isGitLoading || isProcessing || isGitStatusVisible
                        ? "var(--vscode-descriptionForeground, #8c8c8c)"
                        : "var(--vscode-foreground)",
                    opacity:
                      isGitHovered &&
                      !isGitLoading &&
                      !isProcessing &&
                      !isGitStatusVisible
                        ? 0.9
                        : isGitLoading || isProcessing || isGitStatusVisible
                          ? 0.5
                          : 0.7,
                  }}
                  title="Git Pull Request"
                >
                  <GitPullRequestArrow size={12} strokeWidth={2.5} />
                </div>
              )}

              {/* Log Button */}
              <div
                onClick={() => setShowLogDrawer(true)}
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
                  background: "rgba(128, 128, 128, 0.12)",
                  color: "var(--vscode-foreground)",
                  opacity: 0.7,
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(128, 128, 128, 0.2)";
                  e.currentTarget.style.opacity = "0.9";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background =
                    "rgba(128, 128, 128, 0.12)";
                  e.currentTarget.style.opacity = "0.7";
                }}
                title="View Console Logs"
              >
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  width="12"
                  height="12"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M16 14v2.2l1.6 1" />
                  <path d="M16 4h2a2 2 0 0 1 2 2v.832" />
                  <path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h2" />
                  <circle cx="16" cy="16" r="6" />
                  <rect x="8" y="2" width="8" height="4" rx="1" />
                </svg>
              </div>

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

          {/* Log Drawer */}
          <LogDrawer
            isOpen={showLogDrawer}
            onClose={() => setShowLogDrawer(false)}
          />
        </div>
      </div>
    );
  },
);

export default React.memo(MessageInput, (prevProps, nextProps) => {
  // Only re-render when essential props change
  // Skip re-render when only message length changes (typing)
  // or when non-essential callbacks change
  const messageSame = prevProps.message === nextProps.message;
  const isProcessingSame = prevProps.isProcessing === nextProps.isProcessing;
  const isStreamingSame = prevProps.isStreaming === nextProps.isStreaming;
  const currentModelSame =
    prevProps.currentModel?.id === nextProps.currentModel?.id;
  const currentAccountSame =
    prevProps.currentAccount?.id === nextProps.currentAccount?.id;
  const messagesLengthSame =
    prevProps.messages?.length === nextProps.messages?.length;
  const responseRangesSame =
    prevProps.responseRanges?.length === nextProps.responseRanges?.length;
  const conversationFileStatsSame =
    prevProps.conversationFileStats === nextProps.conversationFileStats;

  // Only re-render if critical props changed
  const shouldSkip =
    messageSame &&
    isProcessingSame &&
    isStreamingSame &&
    currentModelSame &&
    currentAccountSame &&
    messagesLengthSame &&
    responseRangesSame &&
    conversationFileStatsSame;

  return shouldSkip;
});
