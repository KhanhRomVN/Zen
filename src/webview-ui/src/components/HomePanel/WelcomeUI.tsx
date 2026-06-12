import React, { useState, useEffect } from "react";
import {
  Loader2, FolderOpen, MessageSquare, Zap,
  Users, Brain,
} from "lucide-react";
import { ConversationItem } from "../HistoryPanel/types";
import HistoryCard from "../HistoryPanel/HistoryCard";
import { useI18n } from "../../hooks/useI18n";
import { useSettings } from "../../context/SettingsContext";
import ModelDistributionCard from "./ModelDistributionCard";
import DailyUsageChart from "./DailyUsageChart";

const SLOGANS_KEYS = [
  "home.slogan0", "home.slogan1", "home.slogan2",
  "home.slogan3", "home.slogan4", "home.slogan5",
] as const;

interface WelcomeUIProps {
  onLoadConversation?: (
    conversationId: string,
    tabId: number,
    folderPath: string | null,
  ) => void;
}

const WelcomeUI: React.FC<WelcomeUIProps> = ({ onLoadConversation }) => {
  const imagesUri = (window as any).__zenImagesUri;
  const { t } = useI18n();
  const { apiUrl } = useSettings();
  const [sloganIndex, setSloganIndex] = useState(0);
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");

  // Real stats from Elara
  const [todayTokens, setTodayTokens] = useState<number>(0);
  const [todayRequests, setTodayRequests] = useState<number>(0);
  const [favoriteModel, setFavoriteModel] = useState<string>("—");
  const [totalAccounts, setTotalAccounts] = useState<number>(0);
  const [modelDistribution, setModelDistribution] = useState<{ model_id: string; provider_id: string; total_requests: number; total_tokens: number }[]>([]);
  const [dailyUsage, setDailyUsage] = useState<{ date: string; requests: number; tokens: number }[]>([]);
  const [providerFavicons, setProviderFavicons] = useState<Record<string, string>>({});

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
            const usage: { requests: number; tokens: number }[] = stats.data.usage || [];
            setTodayTokens(usage.reduce((s: number, u: any) => s + (u.tokens || 0), 0));
            setTodayRequests(usage.reduce((s: number, u: any) => s + (u.requests || 0), 0));
            const models: any[] = (stats.data.models || []).filter((m: any) => m.total_requests > 0);
            setModelDistribution(models.slice(0, 5));
            setDailyUsage(stats.data.usage || []);
            if (models.length > 0) setFavoriteModel(models[0].model_id);
          }
        }
        if (accountsRes.ok) {
          const accs = await accountsRes.json();
          if (accs.success && accs.data) {
            setTotalAccounts(accs.data.total ?? accs.data.accounts?.length ?? 0);
          }
        }
        if (providersRes.ok) {
          const prov = await providersRes.json();
          if (prov.success && prov.data) {
            const favicons: Record<string, string> = {};
            prov.data.forEach((p: any) => {
              if (p.provider_id && p.website) {
                try { favicons[p.provider_id] = `${new URL(p.website).origin}/favicon.ico`; } catch {}
              }
            });
            setProviderFavicons(favicons);
          }
        }
      } catch {}
    };
    fetchStats();
  }, [apiUrl]);

  useEffect(() => {
    const timer = setInterval(() => {
      setSloganIndex((prev) => (prev + 1) % SLOGANS_KEYS.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  // Fetch history logic
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.command === "historyResult") {
        if (message.history) {
          setConversations(message.history);
        }
        setIsLoading(false);
      } else if (message.command === "deleteConversationResult") {
        if (message.success) {
          setConversations((prev) =>
            prev.filter((c) => c.id !== message.conversationId),
          );
        }
      } else if (
        message.command === "deleteConfirmed" &&
        message.conversationId
      ) {
        const vscodeApi = (window as any).vscodeApi;
        if (vscodeApi) {
          vscodeApi.postMessage({
            command: "deleteConversation",
            conversationId: message.conversationId,
          });
        }
      }
    };

    window.addEventListener("message", handleMessage);

    // Initial load
    const vscodeApi = (window as any).vscodeApi;
    if (vscodeApi) {
      vscodeApi.postMessage({
        command: "getHistory",
        requestId: `welcome-hist-${Date.now()}`,
      });
    }

    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const handleDeleteConversation = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const vscodeApi = (window as any).vscodeApi;
    if (vscodeApi) {
      vscodeApi.postMessage({ command: "confirmDelete", conversationId: id });
    }
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    const d = date.getDate().toString().padStart(2, "0");
    const m = (date.getMonth() + 1).toString().padStart(2, "0");
    const y = date.getFullYear();
    const h = date.getHours().toString().padStart(2, "0");
    const min = date.getMinutes().toString().padStart(2, "0");
    return `${d}/${m}/${y} ${h}:${min}`;
  };

  const filteredConversations = conversations
    .filter(
      (item) =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.preview.toLowerCase().includes(searchQuery.toLowerCase()),
    )
    .sort((a, b) => {
      const timeA = new Date(
        a.lastModified || a.timestamp || a.createdAt || 0,
      ).getTime();
      const timeB = new Date(
        b.lastModified || b.timestamp || b.createdAt || 0,
      ).getTime();
      return timeB - timeA;
    });

  // no mock stats needed — real data from API

  return (
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
        overflowY: "auto",
      }}
    >
      {/* Header Info */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: "12px",
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
            margin: "0",
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
            {t(SLOGANS_KEYS[sloganIndex])}
          </div>
        </div>

        {/* Elara Requirement Alert */}
        <div
          style={{
            padding: "10px 14px",
            borderRadius: "8px",
            backgroundColor: "rgba(234, 179, 8, 0.04)",
            border: "1px solid rgba(234, 179, 8, 0.12)",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            textAlign: "left",
            width: "100%",
            marginBottom: "16px",
            boxSizing: "border-box",
          }}
        >
          <Zap size={16} color="var(--vscode-editorWarning-foreground, #eab308)" style={{ flexShrink: 0 }} />
          <div
            style={{
              fontSize: "11px",
              color: "var(--vscode-foreground)",
              lineHeight: "1.4",
            }}
          >
            <strong style={{ color: "var(--vscode-editorWarning-foreground, #eab308)" }}>{t("home.prerequisiteLabel")}</strong>{" "}
            {t("home.prerequisiteText")}{" "}
            <a href="https://elara-home.vercel.app/" target="_blank" style={{ color: "var(--vscode-link-activeForeground, #3b82f6)", textDecoration: "none", fontWeight: 600 }}>
              Elara
            </a>{" "}
            {t("home.prerequisiteEnsure")}
          </div>
        </div>
      </div>

      {/* Stats content */}
      <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Stats Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, 1fr)",
              gap: "10px",
              width: "100%",
            }}
          >
            {/* Stat Card 1 */}
            <div
              className="dashboard-card"
              style={{
                backgroundColor: "var(--vscode-sideBar-background, rgba(0,0,0,0.15))",
                border: "1px solid var(--vscode-widget-border, rgba(128,128,128,0.15))",
                borderRadius: "8px",
                padding: "12px",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                transition: "transform 0.2s ease, border-color 0.2s ease",
              }}
            >
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "6px",
                  backgroundColor: "rgba(59, 130, 246, 0.12)",
                  color: "var(--vscode-textLink-foreground, #3b82f6)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <MessageSquare size={16} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <span style={{ fontSize: "16px", fontWeight: 700 }}>{todayTokens.toLocaleString()}</span>
                <span style={{ fontSize: "10px", color: "var(--vscode-descriptionForeground)", fontWeight: 500 }}>
                  {t("home.statTotalChats")}
                </span>
              </div>
            </div>

            {/* Stat Card 2 */}
            <div
              className="dashboard-card"
              style={{
                backgroundColor: "var(--vscode-sideBar-background, rgba(0,0,0,0.15))",
                border: "1px solid var(--vscode-widget-border, rgba(128,128,128,0.15))",
                borderRadius: "8px",
                padding: "12px",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                transition: "transform 0.2s ease, border-color 0.2s ease",
              }}
            >
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "6px",
                  backgroundColor: "rgba(16, 185, 129, 0.12)",
                  color: "var(--vscode-gitDecoration-addedResourceForeground, #10b981)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Zap size={16} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <span style={{ fontSize: "16px", fontWeight: 700 }}>{todayRequests}</span>
                <span style={{ fontSize: "10px", color: "var(--vscode-descriptionForeground)", fontWeight: 500 }}>
                  {t("home.statToolsExecuted")}
                </span>
              </div>
            </div>

            {/* Stat Card 3 */}
            <div
              className="dashboard-card"
              style={{
                backgroundColor: "var(--vscode-sideBar-background, rgba(0,0,0,0.15))",
                border: "1px solid var(--vscode-widget-border, rgba(128,128,128,0.15))",
                borderRadius: "8px",
                padding: "12px",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                transition: "transform 0.2s ease, border-color 0.2s ease",
              }}
            >
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "6px",
                  backgroundColor: "rgba(245, 158, 11, 0.12)",
                  color: "var(--vscode-editorWarning-foreground, #f59e0b)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Brain size={16} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <span style={{ fontSize: "13px", fontWeight: 700, lineHeight: 1.2, wordBreak: "break-all" }}>{favoriteModel}</span>
                <span style={{ fontSize: "10px", color: "var(--vscode-descriptionForeground)", fontWeight: 500 }}>
                  {t("home.statEstimatedSavings")}
                </span>
              </div>
            </div>

            {/* Stat Card 4 */}
            <div
              className="dashboard-card"
              style={{
                backgroundColor: "var(--vscode-sideBar-background, rgba(0,0,0,0.15))",
                border: "1px solid var(--vscode-widget-border, rgba(128,128,128,0.15))",
                borderRadius: "8px",
                padding: "12px",
                display: "flex",
                alignItems: "center",
                gap: "12px",
                transition: "transform 0.2s ease, border-color 0.2s ease",
              }}
            >
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "6px",
                  backgroundColor: "rgba(139, 92, 246, 0.12)",
                  color: "var(--vscode-symbolIcon-namespaceForeground, #8b5cf6)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <Users size={16} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <span style={{ fontSize: "16px", fontWeight: 700 }}>{totalAccounts}</span>
                <span style={{ fontSize: "10px", color: "var(--vscode-descriptionForeground)", fontWeight: 500 }}>
                  {t("home.statSuccessRate")}
                </span>
              </div>
            </div>
          </div>

          {/* AI Model Distribution */}
          <ModelDistributionCard
            modelDistribution={modelDistribution}
            providerFavicons={providerFavicons}
            title={t("home.aiModelDistribution")}
            emptyText={t("home.loadingHistory")}
          />

          <DailyUsageChart
            usage={dailyUsage}
            title={t("home.dailyUsage")}
          />

          {/* Quick Recent Chats Card */}
          <div
            style={{
              backgroundColor: "var(--vscode-sideBar-background, rgba(0,0,0,0.15))",
              border: "1px solid var(--vscode-widget-border, rgba(128,128,128,0.15))",
              borderRadius: "8px",
              padding: "14px",
              boxSizing: "border-box",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--vscode-foreground)", textTransform: "uppercase", letterSpacing: "0.05em", opacity: 0.8 }}>
                {t("home.recentActivities")}
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              {isLoading ? (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "10px 0", color: "var(--vscode-disabledForeground)" }}>
                  <Loader2 size={12} className="spin-animation" />
                  <span style={{ fontSize: "11px" }}>{t("home.loadingHistory")}</span>
                </div>
              ) : conversations.length > 0 ? (
                conversations.slice(0, 10).map((item) => (
                  <HistoryCard
                    key={item.id}
                    item={item}
                    onClick={() => onLoadConversation?.(item.id, item.tabId, item.folderPath)}
                    onDelete={(id, e) => { e.stopPropagation(); const vscodeApi = (window as any).vscodeApi; if (vscodeApi) vscodeApi.postMessage({ command: "confirmDelete", conversationId: id }); }}
                    formatDate={(ts) => { const d = new Date(ts); return `${d.getDate().toString().padStart(2,"0")}/${(d.getMonth()+1).toString().padStart(2,"0")}/${d.getFullYear()}`; }}
                  />
                ))
              ) : (
                <div style={{ padding: "10px 0", fontSize: "11px", color: "var(--vscode-disabledForeground)", fontStyle: "italic" }}>
                  {t("home.noRecentChats")}
                </div>
              )}
            </div>
          </div>
        </div>

      <style>{`
        @keyframes fadeIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
        .spin-animation { animation: spin 1s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .dashboard-card:hover { transform: translateY(-2px); border-color: var(--vscode-focusBorder) !important; box-shadow: 0 4px 12px rgba(0,0,0,0.12); }
      `}</style>
    </div>
  );
};

export default WelcomeUI;
