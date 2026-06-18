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

  React.useEffect(() => {
    const close = () => setMenuVisible(false);
    if (menuVisible) document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuVisible]);

  const providerInfo = undefined; // unused, kept for safety

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
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
        }}
      >
        {/* Title */}
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
          {title}
        </span>

        {/* Token badge */}
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
                  border: `1px solid ${c.border}`,
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
          ].map((item, i) => (
            <button
              key={i}
              onClick={(e) => {
                e.stopPropagation();
                item.action(e);
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
                color: item.color,
                fontSize: "12px",
                cursor: "pointer",
                textAlign: "left",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.backgroundColor = item.hoverBg)
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = "transparent")
              }
            >
              {item.icon}
              <span>{item.label}</span>
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
