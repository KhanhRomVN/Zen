import React from "react";
import { ConversationItem } from "../types";
import { Trash2, Copy, FolderOpen, Zap } from "lucide-react";
import { extensionService } from "../../../services/ExtensionService";

interface HistoryCardProps {
  item: ConversationItem;
  onClick: () => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  formatDate: (timestamp: number) => string;
}

const HistoryCard: React.FC<HistoryCardProps> = ({
  item,
  onClick,
  onDelete,
  formatDate,
}) => {
  const [menuVisible, setMenuVisible] = React.useState(false);
  const [menuPosition, setMenuPosition] = React.useState({ x: 0, y: 0 });
  const [messages, setMessages] = React.useState<any[]>([]);
  const [isLoadingMessages, setIsLoadingMessages] = React.useState(false);
  const [messageFetchError, setMessageFetchError] = React.useState<string | null>(null);

  // Fetch messages when component mounts
  React.useEffect(() => {
    const fetchMessages = () => {
      setIsLoadingMessages(true);
      setMessageFetchError(null);
      const requestId = `hist-card-${Date.now()}`;
      extensionService.postMessage({
        command: "getConversation",
        conversationId: item.id,
        requestId,
      });

      const handler = (event: MessageEvent) => {
        const data = event.data;
        if (
          data.command === "conversationResult" &&
          data.requestId === requestId
        ) {
          window.removeEventListener("message", handler);
          if (data.data?.messages) {
            setMessages(data.data.messages);
          } else {
            setMessageFetchError("No messages found");
          }
          setIsLoadingMessages(false);
        }
      };

      window.addEventListener("message", handler);
      setTimeout(() => {
        window.removeEventListener("message", handler);
        setIsLoadingMessages(false);
      }, 5000);
    };

    fetchMessages();
  }, [item.id]);

  React.useEffect(() => {
    const close = () => setMenuVisible(false);
    if (menuVisible) document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuVisible]);

  const handleCopyContent = () => {
    const requestId = `copy-${Date.now()}`;
    extensionService.postMessage({
      command: "getConversation",
      conversationId: item.id,
      requestId,
    });
    const handler = (event: MessageEvent) => {
      const data = event.data;
      if (
        data.command === "conversationResult" &&
        data.requestId === requestId
      ) {
        window.removeEventListener("message", handler);
        if (data.data?.messages) {
          const text = data.data.messages
            .map((msg: any) => {
              let content = msg.content;
              const m = content.match(/## User Message\n```\n([\s\S]*?)\n```/);
              if (m) content = m[1];
              return `[${msg.role.toUpperCase()}]\n${content}`;
            })
            .join("\n\n");
          navigator.clipboard.writeText(text.trim());
        }
      }
    };
    window.addEventListener("message", handler);
    setTimeout(() => window.removeEventListener("message", handler), 5000);
  };

  const handleOpenFolder = () => {
    extensionService.postMessage({
      command: "openConversationFolder",
      conversationId: item.id,
    });
  };

  // Truncate title
  const title = item.title
    ? item.title.length > 60
      ? item.title.substring(0, 57) + "..."
      : item.title
    : "Untitled";

  // Token badge color based on amount
  const getTokenColor = (n: number) => {
    if (n >= 500000)
      return {
        bg: "rgba(239,68,68,0.15)",
        border: "rgba(239,68,68,0.4)",
        text: "#ef4444",
      };
    if (n >= 100000)
      return {
        bg: "rgba(249,115,22,0.15)",
        border: "rgba(249,115,22,0.4)",
        text: "#f97316",
      };
    if (n >= 50000)
      return {
        bg: "rgba(234,179,8,0.15)",
        border: "rgba(234,179,8,0.4)",
        text: "#ca8a04",
      };
    if (n >= 10000)
      return {
        bg: "rgba(34,197,94,0.15)",
        border: "rgba(34,197,94,0.4)",
        text: "#16a34a",
      };
    return {
      bg: "rgba(99,102,241,0.15)",
      border: "rgba(99,102,241,0.4)",
      text: "#6366f1",
    };
  };

  const formatTokens = (n: number) => {
    if (n >= 1000000) return (n / 1000000).toFixed(1) + "M";
    if (n >= 1000) return (n / 1000).toFixed(1) + "k";
    return String(n);
  };

  // Parse user content from XML
  const parseUserContent = (content: string): string => {
    const regex = /## User Message\n<zen-user-content>\n([\s\S]*?)\n<\/zen-user-content>/;
    const match = content.match(regex);
    if (match) {
      return match[1];
    }
    // Fallback: strip wrapper if present
    let cleaned = content.replace(/^<zen-user-content>\n?/, "").replace(/\n?<\/zen-user-content>[\s\S]*$/, "");
    if (cleaned.startsWith("```") && cleaned.includes("```", 3)) {
      cleaned = cleaned.split("```")[1]?.trim() || cleaned;
    }
    return cleaned || "No content";
  };

  // Get latest user message content
  const getUserContent = (): string => {
    if (!messages.length) return "";
    // Find the latest user message
    const userMessages = messages.filter((msg: any) => msg.role === "user");
    if (!userMessages.length) return "";
    const lastUserMsg = userMessages[userMessages.length - 1];
    return parseUserContent(lastUserMsg.content);
  };

  // Get provider_id/model_id from messages
  const getModelId = (): string | null => {
    if (!messages.length) return null;
    // Find first assistant message with modelId and providerId
    const assistantMsg = messages.find((msg: any) => msg.role === "assistant" && (msg.modelId || msg.providerId));
    if (!assistantMsg) return null;
    const provider = assistantMsg.providerId || "";
    const model = assistantMsg.modelId || "";
    return provider && model ? `${provider}/${model}` : model || provider || null;
  };

  // Calculate request count and response count
  const getRequestResponseCounts = (): { requests: number; responses: number } => {
    if (!messages.length) return { requests: 0, responses: 0 };
    const requests = messages.filter((msg: any) => msg.role === "user").length;
    const responses = messages.filter((msg: any) => msg.role === "assistant" && !msg.isError).length;
    return { requests, responses };
  };

  // Format timestamp: "2m ago", "Yesterday 12:30", "dd/mm/yy hh:mm"
  const formatTimeText = (timestamp: number): string => {
    const now = Date.now();
    const diff = now - timestamp;
    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days === 0) {
      if (hours === 0) {
        if (minutes === 0) return "Just now";
        return `${minutes}m ago`;
      }
      return `${hours}h ago`;
    }
    if (days === 1) {
      const d = new Date(timestamp);
      return `Yesterday ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
    }
    if (days < 7) {
      return `${days}d ago`;
    }
    const d = new Date(timestamp);
    return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getFullYear().toString().slice(2)} ${d.getHours().toString().padStart(2, "0")}:${d.getMinutes().toString().padStart(2, "0")}`;
  };

  const userContent = getUserContent();
  const modelId = getModelId();
  const { requests, responses } = getRequestResponseCounts();
  const timestamp = item.lastModified || item.timestamp || item.createdAt || 0;
  const timeText = formatTimeText(timestamp);

  return (
    <div className="history-card-container">
      <div
        className="history-card-inner"
        onClick={onClick}
        onContextMenu={(e) => {
          e.preventDefault();
          setMenuPosition({ x: e.clientX, y: e.clientY });
          setMenuVisible(true);
        }}
        style={{
          width: "100%",
          padding: "7px 10px",
          display: "flex",
          flexDirection: "column",
          gap: "4px",
        }}
      >
        {/* Row 1: Title (parsed from zen-user-content) */}
        <div
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "8px",
          }}
        >
          <span
            style={{
              fontSize: "13px",
              fontWeight: 500,
              color: "var(--primary-text)",
              overflow: "hidden",
              whiteSpace: "nowrap",
              textOverflow: "ellipsis",
              flex: 1,
            }}
          >
            {userContent || title}
          </span>

          {/* TimeText - now on the right of Row 1 */}
          <span
            style={{
              fontSize: "10px",
              color: "var(--vscode-descriptionForeground, #888)",
              fontWeight: 500,
              flexShrink: 0,
            }}
          >
            {timeText}
          </span>
        </div>

        {/* Row 2: Badge row - model+request/response on the left, token badge on the right */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "8px",
            flexWrap: "wrap",
            marginTop: "2px",
          }}
        >
          {/* Left: Model + request/response count */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              flexWrap: "wrap",
            }}
          >
            {modelId && (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  padding: "0 6px",
                  borderRadius: "3px",
                  backgroundColor: "rgba(128,128,128,0.06)",
                  color: "var(--vscode-descriptionForeground, #888)",
                  fontSize: "9px",
                  fontWeight: 500,
                  height: "16px",
                  letterSpacing: "0.3px",
                }}
              >
                {modelId}
              </div>
            )}

            <div
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                fontSize: "10px",
                color: "var(--vscode-descriptionForeground, #888)",
                fontWeight: 500,
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: "2px" }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: "var(--vscode-charts-green, #89d185)" }}>
                  <path d="M12 3v12" />
                  <path d="m17 8-5-5-5 5" />
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                </svg>
                {requests}
              </span>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "2px" }}>
                <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0, color: "var(--vscode-charts-red, #f48771)" }}>
                  <path d="M12 15V3" />
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <path d="m7 10 5 5 5-5" />
                </svg>
                {responses}
              </span>
            </div>
          </div>

          {/* Right: Token badge - now on the right, no border/outline */}
          {(item.totalTokenUsage ?? 0) > 0 &&
            (() => {
              const c = getTokenColor(item.totalTokenUsage ?? 0);
              return (
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "3px",
                    flexShrink: 0,
                    padding: "1px 6px",
                    borderRadius: "4px",
                    backgroundColor: c.bg,
                    color: c.text,
                    fontSize: "10px",
                    fontWeight: 700,
                  }}
                >
                  <Zap size={9} />
                  <span>{formatTokens(item.totalTokenUsage ?? 0)}</span>
                </div>
              );
            })()}
        </div>
      </div>

      {/* Context menu */}
      {menuVisible && (
        <div
          style={{
            position: "fixed",
            top: menuPosition.y,
            left: menuPosition.x,
            backgroundColor: "var(--tertiary-bg)",
            border: "1px solid var(--border-color)",
            borderRadius: "8px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
            zIndex: 1000,
            minWidth: "180px",
            padding: "4px",
          }}
        >
          {[
            {
              icon: <Trash2 size={13} />,
              label: "Xóa",
              color: "var(--error-color)",
              hoverBg: "rgba(244,67,54,0.1)",
              action: (e: React.MouseEvent) => {
                setMenuVisible(false);
                onDelete(item.id, e);
              },
            },
            {
              icon: <Copy size={13} />,
              label: "Copy nội dung",
              color: "var(--primary-text)",
              hoverBg: "var(--hover-bg)",
              action: () => {
                setMenuVisible(false);
                handleCopyContent();
              },
            },
            {
              icon: <FolderOpen size={13} />,
              label: "Mở thư mục conv",
              color: "var(--primary-text)",
              hoverBg: "var(--hover-bg)",
              action: () => {
                setMenuVisible(false);
                handleOpenFolder();
              },
            },
          ].map((menuItem, i) => (
            <button
              key={i}
              onClick={(e) => {
                e.stopPropagation();
                menuItem.action(e);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                width: "100%",
                padding: "7px 12px",
                borderRadius: "6px",
                border: "none",
                backgroundColor: "transparent",
                color: menuItem.color,
                fontSize: "12px",
                cursor: "pointer",
                textAlign: "left",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = menuItem.hoverBg)
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "transparent")
              }
            >
              {menuItem.icon}
              <span>{menuItem.label}</span>
            </button>
          ))}
        </div>
      )}

      <style>{`
        .history-card-container {
          width: 100%; border-radius: 6px;
          border: none; background-color: transparent;
          cursor: pointer; position: relative; overflow: hidden;
        }
        .history-card-container:hover { background-color: var(--hover-bg); }
      `}</style>
    </div>
  );
};

export default HistoryCard;
