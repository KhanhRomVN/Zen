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

// ── UI ──
import { Zap } from "lucide-react";

// ── Utils ──
import { getFaviconUrl } from "@/utils/favicon";

// ── Components ──
import MessageInput from "@/components/MessageInput";
import FilesPreviews from "@/components/MessageInput/FilesPreviews";
import StatsGrid from "./components/StatsGrid";

import ModelDistributionCard from "./components/ModelDistributionCard";
import { AccountStat } from "./utils/format";
import TopAccountsCard from "./components/TopAccountsCard";
import EfficiencyMapCard from "./components/EfficiencyMapCard";
import HomeSidebar from "./components/HomeSidebar";
import HomeHeader from "./components/HomeHeader";
import RecentActivity from "./components/RecentActivity";
// ── Contexts ──
import { useSettings } from "@/context/SettingsContext";
import { useBackendConnection } from "@/context/BackendConnectionContext";
import { useFileHandling } from "../../hooks/useFileHandling";
import { useHomeDraftManagement } from "./hooks/useHomeDraftManagement";
import { useModelAccount } from "../../hooks/useModelAccount";

// ── Services ──
import { extensionService } from "../../services/ExtensionService";
import {
  isBlockedNow,
  isDeepSeekProvider,
  getBlockedRangeLabel,
  getBlockedHoursDescription,
} from "../../utils/timeBlock";

// ── Types ──
import { ConversationItem } from "../history/types";
import DailyUsageChart from "./components/DailyUsageChart";
import InstallationBanner from "./components/InstallationBanner";
import AIWeb2APIUpdateBanner from "./components/AIWeb2APIUpdateBanner";
import ZenUpdateBanner from "./components/ZenUpdateBanner";
import { useZenUpdate } from "./hooks/useZenUpdate";
import { useContainerWidth } from "./hooks/useContainerWidth";
import SidebarWidthToggle from "./components/SidebarWidthToggle";

import {
  useStatsPeriod,
  readCachedPeriodState,
  readStatsSnapshot,
  writeStatsSnapshot,
  readGlobalSnapshot,
  writeGlobalSnapshot,
} from "./hooks/useStatsPeriod";
import { useToolFormatSettings } from "../../hooks/useToolFormatSettings";

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
    accounts,
    statsPeriod,
  }: {
    todayTokens: number;
    todayRequests: number;
    favoriteModel: string;
    totalAccounts: number;
    modelDistribution: any[];
    providerFavicons: Record<string, string>;
    dailyUsage: any[];
    accounts: AccountStat[];
    statsPeriod: import("./hooks/useStatsPeriod").StatsPeriod;
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
          <ModelDistributionCard
            modelDistribution={modelDistribution}
            providerFavicons={providerFavicons}
            title="AI Model Distribution"
            emptyText="Loading history..."
          />
        </div>

        <div className="zen-home-usage">
          <DailyUsageChart
            usage={dailyUsage}
            title="Usage"
            period={statsPeriod}
          />
        </div>

        <div className="zen-home-top">
          <TopAccountsCard
            accounts={accounts}
            providerFavicons={providerFavicons}
            title="Top Accounts"
          />
        </div>

        <div className="zen-home-ins">
          <EfficiencyMapCard
            accounts={accounts}
            providerFavicons={providerFavicons}
            title="Efficiency Map"
          />
        </div>
      </div>
    );
  },
);

// ─── Interfaces ─────────────────────────────────────────────────────────
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
}

// ─── Component ──────────────────────────────────────────────────────────
const HomePanel: React.FC<HomePanelProps> = ({
  onSendMessage,
  onLoadConversation,
  initialValue,
}) => {
  // ── State ──

  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
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
  const [accounts, setAccounts] = useState<AccountStat[]>([]);
  const SIDEBAR_WIDTH_KEY = "zen.home.sidebarWidth";
  const SIDEBAR_MIN = 240;
  const SIDEBAR_MAX = 640;
  const SIDEBAR_DEFAULT = 340;
  const [sidebarWidth, setSidebarWidth] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY));
      if (saved >= SIDEBAR_MIN && saved <= SIDEBAR_MAX) return saved;
    } catch {}
    return SIDEBAR_DEFAULT;
  });
  const [isResizing, setIsResizing] = useState(false);

  const handleResizeStart = React.useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = sidebarWidth;
      let latest = startWidth;
      setIsResizing(true);
      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";

      const onMove = (ev: MouseEvent) => {
        latest = Math.min(
          SIDEBAR_MAX,
          Math.max(SIDEBAR_MIN, startWidth + ev.clientX - startX),
        );
        setSidebarWidth(latest);
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
        setIsResizing(false);
        try {
          localStorage.setItem(SIDEBAR_WIDTH_KEY, String(latest));
        } catch {}
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [sidebarWidth],
  );
  const [attachedItems, setAttachedItems] = React.useState<any[]>([]);

  // ── Per-conversation feature toggles (default from global settings) ──
  const {
    apiUrl,
    activeDatabaseManagerId,
    diagnosticEnabled: globalDiagnosticEnabled,
    setDiagnosticEnabled,
    useSkillEnabled: globalUseSkillEnabled,
    setUseSkillEnabled,
    memoryEnabled: globalMemoryEnabled,
    setMemoryEnabled,
  } = useSettings();
  const { isConnected, updateInfo } = useBackendConnection();
  const zenUpdateInfo = useZenUpdate();
  const { ref: homeRef, tier, isWide } = useContainerWidth<HTMLDivElement>();

  // Báo extension khi sidebar lịch sử của Home đang hiện (>= 700px, khớp CSS @container zen-root)
  useEffect(() => {
    const el = homeRef.current;
    if (!el) return;
    const HOME_SIDEBAR_MIN = 700;
    let last: boolean | null = null;
    const report = (visible: boolean) => {
      if (last === visible) return;
      last = visible;
      (window as any).vscodeApi?.postMessage({
        command: "setHistorySidebarVisible",
        visible,
      });
    };
    report(el.clientWidth >= HOME_SIDEBAR_MIN);
    const ro = new ResizeObserver(([entry]) =>
      report(entry.contentRect.width >= HOME_SIDEBAR_MIN),
    );
    ro.observe(el);
    return () => {
      ro.disconnect();
      (window as any).vscodeApi?.postMessage({
        command: "setHistorySidebarVisible",
        visible: false,
      });
    };
  }, [homeRef]);

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
    const h: Record<string, string> = {};
    if (activeDatabaseManagerId)
      h["x-database-manager-id"] = activeDatabaseManagerId;
    return h;
  };

  const folderPath = (window as any).__zenWorkspaceFolderPath as
    | string
    | null
    | undefined;

  const { message, setMessage, clearDraft } = useHomeDraftManagement(
    folderPath || null,
  );

  const { currentModel, setCurrentModel, currentAccount, setCurrentAccount } =
    useModelAccount(folderPath);

  // ── Tool Format: per-model, persisted to localStorage ──
  const {
    toolFormat: conversationToolFormat,
    toggleToolFormat: toggleConversationToolFormat,
  } = useToolFormatSettings(currentModel?.providerId, currentModel?.id);

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

  const sortedConversations = React.useMemo(() => {
    return [...conversations].sort((a, b) => {
      const timeA = new Date(
        a.lastModified || a.timestamp || a.createdAt || 0,
      ).getTime();
      const timeB = new Date(
        b.lastModified || b.timestamp || b.createdAt || 0,
      ).getTime();
      return timeB - timeA;
    });
  }, [conversations]);

  // ── Callbacks ──
  // Memoize onLoadConversation to stabilize DashboardStats props
  const stableOnLoadConversation = React.useCallback(onLoadConversation, []);

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
        // ── Time-Block Check: Chặn DeepSeek trong giờ cấm ───────────────
        if (isDeepSeekProvider(model?.providerId)) {
          const providerConfig = providers.find(
            (p: any) =>
              p.provider_id?.toLowerCase() === model?.providerId?.toLowerCase(),
          );
          const ranges = providerConfig?.blocked_time_ranges ?? null;
          if (isBlockedNow(ranges)) {
            const rangeLabel = getBlockedRangeLabel(ranges);
            const allRanges = getBlockedHoursDescription(ranges);
            // Tạo fake chat session để hiển thị error message
            onSendMessage(
              `⛔ DeepSeek bị chặn trong khung giờ ${allRanges}. Hiện tại đang trong khung ${rangeLabel}. Vui lòng thử lại sau.`,
              [],
              model,
              account,
              {},
            );
            return;
          }
        }
        // ────────────────────────────────────────────────────────────────

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

  // ── Effects ──
  // Trigger history limit enforcement on mount
  useEffect(() => {
    extensionService.postMessage({
      command: "getHistory",
      requestId: `home-enforce-${Date.now()}`,
    });
  }, []);

  // Áp snapshot đã cache của kỳ đang chọn ngay khi đổi period/offset (không đợi mạng)
  useEffect(() => {
    const snap = readStatsSnapshot(statsPeriod, statsOffset);
    if (!snap) return;
    setTodayTokens(snap.todayTokens);
    setTodayRequests(snap.todayRequests);
    setFavoriteModel(snap.favoriteModel);
    setModelDistribution(snap.modelDistribution);
    setAccounts(snap.accounts);
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
            setAccounts(stats.data.accounts || []);
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
              accounts: stats.data.accounts || [],
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

  // Fetch conversation history
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const msg = event.data;
      if (msg.command === "historyResult") {
        if (msg.history) setConversations(msg.history);
        setIsLoading(false);
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
        requestId: `welcome-hist-${Date.now()}`,
      });
    }
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  // ── Render ──
  return (
    <div
      ref={homeRef}
      className="home-panel"
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "row",
        height: "100vh",
        backgroundColor: "var(--primary-bg)",
        borderTop: "1px solid var(--border-color)",
        boxSizing: "border-box",
        containerType: "inline-size",
        containerName: "zen-root",
      }}
    >
      <SidebarWidthToggle isWide={isWide} />
      <style>{`
        .zen-home-sidebar { position: relative; flex-shrink: 0; height: 100%; min-height: 0; }
        .zen-sidebar-resizer { position: absolute; top: 0; right: -4px; bottom: 0; width: 8px; cursor: col-resize; z-index: 10; }
        .zen-sidebar-resizer::after { content: ""; position: absolute; top: 0; bottom: 0; left: 3px; width: 2px; background: transparent; transition: background-color 0.15s ease; }
        .zen-sidebar-resizer:hover::after, .zen-sidebar-resizer.dragging::after { background: var(--vscode-sash-hoverBorder, var(--vscode-focusBorder, #3b82f6)); }
        @container zen-root (max-width: 699px) {
          .zen-home-sidebar { display: none; }
        }
        .zen-home-grid {
          display: grid;
          gap: 12px;
          width: 100%;
          align-content: start;
          margin: 0 auto;
          grid-template-columns: minmax(0, 1fr);
          grid-template-areas: "banner" "date" "stats" "dist" "usage" "recent";
        }
        .zen-home-recent { grid-area: recent; min-width: 0; display: none; }
        @container zen-root (max-width: 699px) {
          .zen-home-recent { display: block; }
        }
        .zen-home-banner { grid-area: banner; min-width: 0; }
        .zen-home-banner:empty { display: none; }
        .zen-home-date { grid-area: date; min-width: 0; }
        .zen-home-stats { grid-area: stats; min-width: 0; }
        .zen-home-dist { grid-area: dist; min-width: 0; }
        .zen-home-usage { grid-area: usage; min-width: 0; }
        .zen-home-ins { grid-area: ins; min-width: 0; display: none; }
        .zen-home-prov { grid-area: prov; min-width: 0; display: none; }

        .zen-home-top { grid-area: top; min-width: 0; display: none; }
        .zen-home-dist > div,
        .zen-home-usage > div,
        .zen-home-ins > div,
        .zen-home-top > div { height: 100%; }
        @container zen (min-width: 900px) {
          .zen-home-grid {
            gap: 16px;
            grid-template-columns: minmax(0, 1.8fr) minmax(300px, 1fr);
            grid-template-areas: "banner banner" "date date" "stats stats" "usage dist" "usage dist" "top top" "ins ins";
          }
          .zen-home-ins, .zen-home-top { display: block; }
        }
        @container zen (min-width: 1300px) {
          .zen-home-grid {
            max-width: 1440px;
            grid-template-columns: minmax(0, 1.75fr) minmax(0, 0.75fr) minmax(0, 1fr);
            grid-template-areas: "banner banner banner" "date date date" "stats stats stats" "usage usage dist" "usage usage dist" "top ins ins";
          }
        }
      `}</style>
      <div className="zen-home-sidebar" style={{ width: sidebarWidth }}>
        <HomeSidebar
          imagesUri={imagesUri}
          version={(window as any).__zenVersion}
          conversations={sortedConversations}
          isLoading={isLoading}
          onLoadConversation={stableOnLoadConversation}
          providerFavicons={providerFavicons}
        />
        <div
          className={`zen-sidebar-resizer${isResizing ? " dragging" : ""}`}
          onMouseDown={handleResizeStart}
          title="Drag to resize"
        />
      </div>
      <div
        style={{
          flex: 1,
          minWidth: 0,
          height: "100%",
          display: "flex",
          flexDirection: "column",
          containerType: "inline-size",
          containerName: "zen",
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
            padding:
              tier === "compact" ? "20px 10px 16px 10px" : "32px 16px 20px 16px",
            color: "var(--primary-text)",
            animation: "fadeIn 0.5s ease-out",
            maxWidth: "1200px",
            margin: "0 auto",
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          <HomeHeader imagesUri={imagesUri} />
          <div className="zen-home-grid">
            <div className="zen-home-banner">
              <InstallationBanner isConnected={isConnected} />
              <ZenUpdateBanner updateInfo={zenUpdateInfo} />
              <AIWeb2APIUpdateBanner updateInfo={updateInfo} />
            </div>


            <DashboardStats
              todayTokens={todayTokens}
              todayRequests={todayRequests}
              favoriteModel={favoriteModel}
              totalAccounts={totalAccounts}
              modelDistribution={modelDistribution}
              providerFavicons={providerFavicons}
              dailyUsage={dailyUsage}
              accounts={accounts}
              statsPeriod={statsPeriod}
            />

            {/* Lịch sử: chỉ hiện khi HomeSidebar bị ẩn (< 700px) */}
            <div className="zen-home-recent">
              <RecentActivity
                conversations={sortedConversations}
                isLoading={isLoading}
                onLoadConversation={stableOnLoadConversation}
                providerFavicons={providerFavicons}
              />
            </div>
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
    </div>
  );
};

export default HomePanel;
