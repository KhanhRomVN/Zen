/**
 * ------------------------------------------------------------------
 * AccountInsightsCard
 * ------------------------------------------------------------------
 * Card phân tích mức độ tập trung tokens giữa các account.
 *
 * Main features:
 * - 4 ô số liệu: số account active, % của account đứng đầu,
 *   trung bình tokens/account, trung bình tokens/request
 * - Stacked bar tỷ trọng tokens: top 4 account + nhóm Others
 * - Legend theo màu thứ hạng (khớp TopAccountsCard), hover legend ↔
 *   hover đoạn bar: highlight hai chiều
 * - Toàn bộ số liệu tính từ danh sách accounts, không cần thêm API
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── React ──
import React, { useMemo, useState } from "react";

// ── Utils ──
import { ACCOUNT_COLORS, AccountStat, formatTokens } from "../utils/format";

// ─── Interfaces ─────────────────────────────────────────────────────────
interface Props {
  accounts: AccountStat[];
  title: string;
}

interface Segment {
  key: string;
  label: string;
  tokens: number;
  share: number; // 0..1
  color: string;
}

// ─── Constants ──────────────────────────────────────────────────────────
const TOP_SEGMENTS = 4;
const OTHERS_KEY = "__others__";
const OTHERS_COLOR = "color-mix(in srgb, var(--vscode-foreground) 30%, transparent)";

// ─── Helpers ────────────────────────────────────────────────────────────
/** 0.034 → "3.4%", 0.42 → "42%". */
const pct = (v: number) => `${(v * 100).toFixed(v > 0 && v < 0.1 ? 1 : 0)}%`;

const Metric: React.FC<{ label: string; value: string; sub?: string }> = ({
  label,
  value,
  sub,
}) => (
  <div
    style={{
      padding: "10px 12px",
      borderRadius: "6px",
      minWidth: 0,
      backgroundColor:
        "color-mix(in srgb, var(--vscode-foreground) 4%, transparent)",
    }}
  >
    <div
      style={{
        fontSize: "10px",
        textTransform: "uppercase",
        letterSpacing: "0.05em",
        color: "var(--vscode-descriptionForeground)",
      }}
    >
      {label}
    </div>
    <div
      style={{
        fontSize: "18px",
        fontWeight: 700,
        marginTop: "4px",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {value}
    </div>
    {sub && (
      <div
        style={{
          fontSize: "10px",
          marginTop: "2px",
          color: "var(--vscode-descriptionForeground)",
        }}
      >
        {sub}
      </div>
    )}
  </div>
);

// ─── Component ──────────────────────────────────────────────────────────
const AccountInsightsCard: React.FC<Props> = ({ accounts, title }) => {
  // ── State ──
  const [hovered, setHovered] = useState<string | null>(null);

  // ── Derived ──
  const stats = useMemo(() => {
    const active = accounts
      .filter((a) => (a.total_tokens ?? 0) > 0)
      .sort((a, b) => (b.total_tokens ?? 0) - (a.total_tokens ?? 0));
    const totalTokens = active.reduce((s, a) => s + (a.total_tokens ?? 0), 0);
    const totalRequests = active.reduce((s, a) => s + (a.total_requests ?? 0), 0);
    const safeTotal = totalTokens || 1;

    const segments: Segment[] = active.slice(0, TOP_SEGMENTS).map((a, i) => ({
      key: a.id,
      label: a.email,
      tokens: a.total_tokens ?? 0,
      share: (a.total_tokens ?? 0) / safeTotal,
      color: ACCOUNT_COLORS[i % ACCOUNT_COLORS.length],
    }));
    if (active.length > TOP_SEGMENTS) {
      const rest = active
        .slice(TOP_SEGMENTS)
        .reduce((s, a) => s + (a.total_tokens ?? 0), 0);
      segments.push({
        key: OTHERS_KEY,
        label: `Others (${active.length - TOP_SEGMENTS})`,
        tokens: rest,
        share: rest / safeTotal,
        color: OTHERS_COLOR,
      });
    }

    return {
      activeCount: active.length,
      topShare: active.length > 0 ? (active[0].total_tokens ?? 0) / safeTotal : 0,
      avgPerAccount: active.length > 0 ? totalTokens / active.length : 0,
      avgPerRequest: totalRequests > 0 ? totalTokens / totalRequests : 0,
      segments,
    };
  }, [accounts]);

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
      {/* Header */}
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

      {stats.activeCount === 0 ? (
        <span style={{ fontSize: "11px", opacity: 0.5, fontStyle: "italic" }}>
          No data
        </span>
      ) : (
        <>
          {/* Metrics */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
              gap: "8px",
            }}
          >
            <Metric
              label="Active accounts"
              value={String(stats.activeCount)}
              sub={`of ${accounts.length} total`}
            />
            <Metric
              label="Top account share"
              value={pct(stats.topShare)}
              sub="of all tokens"
            />
            <Metric
              label="Avg / account"
              value={formatTokens(Math.round(stats.avgPerAccount))}
              sub="tokens"
            />
            <Metric
              label="Avg / request"
              value={formatTokens(Math.round(stats.avgPerRequest))}
              sub="tokens"
            />
          </div>

          {/* Stacked bar */}
          <div
            onMouseLeave={() => setHovered(null)}
            style={{ display: "flex", gap: "2px", height: "10px" }}
          >
            {stats.segments.map((s) => (
              <div
                key={s.key}
                onMouseEnter={() => setHovered(s.key)}
                style={{
                  flex: `${s.tokens} 1 0`,
                  minWidth: "3px",
                  borderRadius: "3px",
                  backgroundColor: s.color,
                  opacity: hovered === null || hovered === s.key ? 1 : 0.35,
                  transition: "opacity 0.15s ease",
                }}
              />
            ))}
          </div>

          {/* Legend */}
          <div
            onMouseLeave={() => setHovered(null)}
            style={{ display: "flex", flexDirection: "column", gap: "2px" }}
          >
            {stats.segments.map((s) => (
              <div
                key={s.key}
                onMouseEnter={() => setHovered(s.key)}
                style={{
                  display: "grid",
                  gridTemplateColumns: "8px minmax(0, 1fr) auto auto",
                  gap: "8px",
                  alignItems: "center",
                  padding: "4px 6px",
                  borderRadius: "5px",
                  fontSize: "11px",
                  transition: "background-color 0.15s ease, opacity 0.15s ease",
                  opacity: hovered === null || hovered === s.key ? 1 : 0.55,
                  backgroundColor:
                    hovered === s.key
                      ? "color-mix(in srgb, var(--vscode-foreground) 6%, transparent)"
                      : "transparent",
                }}
              >
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "2px",
                    backgroundColor: s.color,
                  }}
                />
                <span
                  style={{
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                  title={s.label}
                >
                  {s.label}
                </span>
                <span
                  style={{
                    color: "var(--vscode-descriptionForeground)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {formatTokens(s.tokens)}
                </span>
                <span
                  style={{
                    fontWeight: 700,
                    minWidth: "36px",
                    textAlign: "right",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {pct(s.share)}
                </span>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default AccountInsightsCard;