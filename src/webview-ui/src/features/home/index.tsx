import React, { useEffect, useState } from "react";
import { Zap } from "lucide-react";
import MessageInput from "@/components/MessageInput";
import FilesPreviews from "@/components/MessageInput/FilesPreviews";
import StatsGrid from "./components/StatsGrid";
import RecentActivity from "./components/RecentActivity";
import ModelDistributionCard from "./components/ModelDistributionCard";
import DailyUsageChart from "./components/DailyUsageChart";
import { ConversationItem } from "../history/types";
import { extensionService } from "../../services/ExtensionService";
import { useSettings } from "../../context/SettingsContext";
import { useFileHandling } from "../../hooks/useFileHandling";

const SLOGANS = [
  "Code smarter, not harder",
  "Your AI coding companion",
  "Boost your productivity",
  "Where ideas meet implementation",
  "Ship faster with confidence",
  "Your partner in development",
] as const;

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

const HomePanel: React.FC<HomePanelProps> = ({
  onSendMessage,
  onLoadConversation,
  initialValue,
}) => {
  const imagesUri = (window as any).__zenImagesUri;
  const { apiUrl } = useSettings();

  const folderPath = (window as any).__zenWorkspaceFolderPath as
    | string
    | null
    | undefined;

  // MessageInput state
  const [currentModel, setCurrentModel] = useState<any>(() => {
    try {
      const saved = localStorage.getItem("zen_last_model");
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return null;
  });
  const [currentAccount, setCurrentAccount] = useState<any>(() => {
    try {
      const saved = localStorage.getItem("zen_last_account");
      if (saved) return JSON.parse(saved);
    } catch (e) {}
    return null;
  });
  const [message, setMessage] = useState(initialValue || "");
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Persist model/account selection when changed
  useEffect(() => {
    if (currentModel) {
      localStorage.setItem("zen_last_model", JSON.stringify(currentModel));
    }
  }, [currentModel]);

  useEffect(() => {
    if (currentAccount) {
      localStorage.setItem("zen_last_account", JSON.stringify(currentAccount));
    }
  }, [currentAccount]);

  // Dashboard state
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
                try {
                  favicons[p.provider_id] =
                    `${new URL(p.website).origin}/favicon.ico`;
                } catch {}
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
      } else if (msg.command === "deleteConfirmed" && msg.conversationId) {
        const vscodeApi = (window as any).vscodeApi;
        if (vscodeApi) {
          vscodeApi.postMessage({
            command: "deleteConversation",
            conversationId: msg.conversationId,
          });
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

  const sortedConversations = [...conversations].sort((a, b) => {
    const timeA = new Date(
      a.lastModified || a.timestamp || a.createdAt || 0,
    ).getTime();
    const timeB = new Date(
      b.lastModified || b.timestamp || b.createdAt || 0,
    ).getTime();
    return timeB - timeA;
  });

  // MessageInput handlers
  const handleSend = (model: any, account: any) => {
    if (message.trim() || uploadedFiles.length > 0) {
      onSendMessage(message, [...uploadedFiles], model, account);
      setMessage("");
      clearFiles();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setMessage(e.target.value);
  };

  const handleKeyDown = (_e: React.KeyboardEvent<HTMLTextAreaElement>) => {};

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
  } = useFileHandling({
    accountId: currentAccount?.id,
    onAddAttachedItem: () => {}, // no mention system in home
  });

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
                {SLOGANS[sloganIndex]}
              </div>
            </div>

            {/* Elara prerequisite alert */}
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
              <Zap
                size={16}
                color="var(--vscode-editorWarning-foreground, #eab308)"
                style={{ flexShrink: 0 }}
              />
              <div
                style={{
                  fontSize: "11px",
                  color: "var(--vscode-foreground)",
                  lineHeight: "1.4",
                }}
              >
                <strong
                  style={{
                    color: "var(--vscode-editorWarning-foreground, #eab308)",
                  }}
                >
                  Prerequisite:
                </strong>{" "}
                Zen requires{" "}
                <a
                  href="https://elara-home.vercel.app/"
                  target="_blank"
                  style={{
                    color: "var(--vscode-link-activeForeground, #3b82f6)",
                    textDecoration: "none",
                    fontWeight: 600,
                  }}
                >
                  Elara
                </a>{" "}
                backend running. Make sure Elara is installed and running before using Zen.
              </div>
            </div>
          </div>

          {/* Dashboard content */}
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
        attachedItems={[]}
        onRemoveFile={removeFile}
        onRemoveAttachedItem={() => {}}
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
        textareaRef={textareaRef}
        handleTextareaChange={handleTextareaChange}
        handleKeyDown={handleKeyDown}
        handlePaste={handlePaste}
        handleDragOver={handleDragOver}
        handleDrop={handleDrop}
        setShowAtMenu={() => {}}
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
