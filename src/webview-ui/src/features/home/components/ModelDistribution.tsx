/**
 * ------------------------------------------------------------------
 * ModelDistribution
 * ------------------------------------------------------------------
 * Card phân bố requests theo model: donut chart + danh sách model.
 *
 * Main features:
 * - Layout theo bề rộng của chính card (container query):
 *   hẹp → donut ở trên, danh sách ở dưới; rộng → donut trái, danh sách phải
 * - Donut có khe hở giữa các cung, tâm hiển thị tổng requests
 * - Mỗi model là một dòng: màu + favicon + tên + % + thanh tỷ lệ + req/tokens
 * - Hover dòng ↔ hover cung: highlight hai chiều, tâm donut hiện % của model
 * - Nội dung được canh giữa theo chiều dọc, không bị trống nửa dưới card
 * ------------------------------------------------------------------
 */

// ─── Imports ───────────────────────────────────────────────────────────
// ── React ──
import React, { useMemo, useState } from "react";

// ── Components ──
import { formatTokens } from "../utils/format";

// ─── Interfaces ─────────────────────────────────────────────────────────
interface ModelEntry {
  model_id: string;
  provider_id: string;
  total_requests: number;
  total_tokens: number;
}

interface Props {
  modelDistribution: ModelEntry[];
  providerFavicons: Record<string, string>;
  title: string;
  emptyText: string;
}

// ─── Constants ──────────────────────────────────────────────────────────
const COLORS = [
  "var(--vscode-textLink-foreground, #3b82f6)",
  "var(--vscode-editorWarning-foreground, #d97706)",
  "var(--vscode-symbolIcon-namespaceForeground, #8b5cf6)",
  "var(--vscode-gitDecoration-addedResourceForeground, #10b981)",
  "var(--vscode-errorForeground, #f43f5e)",
];
const SIZE = 120;
const STROKE = 12;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;
const ARC_GAP = 2; // khe hở giữa các cung (đơn vị chiều dài cung)
const ROW_H = 48; // chiều cao cố định mỗi dòng model (px)
const ROW_GAP = 2; // khoảng cách giữa các dòng (px)
const MAX_VISIBLE = 3; // số dòng tối đa hiển thị, vượt quá thì cuộn trong danh sách

// ─── Component ──────────────────────────────────────────────────────────
const ModelDistribution: React.FC<Props> = ({
  modelDistribution,
  providerFavicons,
  title,
  emptyText,
}) => {
  // ── State ─
  const [hovered, setHovered] = useState<number | null>(null);

  // ── Derived ──
  const n = modelDistribution.length;
  const total = modelDistribution.reduce((s, m) => s + m.total_requests, 0);
  const safeTotal = total || 1;

  const arcs = useMemo(() => {
    const gap = n > 1 ? ARC_GAP : 0;
    let offset = 0;
    return modelDistribution.map((m, i) => {
      const slice = (m.total_requests / safeTotal) * CIRC;
      const dash = Math.max(slice - gap, 0);
      const arc = { i, dash, offset: offset + gap / 2, color: COLORS[i % COLORS.length] };
      offset += slice;
      return arc;
    });
  }, [modelDistribution, safeTotal, n]);

  const cx = SIZE / 2;
  const hoveredModel = hovered !== null ? modelDistribution[hovered] : null;

  // ── Render ─
  return (
    <div
      className="zen-dist"
      style={{
        backgroundColor: "var(--vscode-editor-background, #1e1e1e)",
        borderRadius: "8px",
        padding: "14px",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        gap: "12px",
        containerType: "inline-size",
        containerName: "zen-dist",
      }}
    >
      <style>{`
        .zen-dist-body { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: flex-start; gap: 16px; min-height: 0; }
        .zen-dist-body[data-multi="true"] { justify-content: center; }
        .zen-dist-donut { width: 112px; height: 112px; flex-shrink: 0; display: block; }
        .zen-dist-list {
          width: 100%; display: flex; flex-direction: column; gap: ${ROW_GAP}px; min-width: 0;
          max-height: ${MAX_VISIBLE * ROW_H + (MAX_VISIBLE - 1) * ROW_GAP}px;
          overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain;
          scrollbar-width: thin; scrollbar-color: var(--vscode-scrollbarSlider-background, rgba(128,128,128,0.4)) transparent;
        }
        .zen-dist-list::-webkit-scrollbar { width: 6px; }
        .zen-dist-list::-webkit-scrollbar-track { background: transparent; }
        .zen-dist-list::-webkit-scrollbar-thumb { background: var(--vscode-scrollbarSlider-background, rgba(128,128,128,0.4)); border-radius: 3px; }
        .zen-dist-list::-webkit-scrollbar-thumb:hover { background: var(--vscode-scrollbarSlider-hoverBackground, rgba(128,128,128,0.6)); }
        @container zen-dist (min-width: 400px) {
          .zen-dist-body { flex-direction: row; gap: 20px; }
          .zen-dist-donut { width: 128px; height: 128px; }
          .zen-dist-list { flex: 1; width: auto; }
        }
        .zen-dist-row { transition: background-color 0.15s ease, opacity 0.15s ease; }
      `}</style>

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
        {n > 0 && (
          <span
            style={{
              fontSize: "10px",
              fontWeight: 600,
              padding: "2px 8px",
              borderRadius: "5px",
              color: "var(--vscode-descriptionForeground)",
              backgroundColor:
                "color-mix(in srgb, var(--vscode-foreground) 6%, transparent)",
            }}
          >
            {n} {n === 1 ? "model" : "models"}
          </span>
        )}
      </div>

      {n === 0 ? (
        <div
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            padding: "24px 16px",
            minHeight: "120px",
          }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.35, color: "var(--vscode-descriptionForeground)" }}>
            <circle cx="12" cy="12" r="10" />
            <path d="M12 6v6l4 2" />
          </svg>
          <span style={{ fontSize: "11px", color: "var(--vscode-descriptionForeground)", opacity: 0.7, textAlign: "center" }}>
            {emptyText}
          </span>
          <span style={{ fontSize: "10px", color: "var(--vscode-descriptionForeground)", opacity: 0.5, textAlign: "center" }}>
            Gửi tin nhắn đầu tiên để xem phân bố model
          </span>
        </div>
      ) : (
        <div className="zen-dist-body" data-multi={n > 1 ? "true" : undefined}>
          {/* Donut */}
          <svg
            className="zen-dist-donut"
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            onMouseLeave={() => setHovered(null)}
          >
            <circle
              cx={cx}
              cy={cx}
              r={R}
              fill="none"
              stroke="var(--vscode-widget-border, rgba(128,128,128,0.15))"
              strokeWidth={STROKE}
            />
            <g transform={`rotate(-90 ${cx} ${cx})`}>
              {arcs.map((a) => {
                const active = hovered === a.i;
                return (
                  <circle
                    key={a.i}
                    cx={cx}
                    cy={cx}
                    r={R}
                    fill="none"
                    stroke={a.color}
                    strokeWidth={active ? STROKE + 3 : STROKE}
                    strokeDasharray={`${a.dash} ${CIRC - a.dash}`}
                    strokeDashoffset={-a.offset}
                    strokeLinecap="butt"
                    opacity={hovered === null || active ? 1 : 0.4}
                    style={{
                      cursor: "pointer",
                      transition: "stroke-width 0.15s ease, opacity 0.15s ease",
                    }}
                    onMouseEnter={() => setHovered(a.i)}
                  />
                );
              })}
            </g>
            <text
              x={cx}
              y={cx - 5}
              textAnchor="middle"
              dominantBaseline="middle"
              style={{ fontSize: "20px", fontWeight: 700, fill: "var(--vscode-foreground)" }}
            >
              {hoveredModel
                ? `${Math.round((hoveredModel.total_requests / safeTotal) * 100)}%`
                : formatTokens(total)}
            </text>
            <text
              x={cx}
              y={cx + 14}
              textAnchor="middle"
              dominantBaseline="middle"
              style={{ fontSize: "10px", fill: "var(--vscode-descriptionForeground)" }}
            >
              {hoveredModel ? `${hoveredModel.total_requests} req` : "requests"}
            </text>
          </svg>

          {/* List */}
          <div
            className="zen-dist-list"
            style={n > MAX_VISIBLE ? { paddingRight: "4px" } : undefined}
            onMouseLeave={() => setHovered(null)}
          >
            {modelDistribution.map((m, i) => {
              const pct = (m.total_requests / safeTotal) * 100;
              const color = COLORS[i % COLORS.length];
              const favicon = providerFavicons[m.provider_id];
              const active = hovered === i;
              return (
                <div
                  key={`${m.provider_id}:${m.model_id}`}
                  className="zen-dist-row"
                  title={`${m.model_id} · ${m.provider_id}\n${m.total_requests} requests · ${m.total_tokens.toLocaleString()} tokens`}
                  onMouseEnter={() => setHovered(i)}
                  style={{
                    height: `${ROW_H}px`,
                    flexShrink: 0,
                    boxSizing: "border-box",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                    padding: "6px 8px",
                    borderRadius: "6px",
                    backgroundColor: active
                      ? "color-mix(in srgb, var(--vscode-foreground) 6%, transparent)"
                      : "transparent",
                    opacity: hovered === null || active ? 1 : 0.55,
                    minWidth: 0,
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      minWidth: 0,
                    }}
                  >
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: "2px",
                        backgroundColor: color,
                        flexShrink: 0,
                      }}
                    />
                    {favicon && (
                      <img
                        src={favicon}
                        alt=""
                        width={13}
                        height={13}
                        style={{ borderRadius: "2px", flexShrink: 0 }}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                    )}
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        fontSize: "12px",
                        fontWeight: 500,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {m.model_id}
                    </span>
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: 700,
                        fontVariantNumeric: "tabular-nums",
                        flexShrink: 0,
                      }}
                    >
                      {Math.round(pct)}%
                    </span>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(0, 1fr) auto",
                      alignItems: "center",
                      gap: "10px",
                      marginTop: "5px",
                    }}
                  >
                    <div
                      style={{
                        height: "4px",
                        borderRadius: "2px",
                        overflow: "hidden",
                        backgroundColor:
                          "var(--vscode-widget-border, rgba(128,128,128,0.15))",
                      }}
                    >
                      <div
                        style={{
                          width: `${pct}%`,
                          height: "100%",
                          backgroundColor: color,
                          borderRadius: "2px",
                        }}
                      />
                    </div>
                    <span
                      style={{
                        fontSize: "10px",
                        color: "var(--vscode-descriptionForeground)",
                        fontVariantNumeric: "tabular-nums",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {m.total_requests} req · {formatTokens(m.total_tokens)}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelDistribution;