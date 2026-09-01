/**
 * ------------------------------------------------------------------
 * useTruncatedText
 * ------------------------------------------------------------------
 * Custom hook đo chiều rộng khả dụng của container và cắt ngắn text
 * để vừa khít, kèm hậu tố "..." khi text bị cắt.

 * Main features:
 * - Tự đo chiều rộng container bằng ResizeObserver
 * - Binary search để tìm điểm cắt tối ưu
 * - Tự cập nhật khi container thay đổi kích thước
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── React ──
import { useState, useRef, useEffect, useCallback } from "react";

// ─── Hook ───────────────────────────────────────────────────────────────
export const useTruncatedText = (fullText: string, fontStyle: string) => {
  // ── State ──
  const [displayText, setDisplayText] = useState(fullText);

  // ── Refs ──
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Callbacks ──
  const computeTruncation = useCallback(() => {
    const el = containerRef.current;
    if (!el || !fullText) return;
    const availWidth = el.clientWidth;
    if (availWidth <= 0) return;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.font = fontStyle;
    const ellipsis = "...";
    const ellipsisWidth = ctx.measureText(ellipsis).width;
    if (ctx.measureText(fullText).width <= availWidth) {
      setDisplayText(fullText);
      return;
    }
    let lo = 0;
    let hi = fullText.length;
    while (lo < hi) {
      const mid = Math.floor((lo + hi + 1) / 2);
      if (ctx.measureText(fullText.slice(0, mid)).width + ellipsisWidth <= availWidth) lo = mid;
      else hi = mid - 1;
    }
    setDisplayText(lo > 0 ? fullText.slice(0, lo) + ellipsis : ellipsis);
  }, [fullText, fontStyle]);

  // ── Effects ──
  useEffect(() => {
    computeTruncation();
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(computeTruncation);
    ro.observe(el);
    return () => ro.disconnect();
  }, [computeTruncation]);

  return { containerRef, displayText };
};