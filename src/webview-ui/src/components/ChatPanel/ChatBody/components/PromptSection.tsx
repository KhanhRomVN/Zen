import React from "react";
import { Message } from "../types";

interface PromptSectionProps {
  message: Message;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
}

const PromptSection: React.FC<PromptSectionProps> = ({
  message,
  isCollapsed,
  onToggleCollapse,
}) => {
  return (
    <div
      style={{
        overflow: "hidden",
      }}
      onClick={(e) => {
        e.stopPropagation();
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
          justifyContent: "space-between",
          position: "relative",
        }}
        onClick={(e) => {
          e.stopPropagation();
          onToggleCollapse();
        }}
      >
        <div
          className="timeline-dot"
          style={{
            backgroundColor: "var(--vscode-descriptionForeground)",
            opacity: 0.8,
          }}
        />
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--spacing-xs)",
            paddingLeft: "29px",
            paddingTop: "16px",
          }}
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
            PROMPT REQUEST
          </span>
        </div>
      </div>
      {!isCollapsed && (
        <div
          style={{
            paddingLeft: "29px",
            fontSize: "var(--font-size-xs)",
            color: "var(--primary-text)",
            lineHeight: 1.6,
            whiteSpace: "pre-wrap",
            fontFamily: "monospace",
            maxHeight: "400px",
            overflowY: "auto",
            paddingBottom: "var(--spacing-md)",
          }}
        >
          {message.content}
        </div>
      )}
    </div>
  );
};

export default PromptSection;
