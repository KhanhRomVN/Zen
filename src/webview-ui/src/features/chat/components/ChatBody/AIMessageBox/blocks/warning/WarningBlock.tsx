import React from "react";
import "./WarningBlock.css";

interface WarningBlockProps {
  message: string;
  warningColor?: string;
}

/**
 * WarningBlock component - displays warning message content only.
 * Header is handled by WarningRenderer using TagHeader.
 */
const WarningBlock: React.FC<WarningBlockProps> = ({
  message,
  warningColor = "var(--vscode-editorWarning-foreground, #cca700)",
}) => {
  return (
    <div
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        paddingBottom: "0px",
      }}
    >
      {/* Warning Message Block */}
      {message && (
        <div
          className="warning-message-block"
          style={{
            border: `1px solid color-mix(in srgb, ${warningColor} 30%, transparent)`,
            background: `color-mix(in srgb, ${warningColor} 5%, transparent)`,
          }}
        >
          <span
            className="warning-message-text"
            style={{ color: warningColor }}
          >
            {message}
          </span>
        </div>
      )}
    </div>
  );
};

export default WarningBlock;
