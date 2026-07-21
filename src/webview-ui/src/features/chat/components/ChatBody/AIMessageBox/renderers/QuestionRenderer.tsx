import React from "react";

// TYPES
import { Question, QuestionAnswer } from "@/features/chat/types/message";

// COMPONENTS
import QuestionBlock from "../blocks/question/QuestionBlock";

interface QuestionRendererProps {
  questions?: Question[];
  options?: string[];
  title?: string;
  optional?: boolean;
  selectedOption?: string;
  questionAnswers?: Record<string, QuestionAnswer>;
  disabled?: boolean;
  onAnswer?: (questionId: string, value: string | string[] | boolean) => void;
  onAllAnswered?: (answers: Record<string, QuestionAnswer>) => void;
  onOptionSelect?: (option: string) => void;
}

/**
 * Renderer for question/option blocks
 * Handles both single-option and multi-question formats
 */
export const QuestionRenderer: React.FC<QuestionRendererProps> = ({
  questions,
  options,
  title,
  optional,
  selectedOption,
  questionAnswers,
  disabled,
  onAnswer,
  onAllAnswered,
  onOptionSelect,
}) => {
  const hasQuestions = questions && questions.length > 0;

  return (
    <QuestionBlock
      questions={hasQuestions ? questions : undefined}
      options={!hasQuestions ? options : undefined}
      title={title}
      optional={optional}
      selectedOption={!hasQuestions ? selectedOption : undefined}
      questionAnswers={hasQuestions ? questionAnswers : undefined}
      disabled={disabled}
      onAnswer={(questionId, value) => {
        if (!hasQuestions) return;
        if (onAnswer) {
          onAnswer(questionId, value);
        }
      }}
      onAllAnswered={(answers) => {
        if (!hasQuestions) return;
        if (onAllAnswered) {
          onAllAnswered(answers);
        }
      }}
      onOptionSelect={(option: string) => {
        if (hasQuestions) return;
        if (onOptionSelect) {
          onOptionSelect(option);
        }
      }}
    />
  );
};
