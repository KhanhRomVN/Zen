/**
 * ------------------------------------------------------------------
 * RecentActivity
 * ------------------------------------------------------------------
 * Component hiển thị danh sách hội thoại gần đây trong Home panel.
 * Tái sử dụng HistoryCard từ feature history.

 * Main features:
 * - Hiển thị tối đa 10 hội thoại gần nhất
 * - Loading state khi đang fetch
 * - Cho phép xóa hội thoại trực tiếp
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── React ──
import React from "react";

// ── UI ──
import { Loader2 } from "lucide-react";

// ── Components ──
import HistoryCard from "../../history/components/HistoryCard";

// ── Types ──
import { ConversationItem } from "../../history/types";

// ─── Interfaces ─────────────────────────────────────────────────────────
interface RecentActivityProps {
  conversations: ConversationItem[];
  isLoading: boolean;
  onLoadConversation?: (
    conversationId: string,
    tabId: number,
    folderPath: string | null,
  ) => void;
}

// ─── Component ──────────────────────────────────────────────────────────
const RecentActivity: React.FC<RecentActivityProps> = ({
  conversations,
  isLoading,
  onLoadConversation,
}) => {
  // ── Derived ──
  const formatDate = (ts: number): string => {
    const d = new Date(ts);
    return `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1)
      .toString()
      .padStart(2, "0")}/${d.getFullYear()}`;
  };

  // ── Handlers ──
  const handleDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const vscodeApi = (window as any).vscodeApi;
    if (vscodeApi) {
      vscodeApi.postMessage({ command: "deleteConversation", conversationId: id });
    }
  };

  // ── Render ──
  return (
    <div
      style={{
        backgroundColor: "var(--vscode-sideBar-background, rgba(0,0,0,0.15))",
        border: "1px solid var(--vscode-widget-border, rgba(128,128,128,0.15))",
        borderRadius: "8px",
        padding: "14px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "10px",
        }}
      >
        <span
          style={{
            fontSize: "11px",
            fontWeight: 600,
            color: "var(--vscode-foreground)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            opacity: 0.8,
          }}
        >
          Recent Activities
        </span>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
        {isLoading ? (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 0",
              color: "var(--vscode-disabledForeground)",
            }}
          >
            <Loader2 size={12} className="spin-animation" />
            <span style={{ fontSize: "11px" }}>Loading history...</span>
          </div>
        ) : conversations.length > 0 ? (
          conversations
            .slice(0, 10)
            .map((item) => (
              <HistoryCard
                key={item.id}
                item={item}
                onClick={() =>
                  onLoadConversation?.(item.id, item.tabId, item.folderPath)
                }
                onDelete={handleDelete}
                formatDate={formatDate}
              />
            ))
        ) : (
          <div
            style={{
              padding: "10px 0",
              fontSize: "11px",
              color: "var(--vscode-disabledForeground)",
              fontStyle: "italic",
            }}
          >
            No recent chats
          </div>
        )}
      </div>
    </div>
  );
};

export default RecentActivity;