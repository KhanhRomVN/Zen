import React, { useCallback } from "react";
import HistoryCard from "./HistoryCard";
import {
  ChevronRight,
  FolderOpen,
  History,
  Loader2,
  Search,
  Trash2,
  ArrowUpDown,
} from "lucide-react";
import { useConversationHistory } from "../../hooks/useConversationHistory";

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
          height: "48px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 var(--spacing-md)",
          borderBottom: "1px solid var(--border-color)",
          flexShrink: 0,
          backgroundColor: "var(--tertiary-bg)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--spacing-sm)",
            overflow: "hidden",
          }}
        >
          <History
            style={{
              width: "16px",
              height: "16px",
              color: "var(--secondary-text)",
            }}
          />
          <span
            style={{
              fontWeight: 700,
              fontSize: "var(--font-size-xs)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              textTransform: "uppercase",
              letterSpacing: "0.1em",
              color: "var(--secondary-text)",
            }}
          >
            History
          </span>
          <span
            style={{
              backgroundColor: "var(--accent-text)",
              color: "var(--primary-bg)",
              borderRadius: "12px",
              padding: "2px 8px",
              fontSize: "10px",
              fontWeight: 500,
            }}
          >
            {totalCount}
          </span>
        </div>
        <button
          onClick={onClose}
          style={{
            padding: "6px",
            borderRadius: "var(--border-radius-lg)",
            backgroundColor: "transparent",
            border: "none",
            color: "var(--secondary-text)",
            cursor: "pointer",
            transition: "background-color 0.2s ease",
          }}
          title="Close History"
        >
          <ChevronRight style={{ width: "16px", height: "16px" }} />
        </button>
      </div>

      {/* Search & Filter */}
      <div
        style={{
          padding: "var(--spacing-md)",
          borderBottom: "1px solid var(--border-color)",
          backgroundColor: "var(--tertiary-bg)",
          display: "flex",
          flexDirection: "column",
          gap: "var(--spacing-sm)",
        }}
      >
        <div style={{ position: "relative" }}>
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
            }}
          />
          <Search
            style={{
              width: "14px",
              height: "14px",
              position: "absolute",
              left: "10px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--secondary-text)",
            }}
          />
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <button
            onClick={() =>
              setSelectedSort(selectedSort === "recent" ? "oldest" : "recent")
            }
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "4px 8px",
              fontSize: "var(--font-size-xs)",
              color: "var(--secondary-text)",
              backgroundColor: "transparent",
              border: "none",
              cursor: "pointer",
            }}
          >
            <ArrowUpDown style={{ width: "12px", height: "12px" }} />
            <span>
              {selectedSort === "recent" ? "Newest first" : "Oldest first"}
            </span>
          </button>
          {totalCount > 0 && (
            <button
              onClick={clearAllHistory}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 8px",
                fontSize: "var(--font-size-xs)",
                color: "var(--error-color)",
                backgroundColor: "transparent",
                border: "none",
                cursor: "pointer",
              }}
            >
              <Trash2 style={{ width: "12px", height: "12px" }} />
              <span>Clear All</span>
            </button>
          )}
        </div>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto", padding: "var(--spacing-md)" }}>
        {isLoading ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "160px",
              color: "var(--secondary-text)",
              gap: "var(--spacing-sm)",
            }}
          >
            <Loader2
              style={{
                width: "24px",
                height: "24px",
                color: "var(--accent-text)",
                animation: "spin 1s linear infinite",
              }}
            />
            <span style={{ fontSize: "var(--font-size-xs)" }}>
              Loading conversations...
            </span>
          </div>
        ) : conversations.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              height: "160px",
              color: "var(--secondary-text)",
              gap: "var(--spacing-md)",
            }}
          >
            <FolderOpen
              style={{ width: "40px", height: "40px", opacity: 0.2 }}
            />
            <div style={{ textAlign: "center" }}>
              <h3
                style={{
                  fontSize: "var(--font-size-sm)",
                  fontWeight: 500,
                  color: "var(--primary-text)",
                  marginBottom: "4px",
                  opacity: 0.7,
                }}
              >
                {searchQuery ? "No results found" : "No conversations yet"}
              </h3>
              <p
                style={{
                  fontSize: "var(--font-size-xs)",
                  maxWidth: "200px",
                  margin: "0 auto",
                  opacity: 0.7,
                }}
              >
                {searchQuery
                  ? "Try a different search term"
                  : "Start a new conversation to see it here"}
              </p>
            </div>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--spacing-sm)",
            }}
          >
            {conversations.map((item) => (
              <HistoryCard
                key={item.id}
                item={item}
                onClick={() => {
                  onLoadConversation?.(item.id, item.tabId, item.folderPath);
                }}
                onDelete={handleDeleteConversation}
                formatDate={formatDate}
              />
            ))}
          </div>
        )}
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default HistoryPanel;
