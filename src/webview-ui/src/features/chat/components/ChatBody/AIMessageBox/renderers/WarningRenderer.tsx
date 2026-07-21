import React from "react";

// COMPONENTS
import WarningBlock from "../blocks/warning/WarningBlock";

interface WarningRendererProps {
  label: string;
  message: string;
  warningColor?: string;
  isPulsing?: boolean;
}

/**
 * Renderer for warning blocks
 * Displays warning messages with optional pulsing animation
 */
export const WarningRenderer: React.FC<WarningRendererProps> = ({
  label,
  message,
  warningColor = "var(--vscode-editorWarning-foreground, #cca700)",
  isPulsing = false,
}) => {
  return (
    <WarningBlock
      label={label}
      message={message}
      warningColor={warningColor}
      isPulsing={isPulsing}
    />
  );
};
