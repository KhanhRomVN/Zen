/**
 * ------------------------------------------------------------------
 * TokensByProviderCard
 * ------------------------------------------------------------------
 * Card hiển thị tổng tokens gom theo provider dưới dạng thanh ngang.
 *
 * Main features:
 * - Gom total_tokens của accounts theo provider_id
 * - Thanh meter tương đối so với provider cao nhất
 * - Hiển thị favicon provider nếu có
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── React ──
import React, { useMemo } from "react";

// ─── Interfaces ─────────────────────────────────────────────────────────
export interface AccountStat {
  id: string;
  email: string;
  provider_id: string;
  total_requests: number | null;
  total_tokens: number | null;
}

interface Props {
  accounts: AccountStat[];
  providerFavicons: Record<string, string>;
  title: string;
}

// ─── Constants ──────────────────────────────────────────────────────────
const MAX_ROWS = 5;

// ─── Helpers ────────────────────────────────────────────────────────────
/** Rút gọn số tokens: 1200 → 1.2k, 3400000 → 3.4M. */
export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

// ─── Component ──────────────────────────────────────────────────────────
const TokensByProviderCard: React.FC<Props> = ({
  accounts,
  providerFavicons,
  title,
}) => {
  // ── Derived ──
  const rows = useMemo(() => {
    const map = new Map<string, number>();
    accounts.forEach((a) => {
      map.set(a.provider_id, (map.get(a.provider_id) ?? 0) + (a.total_tokens ?? 0));
    });
    return [...map.entries()]
      .map(([providerId, tokens]) => ({ providerId, tokens }))
      .filter((r) => r.tokens > 0)
      .sort((a, b) => b.tokens - a.tokens)
      .slice(0, MAX_ROWS);
  }, [accounts]);

  const maxTokens = rows[0]?.tokens || 1;

  // ── Render ──
  return (
    <div
      style={{
        backgroundColor: "var(--vscode-editor-background, #1e1e1e)",
        borderRadius: "8px",
        padding: "14px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          fontSize: "11px",
          fontWeight: 600,
          color: "var(--vscode-foreground)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: "10px",
          opacity: 0.8,
        }}
      >
        {title}
      </div>

      {rows.length === 0 ? (
        <span style={{ fontSize: "11px", opacity: 0.5, fontStyle: "italic" }}>
          No data
        </span>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          {rows.map((r) => {
            const favicon = providerFavicons[r.providerId];
            return (
              <div
                key={r.providerId}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) 90px auto",
                  gap: "10px",
                  alignItems: "center",
                  padding: "5px 0",
                  fontSize: "12px",
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
                    {r.providerId}
                  </span>
                </div>
                <div
                  style={{
                    height: "4px",
                    borderRadius: "2px",
                    backgroundColor:
                      "var(--vscode-widget-border, rgba(128,128,128,0.15))",
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${(r.tokens / maxTokens) * 100}%`,
                      height: "100%",
                      backgroundColor:
                        "var(--vscode-textLink-foreground, #3b82f6)",
                    }}
                  />
                </div>
                <span
                  style={{
                    color: "var(--vscode-descriptionForeground)",
                    fontVariantNumeric: "tabular-nums",
                  }}
                >
                  {formatTokens(r.tokens)}
                </span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default TokensByProviderCard;