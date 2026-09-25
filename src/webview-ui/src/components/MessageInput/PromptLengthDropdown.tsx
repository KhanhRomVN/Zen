import React from "react";
import type { PromptLengthMode } from "../../features/chat/prompts";
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
} from "../ui/Dropdown";
import { Ban } from "lucide-react";

interface PromptLengthDropdownProps {
  currentMode: PromptLengthMode;
  onSelect: (mode: PromptLengthMode) => void;
  triggerButton: React.ReactNode;
  /**
   * Khi true, chỉ "None" được phép chọn — short/medium/long bị disabled.
   * Dùng khi provider có anti-system-prompt-injection.
   */
  isNoneOnly?: boolean;
}

/**
 * Metadata cho 4 mức Prompt Length — dùng chung cho cả trigger icon (step-bar)
 * lẫn panel step-bar bên trong dropdown.
 */
export const PROMPT_LENGTH_MODE_META: {
  key: PromptLengthMode;
  label: string;
  shortLabel: string;
  barHeight: number;
  color: string;
  desc: string;
  /** Nếu true, option này không gắn system prompt. */
  isNoPrompt?: boolean;
}[] = [
  {
    key: "none",
    label: "No Prompt",
    shortLabel: "None",
    barHeight: 4,
    color: "#64748b",
    desc: "No system prompt — only your message is sent",
    isNoPrompt: true,
  },
  {
    key: "short",
    label: "Short",
    shortLabel: "Short",
    barHeight: 12,
    color: "#14b8a6",
    desc: "Ultra-compact prompt — fastest generation, minimal context",
  },
  {
    key: "medium",
    label: "Medium",
    shortLabel: "Medium",
    barHeight: 20,
    color: "#f59e0b",
    desc: "Balanced length — removes examples, keeps core instructions",
  },
  {
    key: "long",
    label: "Long",
    shortLabel: "Long",
    barHeight: 28,
    color: "#8b5cf6",
    desc: "Full prompt — includes all examples and details",
  },
];

/**
 * Icon step-bar cho trigger: 3 cột tăng dần, tô màu theo mode hiện tại.
 * level 0 = tất cả mờ, 1/2/3 = fill lên tới cột tương ứng.
 */
export const PromptLengthTriggerIcon: React.FC<{
  mode: PromptLengthMode;
}> = ({ mode }) => {
  const meta =
    PROMPT_LENGTH_MODE_META.find((m) => m.key === mode) ??
    PROMPT_LENGTH_MODE_META[3];
  const level =
    mode === "none" ? 0 : mode === "short" ? 1 : mode === "medium" ? 2 : 3;
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
      <rect
        x="1"
        y="11"
        width="3"
        height="3"
        rx="0.75"
        fill={meta.color}
        opacity={level >= 1 ? 1 : 0.28}
      />
      <rect
        x="6"
        y="8"
        width="3"
        height="6"
        rx="0.75"
        fill={meta.color}
        opacity={level >= 2 ? 1 : 0.28}
      />
      <rect
        x="11"
        y="5"
        width="3"
        height="9"
        rx="0.75"
        fill={meta.color}
        opacity={level >= 3 ? 1 : 0.28}
      />
    </svg>
  );
};

const PromptLengthDropdown: React.FC<PromptLengthDropdownProps> = ({
  currentMode,
  onSelect,
  triggerButton,
  isNoneOnly = false,
}) => {
  const current =
    PROMPT_LENGTH_MODE_META.find((m) => m.key === currentMode) ??
    PROMPT_LENGTH_MODE_META[3];

  return (
    <Dropdown side="top" align="start" sideOffset={6}>
      <DropdownTrigger asChild>{triggerButton}</DropdownTrigger>
      <DropdownContent>
        <style>{`
          .zen-pl-step .zen-pl-bar {
            transition: background 0.15s ease, box-shadow 0.15s ease;
          }
          .zen-pl-step:not(.zen-pl-disabled):hover .zen-pl-bar {
            background: rgba(128, 128, 128, 0.4);
          }
        `}</style>
        <div style={{ padding: "10px 12px 8px" }}>

          {/* Banner khi isNoneOnly */}
          {isNoneOnly && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "10.5px",
                color: "#f59e0b",
                lineHeight: 1.4,
                marginBottom: "10px",
                paddingBottom: "8px",
                borderBottom:
                  "1px solid var(--vscode-widget-border, rgba(255,255,255,0.08))",
              }}
            >
              <Ban size={11} style={{ flexShrink: 0 }} />
              <span>
                This provider injects its own prompt — only None is available.
              </span>
            </div>
          )}

          {/* Header: label + value pill */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "8px",
            }}
          >
            <div
              style={{
                fontSize: "12.5px",
                fontWeight: 600,
                color: "var(--primary-text)",
              }}
            >
              Prompt Length
            </div>
            <span
              style={{
                fontSize: "10px",
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: "999px",
                background: `color-mix(in srgb, ${current.color} 18%, transparent)`,
                color: current.color,
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                whiteSpace: "nowrap",
              }}
            >
              {current.label}
            </span>
          </div>

          {/* Step-bar */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: "8px",
              height: "34px",
              marginTop: "12px",
              padding: "0 2px",
            }}
          >
            {PROMPT_LENGTH_MODE_META.map((meta) => {
              const isSelected = currentMode === meta.key;
              const isDisabled = isNoneOnly && !meta.isNoPrompt;

              return (
                <div
                  key={meta.key}
                  className={`zen-pl-step${isSelected ? " zen-pl-selected" : ""}${isDisabled ? " zen-pl-disabled" : ""}`}
                  onClick={() => {
                    if (!isDisabled) onSelect(meta.key);
                  }}
                  title={
                    isDisabled
                      ? "Unavailable — provider uses its own system prompt"
                      : meta.desc
                  }
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "6px",
                    cursor: isDisabled ? "not-allowed" : "pointer",
                    opacity: isDisabled ? 0.3 : 1,
                    transition: "opacity 0.15s ease",
                  }}
                >
                  <div
                    className="zen-pl-bar"
                    style={{
                      width: "100%",
                      height: `${meta.barHeight}px`,
                      borderRadius: "3px 3px 1px 1px",
                      background: isSelected && !isDisabled
                        ? meta.color
                        : undefined,
                      boxShadow: isSelected && !isDisabled
                        ? `0 0 0 1px color-mix(in srgb, ${meta.color} 50%, transparent)`
                        : undefined,
                    }}
                  />
                  <span
                    style={{
                      fontSize: "9.5px",
                      fontWeight: 600,
                      color: isSelected && !isDisabled
                        ? meta.color
                        : "var(--secondary-text)",
                      lineHeight: 1,
                    }}
                  >
                    {meta.shortLabel}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Description */}
          <div
            style={{
              fontSize: "10.5px",
              color: "var(--secondary-text)",
              marginTop: "8px",
              lineHeight: 1.4,
            }}
          >
            {current.desc}
          </div>
        </div>
      </DropdownContent>
    </Dropdown>
  );
};

export default PromptLengthDropdown;
