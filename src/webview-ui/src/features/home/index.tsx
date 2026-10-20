/**
 * ------------------------------------------------------------------
 * HomePanel
 * ------------------------------------------------------------------
 * Panel trang chủ — hiển thị dashboard thống kê, slogan, và MessageInput.
 * Bao gồm stats grid, model distribution, daily usage chart, recent activity.

 * Main features:
 * - Dashboard stats: tổng tokens, requests, favorite model, số tài khoản
 * - Biểu đồ phân bố model và daily usage
 * - Danh sách hội thoại gần đây
 * - MessageInput với draft auto-save, file handling
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── React ──
import React, { useEffect, useState } from "react";

// ── Utils ──
import { getFaviconUrl } from "@/utils/favicon";

// ── Components ─
import MessageInput from "@/components/MessageInput";
import FilesPreviews from "@/components/MessageInput/FilesPreviews";
import StatsGrid from "./components/StatsGrid";

import ModelDistribution from "./components/ModelDistribution";
import HomeHeader from "./components/HomeHeader";
// ── Contexts ──
import { useSettings } from "@/context/SettingsContext";
import { useBackendConnection } from "@/context/BackendConnectionContext";
import { useFileHandling } from "../../hooks/useFileHandling";
import { useHomeDraftManagement } from "./hooks/useHomeDraftManagement";
import { useModelAccount } from "../../hooks/useModelAccount";

// ── Services ──
import { extensionService } from "../../services/ExtensionService";

// ── Types ──
import UsageChart from "./components/UsageChart";
import HistoryConversation from "./components/HistoryConversation";
import { ConversationItem } from "../history/types";
import HomeBanner from "./components/HomeBanner";
import { useZenUpdate } from "./hooks/useZenUpdate";

import {
  useStatsPeriod,
  readCachedPeriodState,
  readStatsSnapshot,
  writeStatsSnapshot,
  readGlobalSnapshot,
  writeGlobalSnapshot,
} from "./hooks/useStatsPeriod";
import { useToolFormatSettings } from "../../hooks/useToolFormatSettings";
import { useGitRepoScanner } from "../../hooks/useGitRepoScanner";
import { useCommitPromptBuilder } from "../../hooks/useCommitPromptBuilder";
import GitRepoPickerDrawer from "../../components/MessageInput/GitRepoPickerDrawer";

// Memoized dashboard stats component to prevent re-render on typing
const DashboardStats = React.memo(
  ({
    todayTokens,
    todayRequests,
    favoriteModel,
    totalAccounts,
    modelDistribution,
    providerFavicons,
    dailyUsage,
    statsPeriod,
    conversations,
    isLoadingConversations,
    onLoadConversation,
  }: {
    todayTokens: number;
    todayRequests: number;
    favoriteModel: string;
    totalAccounts: number;
    modelDistribution: any[];
    providerFavicons: Record<string, string>;
    dailyUsage: any[];
    statsPeriod: import("./hooks/useStatsPeriod").StatsPeriod;
    conversations: ConversationItem[];
    isLoadingConversations: boolean;
    onLoadConversation?: (
      conversationId: string,
      tabId: number,
      folderPath: string | null,
    ) => void;
  }) => {
    const renderCountRef = React.useRef(0);
    renderCountRef.current++;

    const percentChanges = React.useMemo(() => {
      const sorted = [...dailyUsage].sort((a, b) =>
        b.date.localeCompare(a.date),
      );
      const today = sorted[0];
      const yesterday = sorted[1];
      const tokenChange =
        yesterday?.tokens && today?.tokens
          ? ((today.tokens - yesterday.tokens) / yesterday.tokens) * 100
          : null;
      const requestChange =
        yesterday?.requests && today?.requests
          ? ((today.requests - yesterday.requests) / yesterday.requests) * 100
          : null;
      return [tokenChange, requestChange, null, null];
    }, [dailyUsage, modelDistribution, favoriteModel]);

    return (
      <div style={{ display: "contents" }}>
        <div className="zen-home-stats">
          <StatsGrid
            todayTokens={todayTokens}
            todayRequests={todayRequests}
            favoriteModel={favoriteModel}
            totalAccounts={totalAccounts}
            percentChanges={percentChanges}
          />
        </div>

        <div className="zen-home-dist">
          <ModelDistribution
            modelDistribution={modelDistribution}
            providerFavicons={providerFavicons}
            title="AI Model Distribution"
            emptyText="Loading history..."
          />
        </div>

        <div className="zen-home-usage">
          <UsageChart usage={dailyUsage} title="Usage" period={statsPeriod} />
        </div>

        <div className="zen-home-history">
          <HistoryConversation
            conversations={conversations}
            isLoading={isLoadingConversations}
            onLoadConversation={onLoadConversation}
            providerFavicons={providerFavicons}
          />
        </div>
      </div>
    );
  },
);

// ─── Interfaces ────────────────────────────────────────────────────────
interface HomePanelProps {
  onSendMessage: (
    content: string,
    files: any[],
    model: any,
    account: any,
    conversationOverrides?: {
      diagnosticEnabled?: boolean;
      useSkillEnabled?: boolean;
      memoryEnabled?: boolean;
      toolFormat?: "xml" | "json";
    },
  ) => void;
  onLoadConversation: (
    conversationId: string,
    tabId: number,
    folderPath: string | null,
  ) => void;
  initialValue?: string;
  onOpenAccounts?: () => void;
}

// ─── Component ──────────────────────────────────────────────────────────
const HomePanel: React.FC<HomePanelProps> = ({
  onSendMessage,
  onLoadConversation,
  initialValue,
  onOpenAccounts,
}) => {
  // ── State ─

  // Snapshot cache đọc đồng bộ 1 lần ở lần render đầu → hiển thị data ngay
  const [initialCache] = useState(() => {
    const p = readCachedPeriodState();
    return {
      stats: readStatsSnapshot(p.period, p.offset),
      global: readGlobalSnapshot(),
    };
  });
  const [todayTokens, setTodayTokens] = useState<number>(
    initialCache.stats?.todayTokens ?? 0,
  );
  const [todayRequests, setTodayRequests] = useState<number>(
    initialCache.stats?.todayRequests ?? 0,
  );
  const [favoriteModel, setFavoriteModel] = useState<string>(
    initialCache.stats?.favoriteModel ?? "—",
  );
  const [totalAccounts, setTotalAccounts] = useState<number>(
    initialCache.global?.totalAccounts ?? 0,
  );
  const [accountsLoaded, setAccountsLoaded] = useState(false);
  const [modelDistribution, setModelDistribution] = useState<
    {
      model_id: string;
      provider_id: string;
      total_requests: number;
      total_tokens: number;
    }[]
  >(initialCache.stats?.modelDistribution ?? []);
  const [dailyUsage, setDailyUsage] = useState<
    { date: string; requests: number; tokens: number }[]
  >(initialCache.stats?.dailyUsage ?? []);
  const [providerFavicons, setProviderFavicons] = useState<
    Record<string, string>
  >(initialCache.global?.providerFavicons ?? {});
  const [providers, setProviders] = useState<any[]>([]);
  const [attachedItems, setAttachedItems] = React.useState<any[]>([]);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);

  // ── Per-conversation feature toggles (default from global settings) ──
  const {
    apiUrl,
    diagnosticEnabled: globalDiagnosticEnabled,
    setDiagnosticEnabled,
    useSkillEnabled: globalUseSkillEnabled,
    setUseSkillEnabled,
    memoryEnabled: globalMemoryEnabled,
    setMemoryEnabled,
    commitMessageLanguage,
  } = useSettings();
  const { isConnected, updateInfo } = useBackendConnection();
  const zenUpdateInfo = useZenUpdate();

  // ── Stats period picker ──
  const {
    period: statsPeriod,
    offset: statsOffset,
    setPeriod: setStatsPeriod,
    setOffset: setStatsOffset,
  } = useStatsPeriod();

  const [conversationDiagnosticEnabled, setConversationDiagnosticEnabled] =
    React.useState(globalDiagnosticEnabled);
  const [conversationUseSkillEnabled, setConversationUseSkillEnabled] =
    React.useState(globalUseSkillEnabled);
  const [conversationMemoryEnabled, setConversationMemoryEnabled] =
    React.useState(globalMemoryEnabled);

  // Chỉ sync 1 lần khi global settings load xong lần đầu (từ localStorage/storage async).
  // Không sync liên tục để tránh ghi đè giá trị user đã toggle.
  const didSyncDiagnosticRef = React.useRef(false);
  const didSyncSkillRef = React.useRef(false);
  const didSyncMemoryRef = React.useRef(false);
  React.useEffect(() => {
    if (
      !didSyncDiagnosticRef.current &&
      globalDiagnosticEnabled !== undefined
    ) {
      didSyncDiagnosticRef.current = true;
      setConversationDiagnosticEnabled(globalDiagnosticEnabled);
    }
  }, [globalDiagnosticEnabled]);
  React.useEffect(() => {
    if (!didSyncSkillRef.current && globalUseSkillEnabled !== undefined) {
      didSyncSkillRef.current = true;
      setConversationUseSkillEnabled(globalUseSkillEnabled);
    }
  }, [globalUseSkillEnabled]);
  React.useEffect(() => {
    if (!didSyncMemoryRef.current && globalMemoryEnabled !== undefined) {
      didSyncMemoryRef.current = true;
      setConversationMemoryEnabled(globalMemoryEnabled);
    }
  }, [globalMemoryEnabled]);

  const dbHeaders = () => {
    return {};
  };

  const folderPath = (window as any).__zenWorkspaceFolderPath as
    | string
    | null
    | undefined;

  const { message, setMessage, clearDraft } = useHomeDraftManagement(
    folderPath || null,
  );

  // ── Git Repo Picker + Commit Prompt builder ──
  const {
    repos: gitRepos,
    loading: gitReposLoading,
    error: gitReposError,
    scan: scanGitRepos,
  } = useGitRepoScanner();
  const [gitRepoPickerOpen, setGitRepoPickerOpen] = React.useState(false);
  const [commitPromptBuilding, setCommitPromptBuilding] = React.useState(false);

  const { currentModel, setCurrentModel, currentAccount, setCurrentAccount } =
    useModelAccount(folderPath);

  // ── Tool Format: per-model, persisted to localStorage ──
  const {
    toolFormat: conversationToolFormat,
    toggleToolFormat: toggleConversationToolFormat,
  } = useToolFormatSettings(currentModel?.providerId, currentModel?.id);

  const { build: buildCommitPrompt } = useCommitPromptBuilder({
    commitMessageLanguage,
    toolFormat: conversationToolFormat,
  });

  const fillCommitPrompt = React.useCallback(
    async (repoPath: string) => {
      setCommitPromptBuilding(true);
      try {
        const prompt = await buildCommitPrompt(repoPath);
        if (prompt) setMessage(prompt);
      } finally {
        setCommitPromptBuilding(false);
      }
    },
    [buildCommitPrompt, setMessage],
  );

  const handleRequestGitRepoPicker = React.useCallback(async () => {
    const list = await scanGitRepos();
    if (list.length === 0) {
      (window as any).vscodeApi?.postMessage({
        command: "showInformation",
        message: "Không tìm thấy git repo nào trong workspace (đã quét 4 cấp).",
      });
      return;
    }
    if (list.length === 1) {
      fillCommitPrompt(list[0].relPath);
      return;
    }
    setGitRepoPickerOpen(true);
  }, [scanGitRepos, fillCommitPrompt]);

  const handleSelectGitRepo = React.useCallback(
    (repo: { relPath: string }) => {
      setGitRepoPickerOpen(false);
      fillCommitPrompt(repo.relPath);
    },
    [fillCommitPrompt],
  );

  // NOTE: Claude/anti-injection detection được xử lý nội bộ trong MessageInput
  // (tự đọc providers config + currentModel). Home panel không cần biết.

  // ── Refs ──
  // 🔍 PERFORMANCE DEBUG LOGS
  const renderCountRef = React.useRef(0);
  const lastRenderTimeRef = React.useRef(Date.now());
  const renderTimingsRef = React.useRef<number[]>([]);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // ── Derived ──
  const renderStartTime = performance.now();

  renderCountRef.current++;
  const now = Date.now();
  const timeSinceLastRender = now - lastRenderTimeRef.current;
  lastRenderTimeRef.current = now;
  renderTimingsRef.current.push(timeSinceLastRender);

  // Keep only last 10 timings
  if (renderTimingsRef.current.length > 10) {
    renderTimingsRef.current.shift();
  }

  const imagesUri = (window as any).__zenImagesUri;

  // ── Callbacks ──
  const handleAddAttachedItem = React.useCallback((item: any) => {
    setAttachedItems((prev) => {
      const updated = [...prev, item];
      return updated;
    });
  }, []);

  const handleRemoveAttachedItem = React.useCallback((id: string) => {
    setAttachedItems((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const {
    uploadedFiles,
    fileInputRef,
    externalFileInputRef,
    handlePaste,
    handleFileSelect,
    handleFileInputChange,
    removeFile,
    handleExternalFileInputChange,
    handleDragOver,
    handleDrop,
    clearFiles,
    addAttachedItemWithCache,
    removeAttachedItemFromCache,
  } = useFileHandling({
    accountId: currentAccount?.id,
    modelId: currentModel?.id,
    folderPath: folderPath || null,
    onAddAttachedItem: handleAddAttachedItem,
  });

  // Wrap handleRemoveAttachedItem to also update localStorage cache
  const handleRemoveAttachedItemWrapper = React.useCallback(
    (id: string) => {
      handleRemoveAttachedItem(id);
      removeAttachedItemFromCache(id);
    },
    [handleRemoveAttachedItem, removeAttachedItemFromCache],
  );

  const handleSend = React.useCallback(
    (model: any, account: any) => {
      if (
        message.trim() ||
        uploadedFiles.length > 0 ||
        attachedItems.length > 0
      ) {
        // 🚀 FIX: Merge uploadedFiles and attachedItems like in chat panel
        onSendMessage(
          message,
          [...uploadedFiles, ...attachedItems],
          model,
          account,
          {
            diagnosticEnabled: conversationDiagnosticEnabled,
            useSkillEnabled: conversationUseSkillEnabled,
            memoryEnabled: conversationMemoryEnabled,
            toolFormat: conversationToolFormat,
          },
        );
        setMessage("");
        clearDraft(); // Clear draft after sending
        clearFiles();
        setAttachedItems([]); // Clear attached items after sending
      }
    },
    [
      message,
      uploadedFiles,
      attachedItems,
      providers,
      onSendMessage,
      clearDraft,
      clearFiles,
      conversationDiagnosticEnabled,
      conversationUseSkillEnabled,
      conversationMemoryEnabled,
      conversationToolFormat,
    ],
  );

  const handleTextareaChange = React.useCallback(
    (e: React.ChangeEvent<HTMLTextAreaElement>) => {
      const changeStart = performance.now();
      const newValue = e.target.value;
      const lengthDiff = newValue.length - message.length;

      setMessage(newValue);

      const changeTime = performance.now() - changeStart;

      if (changeTime > 5) {
        console.warn(
          `[Home handleTextareaChange] SLOW: ${changeTime.toFixed(2)}ms`,
        );
      }
    },
    [message],
  );

  const handleKeyDown = React.useCallback(
    (_e: React.KeyboardEvent<HTMLTextAreaElement>) => {},
    [],
  );

  // ── Effects ─
  // Trigger history limit enforcement on mount
  useEffect(() => {
    extensionService.postMessage({
      command: "getHistory",
      requestId: `home-enforce-${Date.now()}`,
    });
  }, []);

  // Fetch conversation history + listen for delete results
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.command === "historyResult") {
        if (msg.history) setConversations(msg.history);
        setIsLoadingConversations(false);
      } else if (msg.command === "deleteConversationResult") {
        if (msg.success) {
          setConversations((prev) =>
            prev.filter((c) => c.id !== msg.conversationId),
          );
        }
      }
    };
    window.addEventListener("message", handleMessage);
    const vscodeApi = (window as any).vscodeApi;
    if (vscodeApi) {
      vscodeApi.postMessage({
        command: "getHistory",
        requestId: `home-hist-${Date.now()}`,
      });
    }
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // Áp snapshot đã cache của kỳ đang chọn ngay khi đổi period/offset (không đợi mạng)
  useEffect(() => {
    const snap = readStatsSnapshot(statsPeriod, statsOffset);
    if (!snap) return;
    setTodayTokens(snap.todayTokens);
    setTodayRequests(snap.todayRequests);
    setFavoriteModel(snap.favoriteModel);
    setModelDistribution(snap.modelDistribution);
    setDailyUsage(snap.dailyUsage);
  }, [statsPeriod, statsOffset]);

  // Cache dữ liệu không phụ thuộc period (chỉ ghi khi đã có favicons thật)
  useEffect(() => {
    if (Object.keys(providerFavicons).length === 0) return;
    writeGlobalSnapshot({ totalAccounts, providerFavicons });
  }, [totalAccounts, providerFavicons]);

  // Fetch stats from API — re-run when period/offset changes, or khi backend kết nối lại
  useEffect(() => {
    if (!isConnected) return; // chờ kết nối trước khi fetch
    const fetchStats = async () => {
      try {
        // period=all maps to a very large offset span; backend uses period=year offset=0
        // but covers all time via the "all" pseudo-period we handle client-side by
        // omitting period so backend defaults aggregate all records.
        const periodParam = statsPeriod === "all" ? "year" : statsPeriod;
        const offsetParam = statsPeriod === "all" ? 0 : statsOffset;

        const statsUrl =
          statsPeriod === "all"
            ? `${apiUrl}/v1/stats?period=year&offset=0`
            : `${apiUrl}/v1/stats?period=${periodParam}&offset=${offsetParam}`;

        const [statsRes, accountsRes, providersRes] = await Promise.all([
          fetch(statsUrl, { headers: dbHeaders() }),
          fetch(`${apiUrl}/v1/accounts?page=1&limit=1000`, {
            headers: dbHeaders(),
          }),
          fetch(`${apiUrl}/v1/providers`, { headers: dbHeaders() }),
        ]);
        if (statsRes.ok) {
          const stats = await statsRes.json();
          if (stats.success && stats.data) {
            const usage: { requests: number; tokens: number }[] =
              stats.data.usage || [];
            setTodayTokens(
              usage.reduce((s: number, u: any) => s + (u.tokens || 0), 0),
            );
            setTodayRequests(
              usage.reduce((s: number, u: any) => s + (u.requests || 0), 0),
            );
            const models: any[] = (stats.data.models || []).filter(
              (m: any) => m.total_requests > 0,
            );
            setModelDistribution(models.slice(0, 5));
            setDailyUsage(stats.data.usage || []);
            if (models.length > 0) setFavoriteModel(models[0].model_id);
            // Ghi cache theo đúng kỳ vừa fetch để lần mở/đổi kỳ sau hiện ngay
            writeStatsSnapshot(statsPeriod, statsOffset, {
              todayTokens: usage.reduce(
                (s: number, u: any) => s + (u.tokens || 0),
                0,
              ),
              todayRequests: usage.reduce(
                (s: number, u: any) => s + (u.requests || 0),
                0,
              ),
              favoriteModel: models.length > 0 ? models[0].model_id : "—",
              modelDistribution: models.slice(0, 5),
              dailyUsage: stats.data.usage || [],
            });
          }
        }
        if (accountsRes.ok) {
          const accs = await accountsRes.json();
          if (accs.success && accs.data) {
            setTotalAccounts(
              accs.data.total ?? accs.data.accounts?.length ?? 0,
            );
            setAccountsLoaded(true);
          }
        }
        if (providersRes.ok) {
          const prov = await providersRes.json();
          if (prov.success && prov.data) {
            setProviders(prov.data);
            const favicons: Record<string, string> = {};
            prov.data.forEach((p: any) => {
              if (p.provider_id && p.website) {
                favicons[p.provider_id] = getFaviconUrl(p.website);
              }
            });
            setProviderFavicons(favicons);
          }
        }
      } catch {}
    };
    fetchStats();
  }, [apiUrl, statsPeriod, statsOffset, isConnected]);

  // ── Render ──
  return (
    <div
      className="home-panel"
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "row",
        height: "100vh",
        backgroundColor: "var(--primary-bg)",
        borderTop: "1px solid var(--border-color)",
        boxSizing: "border-box",
      }}
    >
      <style>{`
        .zen-home-grid {
          display: grid;
          gap: 16px;
          width: 100%;
          align-content: start;
          margin: 0 auto;
          grid-template-columns: minmax(0, 1fr);
          /* Loại bỏ 'banner' và 'date' khỏi areas mặc định nếu chúng hay bị ẩn/rỗng */
          /* Nếu cần hiển thị dynamic, ta sẽ xử lý bằng JS conditionals */
          grid-template-areas: "header" "stats" "dist" "usage" "history";
        }
        .zen-home-header { grid-area: header; min-width: 0; }
        .zen-home-stats { grid-area: stats; min-width: 0; }
        .zen-home-dist { grid-area: dist; min-width: 0; }
        .zen-home-usage { grid-area: usage; min-width: 0; }
        .zen-home-history { grid-area: history; min-width: 0; }
        
        /* Styles bổ sung nếu sau này cần chèn banner/date động */
        .zen-home-dynamic-slot { 
           display: contents; /* Cho phép children tham gia trực tiếp vào grid cha nếu cần, hoặc remove wrapper */
        }
        .zen-home-dist > div,
        .zen-home-usage > div { height: 100%; }
      `}</style>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          height: "100%",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* ─── Dashboard scroll area ─── */}
        <div
          style={{
            flex: 1,
            overflow: "auto",
            backgroundColor: "var(--secondary-bg)",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "flex-start",
              padding: "32px 16px 20px 16px",
              color: "var(--primary-text)",
              animation: "fadeIn 0.5s ease-out",
              maxWidth: "1200px",
              margin: "0 auto",
              width: "100%",
              boxSizing: "border-box",
            }}
          >
            <div className="zen-home-grid">
              <div
                className="zen-home-header"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "16px",
                }}
              >
                <HomeHeader imagesUri={imagesUri} />
                <HomeBanner
                  isConnected={isConnected}
                  zenUpdateInfo={zenUpdateInfo}
                  apiUpdateInfo={updateInfo}
                  totalAccounts={totalAccounts}
                  accountsLoaded={accountsLoaded}
                  onOpenAccounts={onOpenAccounts}
                />
              </div>

              <DashboardStats
                todayTokens={todayTokens}
                todayRequests={todayRequests}
                favoriteModel={favoriteModel}
                totalAccounts={totalAccounts}
                modelDistribution={modelDistribution}
                providerFavicons={providerFavicons}
                dailyUsage={dailyUsage}
                statsPeriod={statsPeriod}
                conversations={conversations}
                isLoadingConversations={isLoadingConversations}
                onLoadConversation={onLoadConversation}
              />
            </div>

            <style>{`
            @keyframes fadeIn {
              from { opacity: 0; transform: translateY(8px); }
              to   { opacity: 1; transform: translateY(0); }
            }
            @keyframes slideUp {
              from { opacity: 0; transform: translateY(16px); }
              to   { opacity: 1; transform: translateY(0); }
            }
            .spin-animation { animation: spin 1s linear infinite; }
            @keyframes spin {
              from { transform: rotate(0deg); }
              to   { transform: rotate(360deg); }
            }
            .dashboard-card:hover {
              transform: translateY(-2px);
              border-color: var(--vscode-focusBorder) !important;
              box-shadow: 0 4px 12px rgba(0,0,0,0.12);
            }
          `}</style>
          </div>
        </div>

        {/* ─── MessageInput ─── */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          style={{ display: "none" }}
          onChange={handleFileInputChange}
        />
        <input
          ref={externalFileInputRef}
          type="file"
          multiple
          style={{ display: "none" }}
          onChange={handleExternalFileInputChange}
        />
        {/* Wrapper cùng max-width/padding với dashboard để input thẳng hàng với content */}
        <div
          style={{
            width: "100%",
            backgroundColor: "var(--secondary-bg)",
            flexShrink: 0,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: "1200px",
              margin: "0 auto",
              padding: "0 12px",
              boxSizing: "border-box",
            }}
          >
            <FilesPreviews
              uploadedFiles={uploadedFiles}
              attachedItems={attachedItems}
              onRemoveFile={removeFile}
              onRemoveAttachedItem={handleRemoveAttachedItemWrapper}
              onOpenImage={(file) => {
                const vscodeApi = (window as any).vscodeApi;
                if (vscodeApi) {
                  vscodeApi.postMessage({
                    command: "openTempImage",
                    content: file.content,
                    filename: file.name,
                  });
                }
              }}
              onAttachedItemClick={() => {}}
            />
            <MessageInput
              message={message}
              setMessage={setMessage}
              isHistoryMode={false}
              uploadedFiles={uploadedFiles}
              attachedItems={attachedItems}
              onSelectSkills={(items) => {
                attachedItems
                  .filter((i: any) => i.type === "skill")
                  .forEach((i: any) => handleRemoveAttachedItemWrapper(i.id));
                items.forEach((item) => addAttachedItemWithCache(item));
              }}
              textareaRef={textareaRef}
              handleTextareaChange={handleTextareaChange}
              handleKeyDown={handleKeyDown}
              handlePaste={handlePaste}
              handleDragOver={handleDragOver}
              handleDrop={handleDrop}
              handleFileSelect={handleFileSelect}
              onOpenProjectStructure={() => {}}
              showChangesDropdown={false}
              setShowChangesDropdown={() => {}}
              messages={[]}
              handleSend={handleSend}
              hasProjectContext={false}
              onOpenProjectContext={() => {}}
              folderPath={folderPath || null}
              isConversationStarted={false}
              currentModel={currentModel}
              setCurrentModel={setCurrentModel}
              currentAccount={currentAccount}
              setCurrentAccount={setCurrentAccount}
              isProcessing={false}
              isStreaming={false}
              onRequestGitRepoPicker={handleRequestGitRepoPicker}
              conversationDiagnosticEnabled={conversationDiagnosticEnabled}
              conversationUseSkillEnabled={conversationUseSkillEnabled}
              conversationMemoryEnabled={conversationMemoryEnabled}
              conversationToolFormat={conversationToolFormat}
              onConversationDiagnosticToggle={() => {
                const next = !conversationDiagnosticEnabled;
                setConversationDiagnosticEnabled(next);
                setDiagnosticEnabled(next);
              }}
              onConversationUseSkillToggle={() => {
                const next = !conversationUseSkillEnabled;
                setConversationUseSkillEnabled(next);
                setUseSkillEnabled(next);
              }}
              onConversationMemoryToggle={() => {
                const next = !conversationMemoryEnabled;
                setConversationMemoryEnabled(next);
                setMemoryEnabled(next);
              }}
              onConversationToolFormatToggle={() => {
                toggleConversationToolFormat();
              }}
            />
          </div>
        </div>
      </div>
      <GitRepoPickerDrawer
        isOpen={gitRepoPickerOpen}
        onClose={() => setGitRepoPickerOpen(false)}
        repos={gitRepos}
        loading={gitReposLoading}
        error={gitReposError}
        onRefresh={scanGitRepos}
        onSelect={handleSelectGitRepo}
      />
    </div>
  );
};

export default HomePanel;
