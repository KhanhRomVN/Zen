/**
 * ------------------------------------------------------------------
 * StatsPeriodPicker
 * ------------------------------------------------------------------
 * 1 hàng duy nhất: [Dropdown chip period] [← Label ↺ →]
 * - Chip mở dropdown chọn Day / Week / Month / Year / All
 * - Nav bar: chevron trái (older) · label · reset · chevron phải (newer)
 * - Nav bar mờ khi period = "all"
 * - Reset button ẩn khi offset = 0, không có background
 * - Label Week/Month/Year/All hiển thị dạng "dd/mm/yyyy – dd/mm/yyyy"
 * - Keyboard: ← → đổi offset · Esc đóng dropdown
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
import React, { useMemo, useRef, useState, useEffect, useCallback } from "react";
import { StatsPeriod } from "../hooks/useStatsPeriod";

// ─── Types ──────────────────────────────────────────────────────────────
interface StatsPeriodPickerProps {
  period: StatsPeriod;
  offset: number;
  onPeriodChange: (period: StatsPeriod) => void;
  onOffsetChange: (offset: number) => void;
}

// ─── Constants ──────────────────────────────────────────────────────────
const TABS: { id: StatsPeriod; label: string }[] = [
  { id: "day",   label: "Day"   },
  { id: "week",  label: "Week"  },
  { id: "month", label: "Month" },
  { id: "year",  label: "Year"  },
  { id: "all",   label: "All"   },
];

const MAX_OFFSET: Record<StatsPeriod, number> = {
  day: 364, week: 52, month: 23, year: 9, all: 0,
};

// ─── Helpers ────────────────────────────────────────────────────────────
/** Format date as dd/mm/yyyy */
function fmtDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}/${mm}/${yyyy}`;
}

function getOffsetLabel(period: StatsPeriod, offset: number): string {
  const now = new Date();

  switch (period) {
    case "day": {
      const d = new Date(now);
      d.setDate(d.getDate() - offset);
      if (offset === 0) return "Today";
      if (offset === 1) return "Yesterday";
      return fmtDate(d);
    }
    case "week": {
      const end = new Date(now);
      end.setDate(end.getDate() - offset * 7);
      end.setHours(23, 59, 59, 999);
      const start = new Date(end);
      start.setDate(start.getDate() - 6);
      start.setHours(0, 0, 0, 0);
      return `${fmtDate(start)} – ${fmtDate(end)}`;
    }
    case "month": {
      const start = new Date(now.getFullYear(), now.getMonth() - offset, 1);
      const end = new Date(now.getFullYear(), now.getMonth() - offset + 1, 0);
      return `${fmtDate(start)} – ${fmtDate(end)}`;
    }
    case "year": {
      const y = now.getFullYear() - offset;
      const start = new Date(y, 0, 1);
      const end = new Date(y, 11, 31);
      return `${fmtDate(start)} – ${fmtDate(end)}`;
    }
    case "all": {
      return "All time";
    }
    default: return "";
  }
}

// ─── Styles ─────────────────────────────────────────────────────────────
const styles = `
  /* ── Row container ── */
  .zpp-row {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 6px;
    height: 34px;
    margin-bottom: 12px;
  }

  /* ── Dropdown chip ── */
  .zpp-dd { position: relative; flex-shrink: 0; }
  .zpp-chip {
    display: flex; align-items: center;
    height: 34px; padding: 0 12px;
    border-radius: 7px;
    border: 1px solid var(--vscode-widget-border, rgba(255,255,255,.07));
    background: var(--vscode-editor-background, #1e1e1e);
    color: var(--vscode-foreground, #eceff7);
    cursor: pointer;
    font-size: 12px; font-weight: 600;
    transition: background .15s, border-color .15s;
    white-space: nowrap;
    outline: none;
  }
  .zpp-chip:hover, .zpp-dd.open .zpp-chip {
    background: rgba(139,123,255,.12);
    border-color: rgba(139,123,255,.4);
  }

  /* ── Dropdown menu ── */
  .zpp-menu {
    position: absolute; top: calc(100% + 5px); left: 0; z-index: 20;
    min-width: 120px; padding: 4px;
    border-radius: 8px;
    background: var(--vscode-editorWidget-background, #1e1e1e);
    border: 1px solid var(--vscode-widget-border, rgba(255,255,255,.07));
    box-shadow: 0 10px 28px rgba(0,0,0,.45);
    opacity: 0; transform: translateY(-4px) scale(.98); transform-origin: top left;
    pointer-events: none;
    transition: opacity .14s, transform .14s;
  }
  .zpp-dd.open .zpp-menu {
    opacity: 1; transform: none; pointer-events: auto;
  }
  .zpp-opt {
    display: flex; align-items: center; justify-content: space-between; gap: 10px;
    width: 100%; border: 0; padding: 6px 8px; border-radius: 6px;
    background: transparent;
    color: var(--vscode-foreground, #eceff7);
    cursor: pointer; font-size: 12px; text-align: left;
    outline: none;
  }
  .zpp-opt:hover { background: rgba(139,123,255,.12); }
  .zpp-opt-check { opacity: 0; color: var(--vscode-focusBorder, #8b7bff); flex-shrink: 0; }
  .zpp-opt.active { font-weight: 600; }
  .zpp-opt.active .zpp-opt-check { opacity: 1; }

  /* ── Nav bar ── */
  .zpp-nav {
    flex: 1; display: flex; align-items: center;
    height: 34px; min-width: 0;
    border-radius: 7px;
    border: 1px solid var(--vscode-widget-border, rgba(255,255,255,.07));
    background: var(--vscode-editor-background, #1e1e1e);
    padding: 0 3px;
    transition: opacity .2s;
  }
  .zpp-nav.off { opacity: .4; pointer-events: none; }

  .zpp-ib {
    width: 26px; height: 26px; flex-shrink: 0;
    display: grid; place-items: center;
    border: 0; border-radius: 5px; background: transparent;
    color: var(--vscode-descriptionForeground, #8a93a8);
    cursor: pointer;
    transition: background .15s, color .15s, transform .1s;
    padding: 0;
    outline: none;
  }
  .zpp-ib:hover:not(:disabled) {
    background: rgba(139,123,255,.12);
    color: var(--vscode-foreground, #eceff7);
  }
  .zpp-ib:active:not(:disabled) { transform: scale(.88); }
  .zpp-ib:disabled { opacity: .25; cursor: default; }

  /* middle: label + reset */
  .zpp-mid {
    flex: 1; display: flex; align-items: center; justify-content: center;
    gap: 5px; min-width: 0;
  }
  .zpp-lbl {
    font-size: 12px; font-weight: 600;
    color: var(--vscode-foreground, #eceff7);
    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
  }
  .zpp-lbl.anim { animation: zpp-swap .22s ease both; }
  @keyframes zpp-swap {
    from { opacity: 0; transform: translateX(calc(var(--zpp-dir, 1) * 8px)); }
    to   { opacity: 1; transform: none; }
  }

  /* reset button — no background */
  .zpp-rst {
    display: grid; place-items: center;
    width: 18px; height: 18px; flex-shrink: 0;
    border: 0; border-radius: 50%;
    background: transparent;
    color: var(--vscode-descriptionForeground, #8a93a8);
    cursor: pointer;
    padding: 0;
    outline: none;
    transition: color .15s, transform .2s;
  }
  .zpp-rst:hover {
    color: var(--vscode-foreground, #eceff7);
    transform: rotate(-45deg);
  }

  @media (prefers-reduced-motion: reduce) {
    .zpp-lbl.anim, .zpp-menu, .zpp-rst { animation: none; transition: none; }
  }
`;

// ─── SVG icons ──────────────────────────────────────────────────────────
const IconCheck = () => (
  <svg className="zpp-opt-check" width="12" height="12" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5"/>
  </svg>
);
const IconLeft = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="m15 18-6-6 6-6"/>
  </svg>
);
const IconRight = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
    <path d="m9 18 6-6-6-6"/>
  </svg>
);
const IconReset = () => (
  <svg width="10" height="10" viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>
  </svg>
);

// ─── Component ──────────────────────────────────────────────────────────
const StatsPeriodPicker: React.FC<StatsPeriodPickerProps> = ({
  period,
  offset,
  onPeriodChange,
  onOffsetChange,
}) => {
  const [open, setOpen] = useState(false);
  const dirRef = useRef<1 | -1>(1);
  const [animKey, setAnimKey] = useState(0);
  const ddRef = useRef<HTMLDivElement>(null);

  const label = useMemo(() => getOffsetLabel(period, offset), [period, offset]);
  const isAll = period === "all";
  const maxOffset = MAX_OFFSET[period];

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ddRef.current && !ddRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const go = useCallback((delta: number) => {
    const next = offset + delta;
    if (next < 0 || next > maxOffset) return;
    dirRef.current = delta > 0 ? -1 : 1;
    setAnimKey(k => k + 1);
    onOffsetChange(next);
  }, [offset, maxOffset, onOffsetChange]);

  const handlePeriodChange = (p: StatsPeriod) => {
    dirRef.current = 1;
    setAnimKey(k => k + 1);
    onPeriodChange(p);
    setOpen(false);
  };

  const handleReset = () => {
    dirRef.current = 1;
    setAnimKey(k => k + 1);
    onOffsetChange(0);
  };



  return (
    <>
      <style>{styles}</style>
      <div className="zpp-row">

        {/* ── Dropdown chip ── */}
        <div className={`zpp-dd${open ? " open" : ""}`} ref={ddRef}>
          <button
            className="zpp-chip"
            aria-haspopup="menu"
            aria-expanded={open}
            onClick={() => setOpen(v => !v)}
          >
            {TABS.find(t => t.id === period)?.label}
          </button>

          <div className="zpp-menu" role="menu">
            {TABS.map(tab => (
              <button
                key={tab.id}
                role="menuitemradio"
                aria-checked={period === tab.id}
                className={`zpp-opt${period === tab.id ? " active" : ""}`}
                onClick={() => handlePeriodChange(tab.id)}
              >
                <span>{tab.label}</span>
                <IconCheck />
              </button>
            ))}
          </div>
        </div>

        {/* ── Nav bar ── */}
        <div className={`zpp-nav${isAll ? " off" : ""}`}>
          {/* older → offset + 1 */}
          <button
            className="zpp-ib"
            aria-label="Older"
            disabled={isAll || offset >= maxOffset}
            onClick={() => go(1)}
          >
            <IconLeft />
          </button>

          <div className="zpp-mid">
            <span
              className="zpp-lbl anim"
              key={animKey}
              style={{ "--zpp-dir": dirRef.current } as React.CSSProperties}
            >
              {label}
            </span>
            {/* reset — only when offset > 0 */}
            {!isAll && offset > 0 && (
              <button
                className="zpp-rst"
                title="Back to current"
                aria-label="Back to current"
                onClick={handleReset}
              >
                <IconReset />
              </button>
            )}
          </div>

          {/* newer → offset - 1 */}
          <button
            className="zpp-ib"
            aria-label="Newer"
            disabled={isAll || offset === 0}
            onClick={() => go(-1)}
          >
            <IconRight />
          </button>
        </div>

      </div>
    </>
  );
};

export default StatsPeriodPicker;
