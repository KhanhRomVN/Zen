import React from "react";
import { Zap, Scale, ShieldCheck, Plane } from "lucide-react";
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

const StyleCodeDropdown: React.FC<StyleCodeDropdownProps> = ({
  currentMode,
  onSelect,
  triggerButton,
}) => {
  return (
    <Dropdown side="top" align="start" sideOffset={4}>
      <DropdownTrigger asChild>{triggerButton}</DropdownTrigger>
      <DropdownContent>
        {MODE_META.map((meta) => {
          const isSelected = currentMode === meta.key;
          return (
            <DropdownItem
              key={meta.key}
              onClick={() => onSelect(meta.key)}
              noPadding
            >
              <div
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  backgroundColor: isSelected
                    ? `color-mix(in srgb, ${meta.color} 10%, transparent)`
                    : "transparent",
                  borderLeft: isSelected
                    ? `3px solid ${meta.color}`
                    : "3px solid transparent",
                  transition: "all 0.15s ease",
                }}
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
                    backgroundColor: `color-mix(in srgb, ${meta.color} 15%, transparent)`,
                    color: meta.color,
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
                      color: "var(--primary-text)",
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
                    {meta.desc}
                  </div>
                </div>

                {/* Active indicator */}
                {isSelected && (
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
