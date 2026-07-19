import React from "react";
import { ToolHeader } from "../../tools/ToolHeader";
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
    <div className="warning-block-wrapper">
      <ToolHeader
        title={label}
        statusColor={warningColor}
        isPartial={isPulsing}
        statusTooltip={label}
      />
      
      {/* Warning Message Block */}
      {message && (
        <div
          className="warning-message-block"
          style={{
            border: `1px solid color-mix(in srgb, ${warningColor} 30%, transparent)`,
            background: `color-mix(in srgb, ${warningColor} 5%, transparent)`,
          }}
        >
          <span className="warning-message-text" style={{ color: warningColor }}>
            {message}
          </span>
        </div>
      )}
    </div>
  );
};
