import React, { useRef, useState, useEffect } from "react";

interface HourEntry { date: string; requests: number; tokens: number; }
interface Props { usage: HourEntry[]; title: string; }

const LINE_COLOR = "#3b82f6";
const CHART_H = 60;
const CHART_W = 600; // viewBox width, scales with container
const HOURS = Array.from({ length: 24 }, (_, i) => i);

const DailyUsageChart: React.FC<Props> = ({ usage, title }) => {
  const [tooltip, setTooltip] = useState<{ hour: number; svgX: number; svgY: number } | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(200);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setContainerWidth(entry.contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

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

  // Build polyline points for past/present hours only
  const pastPoints = HOURS.filter((h) => h <= currentHour)
    .map((h) => `${xOf(h)},${yOf(h)}`).join(" ");

  // Future line (flat at bottom or dashed)
  const futurePoints = HOURS.filter((h) => h >= currentHour)
    .map((h) => `${xOf(h)},${CHART_H}`).join(" ");

  // Area fill under past line
  const areaPoints = [
    `${xOf(0)},${CHART_H}`,
    ...HOURS.filter((h) => h <= currentHour).map((h) => `${xOf(h)},${yOf(h)}`),
    `${xOf(currentHour)},${CHART_H}`,
  ].join(" ");

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

  return (
    <div style={{
      backgroundColor: "var(--vscode-sideBar-background, rgba(0,0,0,0.15))",
      border: "1px solid var(--vscode-widget-border, rgba(128,128,128,0.15))",
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
          {pastPoints && (
            <polygon points={areaPoints} fill="url(#lineAreaGrad)" />
          )}

          {/* Past line */}
          {pastPoints && (
            <polyline points={pastPoints} fill="none" stroke={LINE_COLOR} strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
          )}

          {/* Future overlay rect */}
          <rect
            x={xOf(currentHour)}
            y={0}
            width={CHART_W - xOf(currentHour)}
            height={CHART_H}
            fill="rgba(0,0,0,0.35)"
          />

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
