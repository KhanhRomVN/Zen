import React from "react";

interface ToggleProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  size?: number;
  title?: string;
}

/**
 * Toggle switch đơn giản, style theo theme VSCode.
 * Dùng cho các cờ bật/tắt boolean trong UI.
 */
export function Toggle({
  checked,
  onChange,
  disabled = false,
  size = 28,
  title,
}: ToggleProps) {
  const width = size;
  const height = Math.round(size * 0.57);
  const knob = height - 4;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      title={title}
      onClick={(e) => {
        e.stopPropagation();
        if (!disabled) onChange(!checked);
      }}
      style={{
        width,
        height,
        borderRadius: height / 2,
        border: "none",
        cursor: disabled ? "not-allowed" : "pointer",
        padding: 0,
        position: "relative",
        backgroundColor: checked
          ? "var(--vscode-button-background, #0e639c)"
          : "rgba(128,128,128,0.4)",
        transition: "background-color 0.15s ease",
        opacity: disabled ? 0.5 : 1,
        flexShrink: 0,
      }}
    >
      <span
        style={{
          position: "absolute",
          top: 2,
          left: checked ? width - knob - 2 : 2,
          width: knob,
          height: knob,
          borderRadius: "50%",
          backgroundColor: "#fff",
          transition: "left 0.15s ease",
        }}
      />
    </button>
  );
}

export default Toggle;