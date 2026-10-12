/**
 * ------------------------------------------------------------------
 * StatsGrid
 * ------------------------------------------------------------------
 * Grid hiển thị 4 thống kê chính trong Home panel:
 * tổng tokens, API requests, favorite model, và tổng tài khoản.

 * Main features:
 * - Hẹp: 2x2 grid, mỗi box layout dọc: icon → value → name
 * - Vừa (>=560px): box layout ngang icon + text
 * - Wide (>=900px): 4 cột, box lớn hơn, viền, label trên value, % dạng pill
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
      isModel: false,
    },
    {
      icon: <Zap size={16} />,
      iconBg: "rgba(16, 185, 129, 0.12)",
      iconColor: "var(--vscode-gitDecoration-addedResourceForeground, #10b981)",
      value: String(todayRequests),
      label: "API Requests",
      percent: percentChanges[1],
      isModel: false,
    },
    {
      icon: <Brain size={16} />,
      iconBg: "rgba(245, 158, 11, 0.12)",
      iconColor: "var(--vscode-editorWarning-foreground, #f59e0b)",
      value: favoriteModel,
      label: "Favorite Model",
      percent: null,
      isModel: true,
    },
    {
      icon: <Users size={16} />,
      iconBg: "rgba(139, 92, 246, 0.12)",
      iconColor: "var(--vscode-symbolIcon-namespaceForeground, #8b5cf6)",
      value: String(totalAccounts),
      label: "Total Accounts",
      percent: percentChanges[3],
      isModel: false,
    },
  ];

  const styles = `
    .zen-stats-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    .zen-stat {
      position: relative; display: flex; flex-direction: column; gap: 6px;
      padding: 14px; border-radius: 8px;
      transition: transform 0.2s ease;
    }
    .zen-stat-txt { display: flex; flex-direction: column; gap: 6px; min-width: 0; }
    .zen-stat-icon {
      width: 32px; height: 32px; border-radius: 6px; flex-shrink: 0;
      display: flex; align-items: center; justify-content: center;
    }
    .zen-stat-value { font-size: 16px; font-weight: 700; }
    .zen-stat-value.is-model { font-size: 13px; line-height: 1.2; word-break: break-all; }
    .zen-stat-label { font-size: 10px; font-weight: 500; color: var(--vscode-descriptionForeground); }
    .zen-stat-pct { position: absolute; top: 12px; right: 12px; font-size: 10px; font-weight: 600; }
    @container zen (max-width: 339px) {
      .zen-stats-grid { grid-template-columns: minmax(0, 1fr); }
    }
    @container zen (min-width: 560px) {
      .zen-stat { flex-direction: row; align-items: center; gap: 10px; }
    }
    @container zen (min-width: 760px) {
      .zen-stats-grid { grid-template-columns: repeat(4, minmax(0, 1fr)); }
    }
    /* Wide: box lớn hơn, có viền, label nằm trên value, % dạng pill */
    @container zen (min-width: 900px) {
      .zen-stats-grid { gap: 16px !important; }
      .zen-stat { gap: 14px; padding: 14px; border-radius: 8px; }
      .zen-stat-icon { width: 44px; height: 44px; border-radius: 10px; }
      .zen-stat-icon svg { width: 20px; height: 20px; }
      .zen-stat-txt { flex-direction: column-reverse; gap: 4px; }
      .zen-stat-value { font-size: 22px; letter-spacing: -0.01em; }
      .zen-stat-value.is-model { font-size: 15px; }
      .zen-stat-label { font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em; }
      .zen-stat-pct {
        top: 14px; right: 14px; font-size: 11px; padding: 2px 8px; border-radius: 999px;
        background: color-mix(in srgb, currentColor 14%, transparent);
      }
    }
  `;

  // ── Render ──
  return (
    <div
      className="zen-stats-grid"
      style={{
        display: "grid",
        gap: "10px",
        width: "100%",
      }}
    >
      <style>{styles}</style>
      {cards.map((card, i) => (
        <div
          key={i}
          className="dashboard-card zen-stat"
          style={{
            backgroundColor: "var(--vscode-editor-background, #1e1e1e)",
          }}
        >
          {card.percent !== null && card.percent !== undefined && (
            <span
              className="zen-stat-pct"
              style={{
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
            className="zen-stat-icon"
            style={{ backgroundColor: card.iconBg, color: card.iconColor }}
          >
            {card.icon}
          </div>

          <div className="zen-stat-txt">
            <span className={`zen-stat-value${card.isModel ? " is-model" : ""}`}>
              {card.value}
            </span>
            <span className="zen-stat-label">{card.label}</span>
          </div>
        </div>
      ))}
    </div>
  );
};

export default StatsGrid;