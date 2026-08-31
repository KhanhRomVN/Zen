import React from "react";
import { Question } from "@/features/chat/types/message";

interface ConfirmQuestionProps {
  q: Question;
  selectedValue: boolean | undefined;
  customValue: string;
  disabled: boolean;
  isAllAnswered: boolean;
  isAnswered: boolean;
  textareaRefs: React.MutableRefObject<Record<string, HTMLTextAreaElement | null>>;
  onConfirm: (value: boolean) => void;
  onCustomValueChange: (value: string) => void;
}

/**
 * Render confirm question with Yes/No bars and "Other" custom input.
 * All state and handlers are passed via props from the parent.
 */
const ConfirmQuestion: React.FC<ConfirmQuestionProps> = ({
  q,
  selectedValue,
  customValue,
  disabled,
  isAllAnswered,
  isAnswered,
  textareaRefs,
  onConfirm,
  onCustomValueChange,
}) => {
  const isDisabled = disabled || isAllAnswered;
  const selected = selectedValue;
  const greenColor =
    "var(--vscode-gitDecoration-addedResourceForeground, #3fb950)";
  const redColor =
    "var(--vscode-gitDecoration-deletedResourceForeground, #f85149)";

  const renderOptionBar = (
    value: boolean,
    label: string,
    color: string,
    isSelected: boolean,
  ) => {
    const borderColor = isSelected
      ? color
      : "var(--vscode-descriptionForeground)";
    const bgColor = isSelected
      ? `color-mix(in srgb, ${color} 20%, transparent)`
      : "transparent";

    return (
      <div
        onClick={() => {
          if (!isDisabled) {
            onConfirm(value);
          }
        }}
        style={{
          display: "flex",
          alignItems: "center",
          padding: "8px 16px",
          borderLeft: `3px solid ${borderColor}`,
          backgroundColor: bgColor,
          borderRadius: "0",
          cursor: isDisabled ? "default" : "pointer",
          fontSize: "13px",
          fontWeight: isSelected ? 600 : 400,
          color: isSelected ? color : "var(--vscode-foreground)",
          transition: "all 0.15s ease",
          opacity: 1,
          width: "100%",
        }}
        onMouseEnter={(e) => {
          if (!isDisabled && !isSelected) {
            e.currentTarget.style.borderLeftColor =
              "var(--vscode-descriptionForeground)";
            e.currentTarget.style.color = "var(--vscode-foreground)";
            e.currentTarget.style.backgroundColor =
              "color-mix(in srgb, var(--vscode-descriptionForeground) 10%, transparent)";
          }
        }}
        onMouseLeave={(e) => {
          if (!isDisabled && !isSelected) {
            e.currentTarget.style.borderLeftColor =
              "var(--vscode-descriptionForeground)";
            e.currentTarget.style.color = "var(--vscode-foreground)";
            e.currentTarget.style.backgroundColor = "transparent";
          }
        }}
      >
        <span>{label}</span>
      </div>
    );
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        padding: "4px 0",
      }}
    >
      {/* "Yes" option bar */}
      {renderOptionBar(true, "Yes", greenColor, selected === true)}

      {/* "No" option bar */}
      {renderOptionBar(false, "No", redColor, selected === false)}

      {/* Input bar for custom answer (like single-choice "Other") */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          padding: "8px 16px",
          borderLeft: `3px solid ${customValue.trim() ? "var(--vscode-button-background)" : "var(--vscode-descriptionForeground)"}`,
          backgroundColor: customValue.trim()
            ? "color-mix(in srgb, var(--vscode-button-background) 20%, transparent)"
            : "transparent",
          transition: "all 0.15s ease",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => {
          if (!isDisabled && !customValue.trim()) {
            e.currentTarget.style.borderLeftColor =
              "var(--vscode-descriptionForeground)";
            e.currentTarget.style.backgroundColor =
              "color-mix(in srgb, var(--vscode-descriptionForeground) 10%, transparent)";
          }
        }}
        onMouseLeave={(e) => {
          if (!isDisabled && !customValue.trim()) {
            e.currentTarget.style.borderLeftColor =
              "var(--vscode-descriptionForeground)";
            e.currentTarget.style.backgroundColor = "transparent";
          }
        }}
      >
        <textarea
          ref={(el) => {
            textareaRefs.current[`confirm-other-${q.id}`] = el;
          }}
          value={customValue}
          onChange={(e) => {
            onCustomValueChange(e.target.value);
          }}
          onFocus={(e) => e.target.select()}
          placeholder="Other opinion..."
          disabled={isDisabled}
          rows={1}
          style={{
            flex: 1,
            padding: "0px",
            backgroundColor: "transparent",
            color: "var(--vscode-foreground)",
            border: "none",
            outline: "none",
            fontSize: "13px",
            fontWeight: customValue.trim() ? 600 : 400,
            fontFamily: "inherit",
            minWidth: "0px",
            resize: "none",
            overflowY: "hidden",
            lineHeight: "1.5",
          }}
        />
      </div>
    </div>
  );
};

export default ConfirmQuestion;
