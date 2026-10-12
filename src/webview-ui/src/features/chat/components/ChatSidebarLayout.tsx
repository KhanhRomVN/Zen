/**
 * ------------------------------------------------------------------
 * ChatSidebarLayout
 * ------------------------------------------------------------------
 * Layout bọc quanh ChatPanel: sidebar lịch sử bên trái (giống Home)
 * và nội dung chat ở giữa.
 *
 * Main features:
 * - Left: dùng lại HomeSidebar, chỉ hiện khi container >= 900px
 * - Left: kéo resize, bề rộng dùng chung với Home
 * - Nạp lịch sử lại khi hội thoại hiện tại đổi
 * - Khi hội thoại đang mở bị xóa từ sidebar thì gọi onCurrentDeleted
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── React ──
import React, { useCallback, useEffect, useRef } from "react";

// ── Components ──
import HomeSidebar from "../../home/components/HomeSidebar";

// ── Hooks ──
import { useHistoryList } from "../hooks/conversation/useHistoryList";
import { useSidebarResize } from "../hooks/ui/useSidebarResize";

// ─── Interfaces ─────────────────────────────────────────────────────────
interface ChatSidebarLayoutProps {
  children: React.ReactNode;
  currentConversationId?: string | null;
  onLoadConversation?: (
    conversationId: string,
    tabId: number,
    folderPath: string | null,
  ) => void;
  onCurrentDeleted?: () => void;
}

// ─── Constants ──────────────────────────────────────────────────────────
const WIDE_MIN = 900; // trùng WIDE_MIN của useContainerWidth
// HistoryCard tự fallback favicon theo provider nên không cần fetch API
const NO_FAVICONS: Record<string, string> = {};

// ─── Component ──────────────────────────────────────────────────────────
/** Bọc ChatPanel bằng sidebar lịch sử (trái). */
const ChatSidebarLayout: React.FC<ChatSidebarLayoutProps> = ({
  children,
  currentConversationId,
  onLoadConversation,
  onCurrentDeleted,
}) => {
  // ── State ──
  const { width, isResizing, onResizeStart } = useSidebarResize();

  const handleDeleted = useCallback(
    (id: string) => {
      if (id === currentConversationId) onCurrentDeleted?.();
    },
    [currentConversationId, onCurrentDeleted],
  );

  const { conversations, isLoading } = useHistoryList(
    currentConversationId,
    handleDeleted,
  );

  // ── Handlers ──
  const handleLoad = useCallback(
    (id: string, tabId: number, folderPath: string | null) =>
      onLoadConversation?.(id, tabId, folderPath),
    [onLoadConversation],
  );

  // Báo extension khi sidebar lịch sử đang hiện để ẩn icon History trên title bar
  const rootRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    let last: boolean | null = null;
    const report = (visible: boolean) => {
      if (last === visible) return;
      last = visible;
      (window as any).vscodeApi?.postMessage({
        command: "setHistorySidebarVisible",
        visible,
      });
    };
    report(el.clientWidth >= WIDE_MIN);
    const ro = new ResizeObserver(([entry]) =>
      report(entry.contentRect.width >= WIDE_MIN),
    );
    ro.observe(el);
    return () => {
      ro.disconnect();
      (window as any).vscodeApi?.postMessage({
        command: "setHistorySidebarVisible",
        visible: false,
      });
    };
  }, []);

  // ── Render ──
  return (
    <div
      ref={rootRef}
      className="zen-chat-root"
      style={{
        display: "flex",
        flexDirection: "row",
        height: "100%",
        width: "100%",
        boxSizing: "border-box",
        borderTop: "1px solid var(--border-color)",
        containerType: "inline-size",
        containerName: "zen-chat-root",
      }}
    >
      <style>{`
        .zen-chat-sidebar { position: relative; flex-shrink: 0; height: 100%; min-height: 0; max-width: 50%; display: none; }
        .zen-chat-main { flex: 1; min-width: 0; height: 100%; display: flex; flex-direction: column; }
        .zen-chat-main > .chat-panel { flex: 1; min-height: 0; }
        .zen-chat-resizer { position: absolute; top: 0; right: -4px; bottom: 0; width: 8px; cursor: col-resize; z-index: 10; }
        .zen-chat-resizer::after { content: ""; position: absolute; top: 0; bottom: 0; left: 3px; width: 2px; background: transparent; transition: background-color 0.15s ease; }
        .zen-chat-resizer:hover::after, .zen-chat-resizer.dragging::after { background: var(--vscode-sash-hoverBorder, var(--vscode-focusBorder, #3b82f6)); }
        @container zen-chat-root (min-width: ${WIDE_MIN}px) {
          .zen-chat-sidebar { display: block; }
        }
      `}</style>

      <div className="zen-chat-sidebar" style={{ width }}>
        <HomeSidebar
          imagesUri={(window as any).__zenImagesUri}
          version={(window as any).__zenVersion}
          conversations={conversations}
          isLoading={isLoading}
          onLoadConversation={handleLoad}
          providerFavicons={NO_FAVICONS}
          selectedConversationId={currentConversationId}
        />
        <div
          className={`zen-chat-resizer${isResizing ? " dragging" : ""}`}
          onMouseDown={onResizeStart}
          title="Drag to resize"
        />
      </div>

      <div className="zen-chat-main">{children}</div>
    </div>
  );
};

export default ChatSidebarLayout;