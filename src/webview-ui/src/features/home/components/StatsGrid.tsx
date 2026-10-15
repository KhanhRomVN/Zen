/**
 * ------------------------------------------------------------------
 * StatsGrid
 * ------------------------------------------------------------------
 * Grid hiển thị 4 thống kê chính trong Home panel:
 * tổng tokens, API requests, favorite model, và tổng tài khoản.

 * Main features:
 * - Layout 2x2 grid đơn giản, responsive nhẹ nhàng.
 * - Mỗi card: Icon bên trái (full height), Text bên phải (Label trên, Value dưới).
 * - Hỗ trợ hiển thị % thay đổi (nếu có).
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
import React from "react";
import { MessageSquare, Zap, Brain, Users } from "lucide-react";

// ─── Interfaces ────────────────────────────────────────────────────────
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
  // ── Data Definition ──
  const cards = [
    {
      icon: <MessageSquare size={20} />,
      color: "var(--vscode-textLink-foreground, #3b82f6)",
      bg: "rgba(59, 130, 246, 0.1)",
      label: "Total Tokens",
      value: todayTokens.toLocaleString(),
      percent: percentChanges[0],
    },
    {
      icon: <Zap size={20} />,
      color: "var(--vscode-gitDecoration-addedResourceForeground, #10b981)",
      bg: "rgba(16, 185, 129, 0.1)",
      label: "API Requests",
      value: String(todayRequests),
      percent: percentChanges[1],
    },
    {
      icon: <Brain size={20} />,
      color: "var(--vscode-editorWarning-foreground, #f59e0b)",
      bg: "rgba(245, 158, 11, 0.1)",
      label: "Favorite Model",
      value: favoriteModel,
      percent: null,
      isLongText: true,
    },
    {
      icon: <Users size={20} />,
      color: "var(--vscode-symbolIcon-namespaceForeground, #8b5cf6)",
      bg: "rgba(139, 92, 246, 0.1)",
      label: "Total Accounts",
      value: String(totalAccounts),
      percent: percentChanges[3],
    },
  ];

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
        gap: "12px",
        width: "100%",
      }}
    >
      {cards.map((card, index) => (
        <div
          key={index}
          className="dashboard-card"
          style={{
            backgroundColor: "var(--vscode-editor-background, #1e1e1e)",
            borderRadius: "8px",
            padding: "10px 8px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            boxSizing: "border-box",
            minHeight: "auto",
          }}
        >
          {/* Left: Icon Badge */}
          <div
            style={{
              flexShrink: 0,
              width: "32px",
              height: "32px",
              borderRadius: "6px",
              backgroundColor: card.bg,
              color: card.color,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {React.cloneElement(
              card.icon as React.ReactElement<{ size?: number }>,
              { size: 16 },
            )}
          </div>

          {/* Right: Content (Label + Value) */}
          <div
            style={{
              flex: 1,
              minWidth: 0,
              display: "flex",
              flexDirection: "column",
              justifyContent: "center",
              gap: "2px",
            }}
          >
            {/* Line 1: Label */}
            <span
              style={{
                fontSize: "9px",
                fontWeight: 600,
                color: "var(--vscode-descriptionForeground, #8b95a8)",
                textTransform: "uppercase",
                letterSpacing: "0.03em",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {card.label}
            </span>

            {/* Line 2: Value + Percent */}
            <div
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: "6px",
                flexWrap: "wrap",
              }}
            >
              <span
                style={{
                  fontSize: card.isLongText ? "11px" : "14px",
                  fontWeight: 700,
                  color: "var(--vscode-foreground, #e8ecf4)",
                  lineHeight: 1.2,
                  wordBreak: card.isLongText ? "break-all" : "normal",
                  maxWidth: "100%",
                }}
                title={card.value}
              >
                {card.value}
              </span>

              {card.percent !== null && card.percent !== undefined && (
                <span
                  style={{
                    fontSize: "9px",
                    fontWeight: 600,
                    color:
                      card.percent >= 0
                        ? "var(--vscode-gitDecoration-addedResourceForeground, #10b981)"
                        : "var(--vscode-errorForeground, #f43f5e)",
                    opacity: 0.9,
                  }}
                >
                  {card.percent > 0 ? "+" : ""}
                  {card.percent.toFixed(1)}%
                </span>
              )}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default StatsGrid;
