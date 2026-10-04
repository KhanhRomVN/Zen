/**
 * ------------------------------------------------------------------
 * DailyUsageChart
 * ------------------------------------------------------------------
 * Biểu đồ đường hiển thị usage theo period đang chọn.
 * Tự động adapt x-axis label theo period:
 *   day   → "HH:00"       (hourly, 00:00–23:00)
 *   week  → "dd/mm"       (7 ngày)
 *   month → "dd"          (ngày trong tháng)
 *   year  → "MMM"         (tháng viết tắt)
 *   all   → same as year
 *
 * Main features:
 * - Line chart + area fill với Catmull-Rom smooth curve
 * - Tooltip chi tiết requests/tokens khi hover
 * - X-axis label density tự động theo container width
 * - Responsive (ResizeObserver)
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
import React, { useRef, useState, useEffect } from "react";
import { StatsPeriod } from "../hooks/useStatsPeriod";

// ─── Interfaces ─────────────────────────────────────────────────────────
interface UsageEntry { date: string; requests: number; tokens: number; }
interface Props {
  usage: UsageEntry[];
  title: string;
  period?: StatsPeriod;
}

// ─── Constants ──────────────────────────────────────────────────────────
const LINE_COLOR = "var(--vscode-textLink-foreground, #3b82f6)";
const CHART_H = 120;
const CHART_W = 600;

// ─── Helpers ────────────────────────────────────────────────────────────
interface Point { x: number; y: number; }

function buildSmoothPath(points: Point[]): string {
  if (points.length < 2) return "";
  let d = `M ${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i - 1] || points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2] || p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }
  return d;
}

/** Format x-axis tick label depending on period and raw date string from API. */
function formatTick(dateStr: string, period: StatsPeriod): string {
  switch (period) {
    case "day": {
      // API returns "HH:00" already (e.g. "09:00")
      return dateStr.length >= 5 ? dateStr.slice(0, 5) : dateStr;
    }
    case "week":
    case "month": {
      // API returns "YYYY-MM-DD"
      const parts = dateStr.split("-");
      if (parts.length === 3) return `${parts[2]}/${parts[1]}`;
      return dateStr;
    }
    case "year":
    case "all": {
      // API returns "YYYY-MM"
      const parts = dateStr.split("-");
      if (parts.length >= 2) {
        const month = parseInt(parts[1], 10);
        const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        return MONTHS[month - 1] ?? parts[1];
      }
      return dateStr;
    }
    default: return dateStr;
  }
}

/** Tooltip header line for a given entry. */
function formatTooltipHeader(dateStr: string, period: StatsPeriod): string {
  switch (period) {
    case "day":
      return `${dateStr.slice(0, 5)} – ${String(parseInt(dateStr, 10) + 1).padStart(2,"0")}:00`;
    case "week":
    case "month": {
      const parts = dateStr.split("-");
      return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateStr;
    }
    case "year":
    case "all": {
      const parts = dateStr.split("-");
      if (parts.length >= 2) {
        const month = parseInt(parts[1], 10);
        const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        return `${MONTHS[month - 1] ?? parts[1]} ${parts[0]}`;
      }
      return dateStr;
    }
    default: return dateStr;
  }
}

// ─── Component ──────────────────────────────────────────────────────────
const DailyUsageChart: React.FC<Props> = ({ usage, title, period = "day" }) => {
  // ── State ──
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [containerWidth, setContainerWidth] = useState(200);

  // ── Refs ──
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Derived ──
  // Use usage array as-is — backend already fills all labels
  const n = usage.length;
  const maxReq = Math.max(...usage.map(u => u.requests), 1);

  const xOf = (i: number) => n <= 1 ? CHART_W / 2 : (i / (n - 1)) * CHART_W;
  const yOf = (i: number) => CHART_H - (usage[i].requests / maxReq) * CHART_H;

  const points: Point[] = usage.map((_, i) => ({ x: xOf(i), y: yOf(i) }));
  const smoothPath = buildSmoothPath(points);

  const areaPath = n > 1
    ? `M ${xOf(0)},${CHART_H} ` + points.map(p => `L ${p.x},${p.y}`).join(" ") + ` L ${xOf(n - 1)},${CHART_H} Z`
    : "";

  // ── Effects ──
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Handlers ──
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = svgRef.current;
    if (!svg || n === 0) return;
    const rect = svg.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    const idx = Math.round(relX * (n - 1));
    const clamped = Math.max(0, Math.min(n - 1, idx));
    const dotX = rect.left + (xOf(clamped) / CHART_W) * rect.width;
    const dotY = rect.top + (yOf(clamped) / CHART_H) * rect.height;
    setHoveredIdx(clamped);
    setTooltipPos({ x: dotX, y: dotY });
  };

  const handleMouseLeave = () => {
    setHoveredIdx(null);
    setTooltipPos(null);
  };

  // ── X-axis labels ──
  const xLabels: number[] = (() => {
    const minPxPerLabel = 36;
    const maxLabels = Math.max(2, Math.floor(containerWidth / minPxPerLabel));
    if (n <= maxLabels) return usage.map((_, i) => i);
    const step = Math.ceil((n - 1) / (maxLabels - 1));
    const out: number[] = [];
    for (let i = 0; i < n - 1; i += step) out.push(i);
    if (out[out.length - 1] !== n - 1) out.push(n - 1);
    return out;
  })();

  // ── Render ──
  return (
    <div style={{
      backgroundColor: "var(--vscode-editor-background, #1e1e1e)",
      borderRadius: "8px",
      padding: "14px",
      boxSizing: "border-box",
    }}>
      <div style={{
        fontSize: "11px", fontWeight: 600,
        color: "var(--vscode-foreground)",
        textTransform: "uppercase", letterSpacing: "0.05em",
        marginBottom: "10px", opacity: 0.8,
      }}>
        {title}
      </div>

      <div style={{ position: "relative" }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
          style={{ width: "100%", height: `${CHART_H}px`, display: "block", overflow: "visible" }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <defs>
            <linearGradient id="duc-area-grad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={LINE_COLOR} stopOpacity="0.25" />
              <stop offset="100%" stopColor={LINE_COLOR} stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Area fill */}
          {areaPath && (
            <path d={areaPath} fill="url(#duc-area-grad)" />
          )}

          {/* Smooth line */}
          {smoothPath && (
            <path
              d={smoothPath}
              fill="none"
              stroke={LINE_COLOR}
              strokeWidth="1.5"
              strokeLinejoin="round"
              strokeLinecap="round"
            />
          )}

          {/* Hover dot */}
          {hoveredIdx !== null && (
            <circle
              cx={xOf(hoveredIdx)}
              cy={yOf(hoveredIdx)}
              r={3}
              fill={LINE_COLOR}
              stroke="var(--vscode-editor-background, #1e1e1e)"
              strokeWidth="1.5"
            />
          )}
        </svg>

        {/* X-axis labels */}
        <div
          ref={containerRef}
          style={{ display: "flex", marginTop: "4px", position: "relative", height: "12px" }}
        >
          {xLabels.map((i) => (
            <span key={i} style={{
              position: "absolute",
              left: `${(xOf(i) / CHART_W) * 100}%`,
              transform: "translateX(-50%)",
              fontSize: "9px",
              color: "var(--vscode-descriptionForeground)",
              opacity: 0.6,
              whiteSpace: "nowrap",
            }}>
              {formatTick(usage[i].date, period)}
            </span>
          ))}
        </div>
      </div>

      {/* Tooltip */}
      {hoveredIdx !== null && tooltipPos && (() => {
        const entry = usage[hoveredIdx];
        return (
          <div style={{
            position: "fixed",
            left: tooltipPos.x,
            top: tooltipPos.y - 8,
            transform: "translate(-50%, -100%)",
            backgroundColor: "var(--vscode-editorHoverWidget-background, #1e1e1e)",
            border: "1px solid var(--vscode-editorHoverWidget-border, rgba(128,128,128,0.3))",
            borderRadius: "6px",
            padding: "6px 10px",
            fontSize: "11px",
            color: "var(--vscode-foreground)",
            pointerEvents: "none",
            zIndex: 9999,
            whiteSpace: "nowrap",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          }}>
            <div style={{ fontWeight: 600, marginBottom: "3px" }}>
              {formatTooltipHeader(entry.date, period)}
            </div>
            <div style={{ opacity: 0.75, lineHeight: 1.6 }}>
              <div>{entry.requests} requests</div>
              <div>{entry.tokens.toLocaleString()} tokens</div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default DailyUsageChart;
