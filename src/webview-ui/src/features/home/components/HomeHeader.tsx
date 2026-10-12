/**
 * ------------------------------------------------------------------
 * HomeHeader
 * ------------------------------------------------------------------
 * Header logo + title "Zen" + slogan xoay vòng cho Home.
 * Chỉ hiển thị khi HomeSidebar bị ẩn (webview < 700px) để không
 * trùng với logo/title trong sidebar.
 *
 * Main features:
 * - Logo + title gradient
 * - Slogan xoay vòng mỗi 3 giây với animation slideUp
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
import React, { useEffect, useState } from "react";

// ─── Constants ──────────────────────────────────────────────────────────
const SLOGANS = [
  "Code smarter, not harder",
  "Your AI coding companion",
  "Boost your productivity",
  "Where ideas meet implementation",
  "Ship faster with confidence",
  "Your partner in development",
] as const;

// ─── Interfaces ─────────────────────────────────────────────────────────
interface HomeHeaderProps {
  imagesUri?: string;
}

// ─── Component ──────────────────────────────────────────────────────────
/** Header logo + title + slogan, chỉ hiện khi sidebar trái bị ẩn. */
const HomeHeader: React.FC<HomeHeaderProps> = ({ imagesUri }) => {
  // ── State ──
  const [sloganIndex, setSloganIndex] = useState(0);

  // ── Effects ──
  useEffect(() => {
    const timer = setInterval(() => {
      setSloganIndex((prev) => (prev + 1) % SLOGANS.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  // ── Render ──
  return (
    <div className="zen-home-header">
      <style>{`
        .zen-home-header { display: none; width: 100%; flex-direction: column; align-items: center; text-align: center; margin-bottom: 12px; }
        @container zen-root (max-width: 699px) {
          .zen-home-header { display: flex; }
        }
      `}</style>
      <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
        <div
          style={{
            width: "42px",
            height: "42px",
            borderRadius: "10px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <img
            src={`${imagesUri}/icon.png`}
            alt="Zen Logo"
            style={{ width: "100%", height: "100%", objectFit: "contain" }}
          />
        </div>
        <h1
          style={{
            fontSize: "30px",
            fontWeight: 800,
            margin: 0,
            background:
              "linear-gradient(to right, var(--vscode-foreground, #fff), var(--vscode-textPreformat-foreground, #a8a8a8))",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            letterSpacing: "-0.02em",
          }}
        >
          Zen
        </h1>
      </div>
      <div
        style={{
          height: "28px",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
        }}
      >
        <div
          key={sloganIndex}
          style={{
            fontSize: "14px",
            color: "var(--vscode-descriptionForeground, #888)",
            fontWeight: 500,
            animation: "slideUp 0.4s ease-out",
            whiteSpace: "nowrap",
          }}
        >
          {SLOGANS[sloganIndex]}
        </div>
      </div>
    </div>
  );
};

export default HomeHeader;