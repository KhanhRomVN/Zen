import React from "react";
import { X, Zap, Scale, ShieldCheck, Plane } from "lucide-react";
import type { SystemPromptMode } from "../../features/chat/prompts";
import { MODE_BEHAVIORS } from "../../features/chat/prompts";

interface StyleCodeDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  currentMode: SystemPromptMode;
  onSelect: (mode: SystemPromptMode) => void;
}

const MODE_META: {
  key: SystemPromptMode;
  label: string;
  icon: React.ReactNode;
  color: string;
  desc: string;
}[] = [
  {
    key: "fast",
    label: "Fast",
    icon: <Zap size={14} />,
    color: "#22c55e",
    desc: "Minimal confirmation, no tests, one-line explanations. Best for quick edits.",
  },
  {
    key: "balanced",
    label: "Balanced",
    icon: <Scale size={14} />,
    color: "#3b82f6",
    desc: "Moderate confirmation, propose existing tests, brief explanations. Default mode.",
  },
  {
    key: "thorough",
    label: "Thorough",
    icon: <ShieldCheck size={14} />,
    color: "#a78bfa",
    desc: "Extensive confirmation, write new tests, detailed explanations. Safe and rigorous.",
  },
  {
    key: "autopilot",
    label: "Autopilot",
    icon: <Plane size={14} />,
    color: "#f97316",
    desc: "Almost never asks, propose existing tests, brief explanations. Max speed.",
  },
];

const chipStyle = (color: string): React.CSSProperties => ({
  fontSize: "10px",
  fontWeight: 500,
  padding: "2px 8px",
  borderRadius: "5px",
  backgroundColor: `color-mix(in srgb, ${color} 10%, transparent)`,
  color: `color-mix(in srgb, ${color} 70%, var(--secondary-text))`,
  lineHeight: 1.5,
});

const StyleCodeDrawer: React.FC<StyleCodeDrawerProps> = ({
  isOpen,
  onClose,
  currentMode,
  onSelect,
}) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: "50vh",
        maxHeight: "50vh",
        backgroundColor: "var(--tertiary-bg)",
        borderTop: "1px solid var(--border-color)",
        boxShadow: "0 -8px 24px rgba(0,0,0,0.2)",
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        animation: "styleSlideUp 0.25s ease-out",
        color: "var(--primary-text)",
        overflow: "hidden",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--border-color)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexShrink: 0,
        }}
      >
        <div>
          <div style={{ fontSize: "17px", fontWeight: 700 }}>
            Style Code
          </div>
          <div
            style={{
              fontSize: "11px",
              color: "var(--secondary-text)",
              opacity: 0.7,
            }}
          >
            Choose how AI writes code
          </div>
        </div>
        <button
          onClick={onClose}
          style={{
            background: "rgba(128,128,128,0.1)",
            border: "none",
            cursor: "pointer",
            padding: "6px",
            borderRadius: "6px",
            color: "var(--secondary-text)",
            display: "flex",
            alignItems: "center",
          }}
        >
          <X size={16} />
        </button>
      </div>

      {/* 4 cards */}
      <div
        className="custom-scrollbar"
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "12px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        {MODE_META.map((meta) => {
          const behavior = MODE_BEHAVIORS[meta.key];
          const isSelected = currentMode === meta.key;
          return (
            <div
              key={meta.key}
              onClick={() => {
                onSelect(meta.key);
                onClose();
              }}
              style={{
                padding: "12px",
                borderRadius: "10px",
                cursor: "pointer",
                backgroundColor: isSelected
                  ? `color-mix(in srgb, ${meta.color} 12%, transparent)`
                  : "var(--input-bg)",
                border: isSelected
                  ? `1px solid ${meta.color}40`
                  : "1px solid transparent",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                if (!isSelected)
                  e.currentTarget.style.backgroundColor = `color-mix(in srgb, ${meta.color} 8%, transparent)`;
              }}
              onMouseLeave={(e) => {
                if (!isSelected)
                  e.currentTarget.style.backgroundColor = "var(--input-bg)";
              }}
            >
              {/* Row 1: badgeIcon + label + selected check */}
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "26px",
                    height: "26px",
                    borderRadius: "7px",
                    backgroundColor: `color-mix(in srgb, ${meta.color} 14%, transparent)`,
                    color: meta.color,
                    flexShrink: 0,
                  }}
                >
                  {meta.icon}
                </span>
                <span style={{ fontSize: "14px", fontWeight: 700 }}>
                  {meta.label}
                </span>
                {isSelected && (
                  <span
                    style={{
                      marginLeft: "auto",
                      fontSize: "11px",
                      color: meta.color,
                      fontWeight: 600,
                    }}
                  >
                    ● Active
                  </span>
                )}
              </div>

              {/* Row 2: desc */}
              <div
                style={{
                  fontSize: "11px",
                  color: "var(--secondary-text)",
                  opacity: 0.75,
                  marginTop: "6px",
                  lineHeight: 1.5,
                }}
              >
                {meta.desc}
              </div>

              {/* Row 3: behavior chips */}
              <div
                style={{
                  display: "flex",
                  gap: "6px",
                  flexWrap: "wrap",
                  marginTop: "8px",
                }}
              >
                <span style={chipStyle(meta.color)}>
                  confirm · {behavior.askConfirmation}
                </span>
                <span style={chipStyle(meta.color)}>
                  tests · {behavior.testBehavior}
                </span>
                <span style={chipStyle(meta.color)}>
                  explain · {behavior.explanationLevel}
                </span>
                <span style={chipStyle(meta.color)}>
                  batch · {behavior.maxBatchSize}
                </span>
                <span style={chipStyle(meta.color)}>
                  files/turn · {behavior.maxFilesPerTurn}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        @keyframes styleSlideUp {
          from { transform: translateY(100%); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
};

export default StyleCodeDrawer;