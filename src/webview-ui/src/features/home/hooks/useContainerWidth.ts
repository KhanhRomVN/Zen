/**
 * ------------------------------------------------------------------
 * useContainerWidth
 * ------------------------------------------------------------------
 * Đo bề rộng thực của một element bằng ResizeObserver và quy về 3
 * mức (tier) để Home đổi layout theo wireframe:
 * - compact : < COMPACT_MAX px (sidebar rất hẹp)
 * - default : giữa hai ngưỡng (secondary sidebar thường)
 * - wide    : >= WIDE_MIN px (sidebar đã maximize hoặc kéo rất rộng)
 *
 * Chỉ state tier (không state width) để không re-render theo từng px
 * khi người dùng kéo sidebar.
 *
 * Main functions:
 * - useContainerWidth() : Trả về { ref, tier, isWide }
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
import { useEffect, useRef, useState } from "react";

// ─── Types ──────────────────────────────────────────────────────────────
export type WidthTier = "compact" | "default" | "wide";

// ─── Constants ──────────────────────────────────────────────────────────
export const COMPACT_MAX = 340;
export const WIDE_MIN = 900;

// ─── Helpers ────────────────────────────────────────────────────────────
function computeTier(width: number): WidthTier {
  if (width >= WIDE_MIN) return "wide";
  if (width > 0 && width < COMPACT_MAX) return "compact";
  return "default";
}

// ─── Hook ───────────────────────────────────────────────────────────────
/** Gắn `ref` vào element cần đo; `tier` đổi khi bề rộng vượt ngưỡng. */
export function useContainerWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [tier, setTier] = useState<WidthTier>("default");

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const update = (width: number) => {
      const next = computeTier(width);
      setTier((prev) => (prev === next ? prev : next));
    };

    update(el.clientWidth);
    const ro = new ResizeObserver(([entry]) => update(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return { ref, tier, isWide: tier === "wide" };
}