import React, { useState, useEffect } from "react";

interface ConversationItem {
  id: string;
  tabId: number;
  folderPath: string | null;
  title: string;
  lastModified: number;
  messageCount: number;
  preview: string;
}

interface HistoryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadConversation?: (
    conversationId: string,
    tabId: number,
    folderPath: string | null
  ) => void;
}

const HistoryPanel: React.FC<HistoryPanelProps> = ({
  isOpen,
  onClose,
  onLoadConversation,
}) => {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSort, setSelectedSort] = useState<"recent" | "oldest">(
    "recent"
  );

  useEffect(() => {
    if (isOpen) {
      loadConversations();
    }
  }, [isOpen]);

  const loadConversations = async () => {
    setIsLoading(true);
    try {
      if (!window.storage) {
        setConversations([]);
        setIsLoading(false);
        return;
      }

      const result = await window.storage.list("zen-conversation:", false);

      if (!result || !result.keys) {
        setConversations([]);
        setIsLoading(false);
        return;
      }

      const items: ConversationItem[] = [];

      for (const key of result.keys) {
        try {
          const data = await window.storage.get(key, false);
          if (data && data.value) {
            const parsed = JSON.parse(data.value);
            if (parsed.metadata) {
              const firstMessage = parsed.messages?.[0]?.content || "";
              items.push({
                ...parsed.metadata,
                preview: firstMessage.substring(0, 150),
              });
            }
          }
        } catch (error) {
          console.error(
            `[HistoryPanel] Error loading conversation ${key}:`,
            error
          );
        }
      }

      setConversations(items);
    } catch (error) {
      console.error("[HistoryPanel] Error loading conversations:", error);
      setConversations([]);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredConversations = conversations
    .filter(
      (item) =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.preview.toLowerCase().includes(searchQuery.toLowerCase())
    )
    .sort((a, b) => {
      if (selectedSort === "recent") {
        return b.lastModified - a.lastModified;
      } else {
        return a.lastModified - b.lastModified;
      }
    });

  const handleDeleteConversation = async (id: string) => {
    const confirmed = window.confirm(
      "Delete this conversation? This cannot be undone."
    );
    if (confirmed) {
      try {
        await window.storage.delete(id, false);
        setConversations((prev) => prev.filter((c) => c.id !== id));
      } catch (error) {
        console.error("[HistoryPanel] Error deleting conversation:", error);
      }
    }
  };

  const handleClearAll = async () => {
    const confirmed = window.confirm(
      "Delete ALL conversations? This cannot be undone."
    );
    if (confirmed) {
      try {
        for (const conv of conversations) {
          await window.storage.delete(conv.id, false);
        }
        setConversations([]);
      } catch (error) {
        console.error("[HistoryPanel] Error clearing all:", error);
      }
    }
  };

  const formatDate = (timestamp: number): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "Just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;

    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: date.getFullYear() !== now.getFullYear() ? "numeric" : undefined,
    });
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "var(--primary-bg)",
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "var(--spacing-lg)",
          borderBottom: "1px solid var(--border-color)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: "var(--secondary-bg)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--spacing-sm)",
          }}
        >
          <span style={{ fontSize: "24px" }}>📚</span>
          <h2
            style={{
              fontSize: "var(--font-size-xl)",
              fontWeight: 600,
              color: "var(--primary-text)",
              margin: 0,
            }}
          >
            History
          </h2>
          <span
            style={{
              fontSize: "var(--font-size-xs)",
              color: "var(--secondary-text)",
              padding: "2px 8px",
              backgroundColor: "var(--hover-bg)",
              borderRadius: "var(--border-radius)",
            }}
          >
            {conversations.length}
          </span>
        </div>
        <div
          style={{
            cursor: "pointer",
            padding: "var(--spacing-xs)",
            borderRadius: "var(--border-radius)",
            transition: "background-color 0.2s",
          }}
          onClick={onClose}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--hover-bg)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </div>
      </div>

      {/* Search & Filter Bar */}
      <div
        style={{
          padding: "var(--spacing-lg)",
          backgroundColor: "var(--secondary-bg)",
          borderBottom: "1px solid var(--border-color)",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: "var(--spacing-sm)",
            marginBottom: "var(--spacing-sm)",
          }}
        >
          <div style={{ flex: 1, position: "relative" }}>
            <input
              type="text"
              placeholder="Search conversations..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "var(--spacing-sm) var(--spacing-md)",
                paddingLeft: "32px",
                backgroundColor: "var(--input-bg)",
                color: "var(--primary-text)",
                border: "1px solid var(--border-color)",
                borderRadius: "var(--border-radius)",
                fontSize: "var(--font-size-sm)",
                outline: "none",
              }}
            />
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              style={{
                position: "absolute",
                left: "8px",
                top: "50%",
                transform: "translateY(-50%)",
                opacity: 0.5,
              }}
            >
              <circle cx="11" cy="11" r="8" />
              <path d="m21 21-4.35-4.35" />
            </svg>
          </div>
          <button
            onClick={() =>
              setSelectedSort(selectedSort === "recent" ? "oldest" : "recent")
            }
            style={{
              padding: "var(--spacing-sm) var(--spacing-md)",
              backgroundColor: "var(--input-bg)",
              color: "var(--primary-text)",
              border: "1px solid var(--border-color)",
              borderRadius: "var(--border-radius)",
              fontSize: "var(--font-size-sm)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "var(--spacing-xs)",
            }}
          >
            <span>{selectedSort === "recent" ? "⬇️" : "⬆️"}</span>
            <span>{selectedSort === "recent" ? "Recent" : "Oldest"}</span>
          </button>
        </div>
      </div>

      {/* Conversations List */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "var(--spacing-lg)",
        }}
      >
        {isLoading ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "var(--spacing-xl)",
              color: "var(--secondary-text)",
              gap: "var(--spacing-sm)",
            }}
          >
            <div
              style={{ fontSize: "32px", animation: "spin 1s linear infinite" }}
            >
              ⚙️
            </div>
            <span>Loading conversations...</span>
            <style>
              {`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}
            </style>
          </div>
        ) : filteredConversations.length === 0 ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              padding: "var(--spacing-xl)",
              color: "var(--secondary-text)",
              textAlign: "center",
              gap: "var(--spacing-md)",
            }}
          >
            <div style={{ fontSize: "64px" }}>📭</div>
            <h3
              style={{
                margin: 0,
                fontSize: "var(--font-size-lg)",
                color: "var(--primary-text)",
              }}
            >
              {searchQuery ? "No results found" : "No conversations yet"}
            </h3>
            <p
              style={{
                margin: 0,
                fontSize: "var(--font-size-sm)",
                maxWidth: "300px",
              }}
            >
              {searchQuery
                ? "Try a different search term"
                : "Start a new conversation to see it here"}
            </p>
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--spacing-sm)",
            }}
          >
            {filteredConversations.map((item) => (
              <div
                key={item.id}
                style={{
                  padding: "var(--spacing-md)",
                  backgroundColor: "var(--secondary-bg)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "var(--border-radius-lg)",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  position: "relative",
                }}
                onClick={() => {
                  if (onLoadConversation) {
                    onLoadConversation(item.id, item.tabId, item.folderPath);
                    onClose();
                  }
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--hover-bg)";
                  e.currentTarget.style.borderColor = "var(--accent-text)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--secondary-bg)";
                  e.currentTarget.style.borderColor = "var(--border-color)";
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    marginBottom: "var(--spacing-xs)",
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        fontSize: "var(--font-size-md)",
                        color: "var(--primary-text)",
                        fontWeight: 500,
                        marginBottom: "var(--spacing-xs)",
                        lineHeight: 1.4,
                      }}
                    >
                      {item.title}
                    </div>
                    <div
                      style={{
                        fontSize: "var(--font-size-sm)",
                        color: "var(--secondary-text)",
                        lineHeight: 1.5,
                        display: "-webkit-box",
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: "vertical",
                        overflow: "hidden",
                      }}
                    >
                      {item.preview}
                    </div>
                  </div>
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteConversation(item.id);
                    }}
                    style={{
                      padding: "var(--spacing-xs)",
                      borderRadius: "var(--border-radius)",
                      cursor: "pointer",
                      transition: "all 0.2s",
                      opacity: 0.5,
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor =
                        "var(--error-color)";
                      e.currentTarget.style.opacity = "1";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "transparent";
                      e.currentTarget.style.opacity = "0.5";
                    }}
                  >
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                    >
                      <polyline points="3 6 5 6 21 6" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </div>
                </div>
                <div
                  style={{
                    display: "flex",
                    gap: "var(--spacing-md)",
                    alignItems: "center",
                  }}
                >
                  <span
                    style={{
                      fontSize: "var(--font-size-xs)",
                      color: "var(--secondary-text)",
                    }}
                  >
                    🕐 {formatDate(item.lastModified)}
                  </span>
                  <span
                    style={{
                      fontSize: "var(--font-size-xs)",
                      color: "var(--secondary-text)",
                    }}
                  >
                    💬 {item.messageCount} messages
                  </span>
                  {item.folderPath && (
                    <span
                      style={{
                        fontSize: "var(--font-size-xs)",
                        color: "var(--accent-text)",
                        padding: "2px 6px",
                        backgroundColor: "var(--hover-bg)",
                        borderRadius: "var(--border-radius)",
                      }}
                    >
                      📁 {item.folderPath.split("/").pop()}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      {conversations.length > 0 && (
        <div
          style={{
            padding: "var(--spacing-lg)",
            borderTop: "1px solid var(--border-color)",
            backgroundColor: "var(--secondary-bg)",
          }}
        >
          <button
            onClick={handleClearAll}
            style={{
              width: "100%",
              padding: "var(--spacing-sm)",
              backgroundColor: "transparent",
              color: "var(--error-color)",
              border: "1px solid var(--error-color)",
              borderRadius: "var(--border-radius)",
              fontSize: "var(--font-size-sm)",
              cursor: "pointer",
              transition: "all 0.2s",
              fontWeight: 500,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--error-color)";
              e.currentTarget.style.color = "white";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "var(--error-color)";
            }}
          >
            🗑️ Clear All History
          </button>
        </div>
      )}
    </div>
  );
};

export default HistoryPanel;
