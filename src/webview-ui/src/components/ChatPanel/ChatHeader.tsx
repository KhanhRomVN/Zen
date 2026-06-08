import React from "react";
import { TabInfo } from "../../types";
import { Message } from "./ChatBody/types";

interface ChatHeaderProps {
  selectedTab: TabInfo;
  onBack: () => void;
  onClearChat: () => void;
  isLoadingConversation?: boolean;
  firstRequestMessage?: Message;
  contextUsage?: {
    prompt: number;
    completion: number;
    total: number;
  };
  taskName?: string | null;
  conversationId?: string;
  currentModel?: any;
  currentAccount?: any;
}

/** Small SVG ring that shows context usage as a colored arc */
const ContextCircle: React.FC<{ ratio: number }> = ({ ratio }) => {
  const clampedRatio = Math.min(1, Math.max(0, ratio));
  const size = 12; // matches ~font-size 11-12px
  const stroke = 1.8;
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const dashOffset = circumference * (1 - clampedRatio);

  // Color: green → yellow → orange → red
  let color: string;
  if (clampedRatio < 0.5) {
    color = "#4caf50"; // green
  } else if (clampedRatio < 0.7) {
    color = "#ffeb3b"; // yellow
  } else if (clampedRatio < 0.85) {
    color = "#ff9800"; // orange
  } else {
    color = "#f44336"; // red
  }

  const pct = Math.round(clampedRatio * 100);

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ flexShrink: 0, transform: "rotate(-90deg)" }}
    >
      <title>{`Context usage: ${pct}%`}</title>
      {/* Track */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke="var(--vscode-editorWidget-border, rgba(255,255,255,0.12))"
        strokeWidth={stroke}
      />
      {/* Progress arc */}
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={color}
        strokeWidth={stroke}
        strokeLinecap="round"
        strokeDasharray={circumference}
        strokeDashoffset={dashOffset}
        style={{ transition: "stroke-dashoffset 0.4s ease, stroke 0.4s ease" }}
      />
    </svg>
  );
};

const ChatHeader: React.FC<ChatHeaderProps> = ({
  selectedTab,
  contextUsage,
  taskName,
  currentModel,
  currentAccount,
}) => {
  const formatTokens = (num: number) => {
    if (num >= 1000) return (num / 1000).toFixed(1) + "K";
    return num.toString();
  };

  const providerId = currentModel?.providerId || selectedTab.provider || "deepseek";

  let faviconUrl = "https://www.google.com/s2/favicons?domain=deepseek.com&sz=64";
  if (providerId.toLowerCase().includes("openai")) faviconUrl = "https://www.google.com/s2/favicons?domain=openai.com&sz=64";
  else if (providerId.toLowerCase().includes("anthropic")) faviconUrl = "https://www.google.com/s2/favicons?domain=anthropic.com&sz=64";
  else if (providerId.toLowerCase().includes("google")) faviconUrl = "https://www.google.com/s2/favicons?domain=google.com&sz=64";
  else if (providerId.toLowerCase().includes("openrouter")) faviconUrl = "https://www.google.com/s2/favicons?domain=openrouter.ai&sz=64";

  // Compute context ratio if the model has avg_context_limit
  const avgContextLimit: number | null = currentModel?.avg_context_limit ?? null;
  const totalTokens = contextUsage?.total ?? 0;
  const contextRatio = avgContextLimit != null && avgContextLimit > 0
    ? totalTokens / avgContextLimit
    : null;

  return (
    <div
      style={{
        borderBottom: "1px solid var(--border-color)",
        backgroundColor: "var(--primary-bg)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: "8px 12px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
        }}
      >
        {/* Left: Model Info */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "12px",
            fontWeight: 600,
            color: "var(--primary-text)",
            overflow: "hidden",
          }}
        >
          <img
            src={faviconUrl}
            alt="provider"
            style={{ width: "14px", height: "14px", borderRadius: "2px" }}
          />
          <span style={{ whiteSpace: "nowrap" }}>
            {providerId}/{currentModel?.id || "chat"}
          </span>

          {currentAccount?.email && (
            <span
              style={{
                opacity: 0.7,
                fontStyle: "italic",
                fontWeight: "normal",
                fontSize: "11px",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                maxWidth: "150px",
              }}
              title={currentAccount.email}
            >
              &lt;{currentAccount.email}&gt;
            </span>
          )}

          {taskName && (
            <>
              <span style={{ opacity: 0.3 }}>|</span>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  fontSize: "11px",
                  color: "var(--vscode-textLink-foreground)",
                  fontWeight: 500,
                  overflow: "hidden",
                }}
              >
                <div style={{ width: "5px", height: "5px", borderRadius: "50%", backgroundColor: "currentColor", flexShrink: 0 }} />
                <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {taskName}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Right: Token Usage + Context Circle */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "5px",
            fontSize: "11px",
            color: "var(--secondary-text)",
            opacity: 0.8,
            flexShrink: 0,
          }}
        >
          {contextRatio !== null && (
            <ContextCircle ratio={contextRatio} />
          )}
          <span>{contextUsage ? formatTokens(contextUsage.total) : "0"}</span>
        </div>
      </div>
    </div>
  );
};

export default ChatHeader;
