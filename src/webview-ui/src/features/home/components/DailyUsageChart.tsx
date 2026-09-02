/**
 * ------------------------------------------------------------------
 * DailyUsageChart
 * ------------------------------------------------------------------
 * Biểu đồ đường hiển thị số requests theo giờ trong ngày.
 * Dùng đường cong mượt (Catmull-Rom → cubic bezier) thay vì polyline gấp khúc.

 * Main features:
 * - Vẽ line chart 24 giờ với area fill
 * - Tooltip hiển thị chi tiết requests/tokens khi hover
 * - Responsive theo container width (ResizeObserver)
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── React ──
import React, { useRef, useState, useEffect } from "react";

// ─── Interfaces ─────────────────────────────────────────────────────────
interface HourEntry { date: string; requests: number; tokens: number; }
interface Props { usage: HourEntry[]; title: string; }

// ─── Constants ──────────────────────────────────────────────────────────
const LINE_COLOR = "var(--vscode-textLink-foreground, #3b82f6)";
const CHART_H = 120;
const CHART_W = 600; // viewBox width, scales with container
const HOURS = Array.from({ length: 24 }, (_, i) => i);

// ─── Helpers ────────────────────────────────────────────────────────────
interface Point { x: number; y: number; }

// Catmull-Rom → cubic bezier path
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

// ─── Component ──────────────────────────────────────────────────────────
const DailyUsageChart: React.FC<Props> = ({ usage, title }) => {
  // ── State ──
  const [tooltip, setTooltip] = useState<{ hour: number; svgX: number; svgY: number } | null>(null);
  const [containerWidth, setContainerWidth] = useState(200);

  // ── Refs ──
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Derived ──
  const dataMap = new Map<number, HourEntry>();
  usage.forEach((u) => {
    const h = parseInt(u.date.split(":")[0], 10);
    if (!isNaN(h)) dataMap.set(h, u);
  });

  const currentHour = new Date().getHours();
  const maxReq = Math.max(...HOURS.map((h) => dataMap.get(h)?.requests ?? 0), 1);

  const xOf = (h: number) => (h / 23) * CHART_W;
  const yOf = (h: number) => {
    const req = dataMap.get(h)?.requests ?? 0;
    return CHART_H - (req / maxReq) * CHART_H;
  };

  // Build smooth path for past/present hours only
  const pastPointsData = HOURS.filter((h) => h <= currentHour).map((h) => ({
    x: xOf(h),
    y: yOf(h),
  }));
  const pastPath = buildSmoothPath(pastPointsData);

  // Area fill under past line
  const areaPoints = [
    `${xOf(0)},${CHART_H}`,
    ...HOURS.filter((h) => h <= currentHour).map((h) => `${xOf(h)},${yOf(h)}`),
    `${xOf(currentHour)},${CHART_H}`,
  ].join(" ");

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
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    const hour = Math.round(relX * 23);
    const clampedH = Math.max(0, Math.min(23, hour));
    // compute dot position in client coords
    const dotX = rect.left + (xOf(clampedH) / CHART_W) * rect.width;
    const dotY = rect.top + (yOf(clampedH) / CHART_H) * rect.height;
    setTooltip({ hour: clampedH, svgX: dotX, svgY: dotY });
  };

  // ── Render ──
  return (
    <div style={{
      backgroundColor: "var(--vscode-editor-background, #1e1e1e)",
      borderRadius: "8px",
      padding: "14px",
      boxSizing: "border-box",
    }}>
      <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--vscode-foreground)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "10px", opacity: 0.8 }}>
        {title}
      </div>

      <div style={{ position: "relative" }}>
        <svg
          ref={svgRef}
          viewBox={`0 0 ${CHART_W} ${CHART_H}`}
          style={{ width: "100%", height: `${CHART_H}px`, display: "block", overflow: "visible" }}
          onMouseMove={handleMouseMove}
          onMouseLeave={() => setTooltip(null)}
        >
          <defs>
            <linearGradient id="lineAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={LINE_COLOR} stopOpacity="0.25" />
              <stop offset="100%" stopColor={LINE_COLOR} stopOpacity="0.02" />
            </linearGradient>
          </defs>

          {/* Area fill */}
          {pastPointsData.length > 1 && (
            <polygon points={areaPoints} fill="url(#lineAreaGrad)" />
          )}

          {/* Past line — smooth curve */}
          {pastPath && (
            <path d={pastPath} fill="none" stroke={LINE_COLOR} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
          )}

          {/* Hover dot */}
          {tooltip !== null && (
            <circle
              cx={xOf(tooltip.hour)}
              cy={yOf(tooltip.hour)}
              r={3}
              fill={tooltip.hour <= currentHour ? LINE_COLOR : "rgba(128,128,128,0.5)"}
              stroke="var(--vscode-editor-background, #1e1e1e)"
              strokeWidth="1.5"
            />
          )}
        </svg>

        {/* X-axis labels — density based on container width */}
        <div ref={containerRef} style={{ display: "flex", marginTop: "4px", position: "relative", height: "12px" }}>
          {(() => {
            // ~28px per label minimum
            const maxLabels = Math.max(2, Math.floor(containerWidth / 28));
            const step = Math.ceil(23 / (maxLabels - 1));
            const labelHours: number[] = [];
            for (let h = 0; h <= 23; h += step) labelHours.push(h);
            if (labelHours[labelHours.length - 1] !== 23) labelHours.push(23);
            return labelHours.map((h) => (
              <span key={h} style={{
                position: "absolute",
                left: `${(h / 23) * 100}%`,
                transform: "translateX(-50%)",
                fontSize: "9px",
                color: "var(--vscode-descriptionForeground)",
                opacity: 0.6,
                whiteSpace: "nowrap",
              }}>
                {String(h).padStart(2, "0")}h
              </span>
            ));
          })()}
        </div>
      </div>

      {/* Tooltip */}
      {tooltip !== null && (() => {
        const entry = dataMap.get(tooltip.hour);
        return (
          <div style={{
            position: "fixed",
            left: tooltip.svgX,
            top: tooltip.svgY - 8,
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
              {String(tooltip.hour).padStart(2, "0")}:00 – {String(tooltip.hour + 1).padStart(2, "0")}:00
            </div>
            <div style={{ opacity: 0.75, lineHeight: 1.6 }}>
              <div>{entry?.requests ?? 0} requests</div>
              <div>{(entry?.tokens ?? 0).toLocaleString()} tokens</div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};

export default DailyUsageChart;