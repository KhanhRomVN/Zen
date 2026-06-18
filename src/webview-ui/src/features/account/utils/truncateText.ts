import { useState, useRef, useEffect, useCallback } from "react";

/**
 * Measures available px width and truncates text to fit, with "..." suffix
 */
export const useTruncatedText = (fullText: string, fontStyle: string) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [displayText, setDisplayText] = useState(fullText);

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