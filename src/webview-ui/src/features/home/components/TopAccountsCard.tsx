/**
 * ------------------------------------------------------------------
 * TopAccountsCard
 * ------------------------------------------------------------------
 * Card hiển thị các account dùng nhiều tokens nhất trong period.
 *
 * Main features:
 * - Sắp xếp theo total_tokens giảm dần, lấy 5 account đầu
 * - Mỗi dòng: huy hiệu thứ hạng + favicon + email + thanh meter + tokens/% tổng
 * - Màu theo thứ hạng, khớp với AccountInsightsCard bên cạnh
 * - Hover dòng: highlight + custom tooltip chi tiết (tokens, requests,
 *   % tổng, trung bình/request, so với account đứng đầu)
 * - Tooltip render qua portal ra document.body, tự lật lên/xuống và
 *   kẹp trong viewport nên không bị cắt bởi container cha
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── React ──
import React, { useCallback, useMemo, useState } from "react";
import { createPortal } from "react-dom";

// ── Utils ──
import { ACCOUNT_COLORS, AccountStat, formatTokens } from "../utils/format";

// ─── Interfaces ─────────────────────────────────────────────────────────
interface Props {
  accounts: AccountStat[];
  providerFavicons: Record<string, string>;
  title: string;
}

interface Row {
  id: string;
  email: string;
  providerId: string;
  rank: number;
  tokens: number;
  requests: number;
  share: number; // 0..1 so với tổng tokens của mọi account
  vsTop: number; // 0..1 so với account cao nhất
  avgPerReq: number;
  color: string;
}

interface TipState {
  row: Row;
  x: number;
  y: number;
}

// ─── Constants ──────────────────────────────────────────────────────────
const MAX_ROWS = 5;
const TOOLTIP_W = 252;
const TOOLTIP_H = 190; // ước lượng để quyết định lật tooltip lên trên
const EDGE = 8;

// ─── Helpers ────────────────────────────────────────────────────────────
/** 0.034 → "3.4%", 0.42 → "42%". */
const pct = (v: number) => `${(v * 100).toFixed(v > 0 && v < 0.1 ? 1 : 0)}%`;

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
    <span style={{ color: "var(--vscode-descriptionForeground)" }}>{label}</span>
    <span style={{ fontWeight: 600, fontVariantNumeric: "tabular-nums" }}>
      {value}
    </span>
  </div>
);

// ─── Component ──────────────────────────────────────────────────────────
const TopAccountsCard: React.FC<Props> = ({
  accounts,
  providerFavicons,
  title,
}) => {
  // ── State ──
  const [tip, setTip] = useState<TipState | null>(null);

  // ── Derived ──
  const { rows, activeCount } = useMemo(() => {
    const active = accounts
      .filter((a) => (a.total_tokens ?? 0) > 0)
      .sort((a, b) => (b.total_tokens ?? 0) - (a.total_tokens ?? 0));
    const total = active.reduce((s, a) => s + (a.total_tokens ?? 0), 0) || 1;
    const top = active[0]?.total_tokens || 1;
    const rows: Row[] = active.slice(0, MAX_ROWS).map((a, i) => {
      const tokens = a.total_tokens ?? 0;
      const requests = a.total_requests ?? 0;
      return {
        id: a.id,
        email: a.email,
        providerId: a.provider_id,
        rank: i + 1,
        tokens,
        requests,
        share: tokens / total,
        vsTop: tokens / top,
        avgPerReq: requests > 0 ? tokens / requests : 0,
        color: ACCOUNT_COLORS[0], // một màu nhấn duy nhất cho mọi hạng, tránh rực rỡ
      };
    });
    return { rows, activeCount: active.length };
  }, [accounts]);

  // ── Handlers ──
  const handleEnter = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, row: Row) => {
      const rect = e.currentTarget.getBoundingClientRect();
      const maxX = window.innerWidth - TOOLTIP_W - EDGE;
      const x = Math.max(EDGE, Math.min(rect.left + 12, maxX));
      const below = rect.bottom + 6;
      const y =
        below + TOOLTIP_H > window.innerHeight
          ? Math.max(EDGE, rect.top - TOOLTIP_H - 6)
          : below;
      setTip({ row, x, y });
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
        {activeCount > 0 && (
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
            {activeCount} active
          </span>
        )}
      </div>

      {rows.length === 0 ? (
        <span style={{ fontSize: "11px", opacity: 0.5, fontStyle: "italic" }}>
          No data
        </span>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          {rows.map((r) => {
            const favicon = providerFavicons[r.providerId];
            const active = tip?.row.id === r.id;
            return (
              <div
                key={r.id}
                onMouseEnter={(e) => handleEnter(e, r)}
                onMouseLeave={handleLeave}
                style={{
                  display: "grid",
                  gridTemplateColumns: "22px minmax(0, 1fr) auto",
                  gap: "10px",
                  alignItems: "center",
                  padding: "8px",
                  borderRadius: "6px",
                  cursor: "default",
                  transition: "background-color 0.15s ease",
                  backgroundColor: active
                    ? "color-mix(in srgb, var(--vscode-foreground) 6%, transparent)"
                    : "transparent",
                }}
              >
                {/* Rank badge */}
                <span
                  style={{
                    width: "22px",
                    height: "22px",
                    borderRadius: "6px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: "11px",
                    fontWeight: 700,
                    color: r.color,
                    backgroundColor: `color-mix(in srgb, ${r.color} 16%, transparent)`,
                  }}
                >
                  {r.rank}
                </span>

                {/* Email + meter */}
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      minWidth: 0,
                      fontSize: "12px",
                    }}
                  >
                    {favicon && (
                      <img
                        src={favicon}
                        alt=""
                        width={13}
                        height={13}
                        style={{ borderRadius: "2px", flexShrink: 0 }}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display =
                            "none";
                        }}
                      />
                    )}
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {r.email}
                    </span>
                  </div>
                  <div
                    style={{
                      height: "4px",
                      borderRadius: "2px",
                      marginTop: "6px",
                      overflow: "hidden",
                      backgroundColor:
                        "var(--vscode-widget-border, rgba(128,128,128,0.15))",
                    }}
                  >
                    <div
                      style={{
                        width: `${r.vsTop * 100}%`,
                        height: "100%",
                        borderRadius: "2px",
                        backgroundColor: r.color,
                        opacity: 0.55,
                      }}
                    />
                  </div>
                </div>

                {/* Tokens + share */}
                <div style={{ textAlign: "right" }}>
                  <div
                    style={{
                      fontSize: "12px",
                      fontWeight: 700,
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {formatTokens(r.tokens)}
                  </div>
                  <div
                    style={{
                      fontSize: "10px",
                      marginTop: "2px",
                      color: "var(--vscode-descriptionForeground)",
                      fontVariantNumeric: "tabular-nums",
                    }}
                  >
                    {pct(r.share)}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
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
              backgroundColor:
                "var(--vscode-editorHoverWidget-background, #252526)",
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
                  borderRadius: "2px",
                  flexShrink: 0,
                  backgroundColor: tip.row.color,
                }}
              />
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  wordBreak: "break-all",
                }}
              >
                {tip.row.email}
              </span>
            </div>
            <div
              style={{
                fontSize: "10px",
                color: "var(--vscode-descriptionForeground)",
              }}
            >
              {tip.row.providerId}
            </div>
            <div
              style={{
                height: "1px",
                backgroundColor:
                  "var(--vscode-widget-border, rgba(128,128,128,0.2))",
              }}
            />
            <TipRow label="Tokens" value={tip.row.tokens.toLocaleString()} />
            <TipRow label="Requests" value={tip.row.requests.toLocaleString()} />
            <TipRow label="Share of total" value={pct(tip.row.share)} />
            <TipRow
              label="Avg tokens / request"
              value={
                tip.row.requests > 0
                  ? Math.round(tip.row.avgPerReq).toLocaleString()
                  : "—"
              }
            />
            <div
              style={{
                fontSize: "10px",
                color: "var(--vscode-descriptionForeground)",
              }}
            >
              {tip.row.rank === 1
                ? "Top account"
                : `Rank #${tip.row.rank} · ${pct(tip.row.vsTop)} of top account`}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
};

export default TopAccountsCard;