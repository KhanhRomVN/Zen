/**
 * ------------------------------------------------------------------
 * DailyUsageChart
 * ------------------------------------------------------------------
 * Biểu đồ kết hợp (combo) hiển thị usage theo period đang chọn:
 * cột = Requests (trục trái), đường + vùng = Tokens (trục phải).
 * Tự động adapt x-axis label theo period:
 *   day   → "HH:00"       (hourly, 00:00–23:00)
 *   week  → "dd/mm"       (7 ngày)
 *   month → "dd/mm"       (ngày trong tháng)
 *   year  → "MMM"         (tháng viết tắt)
 *   all   → same as year
 *
 * Main features:
 * - Hiển thị đồng thời 2 series, legend chip bật/tắt từng series
 * - 4 ô tóm tắt: tổng requests, tổng tokens, trung bình, peak
 * - Hai trục Y (làm tròn "đẹp") dùng chung gridline
 * - Cột bo góc có gradient, cột peak nổi bật; đường tokens monotone cubic
 * - Hover: tô nền cột, dot trên đường tokens, tooltip đủ 2 metric + % tổng
 * - X-axis label density tự động theo container width
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
import React, { useMemo, useRef, useState, useEffect } from "react";
import { StatsPeriod } from "../hooks/useStatsPeriod";
import { formatTokens } from "./TokensByProviderCard";

// ─── Interfaces ─────────────────────────────────────────────────────────
interface UsageEntry {
  date: string;
  requests: number;
  tokens: number;
}
interface Props {
  usage: UsageEntry[];
  title: string;
  period?: StatsPeriod;
}
type Metric = "requests" | "tokens";
interface Point {
  x: number;
  y: number;
}

// ─── Constants ──────────────────────────────────────────────────────────
const CHART_H = 120;
const CHART_W = 600;
const Y_TICKS = 4;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const METRIC_META: Record<Metric, { label: string; color: string }> = {
  requests: { label: "Requests", color: "var(--vscode-textLink-foreground, #3b82f6)" },
  tokens: {
    label: "Tokens",
    color: "var(--vscode-gitDecoration-addedResourceForeground, #10b981)",
  },
};
const SLOT_UNIT: Record<StatsPeriod, string> = {
  day: "hour",
  week: "day",
  month: "day",
  year: "month",
  all: "month",
};

// ─── Helpers ────────────────────────────────────────────────────────────
/** Monotone cubic (Fritsch–Carlson): đường mượt, không vượt quá min/max của dữ liệu. */
function buildMonotonePath(pts: Point[]): string {
  const n = pts.length;
  if (n < 2) return "";
  const dx: number[] = [];
  const s: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx.push(pts[i + 1].x - pts[i].x);
    s.push((pts[i + 1].y - pts[i].y) / (dx[i] || 1));
  }
  const m: number[] = new Array(n);
  m[0] = s[0];
  m[n - 1] = s[n - 2];
  for (let i = 1; i < n - 1; i++) {
    m[i] = s[i - 1] * s[i] <= 0 ? 0 : (s[i - 1] + s[i]) / 2;
  }
  for (let i = 0; i < n - 1; i++) {
    if (s[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
      continue;
    }
    const a = m[i] / s[i];
    const b = m[i + 1] / s[i];
    const h = a * a + b * b;
    if (h > 9) {
      const t = 3 / Math.sqrt(h);
      m[i] = t * a * s[i];
      m[i + 1] = t * b * s[i];
    }
  }
  let d = `M ${pts[0].x},${pts[0].y}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C ${pts[i].x + h},${pts[i].y + m[i] * h} ${pts[i + 1].x - h},${pts[i + 1].y - m[i + 1] * h} ${pts[i + 1].x},${pts[i + 1].y}`;
  }
  return d;
}

/** Làm tròn max lên giá trị "đẹp" (1, 2, 2.5, 5, 10 × 10^k) để gridline đều. */
function niceCeil(v: number): number {
  if (v <= 0) return 1;
  const exp = Math.pow(10, Math.floor(Math.log10(v)));
  const f = v / exp;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * exp;
}

/** Format giá trị theo metric (tokens rút gọn, requests giữ nguyên). */
function formatValue(v: number, metric: Metric): string {
  if (metric === "tokens") return formatTokens(Math.round(v));
  if (v >= 1000) return formatTokens(Math.round(v));
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

/** Format x-axis tick label depending on period and raw date string from API. */
function formatTick(dateStr: string, period: StatsPeriod): string {
  switch (period) {
    case "day":
      return dateStr.length >= 5 ? dateStr.slice(0, 5) : dateStr;
    case "week":
    case "month": {
      const parts = dateStr.split("-");
      return parts.length === 3 ? `${parts[2]}/${parts[1]}` : dateStr;
    }
    case "year":
    case "all": {
      const parts = dateStr.split("-");
      if (parts.length >= 2) return MONTHS[parseInt(parts[1], 10) - 1] ?? parts[1];
      return dateStr;
    }
    default:
      return dateStr;
  }
}

/** Tooltip header line for a given entry. */
function formatTooltipHeader(dateStr: string, period: StatsPeriod): string {
  switch (period) {
    case "day":
      return `${dateStr.slice(0, 5)} – ${String(parseInt(dateStr, 10) + 1).padStart(2, "0")}:00`;
    case "week":
    case "month": {
      const parts = dateStr.split("-");
      return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : dateStr;
    }
    case "year":
    case "all": {
      const parts = dateStr.split("-");
      if (parts.length >= 2)
        return `${MONTHS[parseInt(parts[1], 10) - 1] ?? parts[1]} ${parts[0]}`;
      return dateStr;
    }
    default:
      return dateStr;
  }
}

// ─── Component ──────────────────────────────────────────────────────────
const DailyUsageChart: React.FC<Props> = ({ usage, title, period = "day" }) => {
  // ── State ──
  const [show, setShow] = useState<Record<Metric, boolean>>({
    requests: true,
    tokens: true,
  });
  const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ x: number; y: number } | null>(null);
  const [containerWidth, setContainerWidth] = useState(200);

  // ── Refs ──
  const plotRef = useRef<HTMLDivElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // ── Derived ──
  const n = usage.length;
  const reqColor = METRIC_META.requests.color;
  const tokColor = METRIC_META.tokens.color;
  const reqVals = useMemo(() => usage.map((u) => u.requests), [usage]);
  const tokVals = useMemo(() => usage.map((u) => u.tokens), [usage]);
  const totalReq = useMemo(() => reqVals.reduce((a, b) => a + b, 0), [reqVals]);
  const totalTok = useMemo(() => tokVals.reduce((a, b) => a + b, 0), [tokVals]);
  const yMaxReq = niceCeil(Math.max(...reqVals, 1));
  const yMaxTok = niceCeil(Math.max(...tokVals, 1));
  const isEmpty = totalReq === 0 && totalTok === 0;

  // Peak/avg bám theo series chính (requests nếu đang bật, ngược lại tokens)
  const primary: Metric = show.requests ? "requests" : "tokens";
  const primaryVals = primary === "requests" ? reqVals : tokVals;
  const peakIdx = useMemo(() => {
    let best = -1;
    primaryVals.forEach((v, i) => {
      if (v > 0 && (best === -1 || v > primaryVals[best])) best = i;
    });
    return best;
  }, [primaryVals]);
  const activeSlots = primaryVals.filter((v) => v > 0).length;
  const primaryTotal = primary === "requests" ? totalReq : totalTok;
  const avg = activeSlots > 0 ? primaryTotal / activeSlots : 0;

  const xOf = (i: number) => ((i + 0.5) / Math.max(n, 1)) * CHART_W;
  const yTok = (i: number) => CHART_H - (tokVals[i] / yMaxTok) * CHART_H;
  const tokPoints: Point[] = tokVals.map((_, i) => ({ x: xOf(i), y: yTok(i) }));
  const tokLine = buildMonotonePath(tokPoints);
  const tokArea = tokLine
    ? `${tokLine} L ${xOf(n - 1)},${CHART_H} L ${xOf(0)},${CHART_H} Z`
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
  const toggle = (m: Metric) => {
    setShow((prev) => {
      const other: Metric = m === "requests" ? "tokens" : "requests";
      // luôn giữ lại ít nhất 1 series
      if (prev[m] && !prev[other]) return prev;
      return { ...prev, [m]: !prev[m] };
    });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const el = plotRef.current;
    if (!el || n === 0) return;
    const rect = el.getBoundingClientRect();
    const relX = (e.clientX - rect.left) / rect.width;
    const idx = Math.max(0, Math.min(n - 1, Math.floor(relX * n)));
    const reqPct = show.requests ? reqVals[idx] / yMaxReq : 0;
    const tokPct = show.tokens ? tokVals[idx] / yMaxTok : 0;
    setHoveredIdx(idx);
    setTooltipPos({
      x: rect.left + ((idx + 0.5) / n) * rect.width,
      y: rect.top + (1 - Math.max(reqPct, tokPct)) * rect.height,
    });
  };

  const handleMouseLeave = () => {
    setHoveredIdx(null);
    setTooltipPos(null);
  };

  // ── X-axis labels ──
  const xLabels: number[] = (() => {
    const maxLabels = Math.max(2, Math.floor(containerWidth / 40));
    if (n <= maxLabels) return usage.map((_, i) => i);
    const step = Math.ceil((n - 1) / (maxLabels - 1));
    const out: number[] = [];
    for (let i = 0; i < n - 1; i += step) out.push(i);
    if (out[out.length - 1] !== n - 1) {
      if (n - 1 - out[out.length - 1] < step * 0.6) out.pop();
      out.push(n - 1);
    }
    return out;
  })();


  // ── Render ──
  return (
    <div
      style={{
        backgroundColor: "var(--vscode-editor-background, #1e1e1e)",
        borderRadius: "8px",
        padding: "14px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
      }}
    >
      <style>{`
        .zen-usage-plot { min-height: 120px; }
        @container zen (min-width: 900px) { .zen-usage-plot { min-height: 200px; } }
        @container zen (min-width: 1300px) { .zen-usage-plot { min-height: 260px; } }
        .zen-usage-tiles { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
        @container zen (min-width: 560px) { .zen-usage-tiles { grid-template-columns: repeat(4, minmax(0, 1fr)); } }
        .zen-usage-chip { transition: opacity 0.15s ease, background-color 0.15s ease; }
        .zen-usage-chip:hover { background-color: color-mix(in srgb, var(--vscode-foreground) 8%, transparent) !important; }
        .zen-usage-bar { transition: opacity 0.12s ease, filter 0.12s ease; }
      `}</style>

      {/* Header: title + legend chips */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
          flexWrap: "wrap",
        }}
      >
        <div
          style={{
            fontSize: "11px",
            fontWeight: 600,
            color: "var(--vscode-foreground)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            opacity: 0.8,
          }}
        >
          {title}
        </div>
        <div style={{ display: "inline-flex", gap: "6px" }}>
          {(Object.keys(METRIC_META) as Metric[]).map((m) => {
            const active = show[m];
            const c = METRIC_META[m].color;
            return (
              <button
                key={m}
                type="button"
                className="zen-usage-chip"
                onClick={() => toggle(m)}
                title={active ? `Hide ${METRIC_META[m].label}` : `Show ${METRIC_META[m].label}`}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  border: `1px solid ${active ? `color-mix(in srgb, ${c} 45%, transparent)` : "var(--vscode-widget-border, rgba(128,128,128,0.25))"}`,
                  borderRadius: "5px",
                  padding: "2px 10px 2px 8px",
                  fontSize: "10px",
                  fontWeight: 600,
                  fontFamily: "inherit",
                  cursor: "pointer",
                  color: active ? "var(--vscode-foreground)" : "var(--vscode-descriptionForeground)",
                  backgroundColor: active
                    ? `color-mix(in srgb, ${c} 12%, transparent)`
                    : "transparent",
                  opacity: active ? 1 : 0.7,
                }}
              >
                <span
                  style={{
                    width: m === "requests" ? 8 : 10,
                    height: m === "requests" ? 8 : 3,
                    borderRadius: m === "requests" ? "2px" : "2px",
                    backgroundColor: c,
                    opacity: active ? 1 : 0.4,
                  }}
                />
                {METRIC_META[m].label}
              </button>
            );
          })}
        </div>
      </div>


      {/* Chart body: left axis + plot + right axis */}
      <div style={{ display: "flex", gap: "8px", flex: 1, minHeight: 0 }}>
        {/* Left axis (Requests) */}
        <div
          style={{
            position: "relative",
            width: "28px",
            flexShrink: 0,
            marginBottom: "18px",
            opacity: show.requests ? 1 : 0.25,
          }}
        >
          {Array.from({ length: Y_TICKS + 1 }, (_, i) => (
            <span
              key={i}
              style={{
                position: "absolute",
                right: 0,
                top: `${(i / Y_TICKS) * 100}%`,
                transform: "translateY(-50%)",
                fontSize: "9px",
                lineHeight: 1,
                color: reqColor,
                opacity: 0.75,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {formatValue((yMaxReq * (Y_TICKS - i)) / Y_TICKS, "requests")}
            </span>
          ))}
        </div>

        <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
          {/* Plot */}
          <div
            ref={plotRef}
            className="zen-usage-plot"
            style={{ position: "relative", flex: 1 }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
          >
            {/* Gridlines */}
            {Array.from({ length: Y_TICKS + 1 }, (_, i) => (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  top: `${(i / Y_TICKS) * 100}%`,
                  borderTop:
                    i === Y_TICKS
                      ? "1px solid var(--vscode-widget-border, rgba(128,128,128,0.35))"
                      : "1px dashed var(--vscode-widget-border, rgba(128,128,128,0.22))",
                  pointerEvents: "none",
                }}
              />
            ))}

            {/* Bars: Requests */}
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "stretch",
              }}
            >
              {usage.map((u, i) => {
                const pct = (reqVals[i] / yMaxReq) * 100;
                const isHover = hoveredIdx === i;
                const isPeak = show.requests && i === peakIdx && primary === "requests";
                return (
                  <div
                    key={i}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      position: "relative",
                      backgroundColor: isHover
                        ? "color-mix(in srgb, var(--vscode-foreground) 6%, transparent)"
                        : "transparent",
                      borderRadius: "4px",
                    }}
                  >
                    {show.requests && reqVals[i] > 0 && (
                      <div
                        className="zen-usage-bar"
                        style={{
                          position: "absolute",
                          left: "12%",
                          right: "12%",
                          bottom: 0,
                          height: `${pct}%`,
                          minHeight: "2px",
                          borderRadius: "3px 3px 0 0",
                          background: `linear-gradient(to top, color-mix(in srgb, ${reqColor} 35%, transparent), ${reqColor})`,
                          opacity: isHover || isPeak ? 1 : 0.6,
                          filter: isPeak ? `drop-shadow(0 0 6px color-mix(in srgb, ${reqColor} 60%, transparent))` : "none",
                        }}
                      />
                    )}
                  </div>
                );
              })}
            </div>

            {/* Line + area: Tokens */}
            {show.tokens && (
              <svg
                viewBox={`0 0 ${CHART_W} ${CHART_H}`}
                preserveAspectRatio="none"
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  overflow: "visible",
                  pointerEvents: "none",
                }}
              >
                <defs>
                  <linearGradient id="duc-tok-grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" style={{ stopColor: tokColor }} stopOpacity="0.22" />
                    <stop offset="100%" style={{ stopColor: tokColor }} stopOpacity="0" />
                  </linearGradient>
                </defs>
                {tokArea && <path d={tokArea} fill="url(#duc-tok-grad)" />}
                {tokLine && (
                  <path
                    d={tokLine}
                    fill="none"
                    stroke={tokColor}
                    strokeWidth="2"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                  />
                )}
              </svg>
            )}

            {/* Dot trên đường tokens khi hover */}
            {show.tokens && hoveredIdx !== null && (
              <div
                style={{
                  position: "absolute",
                  left: `${((hoveredIdx + 0.5) / n) * 100}%`,
                  top: `${(1 - tokVals[hoveredIdx] / yMaxTok) * 100}%`,
                  width: 10,
                  height: 10,
                  borderRadius: "50%",
                  transform: "translate(-50%, -50%)",
                  backgroundColor: tokColor,
                  border: "2px solid var(--vscode-editor-background, #1e1e1e)",
                  boxShadow: `0 0 0 3px color-mix(in srgb, ${tokColor} 30%, transparent)`,
                  boxSizing: "border-box",
                  pointerEvents: "none",
                }}
              />
            )}

            {isEmpty && (
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "11px",
                  fontStyle: "italic",
                  color: "var(--vscode-descriptionForeground)",
                  opacity: 0.6,
                  pointerEvents: "none",
                }}
              >
                No usage in this period
              </div>
            )}
          </div>

          {/* X-axis labels */}
          <div
            ref={containerRef}
            style={{ position: "relative", height: "12px", marginTop: "6px" }}
          >
            {xLabels.map((i) => (
              <span
                key={i}
                style={{
                  position: "absolute",
                  left: `${((i + 0.5) / n) * 100}%`,
                  transform: "translateX(-50%)",
                  fontSize: "9px",
                  lineHeight: "12px",
                  color: "var(--vscode-descriptionForeground)",
                  opacity: hoveredIdx === i ? 1 : 0.6,
                  whiteSpace: "nowrap",
                }}
              >
                {formatTick(usage[i].date, period)}
              </span>
            ))}
          </div>
        </div>

        {/* Right axis (Tokens) */}
        <div
          style={{
            position: "relative",
            width: "32px",
            flexShrink: 0,
            marginBottom: "18px",
            opacity: show.tokens ? 1 : 0.25,
          }}
        >
          {Array.from({ length: Y_TICKS + 1 }, (_, i) => (
            <span
              key={i}
              style={{
                position: "absolute",
                left: 0,
                top: `${(i / Y_TICKS) * 100}%`,
                transform: "translateY(-50%)",
                fontSize: "9px",
                lineHeight: 1,
                color: tokColor,
                opacity: 0.75,
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {formatValue((yMaxTok * (Y_TICKS - i)) / Y_TICKS, "tokens")}
            </span>
          ))}
        </div>
      </div>

      {/* Tooltip */}
      {hoveredIdx !== null &&
        tooltipPos &&
        (() => {
          const entry = usage[hoveredIdx];
          const left = Math.min(Math.max(tooltipPos.x, 90), window.innerWidth - 90);
          const rows: { m: Metric; value: number; total: number }[] = [
            { m: "requests", value: entry.requests, total: totalReq },
            { m: "tokens", value: entry.tokens, total: totalTok },
          ];
          return (
            <div
              style={{
                position: "fixed",
                left,
                top: tooltipPos.y - 12,
                transform: "translate(-50%, -100%)",
                backgroundColor: "var(--vscode-editorHoverWidget-background, #1e1e1e)",
                border: "1px solid var(--vscode-editorHoverWidget-border, rgba(128,128,128,0.3))",
                borderRadius: "6px",
                padding: "7px 10px",
                fontSize: "11px",
                color: "var(--vscode-foreground)",
                pointerEvents: "none",
                zIndex: 9999,
                whiteSpace: "nowrap",
                boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
              }}
            >
              <div style={{ fontWeight: 600, marginBottom: "4px" }}>
                {formatTooltipHeader(entry.date, period)}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                {rows.map(({ m, value, total }) => (
                  <div
                    key={m}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "14px",
                      opacity: show[m] ? 1 : 0.45,
                    }}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                      <span
                        style={{
                          width: 6,
                          height: 6,
                          borderRadius: m === "requests" ? "1px" : "50%",
                          backgroundColor: METRIC_META[m].color,
                        }}
                      />
                      {METRIC_META[m].label}
                    </span>
                    <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
                      {value.toLocaleString()}
                      <span
                        style={{
                          marginLeft: "6px",
                          fontWeight: 400,
                          fontSize: "10px",
                          color: "var(--vscode-descriptionForeground)",
                        }}
                      >
                        {total > 0 ? ((value / total) * 100).toFixed(1) : "0.0"}%
                      </span>
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })()}
    </div>
  );
};

export default DailyUsageChart;