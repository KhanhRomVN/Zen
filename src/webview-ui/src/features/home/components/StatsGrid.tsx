/**
 * ------------------------------------------------------------------
 * StatsGrid
 * ------------------------------------------------------------------
 * Grid hiển thị 4 thống kê chính trong Home panel:
 * tổng tokens, API requests, favorite model, và tổng tài khoản.

 * Main features:
 * - Hiển thị dạng 2x2 grid, mỗi box layout dọc: icon → value → name
 * - Text % thay đổi ở góc phải (green/red theo dương/âm)
 * - Giá trị động từ props
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── React ──
import React from "react";

// ── UI ──
import { MessageSquare, Zap, Brain, Users } from "lucide-react";

// ─── Interfaces ─────────────────────────────────────────────────────────
interface StatsGridProps {
  todayTokens: number;
  todayRequests: number;
  favoriteModel: string;
  totalAccounts: number;
  percentChanges: (number | null)[];
}

// ─── Component ──────────────────────────────────────────────────────────
const StatsGrid: React.FC<StatsGridProps> = ({
  todayTokens,
  todayRequests,
  favoriteModel,
  totalAccounts,
  percentChanges,
}) => {
  // ── Derived ──
  const cards = [
    {
      icon: <MessageSquare size={16} />,
      iconBg: "rgba(59, 130, 246, 0.12)",
      iconColor: "var(--vscode-textLink-foreground, #3b82f6)",
      value: todayTokens.toLocaleString(),
      label: "Total Tokens",
      percent: percentChanges[0],
      valueStyle: { fontSize: "16px", fontWeight: 700 } as React.CSSProperties,
    },
    {
      icon: <Zap size={16} />,
      iconBg: "rgba(16, 185, 129, 0.12)",
      iconColor: "var(--vscode-gitDecoration-addedResourceForeground, #10b981)",
      value: String(todayRequests),
      label: "API Requests",
      percent: percentChanges[1],
      valueStyle: { fontSize: "16px", fontWeight: 700 } as React.CSSProperties,
    },
    {
      icon: <Brain size={16} />,
      iconBg: "rgba(245, 158, 11, 0.12)",
      iconColor: "var(--vscode-editorWarning-foreground, #f59e0b)",
      value: favoriteModel,
      label: "Favorite Model",
      percent: percentChanges[2],
      valueStyle: {
        fontSize: "13px",
        fontWeight: 700,
        lineHeight: 1.2,
        wordBreak: "break-all",
      } as React.CSSProperties,
    },
    {
      icon: <Users size={16} />,
      iconBg: "rgba(139, 92, 246, 0.12)",
      iconColor: "var(--vscode-symbolIcon-namespaceForeground, #8b5cf6)",
      value: String(totalAccounts),
      label: "Total Accounts",
      percent: percentChanges[3],
      valueStyle: { fontSize: "16px", fontWeight: 700 } as React.CSSProperties,
    },
  ];

  // ── Render ──
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, 1fr)",
        gap: "10px",
        width: "100%",
      }}
    >
      {cards.map((card, i) => (
        <div
          key={i}
          className="dashboard-card"
          style={{
            position: "relative",
            backgroundColor: "var(--vscode-editor-background, #1e1e1e)",
            borderRadius: "8px",
            padding: "12px",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            transition: "transform 0.2s ease",
          }}
        >
          {card.percent !== null && card.percent !== undefined && (
            <span
              style={{
                position: "absolute",
                top: "12px",
                right: "12px",
                fontSize: "10px",
                fontWeight: 600,
                color:
                  card.percent >= 0
                    ? "var(--vscode-gitDecoration-addedResourceForeground, #10b981)"
                    : "var(--vscode-errorForeground, #f43f5e)",
              }}
            >
              {card.percent > 0 ? "+" : ""}
              {card.percent.toFixed(1)}%
            </span>
          )}

          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "6px",
              backgroundColor: card.iconBg,
              color: card.iconColor,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {card.icon}
          </div>

          <span style={card.valueStyle}>{card.value}</span>

          <span
            style={{
              fontSize: "10px",
              color: "var(--vscode-descriptionForeground)",
              fontWeight: 500,
            }}
          >
            {card.label}
          </span>
        </div>
      ))}
    </div>
  );
};

export default StatsGrid;