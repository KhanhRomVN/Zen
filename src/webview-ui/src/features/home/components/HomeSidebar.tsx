/**
 * ------------------------------------------------------------------
 * HomeSidebar
 * ------------------------------------------------------------------
 * Sidebar trái của Home: logo + tiêu đề Zen và danh sách lịch sử
 * hội thoại (HistoryCard) chiếm 100% chiều cao.
 *
 * Main features:
 * - Header logo, tên Zen và version
 * - Ô tìm kiếm lọc cục bộ theo tiêu đề
 * - Nhóm hội thoại theo ngày (Today, Yesterday, weekday)
 * - Xóa hội thoại trực tiếp
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── React ──
import React, { useMemo, useState } from "react";

// ── UI ──
import { Loader2, Search } from "lucide-react";

// ── Components ──
import HistoryCard from "../../history/components/HistoryCard";

// ── Types ──
import { ConversationItem } from "../../history/types";

// ─── Interfaces ─────────────────────────────────────────────────────────
interface HomeSidebarProps {
  imagesUri?: string;
  version?: string;
  conversations: ConversationItem[];
  isLoading: boolean;
  onLoadConversation: (
    conversationId: string,
    tabId: number,
    folderPath: string | null,
  ) => void;
  providerFavicons: Record<string, string>;
  /** Id hội thoại đang mở trong Chat (để tô nổi card tương ứng) */
  selectedConversationId?: string | null;
}

// ─── Helpers ────────────────────────────────────────────────────────────
const getTimestamp = (item: ConversationItem): number =>
  new Date(item.lastModified || item.timestamp || item.createdAt || 0).getTime();

const getDateLabel = (ts: number): string => {
  const date = new Date(ts);
  const now = new Date();
  const dd = date.getDate().toString().padStart(2, "0");
  const mm = (date.getMonth() + 1).toString().padStart(2, "0");
  const dateStr = `${dd}/${mm}`;
  if (date.toDateString() === now.toDateString()) return `Today · ${dateStr}`;
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString())
    return `Yesterday · ${dateStr}`;
  return `${date.toLocaleDateString("en-US", { weekday: "long" })} · ${dateStr}`;
};

const formatDate = (ts: number): string => {
  const d = new Date(ts);
  return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1)
    .toString()
    .padStart(2, "0")}/${d.getFullYear()}`;
};

// ─── Component ──────────────────────────────────────────────────────────
/** Sidebar trái của Home: logo, tiêu đề và danh sách lịch sử. */
const HomeSidebar: React.FC<HomeSidebarProps> = ({
  imagesUri,
  version,
  conversations,
  isLoading,
  onLoadConversation,
  providerFavicons,
  selectedConversationId,
}) => {
  // ── State ──
  const [search, setSearch] = useState("");

  // ── Derived ──
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return conversations.filter(
      (c) => !q || (c.title || "").toLowerCase().includes(q),
    );
  }, [conversations, search]);

  // ── Handlers ──
  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const vscodeApi = (window as any).vscodeApi;
    if (vscodeApi) {
      vscodeApi.postMessage({
        command: "deleteConversation",
        conversationId: id,
      });
    }
  };

  // ── Render ──
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        minHeight: 0,
        backgroundColor: "var(--tertiary-bg, var(--secondary-bg))",
        borderRight: "1px solid var(--border-color)",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "16px 14px 10px",
          flexShrink: 0,
        }}
      >
        <img
          src={`${imagesUri}/icon.png`}
          alt="Zen Logo"
          style={{ width: "28px", height: "28px", objectFit: "contain" }}
        />
        <span
          style={{
            fontSize: "20px",
            fontWeight: 800,
            letterSpacing: "-0.02em",
            color: "var(--primary-text)",
          }}
        >
          Zen
        </span>
        {version && (
          <span
            style={{
              padding: "1px 7px",
              borderRadius: "999px",
              fontSize: "10px",
              fontWeight: 600,
              color: "var(--vscode-textLink-foreground, #4fc3f7)",
              backgroundColor:
                "color-mix(in srgb, var(--vscode-textLink-foreground, #4fc3f7) 14%, transparent)",
            }}
          >
            v{version}
          </span>
        )}
      </div>

      <div style={{ padding: "0 14px 10px", flexShrink: 0 }}>
        <div style={{ position: "relative" }}>
          <input
            type="text"
            placeholder="Search conversations..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: "100%",
              height: "32px",
              paddingLeft: "30px",
              paddingRight: "8px",
              fontSize: "12px",
              backgroundColor: "var(--input-bg)",
              border: "none",
              borderRadius: "8px",
              color: "var(--primary-text)",
              outline: "none",
              boxSizing: "border-box",
            }}
          />
          <Search
            style={{
              width: "13px",
              height: "13px",
              position: "absolute",
              left: "10px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--secondary-text)",
            }}
          />
        </div>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: "0 10px 12px",
        }}
      >
        {isLoading ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 4px",
              color: "var(--vscode-disabledForeground)",
            }}
          >
            <Loader2 size={12} className="spin-animation" />
            <span style={{ fontSize: "11px" }}>Loading history...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div
            style={{
              padding: "10px 4px",
              fontSize: "11px",
              color: "var(--vscode-disabledForeground)",
              fontStyle: "italic",
            }}
          >
            {search ? "No results found" : "No conversations yet"}
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {filtered.map((item, i) => {
              const label = getDateLabel(getTimestamp(item));
              const showLabel =
                i === 0 || getDateLabel(getTimestamp(filtered[i - 1])) !== label;
              return (
                <React.Fragment key={item.id}>
                  {showLabel && (
                    <div
                      style={{
                        fontSize: "10px",
                        fontWeight: 600,
                        color: "var(--secondary-text)",
                        textTransform: "uppercase",
                        letterSpacing: "0.06em",
                        padding: "8px 4px 2px",
                        opacity: 0.6,
                      }}
                    >
                      {label}
                    </div>
                  )}
                  <HistoryCard
                    item={item}
                    onClick={() =>
                      onLoadConversation(item.id, item.tabId, item.folderPath)
                    }
                    onDelete={handleDelete}
                    formatDate={formatDate}
                    providerFavicons={providerFavicons}
                    selected={
                      !!selectedConversationId &&
                      item.id === selectedConversationId
                    }
                  />
                </React.Fragment>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default HomeSidebar;