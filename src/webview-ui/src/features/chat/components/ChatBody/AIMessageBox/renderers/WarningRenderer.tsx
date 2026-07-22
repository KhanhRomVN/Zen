import React from "react";

// COMPONENTS
import WarningBlock from "../blocks/warning/WarningBlock";
import { TagHeader } from "../TagHeader";

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
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <TagHeader
        title={label}
        statusColor={warningColor}
        isPartial={isPulsing}
        statusTooltip="Warning"
      />
      <WarningBlock
        message={message}
        warningColor={warningColor}
      />
    </div>
  );
};
