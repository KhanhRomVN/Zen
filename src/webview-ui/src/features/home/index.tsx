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
import RecentActivity from "./components/RecentActivity";
import ModelDistributionCard from "./components/ModelDistributionCard";
import DailyUsageChart from "./components/DailyUsageChart";
import InstallationBanner from "./components/InstallationBanner";

// ── Hooks ──
import { useSettings } from "../../context/SettingsContext";
import { useFileHandling } from "../../hooks/useFileHandling";
import { useHomeDraftManagement } from "./hooks/useHomeDraftManagement";
import { useModelAccount } from "../../hooks/useModelAccount";

// ── Services ──
import { extensionService } from "../../services/ExtensionService";

// ── Types ──
import { ConversationItem } from "../history/types";

// ─── Constants ──────────────────────────────────────────────────────────
const SLOGANS = [
  "Code smarter, not harder",
  "Your AI coding companion",
  "Boost your productivity",
  "Where ideas meet implementation",
  "Ship faster with confidence",
  "Your partner in development",
] as const;

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
    sortedConversations,
    isLoading,
    onLoadConversation,
  }: {
    todayTokens: number;
    todayRequests: number;
    favoriteModel: string;
    totalAccounts: number;
    modelDistribution: any[];
    providerFavicons: Record<string, string>;
    dailyUsage: any[];
    sortedConversations: ConversationItem[];
    isLoading: boolean;
    onLoadConversation: (
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
      const tokenChange = yesterday?.tokens && today?.tokens
        ? ((today.tokens - yesterday.tokens) / yesterday.tokens) * 100
        : null;
      const requestChange = yesterday?.requests && today?.requests
        ? ((today.requests - yesterday.requests) / yesterday.requests) * 100
        : null;
      return [tokenChange, requestChange, null, null];
    }, [dailyUsage, modelDistribution, favoriteModel]);

    return (
      <div
        style={{
          width: "100%",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <StatsGrid
          todayTokens={todayTokens}
          todayRequests={todayRequests}
          favoriteModel={favoriteModel}
          totalAccounts={totalAccounts}
          percentChanges={percentChanges}
        />

        <ModelDistributionCard
          modelDistribution={modelDistribution}
          providerFavicons={providerFavicons}
          title="AI Model Distribution"
          emptyText="Loading history..."
        />

        <DailyUsageChart usage={dailyUsage} title="Daily Usage" />

        <RecentActivity
          conversations={sortedConversations}
          isLoading={isLoading}
          onLoadConversation={onLoadConversation}
          providerFavicons={providerFavicons}
        />
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
  const [sloganIndex, setSloganIndex] = useState(0);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [todayTokens, setTodayTokens] = useState<number>(0);
  const [todayRequests, setTodayRequests] = useState<number>(0);
  const [favoriteModel, setFavoriteModel] = useState<string>("—");
  const [totalAccounts, setTotalAccounts] = useState<number>(0);
  const [modelDistribution, setModelDistribution] = useState<
    {
      model_id: string;
      provider_id: string;
      total_requests: number;
      total_tokens: number;
    }[]
  >([]);
  const [dailyUsage, setDailyUsage] = useState<
    { date: string; requests: number; tokens: number }[]
  >([]);
  const [providerFavicons, setProviderFavicons] = useState<
    Record<string, string>
  >({});
  const [attachedItems, setAttachedItems] = React.useState<any[]>([]);

  // ── Store ──
  const { apiUrl } = useSettings();

  const folderPath = (window as any).__zenWorkspaceFolderPath as
    | string
    | null
    | undefined;

  const { message, setMessage, clearDraft } = useHomeDraftManagement(
    folderPath || null,
  );

  const { currentModel, setCurrentModel, currentAccount, setCurrentAccount } =
    useModelAccount(folderPath);

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
    console.log('[Home] ========== handleAddAttachedItem START ==========');
    console.log('[Home] Received item:', {
      id: item.id,
      type: item.type,
      path: item.path,
      hasContent: !!(item as any).content,
      contentLength: (item as any).content?.length || 0,
    });
    
    setAttachedItems((prev) => {
      console.log('[Home] Current attachedItems count:', prev.length);
      const updated = [...prev, item];
      console.log('[Home] Updated attachedItems count:', updated.length);
      console.log('[Home] Updated attachedItems:', updated.map(i => ({
        id: i.id,
        type: i.type,
        hasContent: !!(i as any).content,
      })));
      return updated;
    });
    
    console.log('[Home] ========== handleAddAttachedItem END ==========');
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
      onSendMessage,
      clearDraft,
      clearFiles,
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

  // Fetch stats from API
  useEffect(() => {
    const fetchStats = async () => {
      try {
        const [statsRes, accountsRes, providersRes] = await Promise.all([
          fetch(`${apiUrl}/v1/stats?period=day`),
          fetch(`${apiUrl}/v1/accounts?page=1&limit=1000`),
          fetch(`${apiUrl}/v1/providers`),
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
  }, [apiUrl]);

  // Rotate slogans
  useEffect(() => {
    const timer = setInterval(() => {
      setSloganIndex((prev) => (prev + 1) % SLOGANS.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

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
      className="home-panel"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100vh",
        backgroundColor: "var(--primary-bg)",
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
            maxWidth: "680px",
            margin: "0 auto",
            width: "100%",
            boxSizing: "border-box",
          }}
        >
          {/* Header */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0",
              textAlign: "center",
              width: "100%",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
              <div
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "10px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <img
                  src={`${imagesUri}/icon.png`}
                  alt="Zen Logo"
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "contain",
                  }}
                />
              </div>
              <h1
                style={{
                  fontSize: "30px",
                  fontWeight: 800,
                  margin: 0,
                  background:
                    "linear-gradient(to right, var(--vscode-foreground, #fff), var(--vscode-textPreformat-foreground, #a8a8a8))",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  letterSpacing: "-0.02em",
                }}
              >
                Zen
              </h1>
            </div>

            <div
              style={{
                height: "28px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                margin: "0 0 12px 0",
              }}
            >
              <div
                key={sloganIndex}
                style={{
                  fontSize: "14px",
                  color: "var(--vscode-descriptionForeground, #888)",
                  fontWeight: 500,
                  animation: "slideUp 0.4s ease-out",
                  whiteSpace: "nowrap",
                }}
              >
                {SLOGANS[sloganIndex]}
              </div>
            </div>

            <InstallationBanner />
          </div>

          {/* Dashboard content */}
          <DashboardStats
            todayTokens={todayTokens}
            todayRequests={todayRequests}
            favoriteModel={favoriteModel}
            totalAccounts={totalAccounts}
            modelDistribution={modelDistribution}
            providerFavicons={providerFavicons}
            dailyUsage={dailyUsage}
            sortedConversations={sortedConversations}
            isLoading={isLoading}
            onLoadConversation={stableOnLoadConversation}
          />

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
        accept="image/*,text/*"
      />
      <input
        ref={externalFileInputRef}
        type="file"
        multiple
        style={{ display: "none" }}
        onChange={handleExternalFileInputChange}
      />
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
      />
    </div>
  );
};

export default HomePanel;
