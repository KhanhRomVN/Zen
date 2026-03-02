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
  Copy,
} from "lucide-react";
import { extensionService } from "../../services/ExtensionService";

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
  const [menuVisible, setMenuVisible] = React.useState(false);
  const [menuPosition, setMenuPosition] = React.useState({ x: 0, y: 0 });

  React.useEffect(() => {
    const handleClickOutside = () => setMenuVisible(false);
    if (menuVisible) {
      document.addEventListener("click", handleClickOutside);
    }
    return () => document.removeEventListener("click", handleClickOutside);
  }, [menuVisible]);

  const formatSize = (bytes?: number) => {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const providerInfo = getProviderStyle(item.provider);

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
          const messages = data.data.messages;
          let fullText = "";

          messages.forEach((msg: any, index: number) => {
            let content = msg.content;

            // Transformation for req1 (first message)
            if (index === 0 && msg.role === "user") {
              const userMsgRegex = /## User Message\n```\n([\s\S]*?)\n```/;
              const match = content.match(userMsgRegex);
              if (match) {
                content = match[1];
              }
            }

            const roleName = msg.role === "user" ? "USER" : "ASSISTANT";
            fullText += `[${roleName}]\n${content}\n\n`;
          });

          navigator.clipboard.writeText(fullText.trim());
        }
      }
    };

    window.addEventListener("message", handler);
    // Timeout cleanup
    setTimeout(() => window.removeEventListener("message", handler), 5000);
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
          padding: "10px 14px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        {/* Header row with Title */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
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
      </div>

      {menuVisible && (
        <div
          className="history-context-menu"
          style={{
            position: "fixed",
            top: menuPosition.y,
            left: menuPosition.x,
            backgroundColor: "var(--tertiary-bg)",
            border: "1px solid var(--border-color)",
            borderRadius: "8px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
            zIndex: 1000,
            minWidth: "160px",
            padding: "4px",
            animation: "menuAppear 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
          }}
        >
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuVisible(false);
              onDelete(item.id, e);
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              width: "100%",
              padding: "8px 12px",
              borderRadius: "6px",
              border: "none",
              backgroundColor: "transparent",
              color: "var(--error-color)",
              fontSize: "12px",
              cursor: "pointer",
              textAlign: "left",
              transition: "background-color 0.2s",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "rgba(244, 67, 54, 0.1)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "transparent")
            }
          >
            <Trash2 size={14} />
            <span>Xóa (Delete)</span>
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuVisible(false);
              handleCopyContent();
            }}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              width: "100%",
              padding: "8px 12px",
              borderRadius: "6px",
              border: "none",
              backgroundColor: "transparent",
              color: "var(--primary-text)",
              fontSize: "12px",
              cursor: "pointer",
              textAlign: "left",
              transition: "background-color 0.2s",
            }}
            onMouseEnter={(e) =>
              (e.currentTarget.style.backgroundColor = "var(--hover-bg)")
            }
            onMouseLeave={(e) =>
              (e.currentTarget.style.backgroundColor = "transparent")
            }
          >
            <Copy size={14} />
            <span>Copy Toàn Bộ Nội Dung</span>
          </button>
        </div>
      )}

      <style>
        {`
          .history-card-container {
            width: 100%;
            text-align: left;
            border-radius: 10px;
            border: 1px solid var(--border-color);
            background-color: var(--input-bg);
            cursor: pointer;
            position: relative;
            box-shadow: 0 1px 2px rgba(0,0,0,0.02);
            overflow: hidden;
            display: flex;
            flex-direction: column;
          }
          .history-card-container:hover {
            background-color: var(--hover-bg);
          }
          @keyframes menuAppear {
            from { opacity: 0; transform: scale(0.95) translateY(-5px); }
            to { opacity: 1; transform: scale(1) translateY(0); }
          }
        `}
      </style>
    </div>
  );
};

export default HistoryCard;
