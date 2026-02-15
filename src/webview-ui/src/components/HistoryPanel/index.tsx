import React, { useState, useEffect } from "react";
import { ConversationItem } from "./types";
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
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [selectedSort, setSelectedSort] = useState<"recent" | "oldest">(
    "recent",
  );

  // Load conversations when panel opens
  useEffect(() => {
    if (isOpen) {
      loadConversations();
    }
  }, [isOpen]);

  // Listen for confirmation responses from extension
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;
      if (message.command === "deleteConfirmed" && message.conversationId) {
        // Delete the conversation
        window.storage
          .delete(message.conversationId, false)
          .then(() => {
            setConversations((prev) =>
              prev.filter((c) => c.id !== message.conversationId),
            );
          })
          .catch((error) => {
            console.error("[HistoryPanel] Error deleting conversation:", error);
          });
      } else if (message.command === "clearAllConfirmed") {
        // Clear all conversations
        setConversations((prevConversations) => {
          Promise.all(
            prevConversations.map((conv) =>
              window.storage.delete(conv.id, false),
            ),
          ).catch((error) => {
            console.error("[HistoryPanel] Error clearing all:", error);
          });
          return [];
        });
      }
    };

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  const loadConversations = async () => {
    setIsLoading(true);
    try {
      if (!window.storage) {
        console.error("[HistoryPanel] window.storage not available");
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
      const keysToDelete: string[] = [];
      const now = Date.now();
      const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

      for (const key of result.keys) {
        try {
          const data = await window.storage.get(key, false);
          if (data && data.value) {
            // Check content first to parse
            let parsed;
            try {
              parsed = JSON.parse(data.value);
            } catch (e) {
              console.error(`[HistoryPanel] Error parsing JSON for ${key}`, e);
              keysToDelete.push(key);
              continue;
            }

            // 1. Check expiration (30 days logic)
            // Using lastModified if available, otherwise createdAt
            const itemTime =
              parsed.metadata?.lastModified || parsed.metadata?.createdAt || 0;
            if (itemTime > 0 && now - itemTime > thirtyDaysMs) {
              keysToDelete.push(key);
              continue;
            }

            // 🆕 Validate parsed data structure
            if (
              parsed.metadata &&
              parsed.messages &&
              Array.isArray(parsed.messages)
            ) {
              const firstMessage = parsed.messages?.[0]?.content || "";

              // Calculate size
              const size = new Blob([data.value]).size;

              items.push({
                ...parsed.metadata,
                preview: firstMessage.substring(0, 150),
                size: size,
              });
            } else {
              keysToDelete.push(key);
            }
          } else {
            keysToDelete.push(key);
          }
        } catch (error) {
          console.error(
            `[HistoryPanel] ❌ Error loading conversation ${key}:`,
            error,
          );
          keysToDelete.push(key); // 🆕 Mark for cleanup on error
        }
      }

      if (keysToDelete.length > 0) {
        Promise.all(
          keysToDelete.map(async (key) => {
            try {
              await window.storage.delete(key, false);
            } catch (error) {
              console.error(
                `[HistoryPanel] ❌ Failed to delete key ${key}:`,
                error,
              );
            }
          }),
        ).catch((error) => {
          console.error("[HistoryPanel] ❌ Error during cleanup:", error);
        });
      }

      setConversations(items);
      setIsLoading(false);
    } catch (error) {
      console.error("[HistoryPanel] Error loading conversations:", error);
      setConversations([]);
      setIsLoading(false);
    }
  };

  const filteredConversations = conversations
    .filter(
      (item) =>
        item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.preview.toLowerCase().includes(searchQuery.toLowerCase()),
    )
    .sort((a, b) => {
      if (selectedSort === "recent") {
        return b.lastModified - a.lastModified;
      } else {
        return a.lastModified - b.lastModified;
      }
    });

  const handleDeleteConversation = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    // Use VS Code API for confirmation
    const vscodeApi = (window as any).vscodeApi;
    if (vscodeApi) {
      vscodeApi.postMessage({
        command: "confirmDelete",
        conversationId: id,
      });
    } else {
      // Fallback: just delete without confirmation
      try {
        await window.storage.delete(id, false);
        setConversations((prev) => prev.filter((c) => c.id !== id));
      } catch (error) {
        console.error("[HistoryPanel] Error deleting conversation:", error);
      }
    }
  };

  const handleClearAll = async () => {
    // Use VS Code API for confirmation
    const vscodeApi = (window as any).vscodeApi;
    if (vscodeApi) {
      vscodeApi.postMessage({
        command: "confirmClearAll",
      });
    } else {
      // Fallback: just clear without confirmation
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
            {conversations.length}
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
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--hover-bg)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
          title="Close History"
        >
          <ChevronRight style={{ width: "16px", height: "16px" }} />
        </button>
      </div>

      {/* Search & Filter Bar */}
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
            onFocus={(e) => {
              e.currentTarget.style.borderColor = "var(--accent-text)";
            }}
            onBlur={(e) => {
              e.currentTarget.style.borderColor = "var(--border-color)";
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
              border: "1px solid transparent",
              borderRadius: "var(--border-radius)",
              cursor: "pointer",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = "var(--primary-text)";
              e.currentTarget.style.backgroundColor = "var(--hover-bg)";
              e.currentTarget.style.borderColor = "var(--border-color)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = "var(--secondary-text)";
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.borderColor = "transparent";
            }}
          >
            <ArrowUpDown style={{ width: "12px", height: "12px" }} />
            <span>
              {selectedSort === "recent" ? "Newest first" : "Oldest first"}
            </span>
          </button>

          {conversations.length > 0 && (
            <button
              onClick={handleClearAll}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "4px 8px",
                fontSize: "var(--font-size-xs)",
                color: "var(--error-color)",
                backgroundColor: "transparent",
                border: "none",
                borderRadius: "var(--border-radius)",
                cursor: "pointer",
                transition: "background-color 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "#f4433610";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <Trash2 style={{ width: "12px", height: "12px" }} />
              <span>Clear All</span>
            </button>
          )}
        </div>
      </div>

      {/* Conversations List */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "var(--spacing-md)",
        }}
      >
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
        ) : filteredConversations.length === 0 ? (
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
              style={{
                width: "40px",
                height: "40px",
                opacity: 0.2,
              }}
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
            {filteredConversations.map((item) => (
              <HistoryCard
                key={item.id}
                item={item}
                onClick={() => {
                  if (onLoadConversation) {
                    onLoadConversation(item.id, item.tabId, item.folderPath);
                  } else {
                    console.error(
                      "[HistoryPanel] ❌ onLoadConversation not available",
                    );
                    onClose();
                  }
                }}
                onDelete={handleDeleteConversation}
                formatDate={formatDate}
              />
            ))}
          </div>
        )}
      </div>

      <style>
        {`
          @keyframes spin {
            from {
              transform: rotate(0deg);
            }
            to {
              transform: rotate(360deg);
            }
          }
        `}
      </style>
    </div>
  );
};

export default HistoryPanel;
