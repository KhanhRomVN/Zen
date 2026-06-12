import React from "react";
import { ToolHeader } from "../../../ToolHeader";
import { useI18n } from "../../../../hooks/useI18n";

interface PlanStep {
  id: string;
  status: "done" | "pending" | "in_progress";
  text: string;
}

interface PlanBlockProps {
  steps: PlanStep[];
  isLastMessage?: boolean;
  isLastItemInList?: boolean;
}

const PURPLE = "var(--vscode-textLink-foreground, #a78bfa)";

const PlanBlock: React.FC<PlanBlockProps> = ({ steps, isLastMessage, isLastItemInList = true }) => {
  const { lang } = useI18n();
  const label = lang === "vi" ? "KẾ HOẠCH" : "PLAN";
  return (
    <div
      className="timeline-item"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        paddingLeft: "29px",
        paddingBottom: isLastItemInList ? (isLastMessage ? "0px" : "12px") : "8px",
      }}
    >
      {/* ToolHeader handles the timeline-dot + label row, identical to FileToolItem */}
      <ToolHeader
        title={
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", color: "var(--vscode-editor-foreground)" }}>
            <span style={{ fontWeight: 600, opacity: 0.9, color: PURPLE }}>
              {label}
            </span>
          </div>
        }
        statusColor={PURPLE}
      />

      {/* Steps — container đã có paddingLeft 29px, không cần thêm */}
      <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
        {steps.map((step) => (
          <div
            key={step.id}
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "8px",
              opacity: step.status === "pending" ? 0.38 : 1,
            }}
          >
            {/* Status icon */}
            <div style={{ flexShrink: 0, marginTop: "2px", width: "14px", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {step.status === "done" && (
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <circle cx="6.5" cy="6.5" r="6" fill="rgba(63,185,80,0.12)" stroke="rgba(63,185,80,0.45)" strokeWidth="1" />
                  <polyline points="3.5,6.8 5.5,8.8 9.5,4.2" stroke="rgba(63,185,80,0.85)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                </svg>
              )}
              {step.status === "in_progress" && (
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none" style={{ animation: "plan-spin 1.2s linear infinite" }}>
                  <circle cx="6.5" cy="6.5" r="5" stroke="rgba(167,139,250,0.2)" strokeWidth="1.5" fill="none" />
                  <path d="M6.5 1.5 A5 5 0 0 1 11.5 6.5" stroke={PURPLE} strokeWidth="1.5" strokeLinecap="round" fill="none" />
                </svg>
              )}
              {step.status === "pending" && (
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
                  <circle cx="6.5" cy="6.5" r="5" stroke="rgba(128,128,128,0.3)" strokeWidth="1" fill="none" strokeDasharray="2.5 2" />
                </svg>
              )}
            </div>

            {/* Step text: var(--font-size-sm) = same as normal chat text */}
            <span
              style={{
                fontSize: "var(--font-size-sm)",
                color: step.status === "done"
                  ? "var(--secondary-text)"
                  : "var(--primary-text)",
                textDecoration: step.status === "done" ? "line-through" : "none",
                lineHeight: 1.5,
              }}
            >
              {step.text}
            </span>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes plan-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default PlanBlock;
