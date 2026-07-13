import React from "react";
import "./WarningBlock.css";

interface WarningBlockProps {
  /** Main title/label for the warning (e.g., "CONTINUING RESPONSE") */
  label: string;
  /** Warning message to display */
  message: string;
  /** Optional custom warning color (defaults to vscode warning color) */
  warningColor?: string;
  /** Whether to show pulsing animation on the dot */
  isPulsing?: boolean;
}

/**
 * WarningBlock component with ToolHeader-style layout.
 * Used for displaying warning messages like response continuation, partial tool assembly, etc.
 */
export const WarningBlock: React.FC<WarningBlockProps> = ({
  label,
  message,
  warningColor = "var(--vscode-editorWarning-foreground, #cca700)",
  isPulsing = true,
}) => {
  return (
    <div className="warning-block-container">
      {/* Header matching ToolHeader style */}
      <div className="warning-block-header">
        {/* Left panel: CircleDot with optional pulsing animation */}
        <div className="warning-block-left">
          <div
            className="warning-circle-dot-container"
            title={label}
          >
            {/* CircleDot with optional pulse animation */}
            <div
              className={`warning-circle-dot${isPulsing ? " pulsing" : ""}`}
              style={{
                backgroundColor: warningColor,
              }}
            />
          </div>
        </div>

        {/* Right panel: Label */}
        <div className="warning-block-right">
          <span
            className="warning-label"
            style={{
              color: warningColor,
            }}
          >
            {label}
          </span>
        </div>
      </div>

      {/* Warning Message Block */}
      {message && (
        <div
          className="warning-message-block"
          style={{
            border: `1px solid color-mix(in srgb, ${warningColor} 30%, transparent)`,
            background: `color-mix(in srgb, ${warningColor} 5%, transparent)`,
          }}
        >
          <span className="warning-message-text">{message}</span>
        </div>
      )}
    </div>
  );
};
