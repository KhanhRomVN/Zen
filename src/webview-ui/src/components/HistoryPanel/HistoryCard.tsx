import React from "react";
import { ConversationItem } from "./types";
import { Clock, Trash2, Copy, FolderOpen, Zap } from "lucide-react";
import { extensionService } from "../../services/ExtensionService";
import { getProviderStyle } from "../../utils/providerStyles";
import { getProviderIconPath } from "../../utils/fileIconMapper";

interface HistoryCardProps {
  item: ConversationItem;
  onClick: () => void;
  onDelete: (id: string, e: React.MouseEvent) => void;
  formatDate: (timestamp: number) => string;
}

const HistoryCard: React.FC<HistoryCardProps> = ({ item, onClick, onDelete, formatDate }) => {
  const [menuVisible, setMenuVisible] = React.useState(false);
  const [menuPosition, setMenuPosition] = React.useState({ x: 0, y: 0 });

  React.useEffect(() => {
    const close = () => setMenuVisible(false);
    if (menuVisible) document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, [menuVisible]);

  const providerInfo = getProviderStyle(item.provider);

  const handleCopyContent = () => {
    const requestId = `copy-${Date.now()}`;
    extensionService.postMessage({ command: "getConversation", conversationId: item.id, requestId });
    const handler = (event: MessageEvent) => {
      const data = event.data;
      if (data.command === "conversationResult" && data.requestId === requestId) {
        window.removeEventListener("message", handler);
        if (data.data?.messages) {
          const text = data.data.messages.map((msg: any) => {
            let content = msg.content;
            const m = content.match(/## User Message\n```\n([\s\S]*?)\n```/);
            if (m) content = m[1];
            return `[${msg.role.toUpperCase()}]\n${content}`;
          }).join("\n\n");
          navigator.clipboard.writeText(text.trim());
        }
      }
    };
    window.addEventListener("message", handler);
    setTimeout(() => window.removeEventListener("message", handler), 5000);
  };

  const handleOpenFolder = () => {
    extensionService.postMessage({ command: "openConversationFolder", conversationId: item.id });
  };

  // Truncate title
  const title = item.title
    ? (item.title.length > 60 ? item.title.substring(0, 57) + "..." : item.title)
    : "Untitled";

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
        style={{ width: "100%", padding: "10px 14px", display: "flex", flexDirection: "column", gap: "6px" }}
      >
        {/* Title */}
        <div style={{ fontSize: "13px", fontWeight: 600, color: "var(--primary-text)", lineHeight: 1.4 }}>
          {title}
        </div>

        {/* Badges row */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
          {/* Date */}
          <div style={{ display: "flex", alignItems: "center", gap: "3px", fontSize: "10px", color: "var(--secondary-text)" }}>
            <Clock size={10} />
            <span>{formatDate(item.lastModified)}</span>
          </div>

          {/* Provider */}
          {item.provider && (
            <div style={{
              display: "flex", alignItems: "center", gap: "3px",
              padding: "1px 5px", borderRadius: "4px",
              border: `1px solid ${providerInfo.border}`,
              backgroundColor: providerInfo.bg, color: providerInfo.fg,
              fontSize: "9px", fontWeight: 700, textTransform: "uppercase",
            }}>
              <img src={getProviderIconPath(item.provider)} alt={item.provider} style={{ width: "9px", height: "9px", objectFit: "contain" }} />
              {providerInfo.name}
            </div>
          )}

          {/* Token badge */}
          {(item.totalTokenUsage ?? 0) > 0 && (
            <div style={{
              display: "flex", alignItems: "center", gap: "3px",
              padding: "1px 6px", borderRadius: "4px",
              backgroundColor: "rgba(234,179,8,0.12)",
              border: "1px solid rgba(234,179,8,0.3)",
              color: "#ca8a04", fontSize: "10px", fontWeight: 600,
            }}>
              <Zap size={9} />
              <span>{formatTokens(item.totalTokenUsage ?? 0)}</span>
            </div>
          )}
        </div>
      </div>

      {/* Context menu */}
      {menuVisible && (
        <div
          style={{
            position: "fixed", top: menuPosition.y, left: menuPosition.x,
            backgroundColor: "var(--tertiary-bg)", border: "1px solid var(--border-color)",
            borderRadius: "8px", boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
            zIndex: 1000, minWidth: "180px", padding: "4px",
          }}
        >
          {[
            {
              icon: <Trash2 size={13} />, label: "Xóa", color: "var(--error-color)",
              hoverBg: "rgba(244,67,54,0.1)",
              action: (e: React.MouseEvent) => { setMenuVisible(false); onDelete(item.id, e); },
            },
            {
              icon: <Copy size={13} />, label: "Copy nội dung", color: "var(--primary-text)",
              hoverBg: "var(--hover-bg)",
              action: () => { setMenuVisible(false); handleCopyContent(); },
            },
            {
              icon: <FolderOpen size={13} />, label: "Mở thư mục conv", color: "var(--primary-text)",
              hoverBg: "var(--hover-bg)",
              action: () => { setMenuVisible(false); handleOpenFolder(); },
            },
          ].map((item, i) => (
            <button
              key={i}
              onClick={(e) => { e.stopPropagation(); item.action(e); }}
              style={{
                display: "flex", alignItems: "center", gap: "8px",
                width: "100%", padding: "7px 12px", borderRadius: "6px",
                border: "none", backgroundColor: "transparent",
                color: item.color, fontSize: "12px", cursor: "pointer", textAlign: "left",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = item.hoverBg)}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ))}
        </div>
      )}

      <style>{`
        .history-card-container {
          width: 100%; border-radius: 8px;
          border: 1px solid var(--border-color);
          background-color: var(--input-bg);
          cursor: pointer; position: relative; overflow: hidden;
        }
        .history-card-container:hover { background-color: var(--hover-bg); }
      `}</style>
    </div>
  );
};

export default HistoryCard;
