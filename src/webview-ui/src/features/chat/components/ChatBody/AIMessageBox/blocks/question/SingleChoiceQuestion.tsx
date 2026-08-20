import React from "react";
import { Question } from "@/features/chat/types/message";

interface SingleChoiceQuestionProps {
  q: Question;
  selectedValue: string;
  customValue: string;
  disabled: boolean;
  isAllAnswered: boolean;
  textareaRefs: React.MutableRefObject<Record<string, HTMLTextAreaElement | null>>;
  onSelect: (option: string) => void;
  onCustomValueChange: (value: string) => void;
  onCustomInputBlur: (value: string) => void;
}

/**
 * Render single-choice question with options and "Other" input bar.
 * All state and handlers are passed via props from the parent.
 */
const SingleChoiceQuestion: React.FC<SingleChoiceQuestionProps> = ({
  q,
  selectedValue,
  customValue,
  disabled,
  isAllAnswered,
  textareaRefs,
  onSelect,
  onCustomValueChange,
  onCustomInputBlur,
}) => {
  const isDisabled = disabled || isAllAnswered;
  const selected = selectedValue;
  const options = q.options || [];
  const lastOption = options.length > 0 ? options[options.length - 1] : "";
  const hasAiOther =
    lastOption.toLowerCase().includes("other") ||
    lastOption.toLowerCase().includes("khác");

  const renderOtherInput = (
    isSelected: boolean,
    placeholder: string,
    key: string,
  ) => {
    return (
      <div
        key={key}
        style={{
          display: "flex",
          alignItems: "center",
          padding: "8px 16px",
          borderLeft: `3px solid ${isSelected ? "var(--vscode-button-background)" : "var(--vscode-descriptionForeground)"}`,
          backgroundColor: isSelected
            ? "color-mix(in srgb, var(--vscode-button-background) 20%, transparent)"
            : "transparent",
          transition: "all 0.15s ease",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => {
          if (!isDisabled && !isSelected) {
            e.currentTarget.style.borderLeftColor =
              "var(--vscode-descriptionForeground)";
            e.currentTarget.style.backgroundColor =
              "color-mix(in srgb, var(--vscode-descriptionForeground) 10%, transparent)";
          }
        }}
        onMouseLeave={(e) => {
          if (!isDisabled && !isSelected) {
            e.currentTarget.style.borderLeftColor =
              "var(--vscode-descriptionForeground)";
            e.currentTarget.style.backgroundColor = "transparent";
          }
        }}
        onClick={() => {
          if (!isDisabled && !isSelected) {
            onCustomValueChange(customValue);
          }
        }}
      >
        <textarea
          ref={(el) => {
            textareaRefs.current[`single-other-${q.id}`] = el;
          }}
          value={customValue}
          onChange={(e) => {
            onCustomValueChange(e.target.value);
          }}
          onBlur={(e) => {
            onCustomInputBlur(e.target.value);
          }}
          onFocus={(e) => e.target.select()}
          placeholder={placeholder}
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
            fontWeight: isSelected ? 600 : 400,
            fontFamily: "inherit",
            minWidth: "0px",
            resize: "none",
            overflowY: "hidden",
            lineHeight: "1.5",
          }}
        />
      </div>
    );
  };

  const renderedItems: React.ReactNode[] = [];

  // 1. Render regular option buttons
  options.forEach((option, index) => {
    if (index === options.length - 1 && hasAiOther) {
      const isSelected = !!(selected && selected.toString().startsWith("Other:"));
      renderedItems.push(
        renderOtherInput(isSelected, "Other (your opinion)", `other-${q.id}`),
      );
      return;
    }

    const isSelected = selected === option;
    renderedItems.push(
      <button
        key={`${q.id}-${option}`}
        onClick={() => onSelect(option)}
        disabled={isDisabled}
        className="question-option-btn"
        data-selected={isSelected ? "true" : "false"}
        style={{
          padding: "8px 16px",
          backgroundColor: isSelected
            ? "color-mix(in srgb, var(--vscode-button-background) 20%, transparent)"
            : "transparent",
          color: isSelected
            ? "var(--vscode-button-background)"
            : "var(--vscode-foreground)",
          border: "none",
          borderLeft: `3px solid ${isSelected ? "var(--vscode-button-background)" : "var(--vscode-descriptionForeground)"}`,
          borderRadius: "0",
          cursor: isDisabled ? "default" : "pointer",
          fontSize: "13px",
          fontWeight: isSelected ? 600 : 400,
          textAlign: "left",
          transition:
            "background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease, font-weight 0.15s ease",
          opacity: 1,
          width: "100%",
        }}
        onMouseEnter={(e) => {
          if (!isDisabled && !isSelected) {
            e.currentTarget.style.borderLeftColor =
              "var(--vscode-descriptionForeground)";
            e.currentTarget.style.color = "var(--vscode-foreground)";
            e.currentTarget.style.background =
              "color-mix(in srgb, var(--vscode-descriptionForeground) 10%, transparent)";
          }
        }}
        onMouseLeave={(e) => {
          if (!isDisabled && !isSelected) {
            e.currentTarget.style.borderLeftColor =
              "var(--vscode-descriptionForeground)";
            e.currentTarget.style.color = "var(--vscode-foreground)";
            e.currentTarget.style.background = "transparent";
          }
        }}
      >
        {option}
      </button>,
    );
  });

  // 2. Always add "Other" input bar if AI didn't include one
  if (!hasAiOther) {
    const isSelected = !!(selected && selected.toString().startsWith("Other:"));
    renderedItems.push(
      renderOtherInput(
        isSelected,
        "Other (your opinion)",
        `auto-other-${q.id}`,
      ),
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {renderedItems}
    </div>
  );
};

export default SingleChoiceQuestion;
