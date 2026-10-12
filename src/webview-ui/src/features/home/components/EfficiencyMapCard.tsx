/**
 * ------------------------------------------------------------------
 * EfficiencyMapCard
 * ------------------------------------------------------------------
 * Biểu đồ phân tán cho thấy "kiểu dùng" của từng account.
 *
 * Main features:
 * - Mỗi account là một chấm: x = số requests, y = tokens trung bình/request,
 *   kích thước = tổng tokens, màu = provider
 * - Cả hai trục dùng thang log để các account chênh lệch lớn vẫn đọc được
 * - Dùng toàn bộ account có dữ liệu, không giới hạn top N
 * - Vẽ theo bề rộng thật của card (ResizeObserver) nên chữ không bị phóng to
 * - Hover chấm: highlight + custom tooltip (portal ra body, kẹp trong viewport)
 * - Legend theo provider kèm favicon và số account
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── React ──
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

// ── Utils ──
import { ACCOUNT_COLORS, AccountStat, formatTokens } from "../utils/format";

// ─── Interfaces ─────────────────────────────────────────────────────────
interface Props {
  accounts: AccountStat[];
  providerFavicons: Record<string, string>;
  title: string;
}

interface Point {
  id: string;
  email: string;
  providerId: string;
  requests: number;
  tokens: number;
  avg: number;
  color: string;
}

interface TipState {
  p: Point;
  x: number;
  y: number;
}

// ─── Constants ──────────────────────────────────────────────────────────
const HEIGHT = 250;
const PAD = { top: 12, right: 16, bottom: 36, left: 46 };
const R_MIN = 4;
const R_MAX = 13;
const TOOLTIP_W = 232;
const TOOLTIP_H = 150; // ước lượng để quyết định lật tooltip lên trên
const EDGE = 8;
const GRID = "var(--vscode-widget-border, rgba(128,128,128,0.18))";
const MUTED = "var(--vscode-descriptionForeground)";

// ─── Helpers ────────────────────────────────────────────────────────────
const log = (v: number) => Math.log10(Math.max(v, 1));

/** Các mốc 1, 10, 100, ... nằm trong [min, max]; ít hơn 2 mốc thì dùng chính min/max. */
function logTicks(min: number, max: number): number[] {
  const t: number[] = [];
  for (let k = Math.ceil(log(min)); k <= Math.floor(log(max)); k++) {
    t.push(10 ** k);
  }
  return t.length >= 2 ? t : [...new Set([Math.round(min), Math.round(max)])];
}

/** Mở rộng khoảng log một chút để chấm không dính mép; đảm bảo độ rộng tối thiểu. */
function logDomain(min: number, max: number): [number, number] {
  let lo = log(min) - 0.15;
  let hi = log(max) + 0.15;
  if (hi - lo < 0.5) {
    const mid = (hi + lo) / 2;
    lo = mid - 0.25;
    hi = mid + 0.25;
  }
  return [lo, hi];
}

const TipRow: React.FC<{ label: string; value: string }> = ({
  label,
  value,
}) => (
  <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      gap: "16px",
      fontSize: "11px",
    }}
  >
    <span style={{ color: MUTED }}>{label}</span>
    <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
      {value}
    </span>
  </div>
);

// ─── Component ──────────────────────────────────────────────────────────
const EfficiencyMapCard: React.FC<Props> = ({
  accounts,
  providerFavicons,
  title,
}) => {
  // ── State / Refs ──
  const [tip, setTip] = useState<TipState | null>(null);
  const [width, setWidth] = useState(480);
  const wrapRef = useRef<HTMLDivElement>(null);

  // Theo dõi bề rộng thật của vùng vẽ
  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const ro = new ResizeObserver((entries) => {
      const w = Math.floor(entries[0].contentRect.width);
      if (w > 0) setWidth(w);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // ── Derived ──
  const { points, providers, maxTokens } = useMemo(() => {
    const valid = accounts.filter(
      (a) => (a.total_tokens ?? 0) > 0 && (a.total_requests ?? 0) > 0,
    );

    // Màu theo provider, xếp theo tổng tokens giảm dần
    const byProvider = new Map<string, { tokens: number; count: number }>();
    valid.forEach((a) => {
      const cur = byProvider.get(a.provider_id) ?? { tokens: 0, count: 0 };
      byProvider.set(a.provider_id, {
        tokens: cur.tokens + (a.total_tokens ?? 0),
        count: cur.count + 1,
      });
    });
    const providers = [...byProvider.entries()]
      .sort((a, b) => b[1].tokens - a[1].tokens)
      .map(([id, v], i) => ({
        id,
        count: v.count,
        color: ACCOUNT_COLORS[i % ACCOUNT_COLORS.length],
      }));
    const colorOf = new Map(providers.map((p) => [p.id, p.color]));

    const points: Point[] = valid
      .map((a) => {
        const tokens = a.total_tokens ?? 0;
        const requests = a.total_requests ?? 0;
        return {
          id: a.id,
          email: a.email,
          providerId: a.provider_id,
          requests,
          tokens,
          avg: tokens / requests,
          color: colorOf.get(a.provider_id) ?? ACCOUNT_COLORS[0],
        };
      })
      // Chấm lớn vẽ trước, chấm nhỏ nằm trên nên vẫn hover được
      .sort((a, b) => b.tokens - a.tokens);

    return {
      points,
      providers,
      maxTokens: points[0]?.tokens || 1,
    };
  }, [accounts]);

  const geo = useMemo(() => {
    if (points.length === 0) return null;
    const reqs = points.map((p) => p.requests);
    const avgs = points.map((p) => p.avg);
    const [lx0, lx1] = logDomain(Math.min(...reqs), Math.max(...reqs));
    const [ly0, ly1] = logDomain(Math.min(...avgs), Math.max(...avgs));
    const innerW = Math.max(width - PAD.left - PAD.right, 1);
    const innerH = HEIGHT - PAD.top - PAD.bottom;
    return {
      sx: (v: number) => PAD.left + ((log(v) - lx0) / (lx1 - lx0)) * innerW,
      sy: (v: number) => PAD.top + innerH - ((log(v) - ly0) / (ly1 - ly0)) * innerH,
      xTicks: logTicks(Math.min(...reqs), Math.max(...reqs)),
      yTicks: logTicks(Math.min(...avgs), Math.max(...avgs)),
    };
  }, [points, width]);

  // ── Handlers ──
  const handleEnter = useCallback(
    (e: React.MouseEvent<SVGCircleElement>, p: Point) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const maxX = window.innerWidth - TOOLTIP_W - EDGE;
      const x = Math.max(EDGE, Math.min(rect.right + 8, maxX));
      const below = rect.top;
      const y =
        below + TOOLTIP_H > window.innerHeight
          ? Math.max(EDGE, window.innerHeight - TOOLTIP_H - EDGE)
          : Math.max(EDGE, below - 8);
      setTip({ p, x, y });
    },
    [],
  );
  const handleLeave = useCallback(() => setTip(null), []);

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
        gap: "10px",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
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
        {points.length > 0 && (
          <span
            style={{
              fontSize: "10px",
              fontWeight: 600,
              padding: "2px 8px",
              borderRadius: "5px",
              color: MUTED,
              backgroundColor:
                "color-mix(in srgb, var(--vscode-foreground) 6%, transparent)",
            }}
          >
            {points.length} accounts
          </span>
        )}
      </div>

      {!geo ? (
        <span style={{ fontSize: "11px", opacity: 0.5, fontStyle: "italic" }}>
          No data
        </span>
      ) : (
        <>
          {/* Chart */}
          <div ref={wrapRef} style={{ width: "100%" }}>
            <svg
              width={width}
              height={HEIGHT}
              style={{ display: "block" }}
              onMouseLeave={handleLeave}
            >
              {/* Gridlines + tick labels */}
              {geo.yTicks.map((t) => (
                <g key={`y${t}`}>
                  <line
                    x1={PAD.left}
                    x2={width - PAD.right}
                    y1={geo.sy(t)}
                    y2={geo.sy(t)}
                    stroke={GRID}
                    strokeDasharray="3 4"
                  />
                  <text
                    x={PAD.left - 8}
                    y={geo.sy(t)}
                    textAnchor="end"
                    dominantBaseline="middle"
                    style={{ fontSize: "10px", fill: MUTED }}
                  >
                    {formatTokens(t)}
                  </text>
                </g>
              ))}
              {geo.xTicks.map((t) => (
                <g key={`x${t}`}>
                  <line
                    x1={geo.sx(t)}
                    x2={geo.sx(t)}
                    y1={PAD.top}
                    y2={HEIGHT - PAD.bottom}
                    stroke={GRID}
                    strokeDasharray="3 4"
                  />
                  <text
                    x={geo.sx(t)}
                    y={HEIGHT - PAD.bottom + 14}
                    textAnchor="middle"
                    style={{ fontSize: "10px", fill: MUTED }}
                  >
                    {formatTokens(t)}
                  </text>
                </g>
              ))}

              {/* Axis titles */}
              <text
                x={PAD.left + (width - PAD.left - PAD.right) / 2}
                y={HEIGHT - 4}
                textAnchor="middle"
                style={{ fontSize: "10px", fill: MUTED }}
              >
                Requests (log)
              </text>
              <text
                transform={`translate(11 ${PAD.top + (HEIGHT - PAD.top - PAD.bottom) / 2}) rotate(-90)`}
                textAnchor="middle"
                style={{ fontSize: "10px", fill: MUTED }}
              >
                Avg tokens / request (log)
              </text>

              {/* Points */}
              {points.map((p) => {
                const r = R_MIN + (R_MAX - R_MIN) * Math.sqrt(p.tokens / maxTokens);
                const active = tip?.p.id === p.id;
                const dim = tip !== null && !active;
                return (
                  <circle
                    key={p.id}
                    cx={geo.sx(p.requests)}
                    cy={geo.sy(p.avg)}
                    r={active ? r + 1.5 : r}
                    onMouseEnter={(e) => handleEnter(e, p)}
                    style={{
                      cursor: "default",
                      fill: `color-mix(in srgb, ${p.color} ${active ? 60 : 32}%, transparent)`,
                      stroke: p.color,
                      strokeWidth: active ? 2 : 1.25,
                      opacity: dim ? 0.35 : 1,
                      transition: "opacity 0.15s ease, r 0.15s ease",
                    }}
                  />
                );
              })}
            </svg>
          </div>

          {/* Legend */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              gap: "6px 14px",
              fontSize: "11px",
            }}
          >
            {providers.map((pv) => {
              const favicon = providerFavicons[pv.id];
              return (
                <span
                  key={pv.id}
                  style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}
                >
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: "50%",
                      backgroundColor: pv.color,
                    }}
                  />
                  {favicon && (
                    <img
                      src={favicon}
                      alt=""
                      width={12}
                      height={12}
                      style={{ borderRadius: "2px" }}
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                      }}
                    />
                  )}
                  <span>{pv.id}</span>
                  <span style={{ color: MUTED }}>({pv.count})</span>
                </span>
              );
            })}
            <span style={{ marginLeft: "auto", fontSize: "10px", color: MUTED }}>
              Chấm lớn = nhiều tokens
            </span>
          </div>
        </>
      )}

      {/* Custom tooltip */}
      {tip &&
        createPortal(
          <div
            style={{
              position: "fixed",
              left: tip.x,
              top: tip.y,
              width: TOOLTIP_W,
              boxSizing: "border-box",
              padding: "10px 12px",
              borderRadius: "8px",
              zIndex: 10000,
              pointerEvents: "none",
              display: "flex",
              flexDirection: "column",
              gap: "6px",
              color: "var(--vscode-editorHoverWidget-foreground, var(--vscode-foreground))",
              backgroundColor: "var(--vscode-editorHoverWidget-background, #252526)",
              border:
                "1px solid var(--vscode-editorHoverWidget-border, rgba(128,128,128,0.35))",
              boxShadow: "0 6px 20px rgba(0,0,0,0.35)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  flexShrink: 0,
                  backgroundColor: tip.p.color,
                }}
              />
              <span
                style={{ fontSize: "12px", fontWeight: 600, wordBreak: "break-all" }}
              >
                {tip.p.email}
              </span>
            </div>
            <div style={{ fontSize: "10px", color: MUTED }}>{tip.p.providerId}</div>
            <div
              style={{
                height: "1px",
                backgroundColor: "var(--vscode-widget-border, rgba(128,128,128,0.2))",
              }}
            />
            <TipRow label="Requests" value={tip.p.requests.toLocaleString()} />
            <TipRow label="Tokens" value={tip.p.tokens.toLocaleString()} />
            <TipRow
              label="Avg tokens / request"
              value={Math.round(tip.p.avg).toLocaleString()}
            />
          </div>,
          document.body,
        )}
    </div>
  );
};

export default EfficiencyMapCard;