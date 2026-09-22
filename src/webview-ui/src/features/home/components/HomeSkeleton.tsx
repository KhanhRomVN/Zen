/**
 * ------------------------------------------------------------------
 * HomeSkeleton
 * ------------------------------------------------------------------
 * Skeleton loading UI cho Home panel. Phản ánh đúng layout của panel:
 * - StatsGrid: 4 card dạng 2x2
 * - ModelDistributionCard + DailyUsageChart: 2 cột ngang
 * - RecentActivity: danh sách row
 *
 * Sử dụng shimmer animation nhất quán với VS Code theme variables.
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
import React from "react";

// ─── Helpers ────────────────────────────────────────────────────────────

/** Một block skeleton cơ bản với shimmer. Nhận width, height, borderRadius. */
const Bone: React.FC<{
  width?: string | number;
  height?: string | number;
  borderRadius?: string | number;
  style?: React.CSSProperties;
}> = ({ width = "100%", height = "12px", borderRadius = "4px", style }) => (
  <div
    className="zen-skeleton-bone"
    style={{
      width,
      height,
      borderRadius,
      flexShrink: 0,
      ...style,
    }}
  />
);

// ─── Sub-skeletons ───────────────────────────────────────────────────────

/** 2×2 grid tương ứng StatsGrid */
const StatsGridSkeleton: React.FC = () => (
  <div
    style={{
      display: "grid",
      gridTemplateColumns: "repeat(2, 1fr)",
      gap: "10px",
      width: "100%",
    }}
  >
    {Array.from({ length: 4 }).map((_, i) => (
      <div
        key={i}
        style={{
          backgroundColor: "var(--vscode-editor-background, #1e1e1e)",
          borderRadius: "8px",
          padding: "12px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        {/* Icon box */}
        <Bone width={32} height={32} borderRadius="6px" />
        {/* Value */}
        <Bone width="55%" height="16px" borderRadius="4px" />
        {/* Label */}
        <Bone width="40%" height="10px" borderRadius="4px" />
      </div>
    ))}
  </div>
);

/** Row tương ứng ModelDistributionCard + DailyUsageChart */
const ChartsRowSkeleton: React.FC = () => (
  <div style={{ display: "flex", gap: "10px", width: "100%" }}>
    {/* ModelDistributionCard: donut + list */}
    <div
      style={{
        flex: "0 0 auto",
        width: "calc(50% - 5px)",
        backgroundColor: "var(--vscode-editor-background, #1e1e1e)",
        borderRadius: "8px",
        padding: "14px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        boxSizing: "border-box",
      }}
    >
      {/* Title */}
      <Bone width="60%" height="11px" borderRadius="4px" />
      <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
        {/* Donut placeholder */}
        <Bone width={72} height={72} borderRadius="50%" style={{ flexShrink: 0 }} />
        {/* Model rows */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: "7px",
            minWidth: 0,
          }}
        >
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Bone width={8} height={8} borderRadius="2px" />
              <Bone width="60%" height="10px" borderRadius="3px" />
            </div>
          ))}
        </div>
      </div>
    </div>

    {/* DailyUsageChart */}
    <div
      style={{
        flex: 1,
        backgroundColor: "var(--vscode-editor-background, #1e1e1e)",
        borderRadius: "8px",
        padding: "14px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        boxSizing: "border-box",
        minWidth: 0,
      }}
    >
      {/* Title */}
      <Bone width="55%" height="11px" borderRadius="4px" />
      {/* Chart area */}
      <Bone width="100%" height={88} borderRadius="6px" />
      {/* X-axis labels */}
      <div style={{ display: "flex", justifyContent: "space-between" }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Bone key={i} width="10%" height="9px" borderRadius="3px" />
        ))}
      </div>
    </div>
  </div>
);

/** Danh sách row tương ứng RecentActivity */
const RecentActivitySkeleton: React.FC = () => (
  <div
    style={{
      backgroundColor: "var(--vscode-editor-background, #1e1e1e)",
      borderRadius: "8px",
      padding: "14px",
      display: "flex",
      flexDirection: "column",
      gap: "10px",
    }}
  >
    {/* Section label */}
    <Bone width="28%" height="11px" borderRadius="3px" />
    {/* Activity rows */}
    {Array.from({ length: 5 }).map((_, i) => (
      <div
        key={i}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          padding: "6px 0",
        }}
      >
        {/* Favicon/icon */}
        <Bone width={18} height={18} borderRadius="4px" style={{ flexShrink: 0 }} />
        {/* Text block */}
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: "5px",
            minWidth: 0,
          }}
        >
          <Bone width={`${70 - i * 6}%`} height="11px" borderRadius="3px" />
          <Bone width="30%" height="9px" borderRadius="3px" />
        </div>
        {/* Date */}
        <Bone width={44} height="9px" borderRadius="3px" style={{ flexShrink: 0 }} />
      </div>
    ))}
  </div>
);

// ─── Component ──────────────────────────────────────────────────────────

/**
 * HomeSkeleton — bộ skeleton đầy đủ cho Home panel.
 * Render khi `isLoading === true` trước khi dữ liệu thực sự tải xong.
 */
const HomeSkeleton: React.FC = () => (
  <>
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        width: "100%",
      }}
    >
      <StatsGridSkeleton />
      <ChartsRowSkeleton />
      <RecentActivitySkeleton />
    </div>

    <style>{`
      @keyframes zen-skeleton-shimmer {
        0%   { background-position: -400px 0; }
        100% { background-position:  400px 0; }
      }
      .zen-skeleton-bone {
        background: linear-gradient(
          90deg,
          var(--vscode-editor-background, #1e1e1e) 25%,
          color-mix(in srgb, var(--vscode-foreground, #cccccc) 8%, var(--vscode-editor-background, #1e1e1e)) 50%,
          var(--vscode-editor-background, #1e1e1e) 75%
        );
        background-size: 800px 100%;
        animation: zen-skeleton-shimmer 1.4s ease-in-out infinite;
      }
    `}</style>
  </>
);

export default HomeSkeleton;
