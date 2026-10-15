/**
 * ------------------------------------------------------------------
 * PromptSettingsDropdown
 * ------------------------------------------------------------------
 * Dropdown gộp các cài đặt phụ thuộc vào prompt-length:
 *   1. Style Code   — chọn preset system prompt style
 *   2. Diagnostics  — toggle VSCode diagnostics vào context
 *   3. Skill        — toggle skill instructions
 *   4. Memory       — toggle memory injection
 *   5. Tool Format  — chọn XML hoặc JSON cho tool calls
 *
 * Trigger button: pill hiển thị các icon liên tiếp.
 * Khi promptLengthMode === "none": chỉ hiển thị icon Tool Format (formatOnly).
 * ------------------------------------------------------------------
 */

import React, { useState } from "react";
import { Ban, Stethoscope, Sparkles, Brain, Code2, Check } from "lucide-react";
import type { SystemPromptMode } from "../../features/chat/prompts";
import { Dropdown, DropdownTrigger, DropdownContent } from "../ui/Dropdown";
import {
  SimpleTooltip,
  TooltipHeader,
  TooltipRow,
  TooltipCard,
} from "./SimpleTooltip";




// ─── Local Definitions for STYLE_CODE_MODE_META & StyleCodeTriggerIcon ──
// These were previously imported from ProviderModelDrawer but are not exported there.
// Defining them locally to fix the TypeScript error.

interface StyleCodeModeMeta {
  key: SystemPromptMode;
  label: string;
  desc: string;
  color: string;
  icon: React.ReactNode;
}

export const STYLE_CODE_MODE_META: StyleCodeModeMeta[] = [
  {
    key: "fast",
    label: "Fast",
    desc: "Minimal confirmations, quick edits",
    color: "#ef4444",
    icon: <Ban size={14} />,
  },
  {
    key: "balanced",
    label: "Balanced",
    desc: "Moderate confirmations, standard flow",
    color: "#3b82f6",
    icon: <Stethoscope size={14} />,
  },
  {
    key: "thorough",
    label: "Thorough",
    desc: "Extensive checks, detailed explanations",
    color: "#a855f7",
    icon: <Sparkles size={14} />,
  },
  {
    key: "autopilot",
    label: "Autopilot",
    desc: "Almost no confirmations, autonomous execution",
    color: "#22c55e",
    icon: <Brain size={14} />,
  },
];

const StyleCodeTriggerIcon: React.FC<{ mode: SystemPromptMode }> = ({ mode }) => {
  const meta = STYLE_CODE_MODE_META.find(m => m.key === mode);
  return (
    <span style={{ display: "inline-flex", alignItems: "center" }}>
      {meta?.icon || <Code2 size={14} />}
    </span>
  );
};

// ─── Aliases ────────────────────────────────────────────────────────────
const DiagnosticsIcon = Stethoscope;
const SkillIcon = Sparkles;
const MemoryIcon = Brain;
const FormatIcon = Code2;

const FORMAT_COLORS = { json: "#3b82f6", xml: "#f59e0b" } as const;

const FormatText: React.FC<{ format: "xml" | "json" }> = ({ format }) => (
  <span
    style={{
      fontSize: "9px",
      fontWeight: 700,
      letterSpacing: "0.04em",
      lineHeight: 1,
      textTransform: "uppercase",
      color: FORMAT_COLORS[format],
    }}
  >
    {format}
  </span>
);

// ─── Tick Box ───────────────────────────────────────────────────────────
const TickBox: React.FC<{
  isOn: boolean;
  onToggle: () => void;
}> = ({ isOn, onToggle }) => (
  <button
    role="checkbox"
    aria-checked={isOn}
    onClick={(e) => {
      e.stopPropagation();
      onToggle();
    }}
    style={{
      width: "16px",
      height: "16px",
      display: "inline-flex",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: "3px",
      flexShrink: 0,
      cursor: "pointer",
      padding: 0,
      background: isOn
        ? "var(--vscode-button-background)"
        : "var(--vscode-checkbox-background)",
      border: `1px solid ${
        isOn
          ? "var(--vscode-button-background)"
          : "var(--vscode-checkbox-border)"
      }`,
      color: "var(--vscode-button-foreground)",
      transition: "background 0.15s ease, border-color 0.15s ease",
    }}
  >
    {isOn && <Check size={12} strokeWidth={3} />}
  </button>
);

// ─── Props ──────────────────────────────────────────────────────────────
interface PromptSettingsDropdownProps {
  // Style Code
  systemPromptMode: SystemPromptMode;
  onSelectSystemPromptMode: (mode: SystemPromptMode) => void;
  isAntiInjection?: boolean;

  // Diagnostic
  diagnosticEnabled?: boolean;
  onDiagnosticToggle?: () => void;

  // Skill
  skillEnabled?: boolean;
  onSkillToggle?: () => void;

  // Memory
  memoryEnabled?: boolean;
  onMemoryToggle?: () => void;

  // Tool Format (xml | json)
  toolFormat?: "xml" | "json";
  onToolFormatToggle?: () => void;
  formatOnly?: boolean;
}

// ─── Divider ────────────────────────────────────────────────────────────
const Divider: React.FC = () => (
  <div
    style={{
      height: "1px",
      backgroundColor: "var(--vscode-widget-border, rgba(255,255,255,0.07))",
      margin: "4px 12px",
    }}
  />
);

// ─── Section Row (non-clickable) ────────────────────────────────────────
const SectionLabel: React.FC<{ label: string }> = ({ label }) => (
  <div
    style={{
      padding: "8px 12px 4px",
      fontSize: "10px",
      fontWeight: 700,
      color: "var(--vscode-descriptionForeground, #888)",
      textTransform: "uppercase",
      letterSpacing: "0.06em",
    }}
  >
    {label}
  </div>
);

// ─── Component ──────────────────────────────────────────────────────────
const PromptSettingsDropdown: React.FC<PromptSettingsDropdownProps> = ({
  systemPromptMode,
  onSelectSystemPromptMode,
  isAntiInjection = false,
  diagnosticEnabled = false,
  onDiagnosticToggle,
  skillEnabled = false,
  onSkillToggle,
  memoryEnabled = false,
  onMemoryToggle,
  toolFormat = "xml",
  onToolFormatToggle,
  formatOnly = false,
}) => {
  const [hovered, setHovered] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const styleCodeMeta =
    STYLE_CODE_MODE_META.find((m) => m.key === systemPromptMode) ??
    STYLE_CODE_MODE_META.find((m) => m.key === "balanced")!;

  if (formatOnly) {
    const isJson = toolFormat === "json";
    const formatColor = isJson
      ? "#3b82f6"
      : "var(--vscode-descriptionForeground, #888)";
    return (
      <SimpleTooltip
        content={
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span style={{ color: formatColor, opacity: isJson ? 1 : 0.6 }}>
              <FormatIcon size={11} />
            </span>
            <span style={{ fontWeight: 600, color: formatColor }}>
              Format {isJson ? "JSON" : "XML"}
            </span>
          </div>
        }
      >
        <button
          onClick={() => onToolFormatToggle?.()}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            height: "24px",
            boxSizing: "border-box",
            borderRadius: "6px",
            cursor: "pointer",
            transition: "all 0.15s ease-in-out",
            border: "1px solid transparent",
            background: hovered
              ? "rgba(128, 128, 128, 0.16)"
              : "rgba(128, 128, 128, 0.06)",
            padding: "0 6px",
          }}
        >
          <FormatText format={toolFormat} />
        </button>
      </SimpleTooltip>
    );
  }

  // ── Trigger pill: 3 icons liên tiếp ──────────────────────────────────
  const pill = (
    <button
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        height: "24px",
        boxSizing: "border-box",
        borderRadius: "6px",
        cursor: "pointer",
        transition: "all 0.15s ease-in-out",
        border: "1px solid transparent",
        background: hovered
          ? "rgba(128, 128, 128, 0.16)"
          : "rgba(128, 128, 128, 0.06)",
        padding: "0 5px",
        gap: "4px",
      }}
    >
      {/* Icon 1: Style Code */}
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          color: isAntiInjection
            ? "var(--vscode-descriptionForeground, #888)"
            : styleCodeMeta.color,
          opacity: isAntiInjection ? 0.4 : 1,
        }}
      >
        <StyleCodeTriggerIcon mode={systemPromptMode} />
      </span>

      {/* Micro-divider */}
      <span
        style={{
          width: "1px",
          height: "12px",
          background: "var(--vscode-widget-border, rgba(128,128,128,0.25))",
          flexShrink: 0,
        }}
      />

      {/* Icon 2: Diagnostics */}
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          color: diagnosticEnabled
            ? "#22c55e"
            : "var(--vscode-descriptionForeground, #888)",
          opacity: diagnosticEnabled ? 1 : 0.6,
        }}
      >
        <DiagnosticsIcon size={13} />
      </span>

      {/* Micro-divider */}
      <span
        style={{
          width: "1px",
          height: "12px",
          background: "var(--vscode-widget-border, rgba(128,128,128,0.25))",
          flexShrink: 0,
        }}
      />

      {/* Icon 3: Skill */}
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          color: skillEnabled
            ? "#6366f1"
            : "var(--vscode-descriptionForeground, #888)",
          opacity: skillEnabled ? 1 : 0.6,
        }}
      >
        <SkillIcon size={13} />
      </span>

      {/* Micro-divider */}
      <span
        style={{
          width: "1px",
          height: "12px",
          background: "var(--vscode-widget-border, rgba(128,128,128,0.25))",
          flexShrink: 0,
        }}
      />

      {/* Icon 4: Memory */}
      <span
        style={{
          display: "inline-flex",
          alignItems: "center",
          color: memoryEnabled
            ? "#a855f7"
            : "var(--vscode-descriptionForeground, #888)",
          opacity: memoryEnabled ? 1 : 0.6,
        }}
      >
        <MemoryIcon size={13} />
      </span>

      {/* Micro-divider */}
      <span
        style={{
          width: "1px",
          height: "12px",
          background: "var(--vscode-widget-border, rgba(128,128,128,0.25))",
          flexShrink: 0,
        }}
      />

      {/* Icon 5: Tool Format */}
      <span style={{ display: "inline-flex", alignItems: "center" }}>
        <FormatText format={toolFormat} />
      </span>
    </button>
  );

  const tooltipContent = (
    <TooltipCard>
      <TooltipHeader
        icon={<StyleCodeTriggerIcon mode={systemPromptMode} />}
        title={styleCodeMeta.label}
        color={
          isAntiInjection
            ? "var(--vscode-descriptionForeground, #888)"
            : styleCodeMeta.color
        }
      />
      <div
        style={{
          height: "1px",
          background: "rgba(128, 128, 128, 0.18)",
        }}
      />
      <TooltipRow
        icon={<DiagnosticsIcon size={13} />}
        label="Diagnostics"
        value={diagnosticEnabled ? "ON" : "OFF"}
        color="#22c55e"
        active={diagnosticEnabled}
      />
      <TooltipRow
        icon={<SkillIcon size={13} />}
        label="Skill"
        value={skillEnabled ? "ON" : "OFF"}
        color="#6366f1"
        active={skillEnabled}
      />
      <TooltipRow
        icon={<MemoryIcon size={13} />}
        label="Memory"
        value={memoryEnabled ? "ON" : "OFF"}
        color="#a855f7"
        active={memoryEnabled}
      />
      <TooltipRow
        icon={<FormatIcon size={13} />}
        label="Format"
        value={toolFormat === "json" ? "JSON" : "XML"}
        color="#3b82f6"
      />
    </TooltipCard>
  );

  return (
    <SimpleTooltip content={tooltipContent} disabled={dropdownOpen}>
      <span style={{ display: "inline-flex" }}>
        <Dropdown
          side="top"
          align="start"
          sideOffset={4}
          minWidth="260px"
          onOpenChange={setDropdownOpen}
        >
          <DropdownTrigger asChild>{pill}</DropdownTrigger>
          <DropdownContent size="lg">
            {/* ── Section 1: Style Code ── */}
            <SectionLabel label="Style Code" />

            {isAntiInjection && (
              <div
                style={{
                  margin: "0 12px 6px",
                  padding: "6px 10px",
                  borderRadius: "6px",
                  backgroundColor: "rgba(245,158,11,0.08)",
                  border: "1px solid rgba(245,158,11,0.2)",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "10.5px",
                  color: "#f59e0b",
                }}
              >
                <Ban size={11} style={{ flexShrink: 0 }} />
                <span>
                  Provider injects its own system prompt — presets unavailable.
                </span>
              </div>
            )}

            {STYLE_CODE_MODE_META.map((meta) => {
              const isSelected = systemPromptMode === meta.key;
              const isDisabled = isAntiInjection;
              return (
                <button
                  key={meta.key}
                  onClick={() =>
                    !isDisabled && onSelectSystemPromptMode(meta.key)
                  }
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    background:
                      isSelected && !isDisabled
                        ? `color-mix(in srgb, ${meta.color} 10%, transparent)`
                        : "transparent",
                    borderLeft:
                      isSelected && !isDisabled
                        ? `3px solid ${meta.color}`
                        : "3px solid transparent",
                    border: "none",
                    borderRight: "none",
                    borderTop: "none",
                    borderBottom: "none",
                    cursor: isDisabled ? "not-allowed" : "pointer",
                    opacity: isDisabled ? 0.35 : 1,
                    transition: "background 0.12s ease",
                    textAlign: "left",
                  }}
                  onMouseEnter={(e) => {
                    if (!isDisabled && !isSelected)
                      e.currentTarget.style.background =
                        "var(--hover-bg, rgba(128,128,128,0.08))";
                  }}
                  onMouseLeave={(e) => {
                    if (!isDisabled && !isSelected)
                      e.currentTarget.style.background = isSelected
                        ? `color-mix(in srgb, ${meta.color} 10%, transparent)`
                        : "transparent";
                  }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "28px",
                      height: "28px",
                      borderRadius: "7px",
                      backgroundColor: isDisabled
                        ? "rgba(128,128,128,0.08)"
                        : `color-mix(in srgb, ${meta.color} 15%, transparent)`,
                      color: isDisabled ? "var(--secondary-text)" : meta.color,
                      flexShrink: 0,
                    }}
                  >
                    {meta.icon}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: "12.5px",
                        fontWeight: 600,
                        color: "var(--primary-text)",
                        marginBottom: "1px",
                      }}
                    >
                      {meta.label}
                      {isSelected && !isDisabled && (
                        <span
                          style={{
                            marginLeft: "6px",
                            fontSize: "9px",
                            color: meta.color,
                            fontWeight: 700,
                          }}
                        >
                          ●
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: "10.5px",
                        color: "var(--secondary-text)",
                        lineHeight: 1.35,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {meta.desc}
                    </div>
                  </div>
                </button>
              );
            })}

            <Divider />

            {/* ── Section 2: Diagnostics ── */}
            <SectionLabel label="Diagnostics" />
            <button
              onClick={() => onDiagnosticToggle?.()}
              style={{
                width: "100%",
                padding: "8px 12px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
                transition: "background 0.12s ease",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background =
                  "var(--hover-bg, rgba(128,128,128,0.08))")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "28px",
                  height: "28px",
                  borderRadius: "7px",
                  backgroundColor: diagnosticEnabled
                    ? "rgba(34,197,94,0.15)"
                    : "rgba(34,197,94,0.07)",
                  color: diagnosticEnabled ? "#22c55e" : "rgba(34,197,94,0.5)",
                  flexShrink: 0,
                }}
              >
                <DiagnosticsIcon size={14} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "12.5px",
                    fontWeight: 600,
                    color: "var(--primary-text)",
                    marginBottom: "1px",
                  }}
                >
                  Attach diagnostics
                </div>
                <div
                  style={{
                    fontSize: "10.5px",
                    color: "var(--secondary-text)",
                    lineHeight: 1.35,
                  }}
                >
                  Include VSCode errors & warnings in context
                </div>
              </div>
              <TickBox
                isOn={diagnosticEnabled}
                onToggle={() => onDiagnosticToggle?.()}
              />
            </button>

            <Divider />

            {/* ── Section 3: Skill ── */}
            <SectionLabel label="Skill" />
            <button
              onClick={() => onSkillToggle?.()}
              style={{
                width: "100%",
                padding: "8px 12px",
                marginBottom: "4px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
                transition: "background 0.12s ease",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background =
                  "var(--hover-bg, rgba(128,128,128,0.08))")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "28px",
                  height: "28px",
                  borderRadius: "7px",
                  backgroundColor: skillEnabled
                    ? "rgba(99,102,241,0.15)"
                    : "rgba(99,102,241,0.07)",
                  color: skillEnabled ? "#6366f1" : "rgba(99,102,241,0.5)",
                  flexShrink: 0,
                }}
              >
                <SkillIcon size={14} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "12.5px",
                    fontWeight: 600,
                    color: "var(--primary-text)",
                    marginBottom: "1px",
                  }}
                >
                  Skill instructions
                </div>
                <div
                  style={{
                    fontSize: "10.5px",
                    color: "var(--secondary-text)",
                    lineHeight: 1.35,
                  }}
                >
                  Inject skill instructions into system prompt
                </div>
              </div>
              <TickBox
                isOn={skillEnabled}
                onToggle={() => onSkillToggle?.()}
              />
            </button>

            <Divider />

            {/* ── Section 4: Memory ── */}
            <SectionLabel label="Memory" />
            <button
              onClick={() => onMemoryToggle?.()}
              style={{
                width: "100%",
                padding: "8px 12px",
                marginBottom: "4px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                background: "transparent",
                border: "none",
                cursor: "pointer",
                textAlign: "left",
                transition: "background 0.12s ease",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background =
                  "var(--hover-bg, rgba(128,128,128,0.08))")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "transparent")
              }
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "28px",
                  height: "28px",
                  borderRadius: "7px",
                  backgroundColor: memoryEnabled
                    ? "rgba(168,85,247,0.15)"
                    : "rgba(168,85,247,0.07)",
                  color: memoryEnabled ? "#a855f7" : "rgba(168,85,247,0.5)",
                  flexShrink: 0,
                }}
              >
                <MemoryIcon size={14} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: "12.5px",
                    fontWeight: 600,
                    color: "var(--primary-text)",
                    marginBottom: "1px",
                  }}
                >
                  Global memory
                </div>
                <div
                  style={{
                    fontSize: "10.5px",
                    color: "var(--secondary-text)",
                    lineHeight: 1.35,
                  }}
                >
                  Persist durable facts across conversations
                </div>
              </div>
              <TickBox
                isOn={memoryEnabled}
                onToggle={() => onMemoryToggle?.()}
              />
            </button>

            <Divider />

            {/* ── Section 5: Tool Format ── */}
            <SectionLabel label="Tool Format" />

            {(
              [
                {
                  key: "xml",
                  label: "XML tool calls",
                  desc: "AI uses XML tags for tool calls (default)",
                },
                {
                  key: "json",
                  label: "JSON tool calls",
                  desc: "AI uses fenced JSON objects for tool calls",
                },
              ] as const
            ).map((opt) => {
              const isSelected = toolFormat === opt.key;
              const color = FORMAT_COLORS[opt.key];
              return (
                <button
                  key={opt.key}
                  onClick={() => {
                    if (!isSelected) onToolFormatToggle?.();
                  }}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    background: isSelected
                      ? `color-mix(in srgb, ${color} 10%, transparent)`
                      : "transparent",
                    borderLeft: isSelected
                      ? `3px solid ${color}`
                      : "3px solid transparent",
                    border: "none",
                    borderRight: "none",
                    borderTop: "none",
                    borderBottom: "none",
                    cursor: "pointer",
                    transition: "background 0.12s ease",
                    textAlign: "left",
                  }}
                  onMouseEnter={(e) => {
                    if (!isSelected)
                      e.currentTarget.style.background =
                        "var(--hover-bg, rgba(128,128,128,0.08))";
                  }}
                  onMouseLeave={(e) => {
                    if (!isSelected) e.currentTarget.style.background = "transparent";
                  }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      width: "28px",
                      height: "28px",
                      borderRadius: "7px",
                      backgroundColor: `color-mix(in srgb, ${color} 15%, transparent)`,
                      flexShrink: 0,
                    }}
                  >
                    <FormatText format={opt.key} />
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: "12.5px",
                        fontWeight: 600,
                        color: "var(--primary-text)",
                        marginBottom: "1px",
                      }}
                    >
                      {opt.label}
                      {isSelected && (
                        <span
                          style={{
                            marginLeft: "6px",
                            fontSize: "9px",
                            color,
                            fontWeight: 700,
                          }}
                        >
                          ●
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: "10.5px",
                        color: "var(--secondary-text)",
                        lineHeight: 1.35,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {opt.desc}
                    </div>
                  </div>
                </button>
              );
            })}
          </DropdownContent>
        </Dropdown>
      </span>
    </SimpleTooltip>
  );
};

export default PromptSettingsDropdown;
