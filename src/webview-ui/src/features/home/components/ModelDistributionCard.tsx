import React, { useState } from "react";

const COLORS = [
  "var(--vscode-textLink-foreground, #3b82f6)",
  "var(--vscode-editorWarning-foreground, #d97706)",
  "var(--vscode-symbolIcon-namespaceForeground, #8b5cf6)",
  "var(--vscode-gitDecoration-addedResourceForeground, #10b981)",
  "var(--vscode-errorForeground, #f43f5e)",
];
const COLLAPSE_THRESHOLD = 4;
const SIZE = 96;
const STROKE = 11;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;
const GAP_DEG = 0;

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

interface TooltipState {
  index: number;
  x: number;
  y: number;
}

const ModelDistributionCard: React.FC<Props> = ({
  modelDistribution, providerFavicons, title, emptyText,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);

  const total = modelDistribution.reduce((s, m) => s + m.total_requests, 0) || 1;
  const visible = expanded ? modelDistribution : modelDistribution.slice(0, COLLAPSE_THRESHOLD);
  const hasMore = modelDistribution.length > COLLAPSE_THRESHOLD;

  // Build SVG arcs
  const arcs = (() => {
    if (modelDistribution.length === 0) return [];
    const gapRad = (GAP_DEG / 360) * CIRC;
    const totalGap = gapRad * modelDistribution.length;
    const usable = CIRC - totalGap;
    let offset = 0; // start from top (rotate -90 applied on group)
    return modelDistribution.map((m, i) => {
      const dash = (m.total_requests / total) * usable;
      const arc = { index: i, dash, gap: CIRC - dash, offset, color: COLORS[i % COLORS.length], model: m };
      offset += dash + gapRad;
      return arc;
    });
  })();

  const cx = SIZE / 2;
  const cy = SIZE / 2;

  return (
    <div style={{
      backgroundColor: "var(--vscode-sideBar-background, rgba(0,0,0,0.15))",
      border: "1px solid var(--vscode-widget-border, rgba(128,128,128,0.15))",
      borderRadius: "8px",
      padding: "14px",
      boxSizing: "border-box",
    }}>
      {/* Title */}
      <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--vscode-foreground)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px", opacity: 0.8 }}>
        {title}
      </div>

      {modelDistribution.length === 0 ? (
        <span style={{ fontSize: "11px", opacity: 0.5, fontStyle: "italic" }}>{emptyText}</span>
      ) : (
        <div style={{ display: "flex", gap: "16px", alignItems: "flex-start" }}>
          {/* Circle */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <svg width={SIZE} height={SIZE} style={{ display: "block" }}>
              {/* Track */}
              <circle cx={cx} cy={cy} r={R} fill="none"
                stroke="var(--vscode-widget-border, rgba(128,128,128,0.15))"
                strokeWidth={STROKE} />
              {/* Arcs */}
              <g transform={`rotate(-90 ${cx} ${cy})`}>
                {arcs.map((arc) => (
                  <circle
                    key={arc.index}
                    cx={cx} cy={cy} r={R}
                    fill="none"
                    stroke={arc.color}
                    strokeWidth={STROKE}
                    strokeDasharray={`${arc.dash} ${arc.gap}`}
                    strokeDashoffset={-arc.offset}
                    strokeLinecap="butt"
                    style={{ cursor: "pointer" }}
                    onMouseEnter={(e) => {
                      const rect = (e.currentTarget.closest("svg") as SVGSVGElement).getBoundingClientRect();
                      setTooltip({ index: arc.index, x: rect.left + SIZE / 2, y: rect.top });
                    }}
                    onMouseLeave={() => setTooltip(null)}
                  />
                ))}
              </g>
              {/* Center label */}
              <text x={cx} y={cy - 6} textAnchor="middle" dominantBaseline="middle"
                style={{ fontSize: "17px", fontWeight: 700, fill: "var(--vscode-foreground)" }}>
                {modelDistribution.length}
              </text>
              <text x={cx} y={cy + 11} textAnchor="middle" dominantBaseline="middle"
                style={{ fontSize: "10px", fill: "var(--vscode-descriptionForeground)" }}>
                models
              </text>
            </svg>

            {/* Tooltip */}
            {tooltip !== null && (() => {
              const m = modelDistribution[tooltip.index];
              const pct = Math.round((m.total_requests / total) * 100);
              return (
                <div style={{
                  position: "fixed",
                  left: tooltip.x,
                  top: tooltip.y - 8,
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
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "4px" }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: COLORS[tooltip.index % COLORS.length], flexShrink: 0 }} />
                    <span style={{ fontWeight: 600 }}>{m.model_id}</span>
                  </div>
                  <div style={{ opacity: 0.75, lineHeight: 1.6 }}>
                    <div>{m.total_requests} requests ({pct}%)</div>
                    <div>{m.total_tokens.toLocaleString()} tokens</div>
                    <div style={{ fontSize: "10px", opacity: 0.6 }}>{m.provider_id}</div>
                  </div>
                </div>
              );
            })()}
          </div>

          {/* Model list — grid */}
          <div style={{ flex: 1, minWidth: 0, display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", alignContent: "start" }}>
            {visible.map((m, i) => {
              const pct = Math.round((m.total_requests / total) * 100);
              const favicon = providerFavicons[m.provider_id];
              const isLong = m.model_id.length > 18;
              return (
                <div key={m.model_id} style={{ display: "flex", alignItems: "center", gap: "5px", minWidth: 0, ...(isLong ? { gridColumn: "1 / -1" } : {}) }}>
                  <div style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: COLORS[i % COLORS.length], flexShrink: 0 }} />
                  {favicon && (
                    <img src={favicon} alt="" width={13} height={13} style={{ borderRadius: "2px", flexShrink: 0 }}
                      onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                  )}
                  <span style={{ fontSize: "12px", fontWeight: 500, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
                    {m.model_id} <span style={{ opacity: 0.6, fontWeight: 400 }}>{pct}%</span>
                  </span>
                </div>
              );
            })}

            {hasMore && (
              <button
                onClick={() => setExpanded((v) => !v)}
                style={{
                  gridColumn: "1 / -1",
                  background: "none", border: "none", cursor: "pointer",
                  fontSize: "11px", color: "var(--vscode-textLink-foreground, #3b82f6)",
                  padding: "2px 0", textAlign: "left", marginTop: "2px",
                }}
              >
                {expanded
                  ? "▲ Show less"
                  : `▼ +${modelDistribution.length - COLLAPSE_THRESHOLD} more`}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ModelDistributionCard;
