/**
 * ------------------------------------------------------------------
 * DailyTokenUsageUI
 * ------------------------------------------------------------------
 * Hiển thị daily token usage dạng inline badge.
 *
 *   <Coins icon>  12.5k / 100k tok  (progress bar)
 *
 * Màu đổi theo ngưỡng: blue → orange → red (70% / 90%).
 * Chỉ dùng cho provider có `dailyTokenLimit` (track token/ngày).
 * Usage % theo request limit được track qua field `usage` / `reset_usage_at`
 * trực tiếp — không cần component này.
 *
 * Props:
 * - dailyTokenUsage        : Token đã dùng hôm nay
 * - dailyTokenLimit        : Giới hạn token/ngày (mặc định 100k)
 * - daily_token_reset_date : Ngày YYYY-MM-DD UTC reset token gần nhất
 * - compact                : true → badge nhỏ gọn (AccountCard / Drawer)
 * ------------------------------------------------------------------
 */

import React from "react";
import { Coins } from "lucide-react";

const DEFAULT_TOKEN_LIMIT = 100_000;

interface DailyTokenUsageUIProps {
  dailyTokenUsage?: number | null;
  dailyTokenLimit?: number;
  daily_token_reset_date?: string | null;
  compact?: boolean;
  style?: React.CSSProperties;
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, "") + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}

function colorFromPct(pct: number): string {
  if (pct >= 90) return "var(--vscode-editorError-foreground, #ef4444)";
  if (pct >= 70) return "var(--vscode-editorWarning-foreground, #f97316)";
  return "var(--vscode-charts-blue, #3b82f6)";
}

export const DailyTokenUsageUI: React.FC<DailyTokenUsageUIProps> = ({
  dailyTokenUsage,
  dailyTokenLimit,
  daily_token_reset_date,
  compact = false,
  style,
}) => {
  if (dailyTokenUsage == null) return null;

  const tokLimit = dailyTokenLimit ?? DEFAULT_TOKEN_LIMIT;
  if (tokLimit <= 0) return null;

  const todayUTC = new Date().toISOString().slice(0, 10);
  const effectiveTok = daily_token_reset_date === todayUTC ? dailyTokenUsage : 0;
  const tokPct = Math.min((effectiveTok / tokLimit) * 100, 100);
  const tokColor = colorFromPct(tokPct);
  const tokTitle = `Daily token usage: ${effectiveTok.toLocaleString()} / ${tokLimit.toLocaleString()} (resets at 00:00 UTC)`;

  if (compact) {
    return (
      <span
        title={tokTitle}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "3px",
          fontSize: "10px",
          color: tokColor,
          flexShrink: 0,
          ...style,
        }}
      >
        <Coins size={10} style={{ flexShrink: 0, color: tokColor }} />
        <span>{fmtTokens(effectiveTok)}/{fmtTokens(tokLimit)}</span>
      </span>
    );
  }

  return (
    <span
      title={tokTitle}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "5px",
        fontSize: "11px",
        color: tokColor,
        flexShrink: 0,
        ...style,
      }}
    >
      <Coins size={12} style={{ flexShrink: 0, color: tokColor }} />
      <span style={{ whiteSpace: "nowrap" }}>
        {fmtTokens(effectiveTok)}&nbsp;/&nbsp;{fmtTokens(tokLimit)} today
      </span>
      <span
        style={{
          display: "inline-block",
          width: "40px",
          height: "4px",
          borderRadius: "2px",
          backgroundColor: "var(--vscode-input-border, rgba(128,128,128,0.2))",
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            display: "block",
            width: `${tokPct}%`,
            height: "100%",
            backgroundColor: tokColor,
            borderRadius: "2px",
            transition: "width 0.3s ease",
          }}
        />
      </span>
    </span>
  );
};

export default DailyTokenUsageUI;
