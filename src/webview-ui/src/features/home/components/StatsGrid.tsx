import React from "react";
import { MessageSquare, Zap, Brain, Users } from "lucide-react";

interface StatsGridProps {
  todayTokens: number;
  todayRequests: number;
  favoriteModel: string;
  totalAccounts: number;
}

const StatsGrid: React.FC<StatsGridProps> = ({
  todayTokens,
  todayRequests,
  favoriteModel,
  totalAccounts,
}) => {
  const cards = [
    {
      icon: <MessageSquare size={16} />,
      iconBg: "rgba(59, 130, 246, 0.12)",
      iconColor: "var(--vscode-textLink-foreground, #3b82f6)",
      value: todayTokens.toLocaleString(),
      label: "Total Tokens",
      valueStyle: { fontSize: "16px", fontWeight: 700 } as React.CSSProperties,
    },
    {
      icon: <Zap size={16} />,
      iconBg: "rgba(16, 185, 129, 0.12)",
      iconColor: "var(--vscode-gitDecoration-addedResourceForeground, #10b981)",
      value: String(todayRequests),
      label: "API Requests",
      valueStyle: { fontSize: "16px", fontWeight: 700 } as React.CSSProperties,
    },
    {
      icon: <Brain size={16} />,
      iconBg: "rgba(245, 158, 11, 0.12)",
      iconColor: "var(--vscode-editorWarning-foreground, #f59e0b)",
      value: favoriteModel,
      label: "Favorite Model",
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
      valueStyle: { fontSize: "16px", fontWeight: 700 } as React.CSSProperties,
    },
  ];

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
            backgroundColor:
              "var(--vscode-sideBar-background, rgba(0,0,0,0.15))",
            border:
              "1px solid var(--vscode-widget-border, rgba(128,128,128,0.15))",
            borderRadius: "8px",
            padding: "12px",
            display: "flex",
            alignItems: "center",
            gap: "12px",
            transition: "transform 0.2s ease, border-color 0.2s ease",
          }}
        >
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
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
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
        </div>
      ))}
    </div>
  );
};

export default StatsGrid;
