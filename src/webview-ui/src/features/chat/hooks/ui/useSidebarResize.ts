/**
 * ------------------------------------------------------------------
 * useSidebarResize
 * ------------------------------------------------------------------
 * Quản lý bề rộng sidebar trái có thể kéo resize bằng chuột.
 *
 * Main features:
 * - Giới hạn bề rộng trong [SIDEBAR_MIN, SIDEBAR_MAX]
 * - Lưu bề rộng vào localStorage, dùng chung key với Home nên hai màn
 *   hình luôn có cùng độ rộng sidebar
 * - Trả về isResizing để UI hiển thị trạng thái đang kéo
 *
 * Main functions:
 * - useSidebarResize() : Trả về { width, isResizing, onResizeStart }
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
import React, { useCallback, useState } from "react";

// ─── Constants ──────────────────────────────────────────────────────────
const SIDEBAR_WIDTH_KEY = "zen.home.sidebarWidth";
export const SIDEBAR_MIN = 240;
export const SIDEBAR_MAX = 640;
export const SIDEBAR_DEFAULT = 340;

// ─── Hook ───────────────────────────────────────────────────────────────
/** Gắn `onResizeStart` vào resizer; `width` dùng cho style của sidebar. */
export function useSidebarResize() {
  const [width, setWidth] = useState<number>(() => {
    try {
      const saved = Number(localStorage.getItem(SIDEBAR_WIDTH_KEY));
      if (saved >= SIDEBAR_MIN && saved <= SIDEBAR_MAX) return saved;
    } catch {}
    return SIDEBAR_DEFAULT;
  });
  const [isResizing, setIsResizing] = useState(false);

  const onResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      const startX = e.clientX;
      const startWidth = width;
      let latest = startWidth;
      setIsResizing(true);
      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";

      const onMove = (ev: MouseEvent) => {
        latest = Math.min(
          SIDEBAR_MAX,
          Math.max(SIDEBAR_MIN, startWidth + ev.clientX - startX),
        );
        setWidth(latest);
      };
      const onUp = () => {
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
        document.body.style.userSelect = "";
        document.body.style.cursor = "";
        setIsResizing(false);
        try {
          localStorage.setItem(SIDEBAR_WIDTH_KEY, String(latest));
        } catch {}
      };
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [width],
  );

  return { width, isResizing, onResizeStart };
}