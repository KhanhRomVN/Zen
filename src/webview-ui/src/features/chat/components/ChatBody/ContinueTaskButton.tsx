import React from "react";

interface ContinueTaskButtonProps {
  onContinue: () => void;
}

const ContinueTaskButton: React.FC<ContinueTaskButtonProps> = ({
  onContinue,
}) => {
  return (
    <div
      style={{
        marginTop: "12px",
        marginBottom: "12px",
        display: "flex",
      }}
    >
      <button
        onClick={onContinue}
        style={{
          backgroundColor:
            "color-mix(in srgb, var(--vscode-button-background, #007acc) 15%, transparent)",
          color: "var(--vscode-button-background, #007acc)",
          border:
            "1px solid color-mix(in srgb, var(--vscode-button-background, #007acc) 30%, transparent)",
          padding: "6px 16px",
          borderRadius: "6px",
          cursor: "pointer",
          fontSize: "11px",
          fontWeight: 600,
          textTransform: "uppercase",
          letterSpacing: "0.5px",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "6px",
          height: "28px",
          boxSizing: "border-box",
          transition: "all 0.2s ease",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor =
            "color-mix(in srgb, var(--vscode-button-background, #007acc) 25%, transparent)";
          e.currentTarget.style.borderColor =
            "color-mix(in srgb, var(--vscode-button-background, #007acc) 50%, transparent)";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor =
            "color-mix(in srgb, var(--vscode-button-background, #007acc) 15%, transparent)";
          e.currentTarget.style.borderColor =
            "color-mix(in srgb, var(--vscode-button-background, #007acc) 30%, transparent)";
        }}
      >
        <span
          className="codicon codicon-play"
          style={{
            fontSize: "12px",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        />
        <span>Continue Task</span>
      </button>
    </div>
  );
};

export default ContinueTaskButton;
