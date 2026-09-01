/**
 * ------------------------------------------------------------------
 * CopyableText
 * ------------------------------------------------------------------
 * Component hiển thị đoạn text với khả năng click để copy vào clipboard.
 * Tự động cắt ngắn text nếu vượt quá chiều rộng container.

 * Main features:
 * - Click để copy giá trị vào clipboard (kèm hiệu ứng "✓ copied")
 * - Tự truncate text theo chiều rộng container
 * - Hỗ trợ font monospace hoặc sans-serif
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── React ──
import React, { useState } from "react";

// ── Hooks ──
import { useTruncatedText } from "./truncateText";

// ─── Interfaces ─────────────────────────────────────────────────────────
interface CopyableTextProps {
  value: string;
  monospace?: boolean;
}

// ─── Component ──────────────────────────────────────────────────────────
export const CopyableText: React.FC<CopyableTextProps> = ({ value, monospace }) => {
  // ── State ──
  const [copied, setCopied] = useState(false);
  const [hovered, setHovered] = useState(false);

  // ── Derived ──
  const fontSize = "11px";
  const fontFamily = monospace ? "monospace" : "sans-serif";
  const { containerRef, displayText } = useTruncatedText(value || "", `${fontSize} ${fontFamily}`);

  // ── Handlers ──
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!value) return;
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  // ── Render ──
  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={copied ? "Copied!" : value ? `Click to copy: ${value}` : "N/A"}
      style={{
        fontSize,
        fontFamily,
        color: copied
          ? "var(--vscode-testing-iconPassed, #22c55e)"
          : hovered
            ? "var(--vscode-textLink-foreground)"
            : "var(--primary-text)",
        cursor: value ? "pointer" : "default",
        transition: "color 0.15s ease",
        overflow: "hidden",
        whiteSpace: "nowrap",
        width: "100%",
      }}
    >
      {copied ? "✓ copied" : displayText || "N/A"}
    </div>
  );
};