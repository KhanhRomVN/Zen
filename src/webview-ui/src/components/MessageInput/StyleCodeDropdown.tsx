import React from "react";
import { Zap, Scale, ShieldCheck, Plane, Ban } from "lucide-react";
import type { SystemPromptMode } from "../../features/chat/prompts";
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
} from "../ui/Dropdown";

interface StyleCodeDropdownProps {
  currentMode: SystemPromptMode;
  onSelect: (mode: SystemPromptMode) => void;
  triggerButton: React.ReactNode;
  /**
   * Khi true (provider có anti-system-prompt-injection), tất cả các style
   * code có gắn prompt sẽ bị disabled — chỉ "None" có thể chọn.
   */
  isAntiInjection?: boolean;
}

export const STYLE_CODE_MODE_META: {
  key: SystemPromptMode;
  label: string;
  icon: React.ReactNode;
  color: string;
  desc: string;
  /** Nếu true, option này không gắn system prompt nào. */
  isNoPrompt?: boolean;
}[] = [
  {
    key: "none",
    label: "None",
    icon: <Ban size={14} />,
    color: "#64748b",
    desc: "No style applied — no system prompt injected",
    isNoPrompt: true,
  },
  {
    key: "fast",
    label: "Fast",
    icon: <Zap size={14} />,
    color: "#22c55e",
    desc: "Minimal confirmation, no tests, one-line explanations",
  },
  {
    key: "balanced",
    label: "Balanced",
    icon: <Scale size={14} />,
    color: "#3b82f6",
    desc: "Moderate confirmation, propose existing tests, brief explanations",
  },
  {
    key: "thorough",
    label: "Thorough",
    icon: <ShieldCheck size={14} />,
    color: "#a78bfa",
    desc: "Extensive confirmation, write new tests, detailed explanations",
  },
  {
    key: "autopilot",
    label: "Autopilot",
    icon: <Plane size={14} />,
    color: "#f97316",
    desc: "Almost never asks, propose existing tests, brief explanations",
  },
];

/**
 * Icon-only trigger cho StyleCode: icon thay đổi theo mode hiện tại.
 */
export const StyleCodeTriggerIcon: React.FC<{
  mode: SystemPromptMode;
}> = ({ mode }) => {
  const meta =
    STYLE_CODE_MODE_META.find((m) => m.key === mode) ??
    STYLE_CODE_MODE_META.find((m) => m.key === "balanced")!;
  return <>{meta.icon}</>;
};

const StyleCodeDropdown: React.FC<StyleCodeDropdownProps> = ({
  currentMode,
  onSelect,
  triggerButton,
  isAntiInjection = false,
}) => {
  return (
    <Dropdown side="top" align="start" sideOffset={4}>
      <DropdownTrigger asChild>{triggerButton}</DropdownTrigger>
      <DropdownContent>
        {/* Banner khi provider có anti-injection */}
        {isAntiInjection && (
          <div
            style={{
              padding: "7px 12px 6px",
              borderBottom:
                "1px solid var(--vscode-widget-border, rgba(255,255,255,0.08))",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "10.5px",
              color: "#f59e0b",
              lineHeight: 1.4,
            }}
          >
            <Ban size={11} style={{ flexShrink: 0 }} />
            <span>
              This provider injects its own system prompt — style presets are
              unavailable.
            </span>
          </div>
        )}

        {STYLE_CODE_MODE_META.map((meta) => {
          const isSelected = currentMode === meta.key;
          // Khi anti-injection: chỉ option "none" có thể click, còn lại bị disabled
          const isDisabled = isAntiInjection && !meta.isNoPrompt;

          return (
            <DropdownItem
              key={meta.key}
              onClick={() => {
                if (!isDisabled) onSelect(meta.key);
              }}
              noPadding
              closeOnSelect={false}
            >
              <div
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  backgroundColor: isDisabled
                    ? "transparent"
                    : isSelected
                      ? `color-mix(in srgb, ${meta.color} 10%, transparent)`
                      : "transparent",
                  borderLeft: isDisabled
                    ? "3px solid transparent"
                    : isSelected
                      ? `3px solid ${meta.color}`
                      : "3px solid transparent",
                  transition: "all 0.15s ease",
                  opacity: isDisabled ? 0.35 : 1,
                  cursor: isDisabled ? "not-allowed" : "pointer",
                }}
                title={
                  isDisabled
                    ? "Unavailable — provider uses its own system prompt"
                    : meta.desc
                }
              >
                {/* Badge Icon */}
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    width: "32px",
                    height: "32px",
                    borderRadius: "8px",
                    backgroundColor: isDisabled
                      ? "rgba(128,128,128,0.08)"
                      : `color-mix(in srgb, ${meta.color} 15%, transparent)`,
                    color: isDisabled ? "var(--secondary-text)" : meta.color,
                    flexShrink: 0,
                  }}
                >
                  {meta.icon}
                </span>

                {/* Text Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: "13px",
                      fontWeight: 600,
                      color: isDisabled
                        ? "var(--secondary-text)"
                        : "var(--primary-text)",
                      marginBottom: "2px",
                    }}
                  >
                    {meta.label}
                  </div>
                  <div
                    style={{
                      fontSize: "11px",
                      color: "var(--secondary-text)",
                      lineHeight: 1.4,
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    {isDisabled
                      ? "Unavailable — provider uses its own system prompt"
                      : meta.desc}
                  </div>
                </div>

                {/* Active indicator */}
                {isSelected && !isDisabled && (
                  <span
                    style={{
                      fontSize: "10px",
                      color: meta.color,
                      fontWeight: 600,
                      flexShrink: 0,
                    }}
                  >
                    ●
                  </span>
                )}
              </div>
            </DropdownItem>
          );
        })}
      </DropdownContent>
    </Dropdown>
  );
};

export default StyleCodeDropdown;
