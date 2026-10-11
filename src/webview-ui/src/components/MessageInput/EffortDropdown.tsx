/**
 * ------------------------------------------------------------------
 * EffortDropdown
 * ------------------------------------------------------------------
 * Chọn mức effort của model ngay trên toolbar MessageInput.
 * Kéo thanh trượt trái ↔ phải (hoặc dùng phím mũi tên) để đổi mức.
 * Effort được mã hóa trong model id dạng `<base>-<effort>`.
 * ------------------------------------------------------------------
 */

import React, { useRef, useState } from "react";
import { Feather, Gauge, Flame, Sparkles, Cpu } from "lucide-react";
import { Dropdown, DropdownTrigger, DropdownContent } from "../ui/Dropdown";

export const EFFORT_LEVELS = ["low", "medium", "high", "xhigh", "max"] as const;
export type EffortLevel = (typeof EFFORT_LEVELS)[number];

export const DEFAULT_EFFORT: EffortLevel = "medium";

export const EFFORT_COLOR: Record<EffortLevel, string> = {
  low: "#6b7280",
  medium: "#3b82f6",
  high: "#10b981",
  xhigh: "#f59e0b",
  max: "#ef4444",
};

export const EFFORT_LABEL: Record<EffortLevel, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  xhigh: "Extra",
  max: "Max",
};

export const EFFORT_META: Record<
  EffortLevel,
  { icon: React.ElementType; description: string }
> = {
  low: {
    icon: Feather,
    description:
      "Minimal thinking — fastest responses, best for simple or factual tasks.",
  },
  medium: {
    icon: Gauge,
    description:
      "Balanced thinking — good reasoning without heavy compute overhead.",
  },
  high: {
    icon: Flame,
    description:
      "Deep reasoning — handles complex logic, multi-step problems well.",
  },
  xhigh: {
    icon: Sparkles,
    description:
      "Extra intense thinking — for difficult research and nuanced analysis.",
  },
  max: {
    icon: Cpu,
    description:
      "Maximum effort — full cognitive power, slowest but most thorough.",
  },
};

export function splitModelAndEffort(modelId: string): {
  base: string;
  effort: EffortLevel | null;
} {
  for (const lvl of EFFORT_LEVELS) {
    if (modelId.endsWith(`-${lvl}`)) {
      return { base: modelId.slice(0, -(lvl.length + 1)), effort: lvl };
    }
  }
  return { base: modelId, effort: null };
}

export function getModelEffortInfo(
  providers: any[],
  providerId?: string,
  modelId?: string,
): { base: string; effort: EffortLevel; options: EffortLevel[] } | null {
  if (!providerId || !modelId) return null;
  const { base, effort } = splitModelAndEffort(modelId);
  if (!effort) return null;
  const prov = providers.find(
    (p: any) => p.provider_id?.toLowerCase() === providerId.toLowerCase(),
  );
  if (!prov?.models) return null;
  const present = new Set<EffortLevel>();
  for (const m of prov.models as any[]) {
    const parsed = splitModelAndEffort(m.id);
    if (parsed.base === base && parsed.effort) present.add(parsed.effort);
  }
  const options = EFFORT_LEVELS.filter((lvl) => present.has(lvl));
  return { base, effort, options };
}

interface EffortDropdownProps {
  effort: EffortLevel;
  options: EffortLevel[];
  onChange: (effort: EffortLevel) => void;
}

const EffortDropdown: React.FC<EffortDropdownProps> = ({
  effort,
  options,
  onChange,
}) => {
  const [hovered, setHovered] = useState(false);
  const trackRef = useRef<HTMLDivElement>(null);

  const color = EFFORT_COLOR[effort];
  const Icon = EFFORT_META[effort].icon;
  const lastIndex = Math.max(options.length - 1, 1);
  const currentIndex = Math.max(options.indexOf(effort), 0);
  const percent = (currentIndex / lastIndex) * 100;
  const gradient = `linear-gradient(to right, ${options
    .map((lvl) => EFFORT_COLOR[lvl])
    .join(", ")})`;

  const selectFromClientX = (clientX: number) => {
    const rect = trackRef.current?.getBoundingClientRect();
    if (!rect || rect.width === 0) return;
    const ratio = Math.min(1, Math.max(0, (clientX - rect.left) / rect.width));
    const next = options[Math.round(ratio * (options.length - 1))];
    if (next && next !== effort) onChange(next);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    let next = currentIndex;
    if (e.key === "ArrowLeft" || e.key === "ArrowDown") next = currentIndex - 1;
    else if (e.key === "ArrowRight" || e.key === "ArrowUp")
      next = currentIndex + 1;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = options.length - 1;
    else return;
    e.preventDefault();
    const target = options[Math.min(options.length - 1, Math.max(0, next))];
    if (target && target !== effort) onChange(target);
  };

  const trackLayer: React.CSSProperties = {
    position: "absolute",
    left: 0,
    right: 0,
    top: "50%",
    height: "6px",
    transform: "translateY(-50%)",
    borderRadius: "999px",
    background: gradient,
  };

  const trigger = (
    <button
      title={`Effort: ${EFFORT_LABEL[effort]}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "4px",
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
      <Icon size={12} style={{ color }} />
      <span
        style={{
          fontSize: "9px",
          fontWeight: 700,
          letterSpacing: "0.04em",
          lineHeight: 1,
          textTransform: "uppercase",
          color,
        }}
      >
        {EFFORT_LABEL[effort]}
      </span>
    </button>
  );

  return (
    <Dropdown side="top" align="start" sideOffset={4} minWidth="240px">
      <DropdownTrigger asChild>{trigger}</DropdownTrigger>
      <DropdownContent size="lg">
        <div style={{ padding: "10px 14px 12px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: "8px",
            }}
          >
            <span
              style={{
                fontSize: "10px",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.06em",
                color: "var(--vscode-descriptionForeground, #888)",
              }}
            >
              Effort
            </span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                fontSize: "11px",
                fontWeight: 700,
                color,
              }}
            >
              <Icon size={12} />
              {EFFORT_LABEL[effort]}
            </span>
          </div>

          <div
            ref={trackRef}
            role="slider"
            tabIndex={0}
            aria-valuemin={0}
            aria-valuemax={options.length - 1}
            aria-valuenow={currentIndex}
            aria-valuetext={EFFORT_LABEL[effort]}
            onKeyDown={handleKeyDown}
            onPointerDown={(e) => {
              e.currentTarget.focus();
              e.currentTarget.setPointerCapture(e.pointerId);
              selectFromClientX(e.clientX);
            }}
            onPointerMove={(e) => {
              if (e.currentTarget.hasPointerCapture(e.pointerId))
                selectFromClientX(e.clientX);
            }}
            onPointerUp={(e) => {
              e.currentTarget.releasePointerCapture(e.pointerId);
            }}
            style={{
              position: "relative",
              height: "24px",
              margin: "0 10px",
              cursor: "pointer",
              touchAction: "none",
              outline: "none",
            }}
          >
            <div style={{ ...trackLayer, opacity: 0.25 }} />
            <div
              style={{
                ...trackLayer,
                clipPath: `inset(0 ${100 - percent}% 0 0)`,
              }}
            />
            {options.map((lvl, i) => (
              <span
                key={lvl}
                style={{
                  position: "absolute",
                  top: "50%",
                  left: `${(i / lastIndex) * 100}%`,
                  width: "4px",
                  height: "4px",
                  borderRadius: "50%",
                  transform: "translate(-50%, -50%)",
                  background: "var(--vscode-editor-background, #1e1e1e)",
                  opacity: 0.6,
                  pointerEvents: "none",
                }}
              />
            ))}
            <span
              style={{
                position: "absolute",
                top: "50%",
                left: `${percent}%`,
                width: "16px",
                height: "16px",
                boxSizing: "border-box",
                borderRadius: "50%",
                transform: "translate(-50%, -50%)",
                background: color,
                border: "2px solid var(--vscode-editor-background, #1e1e1e)",
                boxShadow: `0 0 0 1px ${color}`,
                transition: "left 0.12s ease, background 0.12s ease",
                pointerEvents: "none",
              }}
            />
          </div>

          <div style={{ position: "relative", height: "14px", margin: "4px 10px 0" }}>
            {options.map((lvl, i) => {
              const isActive = lvl === effort;
              return (
                <span
                  key={lvl}
                  onClick={() => onChange(lvl)}
                  style={{
                    position: "absolute",
                    left: `${(i / lastIndex) * 100}%`,
                    transform: "translateX(-50%)",
                    fontSize: "9.5px",
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? EFFORT_COLOR[lvl] : "var(--secondary-text)",
                    opacity: isActive ? 1 : 0.7,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    userSelect: "none",
                  }}
                >
                  {EFFORT_LABEL[lvl]}
                </span>
              );
            })}
          </div>

          <div
            style={{
              marginTop: "10px",
              fontSize: "10.5px",
              lineHeight: 1.45,
              color: "var(--secondary-text)",
            }}
          >
            {EFFORT_META[effort].description}
          </div>
        </div>
      </DropdownContent>
    </Dropdown>
  );
};

export default EffortDropdown;