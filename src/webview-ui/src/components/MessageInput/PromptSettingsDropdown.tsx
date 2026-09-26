/**
 * ------------------------------------------------------------------
 * PromptSettingsDropdown
 * ------------------------------------------------------------------
 * Dropdown gộp 3 cài đặt phụ thuộc vào prompt-length:
 *   1. Style Code   — chọn preset system prompt style
 *   2. Diagnostics  — toggle VSCode diagnostics vào context
 *   3. Skill        — toggle skill instructions
 *
 * Trigger button: pill hiển thị 3 icon liên tiếp.
 * Ẩn hoàn toàn khi promptLengthMode === "none".
 * ------------------------------------------------------------------
 */

import React, { useState } from "react";
import { Ban, Stethoscope, Sparkles } from "lucide-react";
import type { SystemPromptMode } from "../../features/chat/prompts";
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
} from "../ui/Dropdown";
import { STYLE_CODE_MODE_META, StyleCodeTriggerIcon } from "./StyleCodeDropdown";

// ─── SimpleTooltip (local copy — SimpleTooltip chưa được export từ index.tsx) ──
const SimpleTooltip: React.FC<{
  content: React.ReactNode;
  children: React.ReactElement;
  disabled?: boolean;
}> = ({ content, children, disabled }) => {
  const [pos, setPos] = React.useState<{ x: number; y: number } | null>(null);

  const show = (e: React.MouseEvent) => {
    if (disabled) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPos({ x: rect.left + rect.width / 2, y: rect.top - 6 });
  };
  const hide = () => setPos(null);

  return (
    <>
      {React.cloneElement(children, {
        onMouseEnter: (e: React.MouseEvent) => {
          children.props.onMouseEnter?.(e);
          show(e);
        },
        onMouseLeave: (e: React.MouseEvent) => {
          children.props.onMouseLeave?.(e);
          hide();
        },
        // Ẩn ngay khi click mở dropdown
        onMouseDown: (e: React.MouseEvent) => {
          children.props.onMouseDown?.(e);
          hide();
        },
      })}
      {pos && !disabled && (
        <div
          style={{
            position: "fixed",
            left: pos.x,
            top: pos.y,
            transform: "translate(-50%, -100%)",
            zIndex: 99999,
            backgroundColor: "var(--vscode-editorHoverWidget-background, #252526)",
            border: "1px solid var(--vscode-editorHoverWidget-border, #454545)",
            borderRadius: "5px",
            padding: "4px 8px",
            fontSize: "11px",
            color: "var(--vscode-foreground)",
            whiteSpace: "nowrap",
            pointerEvents: "none",
            boxShadow: "0 3px 10px rgba(0,0,0,0.35)",
            marginBottom: "4px",
            display: "flex",
            alignItems: "center",
            gap: "4px",
          }}
        >
          {content}
        </div>
      )}
    </>
  );
};

// ─── Aliases ────────────────────────────────────────────────────────────
const DiagnosticsIcon = Stethoscope;
const SkillIcon = Sparkles;

// ─── Toggle Switch ──────────────────────────────────────────────────────
const ToggleSwitch: React.FC<{
  isOn: boolean;
  onToggle: () => void;
  color: string;
}> = ({ isOn, onToggle, color }) => (
  <button
    onClick={(e) => {
      e.stopPropagation();
      onToggle();
    }}
    style={{
      width: "32px",
      height: "18px",
      borderRadius: "999px",
      background: isOn ? color : "rgba(128,128,128,0.3)",
      position: "relative",
      cursor: "pointer",
      flexShrink: 0,
      transition: "background 0.15s ease",
      border: "none",
      padding: 0,
    }}
  >
    <span
      style={{
        position: "absolute",
        top: "2px",
        left: "2px",
        width: "14px",
        height: "14px",
        borderRadius: "50%",
        background: "#fff",
        transition: "transform 0.15s ease",
        transform: isOn ? "translateX(14px)" : "translateX(0)",
      }}
    />
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
}) => {
  const [hovered, setHovered] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const styleCodeMeta =
    STYLE_CODE_MODE_META.find((m) => m.key === systemPromptMode) ??
    STYLE_CODE_MODE_META.find((m) => m.key === "balanced")!;

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
    </button>
  );

  const tooltipContent = (
    <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
      <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
        <span style={{ color: isAntiInjection ? "var(--vscode-descriptionForeground, #888)" : styleCodeMeta.color, opacity: isAntiInjection ? 0.5 : 1 }}>
          <StyleCodeTriggerIcon mode={systemPromptMode} />
        </span>
        <span style={{ fontWeight: 600, color: isAntiInjection ? "var(--vscode-descriptionForeground, #888)" : styleCodeMeta.color }}>
          {styleCodeMeta.label}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
        <span style={{ color: diagnosticEnabled ? "#22c55e" : "var(--vscode-descriptionForeground, #888)", opacity: diagnosticEnabled ? 1 : 0.6 }}>
          <DiagnosticsIcon size={11} />
        </span>
        <span style={{ fontWeight: 600, color: diagnosticEnabled ? "#22c55e" : "var(--vscode-descriptionForeground, #888)" }}>
          Diagnostics {diagnosticEnabled ? "ON" : "OFF"}
        </span>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
        <span style={{ color: skillEnabled ? "#6366f1" : "var(--vscode-descriptionForeground, #888)", opacity: skillEnabled ? 1 : 0.6 }}>
          <SkillIcon size={11} />
        </span>
        <span style={{ fontWeight: 600, color: skillEnabled ? "#6366f1" : "var(--vscode-descriptionForeground, #888)" }}>
          Skill {skillEnabled ? "ON" : "OFF"}
        </span>
      </div>
    </div>
  );

  return (
    <SimpleTooltip content={tooltipContent} disabled={dropdownOpen}>
      <span style={{ display: "inline-flex" }}>
        <Dropdown side="top" align="start" sideOffset={4} minWidth="260px" onOpenChange={setDropdownOpen}>
          <DropdownTrigger asChild>{pill}</DropdownTrigger>
          <DropdownContent>
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
                <span>Provider injects its own system prompt — presets unavailable.</span>
              </div>
            )}

            {STYLE_CODE_MODE_META.map((meta) => {
              const isSelected = systemPromptMode === meta.key;
              const isDisabled = isAntiInjection;
              return (
                <button
                  key={meta.key}
                  onClick={() => !isDisabled && onSelectSystemPromptMode(meta.key)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    background: isSelected && !isDisabled
                      ? `color-mix(in srgb, ${meta.color} 10%, transparent)`
                      : "transparent",
                    borderLeft: isSelected && !isDisabled
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
                      e.currentTarget.style.background = "var(--hover-bg, rgba(128,128,128,0.08))";
                  }}
                  onMouseLeave={(e) => {
                    if (!isDisabled && !isSelected)
                      e.currentTarget.style.background = isSelected ? `color-mix(in srgb, ${meta.color} 10%, transparent)` : "transparent";
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
                    <div style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--primary-text)", marginBottom: "1px" }}>
                      {meta.label}
                      {isSelected && !isDisabled && (
                        <span style={{ marginLeft: "6px", fontSize: "9px", color: meta.color, fontWeight: 700 }}>●</span>
                      )}
                    </div>
                    <div style={{ fontSize: "10.5px", color: "var(--secondary-text)", lineHeight: 1.35, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
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
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--hover-bg, rgba(128,128,128,0.08))")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "28px",
                  height: "28px",
                  borderRadius: "7px",
                  backgroundColor: diagnosticEnabled ? "rgba(34,197,94,0.15)" : "rgba(34,197,94,0.07)",
                  color: diagnosticEnabled ? "#22c55e" : "rgba(34,197,94,0.5)",
                  flexShrink: 0,
                }}
              >
                <DiagnosticsIcon size={14} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--primary-text)", marginBottom: "1px" }}>
                  Attach diagnostics
                </div>
                <div style={{ fontSize: "10.5px", color: "var(--secondary-text)", lineHeight: 1.35 }}>
                  Include VSCode errors & warnings in context
                </div>
              </div>
              <ToggleSwitch isOn={diagnosticEnabled} onToggle={() => onDiagnosticToggle?.()} color="#22c55e" />
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
              onMouseEnter={(e) => (e.currentTarget.style.background = "var(--hover-bg, rgba(128,128,128,0.08))")}
              onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: "28px",
                  height: "28px",
                  borderRadius: "7px",
                  backgroundColor: skillEnabled ? "rgba(99,102,241,0.15)" : "rgba(99,102,241,0.07)",
                  color: skillEnabled ? "#6366f1" : "rgba(99,102,241,0.5)",
                  flexShrink: 0,
                }}
              >
                <SkillIcon size={14} />
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: "12.5px", fontWeight: 600, color: "var(--primary-text)", marginBottom: "1px" }}>
                  Skill instructions
                </div>
                <div style={{ fontSize: "10.5px", color: "var(--secondary-text)", lineHeight: 1.35 }}>
                  Inject skill instructions into system prompt
                </div>
              </div>
              <ToggleSwitch isOn={skillEnabled} onToggle={() => onSkillToggle?.()} color="#6366f1" />
            </button>
          </DropdownContent>
        </Dropdown>
      </span>
    </SimpleTooltip>
  );
};

export default PromptSettingsDropdown;
