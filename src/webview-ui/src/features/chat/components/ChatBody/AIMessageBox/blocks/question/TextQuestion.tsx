import React from "react";
import { Question } from "@/features/chat/types/message";

interface TextQuestionProps {
  q: Question;
  value: string;
  disabled: boolean;
  isAllAnswered: boolean;
  isAnswered: boolean;
  textareaRefs: React.MutableRefObject<Record<string, HTMLTextAreaElement | null>>;
  onChange: (value: string) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
}

/**
 * Render text input question.
 * All state and handlers are passed via props from the parent.
 */
const TextQuestion: React.FC<TextQuestionProps> = ({
  q,
  value,
  disabled,
  isAllAnswered,
  isAnswered,
  textareaRefs,
  onChange,
  onKeyDown,
}) => {
  const isDisabled = disabled || isAllAnswered;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      <textarea
        ref={(el) => {
          textareaRefs.current[`text-${q.id}`] = el;
        }}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        placeholder="Enter your answer..."
        disabled={isDisabled || isAnswered}
        rows={3}
        style={{
          width: "100%",
          minHeight: "60px",
          maxHeight: "240px",
          backgroundColor: "var(--vscode-input-background)",
          color: "var(--vscode-input-foreground)",
          border: "1px solid var(--vscode-input-border)",
          borderRadius: "4px",
          padding: "8px",
          fontSize: "13px",
          fontFamily: "inherit",
          resize: "none",
          outline: "none",
          overflowY: "auto",
          lineHeight: "1.5",
        }}
      />
    </div>
  );
};

export default TextQuestion;
