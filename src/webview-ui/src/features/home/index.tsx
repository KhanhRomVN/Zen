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
import { useHomeDraftManagement } from "./hooks/useHomeDraftManagement";

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

  // Use draft management hook for auto-save/restore
  const { message, setMessage, clearDraft } = useHomeDraftManagement(
    folderPath || null
  );

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
      clearDraft(); // Clear draft after sending
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

            {/* AIWeb2API prerequisite alert - Prominent box */}
            <div
              style={{
                padding: "16px 18px",
                borderRadius: "10px",
                background:
                  "linear-gradient(135deg, rgba(59, 130, 246, 0.08) 0%, rgba(147, 51, 234, 0.08) 100%)",
                border: "2px solid rgba(59, 130, 246, 0.3)",
                boxShadow:
                  "0 4px 12px rgba(59, 130, 246, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.1)",
                display: "flex",
                alignItems: "flex-start",
                textAlign: "left",
                width: "100%",
                marginBottom: "20px",
                boxSizing: "border-box",
                position: "relative",
                overflow: "hidden",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-2px)";
                e.currentTarget.style.boxShadow =
                  "0 6px 20px rgba(59, 130, 246, 0.25), inset 0 1px 0 rgba(255, 255, 255, 0.1)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow =
                  "0 4px 12px rgba(59, 130, 246, 0.15), inset 0 1px 0 rgba(255, 255, 255, 0.1)";
              }}
            >
              {/* Animated background gradient */}
              <div
                style={{
                  position: "absolute",
                  top: 0,
                  left: 0,
                  right: 0,
                  bottom: 0,
                  background:
                    "linear-gradient(45deg, transparent 30%, rgba(59, 130, 246, 0.05) 50%, transparent 70%)",
                  backgroundSize: "200% 200%",
                  animation: "shimmer 3s ease-in-out infinite",
                  pointerEvents: "none",
                }}
              />
              <div
                style={{
                  fontSize: "12.5px",
                  color: "var(--vscode-foreground)",
                  lineHeight: "1.5",
                  position: "relative",
                  zIndex: 1,
                }}
              >
                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: 700,
                    color: "var(--vscode-textLink-activeForeground, #3b82f6)",
                    marginBottom: "6px",
                    letterSpacing: "0.3px",
                  }}
                >
                  ⚡ PREREQUISITE REQUIRED
                </div>
                Zen requires{" "}
                <a
                  href="https://github.com/KhanhRomVN/AIWeb2API"
                  target="_blank"
                  style={{
                    color: "var(--vscode-textLink-activeForeground, #3b82f6)",
                    textDecoration: "none",
                    fontWeight: 700,
                    borderBottom: "2px solid rgba(59, 130, 246, 0.4)",
                    paddingBottom: "1px",
                    transition: "all 0.2s ease",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderBottomColor =
                      "var(--vscode-textLink-activeForeground, #3b82f6)";
                    e.currentTarget.style.paddingBottom = "2px";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderBottomColor =
                      "rgba(59, 130, 246, 0.4)";
                    e.currentTarget.style.paddingBottom = "1px";
                  }}
                >
                  AIWeb2API
                </a>{" "}
                backend running. Make sure AIWeb2API is installed and running
                before using Zen.
              </div>
            </div>

            <style>{`
              @keyframes shimmer {
                0% { background-position: -200% 0; }
                100% { background-position: 200% 0; }
              }
            `}</style>
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
