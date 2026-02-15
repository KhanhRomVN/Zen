import React from "react";
import { Message } from "../types";

interface ThinkingSectionProps {
  message: Message;
  thinking: string;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

const ThinkingSection: React.FC<ThinkingSectionProps> = ({
  message,
  thinking,
  isCollapsed,
  onToggleCollapse,
}) => {
  return (
    <div
      style={{
        borderRadius: "var(--border-radius)",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--spacing-xs)",
          paddingBottom: "var(--spacing-sm) var(--spacing-md)",
          marginBottom: "var(--spacing-sm)",
          cursor: "pointer",
        }}
        onClick={onToggleCollapse}
      >
        <svg
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          style={{
            transition: "transform 0.2s",
            transform: isCollapsed ? "rotate(0deg)" : "rotate(180deg)",
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
        <span
          style={{
            fontSize: "var(--font-size-xs)",
            fontWeight: 600,
            color: "var(--secondary-text)",
            letterSpacing: "0.5px",
          }}
        >
          THINKING
        </span>
      </div>
      {!isCollapsed && (
        <div
          style={{
            fontSize: "var(--font-size-sm)",
            color: "var(--secondary-text)",
            lineHeight: 1.6,
            whiteSpace: "pre-wrap",
            opacity: 0.8,
          }}
        >
          {thinking}
        </div>
      )}
    </div>
  );
};

export default ThinkingSection;
