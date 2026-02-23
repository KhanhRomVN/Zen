import React from "react";
import { ConversationItem } from "./types";
import { getProviderIconPath } from "../../utils/fileIconMapper";
import {
  Clock,
  FolderOpen,
  MessageSquare,
  Trash2,
  Database,
  CheckCircle,
  Activity,
  Zap,
} from "lucide-react";

import { getProviderStyle } from "../../utils/providerStyles";

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

  const providerInfo = getProviderStyle(item.provider);

  return (
    <div
      className="history-card-container"
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        padding: "10px 14px",
        borderRadius: "10px",
        transition: "all 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
        border: "1px solid var(--border-color)",
        backgroundColor: "var(--input-bg)",
        cursor: "pointer",
        position: "relative",
        boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.backgroundColor = "var(--hover-bg)";
        e.currentTarget.style.transform = "translateY(-1px)";
        e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.05)";
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "var(--input-bg)";
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "0 1px 2px rgba(0,0,0,0.02)";
      }}
    >
      {/* Header row with Title and Delete */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          marginBottom: "8px",
        }}
      >
        <h4
          style={{
            fontSize: "13px",
            fontWeight: 600,
            flex: 1,
            color: "var(--primary-text)",
            margin: 0,
            overflow: "hidden",
            whiteSpace: "nowrap",
            textOverflow: "ellipsis",
            transition: "color 0.2s ease",
          }}
        >
          {item.title}
        </h4>
        <button
          onClick={(e) => onDelete(item.id, e)}
          style={{
            padding: "4px",
            borderRadius: "6px",
            backgroundColor: "transparent",
            border: "none",
            color: "var(--secondary-text)",
            cursor: "pointer",
            transition: "all 0.2s ease",
            opacity: 0,
            flexShrink: 0,
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
          <Trash2 size={13} />
        </button>
      </div>

      {/* Badges Container */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          flexWrap: "wrap",
        }}
      >
        {/* Date Badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            fontSize: "10px",
            color: "var(--secondary-text)",
            opacity: 0.7,
            fontWeight: 500,
          }}
        >
          <Clock size={10} />
          <span>{formatDate(item.lastModified)}</span>
        </div>

        {/* Provider Badge */}
        {item.provider && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "2px 6px",
              borderRadius: "6px",
              border: `1px solid ${providerInfo.border}`,
              backgroundColor: providerInfo.bg,
              color: providerInfo.fg,
              fontSize: "9px",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.02em",
            }}
          >
            <img
              src={getProviderIconPath(item.provider)}
              alt={item.provider}
              style={{
                width: "10px",
                height: "10px",
                objectFit: "contain",
              }}
            />
            {providerInfo.name}
          </div>
        )}

        {/* Requests Badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "4px",
            padding: "2px 6px",
            borderRadius: "6px",
            backgroundColor: "rgba(0,0,0,0.03)",
            border: "1px solid var(--border-color)",
            color: "var(--secondary-text)",
            fontSize: "10px",
          }}
        >
          <MessageSquare size={10} style={{ color: "var(--accent-color)" }} />
          <span style={{ fontWeight: 500 }}>
            {item.totalRequests || item.messageCount}req
          </span>
        </div>

        {/* Tokens Badge */}
        {(item.totalTokenUsage ?? 0) > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "2px 6px",
              borderRadius: "6px",
              backgroundColor: "rgba(0,0,0,0.03)",
              border: "1px solid var(--border-color)",
              color: "var(--secondary-text)",
              fontSize: "10px",
            }}
          >
            <Zap size={10} style={{ color: "#eab308" }} />
            <span style={{ fontWeight: 500 }}>
              {(item.totalTokenUsage ?? 0).toLocaleString()} tkn
            </span>
          </div>
        )}

        {/* Task Progress Badge */}
        {(item.totalTasks ?? 0) > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "2px 6px",
              borderRadius: "6px",
              backgroundColor:
                item.completedTasks === item.totalTasks
                  ? "rgba(34, 197, 94, 0.1)"
                  : "rgba(30, 64, 175, 0.05)",
              border: `1px solid ${item.completedTasks === item.totalTasks ? "rgba(34, 197, 94, 0.2)" : "rgba(30, 64, 175, 0.1)"}`,
              color:
                item.completedTasks === item.totalTasks
                  ? "#16a34a"
                  : "var(--accent-color)",
              fontSize: "10px",
            }}
          >
            <CheckCircle size={10} />
            <span style={{ fontWeight: 600 }}>
              {item.completedTasks}/{item.totalTasks}
            </span>
          </div>
        )}

        {/* Unique Task Names Badge */}
        {(item.uniqueTaskCount ?? 0) > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              padding: "2px 6px",
              borderRadius: "6px",
              backgroundColor: "rgba(168, 85, 247, 0.05)",
              border: "1px solid rgba(168, 85, 247, 0.15)",
              color: "#a855f7",
              fontSize: "10px",
            }}
            title="Unique Task Names"
          >
            <Activity size={10} />
            <span style={{ fontWeight: 600 }}>{item.uniqueTaskCount}</span>
          </div>
        )}

        {/* Size Badge */}
        {item.size !== undefined && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "10px",
              color: "var(--secondary-text)",
              opacity: 0.6,
            }}
          >
            <Database size={10} />
            <span>{formatSize(item.size)}</span>
          </div>
        )}

        {/* Folder Path - Right Aligned */}
        {item.folderPath && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "4px",
              fontSize: "10px",
              color: "var(--secondary-text)",
              marginLeft: "auto",
              maxWidth: "120px",
              overflow: "hidden",
              opacity: 0.7,
            }}
            title={item.folderPath}
          >
            <FolderOpen size={10} style={{ flexShrink: 0 }} />
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
