import React from "react";
import { ToggleButtonProps } from "./types";
import { BrainCogIcon, GlobeIcon, MemoryIcon } from "./icons";

export const ThinkingButton: React.FC<ToggleButtonProps> = ({
  isOn,
  onClick,
  title,
}) => {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "4px",
        padding: "0 8px",
        height: "22px",
        boxSizing: "border-box",
        borderRadius: "4px",
        cursor: "pointer",
        fontSize: "11px",
        fontWeight: 600,
        letterSpacing: "0.3px",
        transition: "all 0.2s ease-in-out",
        border: "none",
        background: isOn
          ? isHovered
            ? "color-mix(in srgb, var(--vscode-editorBracketHighlight-foreground2, #a855f7) 20%, transparent)"
            : "color-mix(in srgb, var(--vscode-editorBracketHighlight-foreground2, #a855f7) 12%, transparent)"
          : isHovered
            ? "rgba(128, 128, 128, 0.2)"
            : "rgba(128, 128, 128, 0.12)",
        color: isOn
          ? "var(--vscode-editorBracketHighlight-foreground2, #a855f7)"
          : "var(--vscode-foreground)",
        opacity: isOn ? 1 : isHovered ? 0.9 : 0.7,
        lineHeight: 1,
        verticalAlign: "middle",
      }}
      title={title}
    >
      <BrainCogIcon />
      <span
        style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.3px" }}
      >
        Thinking
      </span>
    </button>
  );
};

export const SearchButton: React.FC<ToggleButtonProps> = ({
  isOn,
  onClick,
  title,
}) => {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "4px",
        padding: "0 8px",
        height: "22px",
        boxSizing: "border-box",
        borderRadius: "4px",
        cursor: "pointer",
        fontSize: "11px",
        fontWeight: 600,
        letterSpacing: "0.3px",
        transition: "all 0.2s ease-in-out",
        border: "none",
        background: isOn
          ? isHovered
            ? "color-mix(in srgb, var(--vscode-editorBracketHighlight-foreground1, #0ea5e9) 20%, transparent)"
            : "color-mix(in srgb, var(--vscode-editorBracketHighlight-foreground1, #0ea5e9) 12%, transparent)"
          : isHovered
            ? "rgba(128, 128, 128, 0.2)"
            : "rgba(128, 128, 128, 0.12)",
        color: isOn
          ? "var(--vscode-editorBracketHighlight-foreground1, #0ea5e9)"
          : "var(--vscode-foreground)",
        opacity: isOn ? 1 : isHovered ? 0.9 : 0.7,
        lineHeight: 1,
        verticalAlign: "middle",
      }}
      title={title}
    >
      <GlobeIcon />
      <span
        style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.3px" }}
      >
        Search
      </span>
    </button>
  );
};

export const MemoryButton: React.FC<ToggleButtonProps> = ({
  isOn,
  onClick,
  title,
}) => {
  const [isHovered, setIsHovered] = React.useState(false);

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "4px",
        padding: "0 8px",
        height: "22px",
        boxSizing: "border-box",
        borderRadius: "4px",
        cursor: "pointer",
        fontSize: "11px",
        fontWeight: 600,
        letterSpacing: "0.3px",
        transition: "all 0.2s ease-in-out",
        border: isOn
          ? "1px solid var(--vscode-editorBracketHighlight-foreground3, rgba(139, 92, 246, 0.4))"
          : "1px solid rgba(128, 128, 128, 0.2)",
        background: isOn
          ? isHovered
            ? "color-mix(in srgb, var(--vscode-editorBracketHighlight-foreground3, #8b5cf6) 20%, transparent)"
            : "color-mix(in srgb, var(--vscode-editorBracketHighlight-foreground3, #8b5cf6) 12%, transparent)"
          : isHovered
            ? "rgba(128, 128, 128, 0.2)"
            : "rgba(128, 128, 128, 0.12)",
        color: isOn
          ? "var(--vscode-editorBracketHighlight-foreground3, #8b5cf6)"
          : "var(--vscode-foreground)",
        opacity: isOn ? 1 : isHovered ? 0.9 : 0.7,
        lineHeight: 1,
        verticalAlign: "middle",
      }}
      title={title}
    >
      <MemoryIcon />
      <span
        style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.3px" }}
      >
        Memory
      </span>
    </button>
  );
};
