import React, { useCallback, useState } from "react";
import HistoryCard from "./HistoryCard";
import { FolderOpen, Loader2, Search } from "lucide-react";
import { useConversationHistory } from "../../hooks/useConversationHistory";
import { useI18n } from "../../hooks/useI18n";

interface HistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadConversation?: (
    conversationId: string,
    tabId: number,
    folderPath: string | null,
  ) => void;
}

const HistoryPanel: React.FC<HistoryPanelProps> = ({
  isOpen,
  onClose,
  onLoadConversation,
}) => {
  const {
    conversations,
    totalCount,
    isLoading,
    searchQuery,
    setSearchQuery,
    selectedSort,
    setSelectedSort,
    deleteConversation,
    clearAllHistory,
  } = useConversationHistory(isOpen);

  const [closeHover, setCloseHover] = useState(false);
  const [trashHover, setTrashHover] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const { t } = useI18n();

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    const d = date.getDate().toString().padStart(2, "0");
    const m = (date.getMonth() + 1).toString().padStart(2, "0");
    const y = date.getFullYear();
    const h = date.getHours().toString().padStart(2, "0");
    const min = date.getMinutes().toString().padStart(2, "0");
    return `${d}/${m}/${y} ${h}:${min}`;
  };

  const handleDeleteConversation = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      deleteConversation(id);
    },
    [deleteConversation],
  );

  const getDateLabel = (item: { lastModified?: number; timestamp?: number; createdAt?: number }): string => {
    const ts = item.lastModified || item.timestamp || item.createdAt || 0;
    const date = new Date(ts);
    const now = new Date();
    const dd = date.getDate().toString().padStart(2, "0");
    const mm = (date.getMonth() + 1).toString().padStart(2, "0");
    const dateStr = `${dd}/${mm}`;
    if (date.toDateString() === now.toDateString()) return `Today · ${dateStr}`;
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) return `Yesterday · ${dateStr}`;
    return `${date.toLocaleDateString("en-US", { weekday: "long" })} · ${dateStr}`;
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "var(--secondary-bg)",
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px var(--spacing-md) 14px",
          borderTop: "1px solid var(--border-color)",
          borderBottom: "1px solid var(--border-color)",
          flexShrink: 0,
          backgroundColor: "var(--tertiary-bg)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {/* Icon badge - VSCode theme neutral */}
          <div style={{
            width: "36px", height: "36px", borderRadius: "8px", flexShrink: 0,
            background: "rgba(128,128,128,0.1)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "var(--vscode-foreground)",
          }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="20" height="5" x="2" y="3" rx="1"/>
              <path d="M4 8v11a2 2 0 0 0 2 2h2"/>
              <path d="M20 8v11a2 2 0 0 1-2 2h-2"/>
              <path d="m9 15 3-3 3 3"/>
              <path d="M12 12v9"/>
            </svg>
          </div>
          <div>
            <div style={{ marginBottom: "3px" }}>
              <span style={{ fontWeight: 700, fontSize: "14px", color: "var(--primary-text)", letterSpacing: "0.01em" }}>
                History
              </span>
            </div>
            <p style={{ margin: 0, fontSize: "12px", color: "var(--secondary-text)", opacity: 0.7, lineHeight: 1.4 }}>
              {t("history.desc")}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          onMouseEnter={() => setCloseHover(true)}
          onMouseLeave={() => setCloseHover(false)}
          style={{
            padding: "5px", borderRadius: "6px", flexShrink: 0,
            backgroundColor: closeHover ? "rgba(239,68,68,0.12)" : "rgba(128,128,128,0.12)",
            border: "none",
            color: closeHover ? "var(--vscode-errorForeground, #f87171)" : "var(--secondary-text)",
            cursor: "pointer", transition: "all 0.15s ease",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
          title="Close History"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
          </svg>
        </button>
      </div>

      {/* Search */}
      <div
        style={{
          padding: "var(--spacing-md)",
          borderBottom: "1px solid var(--border-color)",
          backgroundColor: "var(--tertiary-bg)",
          display: "flex",
          gap: "8px",
          alignItems: "center",
        }}
      >
        <div style={{ position: "relative", flex: 1 }}>
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: "100%",
              paddingLeft: "32px",
              paddingRight: "var(--spacing-md)",
              paddingTop: "6px",
              paddingBottom: "6px",
              fontSize: "var(--font-size-sm)",
              backgroundColor: "var(--input-bg)",
              border: "1px solid var(--border-color)",
              borderRadius: "var(--border-radius)",
              color: "var(--primary-text)",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          <Search
            style={{
              width: "14px", height: "14px",
              position: "absolute", left: "10px", top: "50%",
              transform: "translateY(-50%)", color: "var(--secondary-text)",
            }}
          />
        </div>
        <button
          onClick={() => setShowConfirm(true)}
          onMouseEnter={() => setTrashHover(true)}
          onMouseLeave={() => setTrashHover(false)}
          style={{
            padding: "5px", borderRadius: "6px", flexShrink: 0,
            backgroundColor: trashHover ? "rgba(234,179,8,0.12)" : "rgba(128,128,128,0.12)",
            border: trashHover ? "1px solid rgba(234,179,8,0.4)" : "1px solid transparent",
            color: trashHover ? "var(--vscode-editorWarning-foreground, #fbbf24)" : "var(--secondary-text)",
            cursor: "pointer", transition: "all 0.15s ease",
          }}
          title="Clear all history"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/>
            <path d="M3 6h18"/>
            <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
          </svg>
        </button>
      </div>

      {/* Confirm modal */}
      {showConfirm && (
        <div style={{
          position: "absolute", inset: 0, zIndex: 100,
          backgroundColor: "rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <div style={{
            backgroundColor: "var(--tertiary-bg)",
            border: "1px solid var(--border-color)",
            borderRadius: "10px", padding: "20px", width: "calc(100% - 32px)",
            display: "flex", flexDirection: "column", gap: "12px",
          }}>
            <p style={{ margin: 0, fontSize: "15px", fontWeight: 600, color: "var(--primary-text)" }}>{t("history.clearAllTitle")}</p>
            <p style={{ margin: 0, fontSize: "13px", color: "var(--secondary-text)", opacity: 0.8 }}>
              {t("history.clearAllDesc")}
            </p>
            <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
              <button
                onClick={() => setShowConfirm(false)}
                style={{ padding: "5px 12px", fontSize: "13px", borderRadius: "6px", border: "1px solid var(--border-color)", backgroundColor: "transparent", color: "var(--secondary-text)", cursor: "pointer" }}
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={() => { clearAllHistory(); setShowConfirm(false); }}
                style={{ padding: "5px 12px", fontSize: "13px", borderRadius: "6px", border: "1px solid rgba(239,68,68,0.4)", backgroundColor: "rgba(239,68,68,0.12)", color: "#f87171", cursor: "pointer" }}
              >
                {t("common.delete")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto", padding: "var(--spacing-md)" }}>
        {isLoading ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "160px", color: "var(--secondary-text)", gap: "var(--spacing-sm)" }}>
            <Loader2 style={{ width: "24px", height: "24px", color: "var(--accent-text)", animation: "spin 1s linear infinite" }} />
            <span style={{ fontSize: "var(--font-size-xs)" }}>{t("history.loading")}</span>
          </div>
        ) : conversations.length === 0 ? (
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "160px", color: "var(--secondary-text)", gap: "var(--spacing-md)" }}>
            <FolderOpen style={{ width: "40px", height: "40px", opacity: 0.2 }} />
            <div style={{ textAlign: "center" }}>
              <h3 style={{ fontSize: "var(--font-size-sm)", fontWeight: 500, color: "var(--primary-text)", marginBottom: "4px", opacity: 0.7 }}>
                {searchQuery ? t("history.noResults") : t("history.noConversations")}
              </h3>
              <p style={{ fontSize: "var(--font-size-xs)", maxWidth: "200px", margin: "0 auto", opacity: 0.7 }}>
                {searchQuery ? t("history.noResultsHint") : t("history.noConversationsHint")}
              </p>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "var(--spacing-sm)" }}>
            {conversations.map((item, i) => {
              const label = getDateLabel(item);
              const showLabel = i === 0 || getDateLabel(conversations[i - 1]) !== label;
              return (
                <React.Fragment key={item.id}>
                  {showLabel && (
                    <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--secondary-text)", textTransform: "uppercase", letterSpacing: "0.06em", padding: "8px 2px 4px", paddingLeft: "8px", opacity: 0.6 }}>
                      {label}
                    </div>
                  )}
                  <HistoryCard
                    item={item}
                    onClick={() => { onLoadConversation?.(item.id, item.tabId, item.folderPath); }}
                    onDelete={handleDeleteConversation}
                    formatDate={formatDate}
                  />
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default HistoryPanel;
