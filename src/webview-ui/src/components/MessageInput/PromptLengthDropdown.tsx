import React from "react";
import { Minus, ChevronsUpDown, AlignLeft, Ban } from "lucide-react";
import type { PromptLengthMode } from "../../features/chat/prompts";
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
} from "../ui/Dropdown";

interface PromptLengthDropdownProps {
  currentMode: PromptLengthMode;
  onSelect: (mode: PromptLengthMode) => void;
  triggerButton: React.ReactNode;
}

const MODE_META: {
  key: PromptLengthMode;
  label: string;
  icon: React.ReactNode;
  color: string;
  desc: string;
}[] = [
  {
    key: "short",
    label: "Short",
    icon: <Minus size={14} />,
    color: "#22c55e",
    desc: "Ultra-compact prompt — fastest generation, minimal context",
  },
  {
    key: "medium",
    label: "Medium",
    icon: <ChevronsUpDown size={14} />,
    color: "#3b82f6",
    desc: "Balanced length — removes examples, keeps core instructions",
  },
  {
    key: "long",
    label: "Long",
    icon: <AlignLeft size={14} />,
    color: "#a78bfa",
    desc: "Full prompt — includes all examples and details",
  },
  {
    key: "none",
    label: "No Prompt",
    icon: <Ban size={14} />,
    color: "#ef4444",
    desc: "No system prompt — only your message is sent",
  },
];

const PromptLengthDropdown: React.FC<PromptLengthDropdownProps> = ({
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

export default PromptLengthDropdown;
