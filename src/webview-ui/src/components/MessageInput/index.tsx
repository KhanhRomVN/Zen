import React from "react";
import { Plus, Send, X } from "lucide-react";
import { flushSync } from "react-dom";
import { MentionPopup } from "./MentionPopup";
import { useMentionEditor } from "./hooks/useMentionEditor";
import {
  getFileBadgePath,
  placeCaretAtEnd,
  renderMessageToEditor,
  resolveMentionTokens,
  serializeEditor,
} from "./mentionEditor";
import { extensionService } from "@/services/ExtensionService";
import { useProject } from "@/context/ProjectContext";
import { useWorkspaceZipSize } from "./hooks/useWorkspaceZipSize";
import { ClaudeZipBadge } from "./ClaudeZipBadge";
import { SimpleTooltip, TooltipRow, TooltipCard } from "./SimpleTooltip";
import { ZenCliHintBar } from "./ZenCliHintBar";
import { useBackendConnection } from "../../context/BackendConnectionContext";
import { LANGUAGES } from "../../features/setting/components/general/LanguageSelector";
import { useSettings } from "../../context/SettingsContext";
import { useModelPromptSettings } from "../../hooks/useModelPromptSettings";
import { useDbFetch } from "../../services/useDbFetch";
import { useAccountStats } from "../../hooks/useAccountStats";
import { combinePromptsForMode } from "../../features/chat/prompts";
import { buildClaudePrompt } from "../../features/chat/prompts/claude-system-prompt";
import type { SystemInfo } from "../../features/chat/prompts";
import ProviderModelDrawer from "./ProviderModelDrawer";
import { cacheGet, cacheSet, providersKey } from "./providerModelCache";
import EffortDropdown, { getModelEffortInfo } from "./EffortDropdown";
import type { EffortLevel } from "./EffortDropdown";
import PromptLengthDropdown, {
  PromptLengthTriggerIcon,
  PROMPT_LENGTH_MODE_META,
} from "./PromptLengthDropdown";
import PromptSettingsDropdown from "./PromptSettingsDropdown";
import ActionDropdown from "./ActionDropdown";
import { getFaviconUrl } from "../../utils/favicon";
import { getClientId } from "../../utils/clientId";
import { countTokens, formatTokenCount } from "../../utils/tokenizer";
import { buildAcceptString } from "../../features/chat/utils/fileUtils";
import type {
  MessageInputProps,
  UploadedFile,
  ToggleButtonProps,
} from "./types";

export type { UploadedFile };

// ============================================================================
// ICONS
// ============================================================================

const BrainCogIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="14"
    height="14"
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
    width="14"
    height="14"
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

  const supportsUpload = React.useMemo(() => {
    let result: boolean;
    if (currentModel?.is_image_upload !== undefined) {
      result = !!currentModel.is_image_upload;
    } else if (currentModelConfig?.is_image_upload !== undefined) {
      result = !!currentModelConfig.is_image_upload;
    } else {
      result = false;
    }

    return result;
  }, [currentModel, currentProviderConfig, currentModelConfig]);

  const supportsImageGenerator = React.useMemo(() => {
    return currentModel?.is_image_generator === true;
  }, [currentModel]);

  const supportsVideoGenerator = React.useMemo(() => {
    return currentModel?.is_video_generator === true;
  }, [currentModel]);

  const supportsDeepResearch = React.useMemo(() => {
    return currentModel?.is_deep_research === true;
  }, [currentModel]);

  return {
    showThinkingButton,
    showSearchButton,
    supportsUpload,
    supportsImageGenerator,
    supportsVideoGenerator,
    supportsDeepResearch,
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
          setCurrentAccount({
            id: saved.accountId,
            email: saved.email,
            _partial: true,
          });
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

/** Render "Label ... [ON|OFF]" dạng pill với màu accent khi ON, mờ khi OFF */
const TooltipToggle = ({
  label,
  isOn,
  accentColor,
}: {
  label: string;
  isOn: boolean;
  accentColor: string;
}) => (
  <TooltipCard>
    <TooltipRow
      label={label}
      value={isOn ? "ON" : "OFF"}
      color={accentColor}
      active={isOn}
    />
  </TooltipCard>
);

/**
 * Icon-only toggle button dùng chung cho Thinking / Search / Memory.
 * `accentColor` xác định màu khi ON.
 */
const IconToggleButton: React.FC<
  ToggleButtonProps & {
    accentColor: string;
    children: React.ReactNode;
    tooltipContent: React.ReactNode;
  }
> = ({ isOn, onClick, accentColor, children, tooltipContent }) => {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <SimpleTooltip content={tooltipContent}>
      <button
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "24px",
          width: "24px",
          boxSizing: "border-box",
          borderRadius: "5px",
          cursor: "pointer",
          transition: "all 0.15s ease-in-out",
          border: "1px solid transparent",
          background: isOn
            ? isHovered
              ? `color-mix(in srgb, ${accentColor} 22%, transparent)`
              : `color-mix(in srgb, ${accentColor} 14%, transparent)`
            : isHovered
              ? "rgba(128, 128, 128, 0.16)"
              : "transparent",
          color: isOn ? accentColor : "var(--vscode-foreground)",
          opacity: isOn ? 1 : isHovered ? 1 : 0.75,
          padding: 0,
        }}
      >
        {children}
      </button>
    </SimpleTooltip>
  );
};

const ThinkingButton: React.FC<ToggleButtonProps> = ({
  isOn,
  onClick,
  title,
}) => (
  <IconToggleButton
    isOn={isOn}
    onClick={onClick}
    title={title}
    accentColor="#a855f7"
    tooltipContent={
      <TooltipToggle label="Thinking" isOn={isOn} accentColor="#a855f7" />
    }
  >
    <BrainCogIcon />
  </IconToggleButton>
);

const SearchButton: React.FC<ToggleButtonProps> = ({
  isOn,
  onClick,
  title,
}) => (
  <IconToggleButton
    isOn={isOn}
    onClick={onClick}
    title={title}
    accentColor="#0ea5e9"
    tooltipContent={
      <TooltipToggle label="Search" isOn={isOn} accentColor="#0ea5e9" />
    }
  >
    <GlobeIcon />
  </IconToggleButton>
);

const PROMPT_HISTORY_KEY = "zen:user_prompt_history";
const MAX_PROMPT_HISTORY = 50;

const getStoredPromptHistory = (): string[] => {
  try {
    const raw = localStorage.getItem(PROMPT_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const savePromptToHistory = (prompt: string) => {
  if (!prompt || !prompt.trim()) return;
  const clean = prompt.trim();
  try {
    const history = getStoredPromptHistory().filter((p) => p !== clean);
    history.push(clean);
    if (history.length > MAX_PROMPT_HISTORY) {
      history.splice(0, history.length - MAX_PROMPT_HISTORY);
    }
    localStorage.setItem(PROMPT_HISTORY_KEY, JSON.stringify(history));
  } catch {}
};

const MessageInput: React.FC<MessageInputProps> = React.memo(
  ({
    message,
    setMessage,
    isHistoryMode = false,
    uploadedFiles,
    attachedItems = [],
    textareaRef,
    handleTextareaChange,
    handleKeyDown,
    handlePaste,
    handleDragOver,
    handleDrop,
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
    onRequestGitRepoPicker,
    isGitLoading = false,
    isGitStatusVisible = false,
    gitStatus,
    onOpenGitStatus,
    onReviewClick,
    responseRange,
    responseRanges = [],
    onModelSwitch,
    onRevertConversation,
    autoScrollPaused = false,
    scrollToBottom,
    onSelectSkills,
    conversationDiagnosticEnabled,
    conversationUseSkillEnabled,
    conversationMemoryEnabled,
    conversationToolFormat,
    onConversationDiagnosticToggle,
    onConversationUseSkillToggle,
    onConversationMemoryToggle,
    onConversationToolFormatToggle,
  }) => {
    // 🔍 PERFORMANCE DEBUG LOGS
    const renderCountRef = React.useRef(0);
    renderCountRef.current++;

    // Removed Prompt History Navigation to restore default ArrowUp/ArrowDown behavior

    const editorRef = React.useRef<HTMLDivElement>(null);
    const handleSendRef = React.useRef(handleSend);
    handleSendRef.current = handleSend;

    const syncEditorToMessage = React.useCallback(() => {
      const editor = editorRef.current;
      const hidden = textareaRef.current;
      if (!editor || !hidden) return;
      hidden.value = serializeEditor(editor);
      handleTextareaChange({
        target: hidden,
        currentTarget: hidden,
      } as React.ChangeEvent<HTMLTextAreaElement>);
    }, [textareaRef, handleTextareaChange]);

    const mention = useMentionEditor(editorRef, syncEditorToMessage);

    React.useEffect(() => {
      const editor = editorRef.current;
      if (!editor || serializeEditor(editor) === message) return;
      renderMessageToEditor(editor, message);
      if (document.activeElement === editor) placeCaretAtEnd(editor);
    }, [message]);

    const onSendMessage = () => {
      const resolved = resolveMentionTokens(message);
      if (resolved.trim()) {
        savePromptToHistory(resolved);
      }
      if (resolved !== message) {
        flushSync(() => setMessage(resolved));
        handleSendRef.current(currentModel, currentAccount);
        return;
      }
      handleSend(currentModel, currentAccount);
    };

    const { isConnected, isElaraMismatch, apiUrl } = useBackendConnection();
    const { aiLanguage: preferredLanguage } = useSettings();

    // systemPromptMode + promptLengthMode: per provider+model, fallback về global
    const {
      systemPromptMode,
      setSystemPromptMode,
      promptLengthMode,
      setPromptLengthMode,
    } = useModelPromptSettings(currentModel?.providerId, currentModel?.id);

    const dbFetch = useDbFetch();
    const [providers, setProviders] = React.useState<any[]>([]);
    const [isLoadingProviders, setIsLoadingProviders] = React.useState(false);
    const [showModelDrawer, setShowModelDrawer] = React.useState(false);
    const [isPromptLengthHovered, setIsPromptLengthHovered] =
      React.useState(false);

    const [pendingModelSwitch, setPendingModelSwitch] = React.useState<{
      model: any;
      account: any;
    } | null>(null);
    const [isModelSwitchMode, setIsModelSwitchMode] = React.useState(false);
    const [isPlusHovered, setIsPlusHovered] = React.useState(false);

    // Use custom hooks
    const [isThinking, toggleThinking, setIsThinking] = useToggleState(
      "zen-thinking-enabled",
    );
    const [isSearch, toggleSearch, setIsSearch] =
      useToggleState("zen-search-enabled");

    const { isLoadingCache, pendingAccountIdRef } = useModelSelection(
      folderPath,
      setCurrentModel,
      setCurrentAccount,
      currentModel,
      currentAccount,
    );

    // ─── Presence heartbeat ──────────────────────────────────────────
    // Báo cho backend biết cửa sổ này đang active account nào, để các
    // cửa sổ khác thấy badge "In use". Gửi ngay khi account đổi và lặp
    // lại mỗi 20s; release account cũ khi đổi/đóng.
    React.useEffect(() => {
      const accountId = currentAccount?.id;
      if (!accountId) return;
      const clientId = getClientId();
      const projectName =
        (folderPath || "").replace(/[\\/]+$/, "").split(/[\\/]/).pop() || "";
      let cancelled = false;
      const beat = () => {
        if (cancelled) return;
        dbFetch(`/v1/accounts/${accountId}/presence`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ clientId, projectName }),
        }).catch(() => {});
      };
      beat();
      const intervalId = setInterval(beat, 20000);
      return () => {
        cancelled = true;
        clearInterval(intervalId);
        dbFetch(
          `/v1/accounts/${accountId}/presence?clientId=${encodeURIComponent(clientId)}`,
          { method: "DELETE" },
        ).catch(() => {});
      };
    }, [currentAccount?.id, apiUrl, dbFetch, folderPath]);

    const { currentProviderConfig, currentModelConfig } = useProvidersConfig(
      currentModel,
      providers,
    );

    // ─── Anti-System-Prompt-Injection detection ──────────────────────
    // Cờ này lấy từ backend constant (claude.constant.ts). Nếu false (comment out),
    // toàn bộ cơ chế đặc thù (zip badge, ẩn dropdown, prompt riêng) sẽ tắt theo.
    const isAntiInjectionProvider = !!(currentProviderConfig as any)
      ?.anti_system_prompt_injection;

    // ─── Workspace zip-size badge ────────────────────────────────────
    // Chỉ kích hoạt khi provider có anti-injection flag = true.
    const { rootPath } = useProject();
    // triggerKey: đổi khi rootPath hoặc model đổi → invalidate cache, chạy lại
    const zipTriggerKey = React.useMemo(() => {
      if (!isAntiInjectionProvider || !rootPath) return null;
      return `${rootPath}::${currentModel?.id ?? ""}`;
    }, [isAntiInjectionProvider, rootPath, currentModel?.id]);
    const zipSizeState = useWorkspaceZipSize(
      isAntiInjectionProvider,
      zipTriggerKey,
    );



    const {
      showThinkingButton,
      showSearchButton,
      supportsUpload,
      supportsImageGenerator,
      supportsVideoGenerator,
      supportsDeepResearch,
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

    const effortInfo = React.useMemo(
      () =>
        getModelEffortInfo(
          providers,
          currentModel?.providerId,
          currentModel?.id,
        ),
      [providers, currentModel?.providerId, currentModel?.id],
    );

    const handleEffortChange = React.useCallback(
      (lvl: EffortLevel) => {
        if (!currentModel || !effortInfo) return;
        const nextId = `${effortInfo.base}-${lvl}`;
        const prov = providers.find(
          (p: any) =>
            p.provider_id?.toLowerCase() ===
            currentModel.providerId?.toLowerCase(),
        );
        const modelObj = prov?.models?.find((m: any) => m.id === nextId);
        if (!modelObj) return;
        setCurrentModel({
          ...currentModel,
          id: nextId,
          modelId: nextId,
          name: modelObj.name || nextId,
          is_thinking: modelObj.is_thinking ?? false,
          is_search: modelObj.is_search ?? false,
          is_image_upload: modelObj.is_image_upload ?? false,
          is_video_upload: modelObj.is_video_upload ?? false,
          is_audio_upload: modelObj.is_audio_upload ?? false,
          is_file_upload: modelObj.is_file_upload ?? false,
        });
      },
      [currentModel, effortInfo, providers, setCurrentModel],
    );

    // Fetch live stats từ /v1/accounts/:id để triggerUI luôn có usage mới nhất
    // refreshInterval=30000: cập nhật mỗi 30s khi drawer mở (bug fix: triggerUI dùng data cũ)
    useAccountStats({
      accountId: currentAccount?.id,
      onStats: (freshAccount) => {
        setCurrentAccount((prev: any) => ({ ...prev, ...freshAccount }));
      },
      refreshInterval: 30_000,
    });

    // Dynamic placeholder text
    const placeholderText = React.useMemo(() => {
      if (isHistoryMode) {
        return "History mode - enter a search query";
      }
      if (!isConnected) {
        return "Connecting to backend...";
      }
      if (isLoadingCache) {
        return "Loading cache...";
      }
      if (isProcessing) {
        return "Processing...";
      }
      if (!currentModel) {
        return "Select a model to start";
      }
      if (!currentAccount) {
        return "Select an account to start";
      }

      // Default: concise single-line placeholder, no emoji
      return "Type a message...";
    }, [
      isHistoryMode,
      isConnected,
      isLoadingCache,
      isProcessing,
      currentModel,
      currentAccount,
      supportsUpload,
      showThinkingButton,
      showSearchButton,
    ]);

    // Calculate token count for message input (including system prompt + text snippets)
    const messageTokenCount = React.useMemo(() => {
      // Count tokens in textarea message
      let totalTokens = countTokens(message);

      // Add tokens from text snippets in attachedItems
      if (attachedItems && attachedItems.length > 0) {
        attachedItems.forEach((item: any, index: number) => {
          if (item.type === "text-snippet" && item.content) {
            const snippetTokens = countTokens(item.content);
            totalTokens += snippetTokens;
          }
        });
      }

      // Add system prompt tokens (only for first message in conversation)
      if (!isConversationStarted) {
        try {
          let systemPrompt: string;

          if (isAntiInjectionProvider) {
            // Anti-injection provider dùng prompt riêng — không phụ thuộc promptLengthMode/systemPromptMode
            systemPrompt = buildClaudePrompt({ language: preferredLanguage });
          } else {
            // Generic providers: build theo mode + length
            systemPrompt = combinePromptsForMode(
              {
                language: preferredLanguage,
                systemInfo: {
                  os: "Unknown OS",
                  ide: "Zen IDE",
                  shell: "unknown",
                  homeDir: "~",
                  cwd: folderPath || ".",
                  language: preferredLanguage,
                } as SystemInfo,
                promptLengthMode,
              },
              systemPromptMode,
            );
          }

          const systemPromptTokens = countTokens(systemPrompt);
          totalTokens += systemPromptTokens;
        } catch (e) {
          console.warn(
            "[MessageInput] Failed to calculate system prompt tokens:",
            e,
          );
        }
      }

      return totalTokens;
    }, [
      message,
      isConversationStarted,
      preferredLanguage,
      promptLengthMode,
      systemPromptMode,
      folderPath,
      currentModel?.providerId,
      JSON.stringify(
        attachedItems?.map((item: any) => ({
          id: item.id,
          type: item.type,
          contentLength: item.content?.length || 0,
        })),
      ),
    ]);

    // 🔍 DEBUG: Monitor attachedItems changes
    React.useEffect(() => {
      if (attachedItems && attachedItems.length > 0) {
      }
    }, [attachedItems, messageTokenCount]);

    // Get max input tokens from model config
    const maxInputTokens = React.useMemo(() => {
      return currentModelConfig?.max_input_tokens || null;
    }, [currentModelConfig]);

    // Check if token limit exceeded
    const isTokenLimitExceeded = React.useMemo(() => {
      return maxInputTokens !== null && messageTokenCount > maxInputTokens;
    }, [messageTokenCount, maxInputTokens]);

    const providersScope = "default";

    const fetchProviders = React.useCallback(
      async (force = false) => {
        const cacheKey = providersKey(providersScope);
        const cached = cacheGet<any[]>(cacheKey);
        if (cached) setProviders(cached);
        try {
          if (!cached || force === true) setIsLoadingProviders(true);
          const response = await dbFetch(`/v1/providers`);
          const result = await response.json();
          if (result.success) {
            const enabled = result.data.filter((p: any) => p.is_enabled);
            cacheSet(cacheKey, enabled);
            setProviders(enabled);
          }
        } catch (error) {
          // console.error("Failed to fetch providers:", error);
        } finally {
          setIsLoadingProviders(false);
        }
      },
      [dbFetch, providersScope],
    );

    const refreshProviders = React.useCallback(async () => {
      try {
        // Invalidate cache trước để force re-fetch models từ upstream
        await dbFetch(`/v1/providers/cache/clear`, { method: "POST" });
      } catch {
        // non-fatal
      }
      await fetchProviders(true);
    }, [dbFetch, fetchProviders]);

    // Initial fetch
    React.useEffect(() => {
      fetchProviders();
    }, [fetchProviders]);

    // Re-fetch providers every time the model drawer opens so stale data
    // (e.g. "No accounts" after user just added an account) is never shown.
    React.useEffect(() => {
      if (showModelDrawer) {
        fetchProviders();
      }
    }, [showModelDrawer, fetchProviders]);

    // Close model drawer when user navigates to another panel (Accounts, Settings, etc.)
    // so the drawer doesn't linger behind when they come back.
    React.useEffect(() => {
      const handler = () => setShowModelDrawer(false);
      window.addEventListener("zen:panel-change", handler);
      return () => window.removeEventListener("zen:panel-change", handler);
    }, []);

    // 🔍 VALIDATION: Check if currentModel and currentAccount still exist after providers loaded
    React.useEffect(() => {
      if (providers.length === 0 || isLoadingCache) return;

      let needsReset = false;

      // Validate currentModel
      if (currentModel?.id && currentModel?.providerId) {
        const provider = providers.find(
          (p: any) =>
            p.provider_id?.toLowerCase() ===
            currentModel.providerId?.toLowerCase(),
        );

        if (!provider) {
          console.warn(
            `[MessageInput] Provider ${currentModel.providerId} not found - resetting model`,
          );
          needsReset = true;
        } else {
          const modelExists = provider.models?.some(
            (m: any) => m.id?.toLowerCase() === currentModel.id?.toLowerCase(),
          );

          if (!modelExists) {
            console.warn(
              `[MessageInput] Model ${currentModel.id} not found in provider ${currentModel.providerId} - resetting model`,
            );
            needsReset = true;
          }
        }
      }

      // Validate currentAccount (async check)
      if (currentAccount?.id && currentModel?.providerId && !needsReset) {
        const validateAccount = async () => {
          try {
            const response = await dbFetch(
              `/v1/accounts?page=1&limit=50&provider_id=${currentModel.providerId}`,
            );
            const result = await response.json();

            if (result.success && result.data?.accounts) {
              const matchedAccount = result.data.accounts.find(
                (a: any) => a.id === currentAccount.id,
              );

              if (!matchedAccount) {
                console.warn(
                  `[MessageInput] Account ${currentAccount.id} not found - resetting model + account`,
                );
                // Account đã bị xóa → reset luôn model để triggerUI về "Select Model",
                // tránh giữ provider_id + model_id mà thiếu account.
                setCurrentModel(null);
                setCurrentAccount(null);
              } else if (
                matchedAccount.email &&
                matchedAccount.email !== currentAccount.email
              ) {
                // Email trong cache là snapshot cũ — account có thể đã bị sửa ở cửa sổ khác.
                // Cập nhật lại để triggerUI hiển thị email mới nhất từ server.
                setCurrentAccount({
                  ...currentAccount,
                  email: matchedAccount.email,
                });
              }
            }
          } catch (error) {
            console.error("[MessageInput] Failed to validate account:", error);
          }
        };

        validateAccount();
      }

      if (needsReset) {
        setCurrentModel(null);
        setCurrentAccount(null);
      }
    }, [
      providers,
      currentModel,
      currentAccount,
      isLoadingCache,
      dbFetch,
      setCurrentModel,
      setCurrentAccount,
    ]);

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

    // Auto-fix promptLengthMode & systemPromptMode khi provider có anti-injection flag = true
    React.useEffect(() => {
      if (!isAntiInjectionProvider) return;
      // Fix cứng về "none" — không cho user chọn option khác
      if (promptLengthMode !== "none") {
        setPromptLengthMode("none");
      }
      if (systemPromptMode !== "none") {
        setSystemPromptMode("none");
      }
    }, [
      isAntiInjectionProvider,
      promptLengthMode,
      systemPromptMode,
      setPromptLengthMode,
      setSystemPromptMode,
    ]);

    // Handle auto-selection of account from cache once providers are loaded
    React.useEffect(() => {
      if (
        pendingAccountIdRef.current &&
        providers.length > 0 &&
        (!currentAccount?.email || currentAccount?._partial) &&
        currentModel?.providerId
      ) {
        const fetchAccountsForProvider = async () => {
          try {
            const response = await dbFetch(
              `/v1/accounts?page=1&limit=50&provider_id=${currentModel.providerId}`,
            );
            const result = await response.json();
            if (result.success && result.data?.accounts) {
              const acc = result.data.accounts.find(
                (a: any) => a.id === pendingAccountIdRef.current,
              );
              if (acc) {
                setCurrentAccount(acc);
                pendingAccountIdRef.current = null; // Mark as resolved
              }
            }
          } catch (error) {
            // ignore
          }
        };
        fetchAccountsForProvider();
      }
    }, [providers, currentModel, currentAccount, dbFetch, setCurrentAccount]);

    // TRACK PROPS CHANGES - removed for performance

    return (
      <div
        style={{
          padding: "var(--spacing-md) 0",
          backgroundColor: "var(--secondary-bg)",
          position: "relative",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            position: "relative",
            marginTop:
              !isConversationStarted ||
              (isConnected && isElaraMismatch) ||
              isConversationStarted
                ? "24px"
                : "0px", // Space for badges/DiffSummaryBar sticking up
          }}
        >
          {/* ─── Wrapper có border: chỉ bao quanh textarea + toolbar ─── */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              position: "relative",
              borderRadius: "var(--border-radius)",
              border: !isConnected
                ? "1px dashed var(--vscode-errorForeground, #f44336)"
                : isTokenLimitExceeded
                  ? "2px dashed var(--vscode-errorForeground, #f44336)"
                  : "1px solid var(--vscode-widget-border, rgba(255,255,255,0.08))",
              transition: "border 0.3s ease",
            }}
          >
            {mention.isOpen && (
              <MentionPopup
                items={mention.items}
                query={mention.query ?? ""}
                onSelect={mention.selectItem}
              />
            )}
            {/* 🆕 HOME PANEL BADGE (Stuck to Border) - Only when !isConversationStarted */}
            {!isConversationStarted && !mention.isOpen && (
              <div
                onClick={() => {
                  setShowModelDrawer((v) => !v);
                }}
                style={{
                  position: "absolute",
                  bottom: "100%",
                  left: "8px",
                  backgroundColor: "var(--input-bg)",
                  color: "var(--primary-text)",
                  padding: "5px 10px",
                  fontSize: "11px",
                  fontWeight: 600,
                  zIndex: 20,
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  cursor: "pointer",
                  boxShadow: "0 -2px 6px rgba(0,0,0,0.1)",
                  transition: "all 0.2s ease",
                  // Normal border: overlap by 1px so badge sits flush on border.
                  // Error/warning dashed border: keep full gap so the border stays visible.
                  marginBottom:
                    !isConnected || isTokenLimitExceeded ? "1px" : "-1px",
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
                    {(() => {
                      const prov = providers.find(
                        (p: any) => p.provider_id === displayModel.providerId,
                      );
                      if (!prov?.website) {
                        return (
                          <span
                            className="codicon codicon-server-process"
                            style={{ fontSize: "12px" }}
                          />
                        );
                      }

                      const faviconUrl = getFaviconUrl(prov.website);
                      return (
                        <img
                          key={faviconUrl}
                          src={faviconUrl}
                          alt=""
                          style={{
                            width: "12px",
                            height: "12px",
                            borderRadius: "2px",
                            objectFit: "contain",
                          }}
                          onLoad={() => {}}
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display =
                              "none";
                          }}
                        />
                      );
                    })()}
                    {displayModel.providerId}/
                    {(() => {
                      // Tách effort suffix khỏi model id để hiển thị riêng
                      const EFFORT_LEVELS_TRIGGER = [
                        "low",
                        "medium",
                        "high",
                        "xhigh",
                        "max",
                      ] as const;
                      type EffortLvl = (typeof EFFORT_LEVELS_TRIGGER)[number];
                      const EFFORT_COLOR_TRIGGER: Record<EffortLvl, string> = {
                        low: "#6b7280",
                        medium: "#3b82f6",
                        high: "#10b981",
                        xhigh: "#f59e0b",
                        max: "#ef4444",
                      };
                      const EFFORT_LABEL_TRIGGER: Record<EffortLvl, string> = {
                        low: "Low",
                        medium: "Medium",
                        high: "High",
                        xhigh: "Extra",
                        max: "Max",
                      };
                      let baseId = displayModel.id;
                      let effort: EffortLvl | null = null;
                      for (const lvl of EFFORT_LEVELS_TRIGGER) {
                        if (displayModel.id.endsWith(`-${lvl}`)) {
                          baseId = displayModel.id.slice(0, -(lvl.length + 1));
                          effort = lvl;
                          break;
                        }
                      }
                      if (!effort) return <>{baseId}</>;
                      const effortColor = EFFORT_COLOR_TRIGGER[effort];
                      return (
                        <>
                          {baseId}{" "}
                          <span
                            style={{
                              fontSize: "10px",
                              fontWeight: 700,
                              padding: "1px 5px",
                              borderRadius: "3px",
                              backgroundColor: `color-mix(in srgb, ${effortColor} 15%, transparent)`,
                              color: effortColor,
                              letterSpacing: "0.02em",
                              verticalAlign: "middle",
                            }}
                          >
                            {EFFORT_LABEL_TRIGGER[effort]}
                          </span>
                        </>
                      );
                    })()}
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
                    {/* period_requests + period_tokens: hiển thị độc lập, không phụ thuộc usage */}
                    {displayAccount?.period_requests != null && (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "2px",
                          opacity: 0.75,
                          marginLeft: "4px",
                          color: "var(--secondary-text)",
                        }}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="9"
                          height="9"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="var(--vscode-testing-iconPassed, #22c55e)"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                        </svg>
                        {Number(
                          displayAccount.period_requests,
                        ).toLocaleString()}
                      </span>
                    )}
                    {displayAccount?.period_tokens != null && (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "2px",
                          opacity: 0.75,
                          marginLeft: "2px",
                          color: "var(--secondary-text)",
                        }}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="9"
                          height="9"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="var(--vscode-editorWarning-foreground, #f97316)"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <circle cx="8" cy="8" r="6" />
                          <path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
                          <path d="M7 6h1v4" />
                          <path d="m16.71 13.88.7.71-2.82 2.82" />
                        </svg>
                        {(() => {
                          const n = Number(displayAccount.period_tokens);
                          if (n >= 1_000_000)
                            return (n / 1_000_000).toFixed(1) + "M";
                          if (n >= 1_000) return (n / 1_000).toFixed(1) + "k";
                          return String(n);
                        })()}
                      </span>
                    )}
                    {/* usage %: chỉ hiển thị khi có */}
                    {displayAccount?.usage != null &&
                      (() => {
                        const usageNum = Number(displayAccount.usage);
                        const usageColor =
                          usageNum >= 90
                            ? "var(--vscode-editorError-foreground, #ef4444)"
                            : usageNum >= 70
                              ? "var(--vscode-editorWarning-foreground, #f97316)"
                              : "var(--secondary-text)";
                        return (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "2px",
                              opacity: 0.85,
                              marginLeft: "4px",
                              color: usageColor,
                            }}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              width="9"
                              height="9"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                              strokeLinecap="round"
                              strokeLinejoin="round"
                            >
                              <line x1="18" y1="20" x2="18" y2="10" />
                              <line x1="12" y1="20" x2="12" y2="4" />
                              <line x1="6" y1="20" x2="6" y2="14" />
                            </svg>
                            {usageNum.toFixed(1)}%
                          </span>
                        );
                      })()}
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
              <ProviderModelDrawer
                isOpen={showModelDrawer}
                onClose={() => setShowModelDrawer(false)}
                providers={providers}
                isLoadingProviders={isLoadingProviders}
                apiUrl={apiUrl}
                onRefresh={refreshProviders}
                cacheScope={providersScope}
                currentProviderId={currentModel?.providerId}
                currentModelId={currentModel?.id}
                currentAccountId={currentAccount?.id}
                currentEffort={effortInfo?.effort}
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
                    is_image_upload: modelObj?.is_image_upload ?? false,
                    is_video_upload: modelObj?.is_video_upload ?? false,
                    is_audio_upload: modelObj?.is_audio_upload ?? false,
                    is_file_upload: modelObj?.is_file_upload ?? false,
                  };

                  const newAccount = {
                    id: selected.accountId,
                    email: selected.email,
                    provider_id: selected.accountProviderId,
                    usage: selected.usage ?? null,
                    period_requests: selected.period_requests ?? null,
                    period_tokens: selected.period_tokens ?? null,
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
                        fontFamily:
                          "var(--vscode-editor-font-family, monospace)",
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
                            ? Array.from(
                                currentRange.fileChanges.entries(),
                              ).map(([path, stats]) => ({
                                path,
                                additions: stats.additions,
                                deletions: stats.deletions,
                              }))
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
            {showBrowserWarning &&
              currentModel?.providerId === "zai-browser" && (
                <div
                  onClick={
                    isLaunchingBrowser ? undefined : onLaunchBrowserSession
                  }
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
          .custom-scrollbar {
            scrollbar-width: thin;
            scrollbar-color: var(--scrollbar-thumb, rgba(255,255,255,0.2)) transparent;
          }
          .custom-scrollbar::-webkit-scrollbar {
            width: 8px;
            height: 8px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
            border-radius: 10px;
            margin: 4px 0;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background-color: var(--scrollbar-thumb, rgba(255,255,255,0.2));
            border-radius: 10px;
            border: 2px solid transparent;
            background-clip: padding-box;
            min-height: 40px;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background-color: var(--scrollbar-thumb-hover, rgba(255,255,255,0.35));
          }
          .custom-scrollbar::-webkit-scrollbar-thumb:active {
            background-color: var(--scrollbar-thumb-hover, rgba(255,255,255,0.4));
          }
          .custom-scrollbar::-webkit-scrollbar-corner {
            background: transparent;
          }
          .zen-message-input[data-empty="true"]::before {
            content: attr(data-placeholder);
            position: absolute;
            left: 0;
            right: 0;
            top: 0;
            overflow: hidden;
            white-space: nowrap;
            text-overflow: ellipsis;
            pointer-events: none;
            color: var(--vscode-input-placeholderForeground, rgba(204, 204, 204, 0.5));
          }
        `}</style>

              <textarea
                ref={textareaRef}
                value={message}
                readOnly
                tabIndex={-1}
                aria-hidden="true"
                style={{ display: "none" }}
              />
              <div
                ref={editorRef}
                contentEditable="plaintext-only"
                suppressContentEditableWarning
                role="textbox"
                aria-multiline="true"
                data-empty={message === "" ? "true" : "false"}
                onInput={() => {
                  syncEditorToMessage();
                  mention.updateFromSelection();
                }}
                onKeyUp={mention.updateFromSelection}
                onClick={(e) => {
                  const badgePath = getFileBadgePath(e.target);
                  if (badgePath) {
                    extensionService.postMessage({
                      command: "openFile",
                      path: badgePath,
                    });
                    return;
                  }
                  mention.updateFromSelection();
                }}
                onBlur={mention.closePopup}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    if (
                      !isHistoryMode &&
                      isConnected &&
                      !isLoadingCache &&
                      !isProcessing &&
                      !isTokenLimitExceeded
                    ) {
                      onSendMessage();
                    }
                  } else {
                    handleKeyDown(
                      e as unknown as React.KeyboardEvent<HTMLTextAreaElement>,
                    );
                  }
                }}
                onPaste={(e) => {
                  // Kiểm tra clipboard có chứa file/ảnh không (dùng items vì files=0 với screenshot)
                  const hasFileInClipboard = Array.from(
                    e.clipboardData.items,
                  ).some((it) => it.kind === "file");
                  if (!supportsUpload && hasFileInClipboard) {
                    e.preventDefault();
                    return;
                  }
                  handlePaste(
                    e as unknown as React.ClipboardEvent<HTMLTextAreaElement>,
                  );
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
                className="zen-message-input"
                data-placeholder={placeholderText}
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
                  overflowX: "hidden",
                  overflowY: "auto",
                  position: "relative",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
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
                pointerEvents: !isConnected ? "none" : undefined,
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
                <ActionDropdown
                  onSelectAttach={() => {
                    const acceptStr = buildAcceptString(
                      currentModelConfig ?? currentModel,
                    );
                    if (fileInputRef?.current) {
                      fileInputRef.current.accept = acceptStr;
                      (fileInputRef.current as any).dataset.textOnly =
                        String(!supportsUpload);
                      fileInputRef.current.click();
                    } else {
                      handleFileSelect(acceptStr, !supportsUpload);
                    }
                  }}
                  onSelectImageGenerator={() => {}}
                  onSelectVideoGenerator={() => {}}
                  onSelectDeepResearch={() => {}}
                  onSelectPullRequest={onRequestGitRepoPicker ?? onGitPullRequest}
                  showImageGenerator={supportsImageGenerator}
                  showVideoGenerator={supportsVideoGenerator}
                  showDeepResearch={supportsDeepResearch}
                  currentModel={currentModel}
                  currentModelConfig={currentModelConfig}
                  onSelectSkills={
                    onSelectSkills &&
                    ((items) => {
                      onSelectSkills(items);
                      if (items.length > 0 && !conversationUseSkillEnabled) {
                        onConversationUseSkillToggle?.();
                      }
                    })
                  }
                  selectedSkillSlugs={(attachedItems ?? [])
                    .filter((i: any) => i.type === "skill")
                    .map((i: any) => i.skillSlug as string)}
                  triggerButton={
                    <div
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
                        supportsUpload
                          ? "Attach files"
                          : "Attach text files only"
                      }
                    >
                      <Plus />
                    </div>
                  }
                />

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


                <div
                  style={{
                    width: "1px",
                    height: "16px",
                    background: "var(--border-color)",
                    margin: "0 2px",
                    flexShrink: 0,
                  }}
                />
                {!isConversationStarted &&
                  effortInfo &&
                  effortInfo.options.length > 1 && (
                    <EffortDropdown
                      effort={effortInfo.effort}
                      options={effortInfo.options}
                      onChange={handleEffortChange}
                    />
                  )}
                {/* Prompt Settings (Style · Diagnostics · Skill) — Home only, ẩn khi anti-injection bật hoặc promptLength=none */}
                {!isConversationStarted &&
                  !isAntiInjectionProvider &&
                  promptLengthMode !== "none" && (
                    <PromptSettingsDropdown
                      systemPromptMode={systemPromptMode}
                      onSelectSystemPromptMode={(mode) => {
                        if (isAntiInjectionProvider && mode !== "none") return;
                        setSystemPromptMode(mode);
                      }}
                      isAntiInjection={isAntiInjectionProvider}
                      diagnosticEnabled={!!conversationDiagnosticEnabled}
                      onDiagnosticToggle={onConversationDiagnosticToggle}
                      skillEnabled={!!conversationUseSkillEnabled}
                      onSkillToggle={onConversationUseSkillToggle}
                      memoryEnabled={!!conversationMemoryEnabled}
                      onMemoryToggle={onConversationMemoryToggle}
                      toolFormat={conversationToolFormat ?? "xml"}
                      onToolFormatToggle={() => {
                        onConversationToolFormatToggle?.();
                      }}
                    />
                  )}

                {!isConversationStarted &&
                  !isAntiInjectionProvider &&
                  promptLengthMode === "none" && (
                    <PromptSettingsDropdown
                      formatOnly
                      systemPromptMode={systemPromptMode}
                      onSelectSystemPromptMode={() => {}}
                      toolFormat={conversationToolFormat ?? "xml"}
                      onToolFormatToggle={() => {
                        onConversationToolFormatToggle?.();
                      }}
                    />
                  )}

                {/* Prompt Length Selector - Home only, hidden when anti-injection is active */}
                {!isConversationStarted && !isAntiInjectionProvider && (
                  <PromptLengthDropdown
                    currentMode={promptLengthMode}
                    onSelect={(mode) => {
                      if (isAntiInjectionProvider && mode !== "none") return;
                      setPromptLengthMode(mode);
                    }}
                    isNoneOnly={isAntiInjectionProvider}
                    triggerButton={(() => {
                      const meta =
                        PROMPT_LENGTH_MODE_META.find(
                          (m) => m.key === promptLengthMode,
                        ) ?? PROMPT_LENGTH_MODE_META[3];
                      return (
                        <SimpleTooltip
                          content={
                            <TooltipCard>
                              <TooltipRow
                                label="Prompt Length"
                                value={meta.label}
                                color={meta.color}
                              />
                            </TooltipCard>
                          }
                        >
                          <button
                            onMouseEnter={() => setIsPromptLengthHovered(true)}
                            onMouseLeave={() => setIsPromptLengthHovered(false)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              height: "24px",
                              width: "24px",
                              boxSizing: "border-box",
                              borderRadius: "5px",
                              cursor: "pointer",
                              transition: "all 0.15s ease-in-out",
                              border: "1px solid transparent",
                              background: isPromptLengthHovered
                                ? "rgba(128, 128, 128, 0.16)"
                                : "transparent",
                              color: meta.color,
                              opacity: 1,
                              padding: 0,
                            }}
                          >
                            <PromptLengthTriggerIcon mode={promptLengthMode} />
                          </button>
                        </SimpleTooltip>
                      );
                    })()}
                  />
                )}

                {/* Diagnostic và Skill toggles đã được chuyển vào ActionDropdown */}
              </div>

              {/* Right Icons */}
              <div
                style={{
                  display: "flex",
                  gap: "var(--spacing-xs)",
                  alignItems: "center",
                }}
              >
                {/* Workspace zip-size badge — chỉ hiện khi provider có anti-injection flag = true */}
                {isAntiInjectionProvider && (
                  <ClaudeZipBadge state={zipSizeState} />
                )}

                {/* Token Count Badge / Stop Button */}
                {isConnected && (
                  <div
                    style={{
                      cursor:
                        isHistoryMode || isLoadingCache
                          ? "not-allowed"
                          : isStreaming || isProcessing
                            ? "pointer"
                            : isTokenLimitExceeded
                              ? "not-allowed"
                              : message.trim() || uploadedFiles.length > 0
                                ? "pointer"
                                : "default",
                      padding:
                        isStreaming || isProcessing
                          ? "var(--spacing-xs)"
                          : "4px 8px",
                      borderRadius: "var(--border-radius)",
                      transition: "all 0.2s",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color:
                        isHistoryMode || isLoadingCache
                          ? "var(--secondary-text)"
                          : isStreaming || isProcessing
                            ? "var(--vscode-errorForeground, #f44336)"
                            : isTokenLimitExceeded
                              ? "var(--vscode-errorForeground, #f44336)"
                              : "var(--vscode-descriptionForeground, #888)",
                      pointerEvents:
                        isHistoryMode ||
                        isLoadingCache ||
                        (isTokenLimitExceeded &&
                          !isStreaming &&
                          !isProcessing)
                          ? "none"
                          : "auto",
                      // Soft-style background for token badge
                      backgroundColor:
                        isStreaming || isProcessing
                          ? "transparent"
                          : isTokenLimitExceeded
                            ? "color-mix(in srgb, var(--vscode-errorForeground, #f44336) 12%, transparent)"
                            : "color-mix(in srgb, var(--vscode-descriptionForeground, #888) 8%, transparent)",
                      fontSize: "11px",
                      fontWeight: 600,
                      letterSpacing: "0.3px",
                      whiteSpace: "nowrap",
                    }}
                    onClick={() => {
                      if ((isStreaming || isProcessing) && onStopGeneration) {
                        // Stop generation
                        onStopGeneration();
                        return;
                      }

                      if (isTokenLimitExceeded) {
                        // Don't send when limit exceeded
                        return;
                      }

                      if (!currentModel) {
                        console.warn(
                          "[Zen] MessageInput send: no model selected, aborting",
                        );
                        return;
                      }
                      onSendMessage();
                    }}
                    onMouseEnter={(e) => {
                      if (isStreaming || isProcessing) {
                        e.currentTarget.style.backgroundColor =
                          "var(--hover-bg)";
                      } else if (isTokenLimitExceeded) {
                        e.currentTarget.style.backgroundColor =
                          "color-mix(in srgb, var(--vscode-errorForeground, #f44336) 18%, transparent)";
                      } else if (message.trim() || uploadedFiles.length > 0) {
                        e.currentTarget.style.backgroundColor =
                          "var(--hover-bg)";
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (isStreaming || isProcessing) {
                        e.currentTarget.style.backgroundColor = "transparent";
                      } else if (isTokenLimitExceeded) {
                        e.currentTarget.style.backgroundColor =
                          "color-mix(in srgb, var(--vscode-errorForeground, #f44336) 12%, transparent)";
                      } else {
                        e.currentTarget.style.backgroundColor =
                          "color-mix(in srgb, var(--vscode-descriptionForeground, #888) 8%, transparent)";
                      }
                    }}
                    title={
                      isStreaming || isProcessing
                        ? "Stop Generation"
                        : isTokenLimitExceeded
                            ? `Token limit exceeded (${messageTokenCount.toLocaleString()}/${maxInputTokens?.toLocaleString()})`
                            : maxInputTokens
                              ? `${messageTokenCount.toLocaleString()}/${maxInputTokens.toLocaleString()} tokens`
                              : `${messageTokenCount.toLocaleString()} tokens`
                    }
                  >
                    {isStreaming || isProcessing ? (
                      <X size={16} strokeWidth={2.5} />
                    ) : (
                      <span style={{ lineHeight: 1 }}>
                        {(() => {
                          return maxInputTokens
                            ? `${formatTokenCount(messageTokenCount)}/${formatTokenCount(maxInputTokens)}`
                            : messageTokenCount > 0
                              ? `${formatTokenCount(messageTokenCount)}`
                              : "0";
                        })()}
                      </span>
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
                      ?.flag || "🇺"}{" "}
                    {preferredLanguage.toUpperCase()}
                  </span>
                </div>
              )}
          </div>
          {/* end bordered wrapper (textarea + toolbar) */}

          {/* ─── Bậc 3: ZenCLI hint bar (ngoài border, chỉ HomePanel) ─── */}
          {!isConversationStarted && (
            <ZenCliHintBar isClaudeProvider={isAntiInjectionProvider} />
          )}
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

  // 🔧 FIX: Check attachedItems changes for text snippets
  const attachedItemsSame =
    prevProps.attachedItems?.length === nextProps.attachedItems?.length;

  // 🔧 FIX: Check diagnostic/skill toggles so toolbar icons re-render immediately
  const diagnosticSame =
    prevProps.conversationDiagnosticEnabled ===
    nextProps.conversationDiagnosticEnabled;
  const useSkillSame =
    prevProps.conversationUseSkillEnabled ===
    nextProps.conversationUseSkillEnabled;
  const memorySame =
    prevProps.conversationMemoryEnabled === nextProps.conversationMemoryEnabled;
  const toolFormatSame =
    prevProps.conversationToolFormat === nextProps.conversationToolFormat;

  // Only re-render if critical props changed
  const shouldSkip =
    messageSame &&
    isProcessingSame &&
    isStreamingSame &&
    currentModelSame &&
    currentAccountSame &&
    messagesLengthSame &&
    responseRangesSame &&
    conversationFileStatsSame &&
    attachedItemsSame &&
    diagnosticSame &&
    useSkillSame &&
    memorySame &&
    toolFormatSame;

  return shouldSkip;
});
