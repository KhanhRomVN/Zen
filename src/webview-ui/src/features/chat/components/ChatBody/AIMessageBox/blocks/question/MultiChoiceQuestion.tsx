import React from "react";
import { Question } from "@/features/chat/types/message";

interface MultiChoiceQuestionProps {
  q: Question;
  selectedValues: string[];
  customValue: string;
  disabled: boolean;
  isAllAnswered: boolean;
  isAnswered: boolean;
  textareaRefs: React.MutableRefObject<Record<string, HTMLTextAreaElement | null>>;
  onToggle: (option: string) => void;
  onCustomValueChange: (value: string) => void;
  onCustomInputBlur: (value: string) => void;
}

/**
 * Render multi-choice question with checkboxes and "Other" input bar.
 * All state and handlers are passed via props from the parent.
 */
const MultiChoiceQuestion: React.FC<MultiChoiceQuestionProps> = ({
  q,
  selectedValues,
  customValue,
  disabled,
  isAllAnswered,
  isAnswered,
  textareaRefs,
  onToggle,
  onCustomValueChange,
  onCustomInputBlur,
}) => {
  const isDisabled = disabled || isAllAnswered;
  const selected = selectedValues;
  const originalOptions = q.options || [];
  const hasOtherSelected = selected.some((opt) => opt.startsWith("Other:"));

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      {/* Regular options */}
      {originalOptions.map((option) => {
        const isSelected = selected.includes(option);
        return (
          <div key={option}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "8px 6px",
                cursor: isDisabled || isAnswered ? "default" : "pointer",
                opacity: isAnswered && !isSelected ? 0.5 : 1,
                transition: "all 0.15s ease",
                borderLeft: "none",
                backgroundColor: "transparent",
              }}
            >
              <input
                type="checkbox"
                checked={isSelected}
                onChange={() => onToggle(option)}
                disabled={isDisabled}
                style={{
                  accentColor: isSelected
                    ? "var(--vscode-button-background)"
                    : "var(--vscode-descriptionForeground)",
                  width: "16px",
                  height: "16px",
                  cursor: isDisabled || isAnswered ? "default" : "pointer",
                  opacity: isSelected ? 1 : 0.4,
                }}
              />
              <span style={{ fontSize: "13px" }}>{option}</span>
            </div>
          </div>
        );
      })}

      {/* "Other" option with checkbox and input */}
      <div>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "8px 6px",
            cursor: isDisabled || isAnswered ? "default" : "pointer",
            opacity: isAnswered && !hasOtherSelected ? 0.5 : 1,
            transition: "all 0.15s ease",
            borderLeft: "none",
            backgroundColor: "transparent",
          }}
        >
          <input
            type="checkbox"
            checked={hasOtherSelected}
            onChange={() => {
              if (hasOtherSelected) {
                onCustomValueChange("");
                // Uncheck handled by parent via onToggle logic
              }
            }}
            disabled={isDisabled}
            style={{
              accentColor: hasOtherSelected
                ? "var(--vscode-button-background)"
                : "var(--vscode-descriptionForeground)",
              width: "16px",
              height: "16px",
              cursor: isDisabled || isAnswered ? "default" : "pointer",
              opacity: hasOtherSelected ? 1 : 0.4,
            }}
          />
          <textarea
            ref={(el) => {
              textareaRefs.current[`multi-other-${q.id}`] = el;
            }}
            value={customValue}
            onChange={(e) => {
              onCustomValueChange(e.target.value);
            }}
            onBlur={(e) => {
              onCustomInputBlur(e.target.value);
            }}
            onFocus={(e) => e.target.select()}
            placeholder="Other (your opinion)"
            disabled={isDisabled}
            rows={1}
            style={{
              flex: 1,
              padding: "2px 8px",
              backgroundColor: "transparent",
              color: "var(--vscode-foreground)",
              border: "none",
              outline: "none",
              fontSize: "13px",
              fontFamily: "inherit",
              minWidth: "60px",
              resize: "none",
              overflowY: "hidden",
              lineHeight: "1.5",
            }}
          />
        </div>
      </div>
    </div>
  );
};

export default MultiChoiceQuestion;
