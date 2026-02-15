import React from "react";
import { ConversationItem } from "./types";
import { getProviderIconPath } from "../../utils/fileIconMapper";
import { Clock, FolderOpen, MessageSquare, Trash2 } from "lucide-react";

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
  const formatSize = (bytes?: number) => {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const getProviderInfo = (provider?: string) => {
    const providerColors: Record<
      string,
      { name: string; bg: string; fg: string }
    > = {
      deepseek: { name: "DeepSeek", bg: "#3b82f620", fg: "#3b82f6" },
      chatgpt: { name: "ChatGPT", bg: "#10b98120", fg: "#10b981" },
      gemini: { name: "Gemini", bg: "#a855f720", fg: "#a855f7" },
      grok: { name: "Grok", bg: "#ef444420", fg: "#ef4444" },
      claude: { name: "Claude", bg: "#f59e0b20", fg: "#f59e0b" },
    };

    return (
      providerColors[provider || ""] || {
        name: "AI",
        bg: "#6b728020",
        fg: "#6b7280",
      }
    );
  };

  const providerInfo = getProviderInfo(item.provider);

  return (
    <div
      className="history-card-container"
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        padding: "var(--spacing-md)",
        borderRadius: "var(--border-radius)",
        transition: "all 0.2s ease",
        border: "1px solid var(--border-color)",
        backgroundColor: "var(--input-bg)",
        cursor: "pointer",
        position: "relative",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = "var(--hover-bg)";
        e.currentTarget.style.borderColor = "var(--accent-text)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "var(--input-bg)";
        e.currentTarget.style.borderColor = "var(--border-color)";
      }}
    >
      {/* Header row with Title and Delete */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: "var(--spacing-sm)",
          marginBottom: "var(--spacing-sm)",
        }}
      >
        <h4
          style={{
            fontSize: "var(--font-size-sm)",
            fontWeight: 600,
            flex: 1,
            color: "var(--primary-text)",
            lineHeight: 1.4,
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 2,
            WebkitBoxOrient: "vertical",
            transition: "color 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.color = "var(--accent-text)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.color = "var(--primary-text)";
          }}
        >
          {item.title}
        </h4>
        <button
          onClick={(e) => onDelete(item.id, e)}
          style={{
            padding: "var(--spacing-xs)",
            borderRadius: "var(--border-radius)",
            backgroundColor: "transparent",
            border: "none",
            color: "var(--secondary-text)",
            cursor: "pointer",
            transition: "all 0.2s ease",
            opacity: 0,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#f4433620";
            e.currentTarget.style.color = "#f44336";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
            e.currentTarget.style.color = "var(--secondary-text)";
          }}
          title="Delete conversation"
          className="delete-btn"
        >
          <Trash2 style={{ width: "14px", height: "14px" }} />
        </button>
      </div>

      {/* Preview text - Hidden per user request */}

      {/* Footer Info */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--spacing-md)",
          fontSize: "10px",
          color: "var(--secondary-text)",
          marginTop: "var(--spacing-xs)",
          flexWrap: "wrap",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <Clock style={{ width: "12px", height: "12px" }} />
          <span>{formatDate(item.lastModified)}</span>
        </div>

        {item.provider && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "2px 6px",
              borderRadius: "var(--border-radius)",
              border: `1px solid ${providerInfo.bg}`,
              backgroundColor: providerInfo.bg,
              color: providerInfo.fg,
            }}
          >
            <img
              src={getProviderIconPath(item.provider)}
              alt={item.provider}
              style={{
                width: "12px",
                height: "12px",
                objectFit: "contain",
              }}
            />
            <span style={{ textTransform: "uppercase", fontWeight: 500 }}>
              {providerInfo.name}
            </span>
          </div>
        )}

        {item.messageCount > 0 && (
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <MessageSquare style={{ width: "12px", height: "12px" }} />
            <span>{item.messageCount} msgs</span>
          </div>
        )}

        {item.size !== undefined && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <span>{formatSize(item.size)}</span>
          </div>
        )}

        {item.folderPath && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "var(--font-size-xs)",
              color: "var(--secondary-text)",
              marginLeft: "auto",
              maxWidth: "100px",
              overflow: "hidden",
            }}
            title={item.folderPath}
          >
            <FolderOpen
              style={{ width: "12px", height: "12px", flexShrink: 0 }}
            />
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {item.folderPath.split("/").pop()}
            </span>
          </div>
        )}
      </div>

      <style>
        {`
          .history-card-container:hover .delete-btn {
            opacity: 1 !important;
          }
        `}
      </style>
    </div>
  );
};

export default HistoryCard;
