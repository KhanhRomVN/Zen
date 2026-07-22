import React from "react";

// COMPONENTS
import ErrorBlock from "../blocks/error/ErrorBlock";
import { TagHeader } from "../TagHeader";

interface ErrorRendererProps {
  content: string;
  errorCode?: string;
  toolName?: string;
  isLast?: boolean;
  isLastMessage?: boolean;
  maxHeight?: string;
  label?: string;
}

/**
 * Renderer for error blocks
 * Handles error display with optional tool name context
 */
export const ErrorRenderer: React.FC<ErrorRendererProps> = ({
  content,
  errorCode,
  toolName,
  isLast,
  isLastMessage,
  maxHeight = "300px",
  label,
}) => {
  // Translate error message
  const translateError = (raw: string): string => {
    const normalized = raw.trim().toLowerCase();
    if (/provider returned empty response/i.test(normalized))
      return "Provider returned empty response";
    if (/no response body/i.test(normalized)) return "No response body";
    if (/no workspace/i.test(normalized))
      return "No workspace folder is open. Open a folder to use file operations.";
    if (/path.*argument.*string|path.*required/i.test(normalized))
      return "Path argument must be a string and is required.";
    if (/file.*path.*required|missing file path/i.test(normalized))
      return "File path is required.";
    if (/folder.*path.*required/i.test(normalized))
      return "Folder path is required.";
    if (/security validation failed/i.test(normalized))
      return "Security validation failed: path is outside workspace.";
    if (/out of scope.*ignored/i.test(normalized))
      return "Path is out of scope and will be ignored.";
    if (/invalid diff format/i.test(normalized)) return "Invalid diff format.";
    if (/search text not found/i.test(normalized))
      return "Search text not found in file.";
    if (/no change made/i.test(normalized)) return "No changes were made.";
    if (/command validation failed/i.test(normalized))
      return "Command validation failed.";
    if (
      /unknown upload error|upload.*failed|upload api returned/i.test(
        normalized,
      )
    )
      return "File upload failed.";
    if (/no active account|no.*account.*selected/i.test(normalized))
      return "No active account. Please select an account first.";
    if (/file not found/i.test(normalized)) return "File not found.";
    if (/invalid conversation log format/i.test(normalized))
      return "Invalid conversation log format.";
    return raw;
  };

  const errorText = content.replace(/^Error:\s*/i, "");
  const translatedMessage = translateError(errorText);

  // If we have toolName, use it as the label (e.g., "READ FILE")
  // Otherwise use default "ERROR"
  const errorLabel = toolName
    ? toolName.toUpperCase().replace(/_/g, " ")
    : label || "ERROR";

  const errorColor = "var(--vscode-errorForeground, #f44336)";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      <TagHeader
        title={errorLabel}
        statusColor={errorColor}
        isError={true}
        statusTooltip={`Error${errorCode ? `: ${errorCode}` : ""}`}
      />
      <ErrorBlock
        content={translatedMessage}
        errorCode={errorCode}
        isLast={isLast}
        isLastMessage={isLastMessage}
        maxHeight={maxHeight}
        showHeader={false}
      />
    </div>
  );
};