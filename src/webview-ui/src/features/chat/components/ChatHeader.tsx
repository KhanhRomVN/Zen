/**
 * ------------------------------------------------------------------
 * ChatHeader
 * ------------------------------------------------------------------
 * Row 1: conversation_title  [Search] [3-dot vert]
 * Row 2: favicon · provider/model · email  [StatsBadge▸tooltip]
 * ------------------------------------------------------------------
 */

import React from "react";
import { useAccountStats } from "../../../hooks/useAccountStats";

// ─── Props ───────────────────────────────────────────────────────────────
interface ChatHeaderProps {
  displayedModel: any;
  currentAccount: any;
  setCurrentAccount: (account: any) => void;

  messages?: any[];
  conversationTitle?: string;
  currentConversationId?: string | null;
  currentTaskName: string | null;

  promptLengthMode?: "none" | "short" | "medium" | "long";
  systemPromptMode?: string;

  contextUsage: { prompt: number; completion: number; total: number };
  chatTokens?: number;
  chatRequests?: number;

  isSearchOpen: boolean;
  setIsSearchOpen: React.Dispatch<React.SetStateAction<boolean>>;
  searchQuery: string;
  setSearchQuery: (value: string) => void;

  onRenameConversation?: () => void;
  onCopyAsMarkdown?: () => void;
  onCopyAsJson?: () => void;
  onDeleteConversation?: () => void;
  onExportAsJson?: () => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────
const fmt = (num: number) => {
  if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + "M";
  if (num >= 1_000) return (num / 1_000).toFixed(1) + "K";
  return num.toString();
};

const PROMPT_LENGTH_COLOR: Record<string, string> = {
  none: "#64748b",
  short: "#14b8a6",
  medium: "#f59e0b",
  long: "#8b5cf6",
};
const PROMPT_LENGTH_LABEL: Record<string, string> = {
  none: "No Prompt",
  short: "Short",
  medium: "Medium",
  long: "Long",
};

const parseUserContent = (content: string): string => {
  const regex = /## User Message\n<user-message>\n([\s\S]*?)\n<\/user-message>/;
  const match = content.match(regex);
  if (match) return match[1];

  let cleaned = content
    .replace(/^<user-message>\n?/, "")
    .replace(/\n?<\/user-message>[\s\S]*$/, "");

  if (cleaned.startsWith("```") && cleaned.includes("```", 3)) {
    cleaned = cleaned.split("```")[1]?.trim() || cleaned;
  }
  return cleaned || "";
};

const extractFirstUserMessage = (messages: any[]): string => {
  if (!messages || !messages.length) return "";
  const firstUserMsg = messages.find((msg) => msg.role === "user");
  if (!firstUserMsg) return "";

  const rawContent =
    typeof firstUserMsg.content === "string" ? firstUserMsg.content : "";
  const parsed = parseUserContent(rawContent).trim();

  // Take first line or truncate to reasonable length for title
  const lines = parsed.split("\n").filter((l) => l.trim());
  const titleCandidate = lines[0] || parsed.substring(0, 60);

  return titleCandidate.length > 60
    ? titleCandidate.substring(0, 57) + "..."
    : titleCandidate;
};

const getFaviconUrl = (providerId: string, fallback?: string): string => {
  if (fallback) return fallback;
  const pid = providerId.toLowerCase();
  const domain = (() => {
    if (
      pid.includes("openai") ||
      pid.includes("chatgpt") ||
      pid.includes("gpt")
    )
      return "openai.com";
    if (pid.includes("anthropic") || pid.includes("claude"))
      return "anthropic.com";
    if (pid.includes("google") || pid.includes("gemini")) return "google.com";
    if (pid.includes("openrouter")) return "openrouter.ai";
    if (pid.includes("deepseek")) return "deepseek.com";
    if (pid.includes("grok") || pid.includes("xai") || pid.includes("x.ai"))
      return "x.ai";
    if (pid.includes("zenmux")) return "zenmux.ai";
    if (pid.includes("moonshot") || pid.includes("kimi")) return "moonshot.cn";
    if (
      pid.includes("qwen") ||
      pid.includes("alibaba") ||
      pid.includes("aliyun") ||
      pid.includes("dashscope")
    )
      return "qwen.ai";
    if (pid.includes("groq")) return "groq.com";
    if (pid.includes("mistral")) return "mistral.ai";
    if (
      pid.includes("glm") ||
      pid.includes("zai") ||
      pid.includes("z-ai") ||
      pid.includes("zhipu") ||
      pid.includes("bigmodel")
    )
      return "bigmodel.cn";
    if (pid.includes("cohere")) return "cohere.com";
    if (pid.includes("perplexity")) return "perplexity.ai";
    if (pid.includes("together")) return "together.ai";
    if (pid.includes("fireworks")) return "fireworks.ai";
    if (pid.includes("meta") || pid.includes("llama")) return "meta.com";
    if (pid.includes("siliconflow")) return "siliconflow.cn";
    if (pid.includes("baichuan")) return "baichuan-ai.com";
    if (pid.includes("minimax")) return "minimaxi.com";
    if (pid.includes("01wanwu") || pid.includes("yi-")) return "01.ai";
    return `${pid}.com`;
  })();
  return `https://www.google.com/s2/favicons?domain=${domain}&sz=64`;
};

// ─── Square icon button (Search / 3-dot) ─────────────────────────────────
const SqButton: React.FC<{
  title: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}> = ({ title, active = false, onClick, children }) => {
  const [hov, setHov] = React.useState(false);
  const SIZE = "24px";
  return (
    <button
      onClick={onClick}
      title={title}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        width: SIZE,
        height: SIZE,
        padding: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        borderRadius: "4px",
        border: "none",
        outline: "none",
        cursor: "pointer",
        background: "transparent",
        color: active
          ? "var(--vscode-button-background, var(--vscode-textLink-foreground))"
          : "var(--vscode-icon-foreground, var(--secondary-text))",
        opacity: active ? 1 : hov ? 1 : 0.6,
        transition: "opacity 0.15s ease",
      }}
    >
      {children}
    </button>
  );
};

// ─── 3-dot menu ───────────────────────────────────────────────────────────
interface ConversationMenuProps {
  onRename?: () => void;
  onCopyAsMarkdown?: () => void;
  onCopyAsJson?: () => void;
  onDelete?: () => void;
  onExportAsJson?: () => void;
}

const ConversationMenu: React.FC<ConversationMenuProps> = ({
  onRename,
  onCopyAsMarkdown,
  onCopyAsJson,
  onDelete,
  onExportAsJson,
}) => {
  const [open, setOpen] = React.useState(false);
  const [hov, setHov] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, [open]);

  const items: {
    label: string;
    icon: React.ReactNode;
    action?: () => void;
    danger?: boolean;
    sep?: boolean;
  }[] = [
    {
      label: "Rename",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
          <path d="m15 5 4 4" />
        </svg>
      ),
      action: onRename,
    },
    {
      label: "Copy as Markdown",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
        </svg>
      ),
      action: onCopyAsMarkdown,
    },
    {
      label: "Copy as JSON",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
        </svg>
      ),
      action: onCopyAsJson,
    },
    {
      label: "Export as JSON",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" x2="12" y1="15" y2="3" />
        </svg>
      ),
      action: onExportAsJson,
    },
    {
      label: "Delete Conversation",
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="13"
          height="13"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 6h18" />
          <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
          <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
        </svg>
      ),
      action: onDelete,
      danger: true,
      sep: true,
    },
  ];

  const SIZE = "24px";
  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        title="More options"
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          width: SIZE,
          height: SIZE,
          padding: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          borderRadius: "4px",
          border: "none",
          outline: "none",
          cursor: "pointer",
          background: "transparent",
          color: open
            ? "var(--vscode-button-background, var(--vscode-textLink-foreground))"
            : "var(--vscode-icon-foreground, var(--secondary-text))",
          opacity: open || hov ? 1 : 0.6,
          transition: "opacity 0.15s ease",
        }}
      >
        {/* vertical ellipsis */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="15"
          height="15"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="5" r="1" />
          <circle cx="12" cy="12" r="1" />
          <circle cx="12" cy="19" r="1" />
        </svg>
      </button>

      {open && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 4px)",
            right: 0,
            zIndex: 9999,
            backgroundColor:
              "var(--vscode-menu-background, var(--vscode-editorWidget-background, #1e1e1e))",
            border:
              "1px solid var(--vscode-menu-border, var(--vscode-widget-border, #454545))",
            borderRadius: "6px",
            boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
            minWidth: "180px",
            padding: "4px 0",
            overflow: "hidden",
          }}
        >
          {items.map((item) => (
            <React.Fragment key={item.label}>
              {item.sep && (
                <div
                  style={{
                    height: "1px",
                    backgroundColor:
                      "var(--vscode-widget-border, rgba(255,255,255,0.08))",
                    margin: "4px 0",
                  }}
                />
              )}
              <button
                onClick={() => {
                  setOpen(false);
                  item.action?.();
                }}
                disabled={!item.action}
                style={{
                  width: "100%",
                  padding: "6px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  background: "transparent",
                  border: "none",
                  cursor: item.action ? "pointer" : "not-allowed",
                  color: item.danger
                    ? "var(--vscode-editorError-foreground, #ef4444)"
                    : "var(--vscode-menu-foreground, var(--vscode-foreground))",
                  fontSize: "12px",
                  textAlign: "left",
                  opacity: item.action ? 1 : 0.4,
                  transition: "background 0.1s ease",
                }}
                onMouseEnter={(e) => {
                  if (item.action)
                    e.currentTarget.style.backgroundColor = item.danger
                      ? "color-mix(in srgb, var(--vscode-editorError-foreground, #ef4444) 12%, transparent)"
                      : "var(--vscode-menu-selectionBackground, rgba(255,255,255,0.06))";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <span
                  style={{
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  {item.icon}
                </span>
                {item.label}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};



// ─── Progress circle for usage% ─────────────────────────────────────────
const UsageCircle: React.FC<{ pct: number; color: string }> = ({
  pct,
  color,
}) => {
  const R = 6;
  const circ = 2 * Math.PI * R;
  const dash = Math.min(pct / 100, 1) * circ;
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" style={{ flexShrink: 0 }}>
      <circle
        cx="8"
        cy="8"
        r={R}
        fill="none"
        stroke="rgba(128,128,128,0.2)"
        strokeWidth="2.5"
      />
      <circle
        cx="8"
        cy="8"
        r={R}
        fill="none"
        stroke={color}
        strokeWidth="2.5"
        strokeDasharray={`${dash} ${circ}`}
        strokeDashoffset={circ * 0.25}
        strokeLinecap="round"
        transform="rotate(-90 8 8)"
      />
    </svg>
  );
};

// ─── Stats badge + custom tooltip ────────────────────────────────────────
interface StatsBadgeProps {
  chatTokens?: number;
  chatRequests?: number;
  dayTokens?: number | null;
  dayRequests?: number | null;
  usageNum?: number | null;
  usageColor?: string;
  promptLengthMode?: string;
  systemPromptMode?: string;
}

const StatsBadge: React.FC<StatsBadgeProps> = ({
  chatTokens,
  chatRequests,
  dayTokens,
  dayRequests,
  usageNum,
  usageColor = "var(--vscode-charts-purple, #a855f7)",
  promptLengthMode,
  systemPromptMode,
}) => {
  const [tooltipPos, setTooltipPos] = React.useState<{
    x: number;
    y: number;
  } | null>(null);
  const ref = React.useRef<HTMLDivElement>(null);

  const handleMouseEnter = () => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setTooltipPos({ x: rect.right, y: rect.bottom + 6 });
  };
  const handleMouseLeave = () => setTooltipPos(null);

  const hasChatStats = chatTokens != null || chatRequests != null;
  const hasDayStats =
    dayTokens != null || dayRequests != null || usageNum != null;
  const hasAny = hasChatStats || hasDayStats;

  if (!hasAny) return null;

  const plLabel = promptLengthMode
    ? (PROMPT_LENGTH_LABEL[promptLengthMode] ?? promptLengthMode)
    : "—";
  const plColor = promptLengthMode
    ? (PROMPT_LENGTH_COLOR[promptLengthMode] ?? "#64748b")
    : "#64748b";

  return (
    <>
      <div
        ref={ref}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          padding: "1px 7px",
          borderRadius: "4px",
          height: "20px",
          boxSizing: "border-box",
          cursor: "default",
          backgroundColor:
            "color-mix(in srgb, var(--vscode-icon-foreground, var(--secondary-text)) 8%, transparent)",
          border:
            "1px solid color-mix(in srgb, var(--vscode-icon-foreground, var(--secondary-text)) 14%, transparent)",
          fontSize: "12px",
          color: "var(--secondary-text)",
          whiteSpace: "nowrap",
        }}
      >
        {/* tokens */}
        {chatTokens != null && (
          <span>
            <span style={{ color: "var(--primary-text)" }}>
              {fmt(chatTokens)}
            </span>{" "}
            tok
          </span>
        )}
        {/* requests */}
        {chatRequests != null && (
          <span>
            <span style={{ color: "var(--primary-text)" }}>
              {fmt(chatRequests)}
            </span>{" "}
            req
          </span>
        )}
        {/* usage circle + percent */}
        {usageNum != null && (
          <>
            <UsageCircle pct={usageNum} color={usageColor} />
            <span>{Math.round(usageNum)}%</span>
          </>
        )}
      </div>

      {/* ── Custom tooltip ── */}
      {tooltipPos && (
        <div
          style={{
            position: "fixed",
            left: tooltipPos.x,
            top: tooltipPos.y,
            transform: "translateX(-100%)",
            zIndex: 99999,
            backgroundColor: "var(--sidebar-bg, var(--input-bg))",
            border: "1px solid var(--border-color)",
            borderRadius: "10px",
            padding: "10px 12px",
            minWidth: "200px",
            boxShadow: "0 4px 24px rgba(0,0,0,0.28)",
            pointerEvents: "none",
            fontSize: "11px",
            color: "var(--vscode-foreground)",
            lineHeight: 1.5,
          }}
        >
          {/* ── This conversation ── */}
          <div
            style={{
              fontSize: "10px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.07em",
              opacity: 0.5,
              marginBottom: "5px",
            }}
          >
            This conversation
          </div>
          <TooltipRow
            icon="token"
            label="Tokens"
            value={chatTokens != null ? fmt(chatTokens) : "—"}
          />
          <TooltipRow
            icon="req"
            label="Requests"
            value={chatRequests != null ? String(chatRequests) : "—"}
          />

          {/* ── Account (day) ── */}
          <div
            style={{
              height: "1px",
              backgroundColor: "rgba(255,255,255,0.07)",
              margin: "7px 0",
            }}
          />
          <div
            style={{
              fontSize: "10px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.07em",
              opacity: 0.5,
              marginBottom: "5px",
            }}
          >
            Account (day)
          </div>
          <TooltipRow
            icon="token"
            label="Tokens"
            value={dayTokens != null ? fmt(dayTokens) : "—"}
          />
          <TooltipRow
            icon="req"
            label="Requests"
            value={dayRequests != null ? String(dayRequests) : "—"}
          />
          <TooltipRow
            icon="usage"
            label="Usage"
            value={usageNum != null ? `${usageNum.toFixed(1)}%` : "—"}
            valueColor={usageColor}
          />

          {/* ── Config ── */}
          <div
            style={{
              height: "1px",
              backgroundColor: "rgba(255,255,255,0.07)",
              margin: "7px 0",
            }}
          />
          <div
            style={{
              fontSize: "10px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.07em",
              opacity: 0.5,
              marginBottom: "5px",
            }}
          >
            Config
          </div>
          <TooltipRow
            icon="pl"
            label="Prompt Length"
            value={plLabel}
            valueColor={plColor}
          />
          {systemPromptMode && (
            <TooltipRow icon="cs" label="Code Style" value={systemPromptMode} />
          )}
        </div>
      )}
    </>
  );
};

// ─── Tooltip row helper ───────────────────────────────────────────────────
const TooltipRow: React.FC<{
  icon: string;
  label: string;
  value: string;
  valueColor?: string;
}> = ({ icon, label, value, valueColor }) => {
  const iconEl = (() => {
    if (icon === "token")
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--vscode-editorWarning-foreground,#f97316)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="8" cy="8" r="6" />
          <path d="M18.09 10.37A6 6 0 1 1 10.34 18" />
          <path d="M7 6h1v4" />
          <path d="m16.71 13.88.7.71-2.82 2.82" />
        </svg>
      );
    if (icon === "req")
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--vscode-testing-iconPassed,#22c55e)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
        </svg>
      );
    if (icon === "usage")
      return (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="var(--vscode-charts-purple,#a855f7)"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M3 3v18h18" />
          <path d="m19 9-5 5-4-4-3 3" />
        </svg>
      );
    if (icon === "pl")
      return (
        <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
          <rect
            x="1"
            y="11"
            width="3"
            height="3"
            rx="0.75"
            fill="currentColor"
            opacity="0.6"
          />
          <rect
            x="6"
            y="8"
            width="3"
            height="6"
            rx="0.75"
            fill="currentColor"
            opacity="0.6"
          />
          <rect
            x="11"
            y="5"
            width="3"
            height="9"
            rx="0.75"
            fill="currentColor"
            opacity="0.6"
          />
        </svg>
      );
    // cs, fallback
    return (
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
      >
        <polyline points="16 18 22 12 16 6" />
        <polyline points="8 6 2 12 8 18" />
      </svg>
    );
  })();

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        marginBottom: "3px",
      }}
    >
      <span
        style={{
          display: "flex",
          alignItems: "center",
          flexShrink: 0,
          opacity: 0.7,
        }}
      >
        {iconEl}
      </span>
      <span style={{ opacity: 0.7, flex: 1 }}>{label}</span>
      <span
        style={{
          fontWeight: 600,
          color: valueColor ?? "var(--vscode-foreground)",
        }}
      >
        {value}
      </span>
    </div>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────
const ChatHeader: React.FC<ChatHeaderProps> = ({
  displayedModel,
  currentAccount,
  setCurrentAccount,
  conversationTitle,
  currentConversationId,
  currentTaskName,
  promptLengthMode,
  systemPromptMode,
  contextUsage,
  chatTokens,
  chatRequests,
  isSearchOpen,
  setIsSearchOpen,
  searchQuery,
  setSearchQuery,
  onRenameConversation,
  onCopyAsMarkdown,
  onCopyAsJson,
  onDeleteConversation,
  onExportAsJson,
  messages,
}) => {
  useAccountStats({
    accountId: currentAccount?.id,
    onStats: (freshAccount) => {
      setCurrentAccount((prev: any) => ({ ...prev, ...freshAccount }));
    },
  });

  const providerId = displayedModel?.providerId || "";
  const faviconUrl = getFaviconUrl(providerId, displayedModel?.favicon);

  const usageNum =
    currentAccount?.usage != null ? Number(currentAccount.usage) : null;
  const usageColor =
    usageNum == null
      ? "var(--vscode-charts-purple, #a855f7)"
      : usageNum >= 90
        ? "var(--vscode-editorError-foreground, #ef4444)"
        : usageNum >= 70
          ? "var(--vscode-editorWarning-foreground, #f97316)"
          : "var(--vscode-charts-purple, #a855f7)";

  const dayRequests = currentAccount?.period_requests ?? null;
  const dayTokens = currentAccount?.period_tokens ?? null;

  const derivedTitle = React.useMemo(() => {
    const firstMsgTitle = extractFirstUserMessage(messages || []);

    if (conversationTitle) return conversationTitle;
    if (currentTaskName) return currentTaskName;
    // Fallback for req1 when no title is set yet
    return firstMsgTitle || "Untitled";
  }, [conversationTitle, currentTaskName, messages]);

  const displayTitle = derivedTitle;

  return (
    <div
      style={{
        borderBottom: "1px solid var(--border-color)",
        backgroundColor: "var(--primary-bg)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* ── Wrapper: padding chung cho cả 2 rows ── */}
      <div
        style={{
          padding: "8px 16px",
          display: "flex",
          flexDirection: "column",
          gap: "4px",
        }}
      >
        {/* ── Row 1: title | [Search] [3-dot] ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "5px",
            minWidth: 0,
          }}
        >
          {/* title */}
          <span
            title={displayTitle}
            style={{
              flex: 1,
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--primary-text)",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              minWidth: 0,
            }}
          >
            {displayTitle}
          </span>

          {/* Search */}
          <SqButton
            title="Search in chat"
            active={isSearchOpen}
            onClick={() => {
              setIsSearchOpen((v) => !v);
              if (isSearchOpen) setSearchQuery("");
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="15"
              height="15"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="m13 13.5 2-2.5-2-2.5" />
              <path d="m21 21-4.3-4.3" />
              <path d="M9 8.5 7 11l2 2.5" />
              <circle cx="11" cy="11" r="8" />
            </svg>
          </SqButton>

          {/* 3-dot */}
          <ConversationMenu
            onRename={onRenameConversation}
            onCopyAsMarkdown={onCopyAsMarkdown}
            onCopyAsJson={onCopyAsJson}
            onDelete={onDeleteConversation}
            onExportAsJson={onExportAsJson}
          />
        </div>

        {/* ── Row 2: favicon · provider/model · email · [StatsBadge] ── */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            minWidth: 0,
          }}
        >
          {/* favicon */}
          <img
            src={faviconUrl}
            alt="provider"
            style={{
              width: "14px",
              height: "14px",
              borderRadius: "2px",
              objectFit: "contain",
              flexShrink: 0,
            }}
            onError={(e) => {
              (e.target as HTMLImageElement).style.display = "none";
            }}
          />

          {/* provider/model */}
          <span
            style={{
              fontSize: "11px",
              fontWeight: 600,
              color: "var(--primary-text)",
              whiteSpace: "nowrap",
              opacity: 0.85,
              flexShrink: 0,
            }}
          >
            {displayedModel?.providerId || "?"}/{displayedModel?.id || "chat"}
          </span>

          {/* email */}
          {currentAccount?.email && (
            <span
              title={currentAccount.email}
              style={{
                fontSize: "11px",
                opacity: 0.6,
                fontStyle: "italic",
                whiteSpace: "nowrap",
                overflow: "hidden",
                maxWidth: "120px",
                flexShrink: 1,
              }}
            >
              {currentAccount.email}
            </span>
          )}

          {/* push stats badge to right */}
          <div style={{ flex: 1 }} />

          {/* Stats badge */}
          <StatsBadge
            chatTokens={chatTokens}
            chatRequests={chatRequests}
            dayTokens={dayTokens}
            dayRequests={dayRequests}
            usageNum={usageNum}
            usageColor={usageColor}
            promptLengthMode={promptLengthMode}
            systemPromptMode={systemPromptMode}
          />
        </div>
        {/* end row 2 */}
      </div>
      {/* end wrapper */}
    </div>
  );
};

export default ChatHeader;
