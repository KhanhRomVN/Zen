import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  Question,
  QuestionAnswer,
  QuestionType,
} from "@/features/chat/types/message";
import SingleChoiceQuestion from "./SingleChoiceQuestion";
import MultiChoiceQuestion from "./MultiChoiceQuestion";
import TextQuestion from "./TextQuestion";
import ConfirmQuestion from "./ConfirmQuestion";
import QuestionSummary from "./QuestionSummary";
import "./QuestionBlock.css";

interface QuestionAnswerBlockProps {
  questions?: Question[];
  options?: string[];
  onAnswer?: (questionId: string, value: string | string[] | boolean) => void;
  onAllAnswered?: (answers: Record<string, QuestionAnswer>) => void;
  disabled?: boolean;
  title?: string;
  selectedOption?: string;
  onOptionSelect?: (option: string) => void;
  optional?: boolean;
  questionAnswers?: Record<string, QuestionAnswer>;
}

const QuestionAnswerBlock: React.FC<QuestionAnswerBlockProps> = ({
  questions: questionsProp,
  options: optionsProp,
  onAnswer: onAnswerProp,
  onAllAnswered: onAllAnsweredProp,
  disabled = false,
  title,
  selectedOption: selectedOptionProp,
  onOptionSelect: onOptionSelectProp,
  optional,
  questionAnswers: questionAnswersProp,
}) => {
  const isPaginated = questionsProp && questionsProp.length > 0;
  const questions = React.useMemo(
    () => (isPaginated ? questionsProp! : []),
    [questionsProp, isPaginated],
  );
  const legacyOptions = optionsProp || [];

  // Stable key derived from question IDs — only changes when question set actually changes
  const questionIdsKey = React.useMemo(
    () =>
      questions
        .map((q) => q.id)
        .sort()
        .join(","),
    [questions],
  );

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, QuestionAnswer>>({});
  const [selectedOptions, setSelectedOptions] = useState<
    Record<string, string | string[]>
  >({});
  const [textInputs, setTextInputs] = useState<Record<string, string>>({});
  const [confirmValues, setConfirmValues] = useState<Record<string, boolean>>(
    {},
  );
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  const [multiCustomValues, setMultiCustomValues] = useState<
    Record<string, string>
  >({});
  const [isSummaryMode, setIsSummaryModeState] = useState(false);
  const isSummaryModeRef = useRef(false);
  const logPrefix = useRef(`[Zen][QuestionAnswerBlock]`);
  const hasSubmittedRef = useRef(false);
  const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  const setIsSummaryMode = (value: boolean) => {
    isSummaryModeRef.current = value;
    setIsSummaryModeState(value);
  };

  // Reset state when questions change (new request arrives)
  // Must run BEFORE the init effect below so isSummaryMode is false
  // when questions don't match questionAnswersProp (e.g. next request)
  useEffect(() => {
    setIsSummaryMode(false);
    setAnswers({});
    setSelectedOptions({});
    setTextInputs({});
    setConfirmValues({});
    setCustomValues({});
    setMultiCustomValues({});
    setCurrentIndex(0);
    hasSubmittedRef.current = false;
  }, [questionIdsKey]);

  // Initialize state from questionAnswersProp
  // Only apply answers that match current question IDs (ignore stale data from other requests)
  const initEffectCountRef = useRef(0);
  useEffect(() => {
    initEffectCountRef.current += 1;

    if (questionAnswersProp && Object.keys(questionAnswersProp).length > 0) {
      // Build a filtered answers object that only includes entries matching current question IDs
      const matchedAnswers: Record<string, QuestionAnswer> = {};
      questions.forEach((q) => {
        if (questionAnswersProp[q.id]) {
          matchedAnswers[q.id] = questionAnswersProp[q.id];
        }
      });

      const matchedCount = Object.keys(matchedAnswers).length;
      // If no answers match current questions, skip initialization (fresh form)
      if (matchedCount === 0) {
        return;
      }

      setAnswers(matchedAnswers);

      const newSelectedOptions: Record<string, string | string[]> = {};
      const newTextInputs: Record<string, string> = {};
      const newConfirmValues: Record<string, boolean> = {};
      const newCustomValues: Record<string, string> = {};
      const newMultiCustomValues: Record<string, string> = {};

      questions.forEach((q) => {
        const answer = matchedAnswers[q.id];
        if (!answer) {
          return;
        }

        if (q.type === "single") {
          const value = answer.value as string;
          newSelectedOptions[q.id] = value;

          if (typeof value === "string" && value.startsWith("Other:")) {
            newCustomValues[q.id] = value.replace("Other:", "").trim();
          }
        } else if (q.type === "multi") {
          let values: string[];
          if (Array.isArray(answer.value)) {
            values = answer.value as string[];
          } else if (typeof answer.value === "string") {
            values = answer.value
              .split(",")
              .map((v) => v.trim())
              .filter(Boolean);
          } else {
            console.warn(
              `${logPrefix.current} Unexpected value type for multi question ${q.id}:`,
              answer.value,
            );
            return;
          }

          newSelectedOptions[q.id] = values;

          const otherValue = values.find((v) => v.startsWith("Other:"));
          if (otherValue) {
            newMultiCustomValues[q.id] = otherValue
              .replace("Other:", "")
              .trim();
          }
        } else if (q.type === "text") {
          newTextInputs[q.id] = answer.value as string;
        } else if (q.type === "confirm") {
          if (typeof answer.value === "boolean") {
            newConfirmValues[q.id] = answer.value;
          } else {
            newCustomValues[q.id] = answer.value as string;
          }
        }
      });

      setSelectedOptions(newSelectedOptions);
      setTextInputs(newTextInputs);
      setConfirmValues(newConfirmValues);
      setCustomValues(newCustomValues);
      setMultiCustomValues(newMultiCustomValues);
      setIsSummaryMode(true);
    }
  }, [questionAnswersProp, questions]);

  // Auto-resize textareas
  const resizeEffectCountRef = useRef(0);
  useEffect(() => {
    resizeEffectCountRef.current += 1;
    Object.entries(textareaRefs.current).forEach(([key, el]) => {
      if (!el) return;
      el.style.height = "auto";
      const maxHeight = 240;
      el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
      el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
    });
  }, [customValues, multiCustomValues, textInputs]);

  const isLegacyMode = !isPaginated && legacyOptions.length > 0;
  const legacyAnswered = !!selectedOptionProp;

  const totalQuestions = questions.length;
  const currentQuestion = isPaginated ? questions[currentIndex] : null;

  const isLastQuestion = currentIndex === totalQuestions - 1;
  const isAllAnswered = isPaginated ? isSummaryModeRef.current : legacyAnswered;

  const isCurrentAnswered = useCallback(() => {
    if (!isPaginated || !currentQuestion) return false;
    const q = currentQuestion;
    if (q.type === "multi") {
      const selected = (selectedOptions[q.id] as string[]) || [];
      return selected.length > 0;
    }
    if (q.type === "single") {
      const selected = selectedOptions[q.id] as string;
      return !!selected && selected.length > 0;
    }
    if (q.type === "text") {
      const value = textInputs[q.id] || "";
      return value.trim().length > 0;
    }
    if (q.type === "confirm") {
      const hasConfirmValue = confirmValues[q.id] !== undefined;
      const hasAnswer = answers[q.id] !== undefined;
      return hasConfirmValue || hasAnswer;
    }
    const answer = answers[q.id];
    if (!answer) return false;
    if (q.type === "single")
      return typeof answer.value === "string" && answer.value.length > 0;
    if (q.type === "multi")
      return Array.isArray(answer.value) && answer.value.length > 0;
    if (q.type === "text")
      return typeof answer.value === "string" && answer.value.trim().length > 0;
    if (q.type === "confirm") return typeof answer.value === "boolean";
    return false;
  }, [
    isPaginated,
    currentQuestion,
    answers,
    selectedOptions,
    textInputs,
    confirmValues,
  ]);

  const handleSingleSelect = (option: string) => {
    if (disabled || isAllAnswered || !isPaginated || !currentQuestion) {
      return;
    }
    const answer: QuestionAnswer = {
      questionId: currentQuestion.id,
      value: option,
    };
    const newAnswers = { ...answers, [currentQuestion.id]: answer };
    setAnswers(newAnswers);
    setSelectedOptions((prev) => ({ ...prev, [currentQuestion.id]: option }));
    onAnswerProp?.(currentQuestion.id, option);
  };

  const handleMultiToggle = (option: string) => {
    if (disabled || isAllAnswered || !isPaginated || !currentQuestion) return;
    const currentSelected =
      (selectedOptions[currentQuestion.id] as string[]) || [];
    const newSelected = currentSelected.includes(option)
      ? currentSelected.filter((o) => o !== option)
      : [...currentSelected, option];
    setSelectedOptions({
      ...selectedOptions,
      [currentQuestion.id]: newSelected,
    });
  };

  const handleTextSubmit = () => {
    if (disabled || isAllAnswered || !isPaginated || !currentQuestion) {
      return;
    }

    const value = textInputs[currentQuestion.id] || "";
    if (value.trim().length === 0) {
      return;
    }

    const answer: QuestionAnswer = {
      questionId: currentQuestion.id,
      value: value.trim(),
    };

    const newAnswers = { ...answers, [currentQuestion.id]: answer };
    setAnswers(newAnswers);
    onAnswerProp?.(currentQuestion.id, value.trim());
    setTimeout(() => {
      if (currentIndex < totalQuestions - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        setIsSummaryMode(true);
        if (!hasSubmittedRef.current) {
          hasSubmittedRef.current = true;
          onAllAnsweredProp?.(newAnswers);
        } else {
          console.warn(
            `[Zen][QuestionBlock] Blocked duplicate submission (handleTextSubmit)`,
          );
        }
      }
    }, 300);
  };

  const handleConfirm = (value: boolean) => {
    if (disabled || isAllAnswered || !isPaginated || !currentQuestion) return;
    const answer: QuestionAnswer = { questionId: currentQuestion.id, value };
    const newAnswers = { ...answers, [currentQuestion.id]: answer };
    setAnswers(newAnswers);
    setConfirmValues({ ...confirmValues, [currentQuestion.id]: value });
    onAnswerProp?.(currentQuestion.id, value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (currentQuestion?.type === "text") {
        handleTextSubmit();
      }
    }
  };

  // --- Single-choice custom value handlers ---
  const handleSingleCustomChange = (qId: string, value: string) => {
    setCustomValues((prev) => ({ ...prev, [qId]: value }));

    if (value.trim()) {
      const fullValue = `Other: ${value.trim()}`;
      setSelectedOptions((prev) => ({
        ...prev,
        [qId]: fullValue,
      }));
      const answer: QuestionAnswer = { questionId: qId, value: fullValue };
      setAnswers((prev) => ({ ...prev, [qId]: answer }));
      onAnswerProp?.(qId, fullValue);
    } else {
      setSelectedOptions((prev) => {
        const newState = { ...prev };
        delete newState[qId];
        return newState;
      });
      setAnswers((prev) => {
        const newState = { ...prev };
        delete newState[qId];
        return newState;
      });
    }
  };

  const handleSingleCustomBlur = (qId: string, value: string) => {
    if (value.trim()) {
      const fullValue = `Other: ${value.trim()}`;
      const answer: QuestionAnswer = { questionId: qId, value: fullValue };
      setAnswers((prev) => ({ ...prev, [qId]: answer }));
      setSelectedOptions((prev) => ({ ...prev, [qId]: fullValue }));
      onAnswerProp?.(qId, fullValue);
    } else {
      setAnswers((prev) => {
        const newState = { ...prev };
        delete newState[qId];
        return newState;
      });
      setSelectedOptions((prev) => {
        const newState = { ...prev };
        delete newState[qId];
        return newState;
      });
    }
  };

  // --- Multi-choice custom value handlers ---
  const handleMultiCustomChange = (qId: string, value: string) => {
    setMultiCustomValues((prev) => ({ ...prev, [qId]: value }));
  };

  const handleMultiCustomBlur = (qId: string, value: string) => {
    if (!currentQuestion) return;
    const currentSelected =
      (selectedOptions[currentQuestion.id] as string[]) || [];
    if (value.trim()) {
      const fullValue = `Other: ${value.trim()}`;
      const newSelected = currentSelected.filter(
        (opt) => !opt.startsWith("Other:"),
      );
      newSelected.push(fullValue);
      setSelectedOptions({
        ...selectedOptions,
        [currentQuestion.id]: newSelected,
      });
    } else {
      const newSelected = currentSelected.filter(
        (opt) => !opt.startsWith("Other:"),
      );
      setSelectedOptions({
        ...selectedOptions,
        [currentQuestion.id]: newSelected,
      });
    }
  };

  // --- Confirm custom value handler ---
  const handleConfirmCustomChange = (qId: string, value: string) => {
    setCustomValues((prev) => ({ ...prev, [qId]: value }));

    if (value.trim()) {
      setConfirmValues((prev) => {
        const newState = { ...prev };
        delete newState[qId];
        return newState;
      });
    }
  };

  const wrapperStyle = {
    display: "flex",
    flexDirection: "column" as const,
    paddingBottom: "12px",
    width: "100%",
  };

  // --- Legacy rendering ---
  if (isLegacyMode) {
    const legacySelected = selectedOptionProp || null;
    const statusColor = legacyAnswered
      ? "var(--vscode-gitDecoration-addedResourceForeground, #3fb950)"
      : "var(--vscode-descriptionForeground)";

    return (
      <div style={wrapperStyle}>
        <div
          className="terminal-block-header"
          style={{
            paddingTop: "4px",
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <div className="terminal-info" style={{ flex: 1, minWidth: 0 }}>
            <div className="terminal-header-top">
              <div
                style={{
                  marginTop: "1px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "2px",
                  flex: 1,
                  minWidth: 0,
                  width: "100%",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "8px",
                    flexWrap: "nowrap",
                  }}
                >
                  <div
                    style={{
                      position: "relative",
                      width: "16px",
                      height: "16px",
                      flexShrink: 0,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      marginTop: "2px",
                    }}
                  >
                    <div
                      style={{
                        position: "absolute",
                        width: "16px",
                        height: "16px",
                        borderRadius: "50%",
                        border: `2px solid ${statusColor}`,
                        opacity: 0.4,
                      }}
                    />
                    <div
                      style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        backgroundColor: statusColor,
                      }}
                    />
                  </div>
                  <div
                    style={{
                      flex: 1,
                      minWidth: 0,
                      display: "flex",
                      flexDirection: "column",
                      gap: "2px",
                      marginTop: "2px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        flexWrap: "wrap",
                      }}
                    >
                      <span
                        className="codicon codicon-question"
                        style={{
                          fontSize: "14px",
                          display: "flex",
                          alignItems: "center",
                        }}
                      />
                      <span className="terminal-name">QUESTION</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div style={{ paddingLeft: "36px", marginTop: "4px" }}>
          {title && (
            <div
              style={{
                fontSize: "13px",
                fontWeight: 500,
                color: "var(--vscode-foreground)",
                marginBottom: "8px",
              }}
            >
              {title}
            </div>
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {legacyOptions.map((option) => (
              <button
                key={option}
                onClick={() => onOptionSelectProp?.(option)}
                disabled={disabled || legacyAnswered}
                style={{
                  padding: "6px 12px",
                  backgroundColor:
                    legacySelected === option
                      ? "var(--vscode-button-background)"
                      : "transparent",
                  color:
                    legacySelected === option
                      ? "var(--vscode-button-foreground)"
                      : "var(--vscode-foreground)",
                  border: "none",
                  borderLeft: `3px solid ${legacySelected === option ? "var(--vscode-button-background)" : "var(--vscode-descriptionForeground)"}`,
                  borderRadius: "0",
                  cursor: disabled || legacyAnswered ? "default" : "pointer",
                  fontSize: "13px",
                  fontWeight: legacySelected === option ? 600 : 400,
                  textAlign: "left",
                  transition: "all 0.15s ease",
                  opacity:
                    legacyAnswered && legacySelected !== option ? 0.5 : 1,
                }}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // --- Paginated rendering ---
  if (!isPaginated || !currentQuestion) {
    return null;
  }

  const renderQuestionContent = () => {
    if (!currentQuestion) return null;
    switch (currentQuestion.type) {
      case "single":
        return (
          <SingleChoiceQuestion
            q={currentQuestion}
            selectedValue={(answers[currentQuestion.id]?.value as string) || ""}
            customValue={customValues[currentQuestion.id] || ""}
            disabled={disabled}
            isAllAnswered={isAllAnswered}
            textareaRefs={textareaRefs}
            onSelect={handleSingleSelect}
            onCustomValueChange={(value) =>
              handleSingleCustomChange(currentQuestion.id, value)
            }
            onCustomInputBlur={(value) =>
              handleSingleCustomBlur(currentQuestion.id, value)
            }
          />
        );
      case "multi":
        return (
          <MultiChoiceQuestion
            q={currentQuestion}
            selectedValues={
              (selectedOptions[currentQuestion.id] as string[]) || []
            }
            customValue={multiCustomValues[currentQuestion.id] || ""}
            disabled={disabled}
            isAllAnswered={isAllAnswered}
            isAnswered={!!answers[currentQuestion.id]}
            textareaRefs={textareaRefs}
            onToggle={handleMultiToggle}
            onCustomValueChange={(value) =>
              handleMultiCustomChange(currentQuestion.id, value)
            }
            onCustomInputBlur={(value) =>
              handleMultiCustomBlur(currentQuestion.id, value)
            }
          />
        );
      case "text":
        return (
          <TextQuestion
            q={currentQuestion}
            value={textInputs[currentQuestion.id] || ""}
            disabled={disabled}
            isAllAnswered={isAllAnswered}
            isAnswered={!!answers[currentQuestion.id]}
            textareaRefs={textareaRefs}
            onChange={(value) =>
              setTextInputs({ ...textInputs, [currentQuestion.id]: value })
            }
            onKeyDown={handleKeyDown}
          />
        );
      case "confirm":
        return (
          <ConfirmQuestion
            q={currentQuestion}
            selectedValue={confirmValues[currentQuestion.id]}
            customValue={customValues[currentQuestion.id] || ""}
            disabled={disabled}
            isAllAnswered={isAllAnswered}
            isAnswered={!!answers[currentQuestion.id]}
            textareaRefs={textareaRefs}
            onConfirm={handleConfirm}
            onCustomValueChange={(value) =>
              handleConfirmCustomChange(currentQuestion.id, value)
            }
          />
        );
      default:
        return null;
    }
  };

  const renderNavIcons = () => {
    if (totalQuestions <= 1) return null;
    const iconColor = "var(--vscode-foreground)";
    const bgColor = `color-mix(in srgb, ${iconColor} 10%, transparent)`;
    return (
      <div style={{ display: "flex", gap: "2px", alignItems: "center" }}>
        <button
          onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
          disabled={currentIndex === 0}
          style={{
            background: currentIndex === 0 ? "transparent" : bgColor,
            border: "none",
            color: iconColor,
            cursor: currentIndex === 0 ? "default" : "pointer",
            opacity: currentIndex === 0 ? 0.3 : 0.8,
            padding: "4px 6px",
            borderRadius: "4px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          title="Previous question"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <button
          onClick={() =>
            setCurrentIndex(Math.min(totalQuestions - 1, currentIndex + 1))
          }
          disabled={currentIndex === totalQuestions - 1}
          style={{
            background:
              currentIndex === totalQuestions - 1 ? "transparent" : bgColor,
            border: "none",
            color: iconColor,
            cursor: currentIndex === totalQuestions - 1 ? "default" : "pointer",
            opacity: currentIndex === totalQuestions - 1 ? 0.3 : 0.8,
            padding: "4px 6px",
            borderRadius: "4px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          title="Next question"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="m9 18 6-6-6-6" />
          </svg>
        </button>
      </div>
    );
  };

  // If in summary mode, render summary view
  if (isSummaryMode && isPaginated) {
    return (
      <QuestionSummary questions={questions} answers={answers} title={title} />
    );
  }

  return (
    <div style={wrapperStyle}>
      <div
        className="terminal-block-header"
        style={{
          paddingTop: "4px",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          width: "100%",
        }}
      >
        <div className="terminal-info" style={{ flex: 1, minWidth: 0 }}>
          <div className="terminal-header-top">
            <div
              style={{
                marginTop: "1px",
                display: "flex",
                flexDirection: "column",
                gap: "2px",
                flex: 1,
                minWidth: 0,
                width: "100%",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "8px",
                  flexWrap: "nowrap",
                }}
              >
                <span
                  className="codicon codicon-question"
                  style={{ fontSize: "14px", marginTop: "2px" }}
                />
              </div>
            </div>
          </div>
        </div>
        {isAllAnswered && (
          <div
            className="header-actions"
            style={{ flexShrink: 0, marginLeft: "8px" }}
          >
            {renderNavIcons()}
          </div>
        )}
      </div>

      <div style={{ marginTop: "8px" }}>
        <div
          style={{
            fontSize: "14px",
            fontWeight: 500,
            color: "var(--vscode-foreground)",
            padding: "4px 0 8px 0",
            display: "flex",
            alignItems: "baseline",
            gap: "8px",
          }}
        >
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              minWidth: "22px",
              height: "22px",
              padding: "0 6px",
              fontSize: "11px",
              fontWeight: 600,
              color: "var(--vscode-descriptionForeground)",
              backgroundColor:
                "color-mix(in srgb, var(--vscode-descriptionForeground) 15%, transparent)",
              borderRadius: "4px",
            }}
          >
            {currentIndex + 1}
          </span>
          <span style={{ flex: 1 }}>{currentQuestion?.label}</span>
        </div>

        <div style={{ padding: "2px 0" }}>{renderQuestionContent()}</div>

        {!isSummaryMode && (
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "8px",
              marginTop: "12px",
            }}
          >
            <span
              style={{
                fontSize: "11px",
                color: "var(--vscode-descriptionForeground)",
                opacity: 0.6,
              }}
            >
              {currentIndex + 1} of {totalQuestions}
            </span>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <button
                onClick={() => {
                  if (currentIndex < totalQuestions - 1) {
                    setCurrentIndex(currentIndex + 1);
                  } else {
                    setIsSummaryMode(true);
                    onAllAnsweredProp?.(answers);
                  }
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "6px 12px",
                  backgroundColor: "transparent",
                  color: "var(--vscode-descriptionForeground)",
                  border: "none",
                  borderRadius: "4px",
                  fontSize: "11px",
                  cursor: "pointer",
                  opacity: 0.7,
                  transition: "all 0.15s ease",
                  textDecoration: "none",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.opacity = "1";
                  e.currentTarget.style.textDecoration = "underline";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.opacity = "0.7";
                  e.currentTarget.style.textDecoration = "none";
                }}
              >
                <span
                  className="codicon codicon-chevron-right"
                  style={{ fontSize: "12px" }}
                />
                <span>Skip</span>
              </button>

              <button
                onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
                disabled={currentIndex === 0}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "6px 12px",
                  backgroundColor:
                    currentIndex === 0
                      ? "transparent"
                      : "color-mix(in srgb, var(--vscode-descriptionForeground) 15%, transparent)",
                  color: "var(--vscode-descriptionForeground)",
                  border: "none",
                  borderRadius: "4px",
                  fontSize: "11px",
                  lineHeight: "1",
                  cursor: currentIndex === 0 ? "not-allowed" : "pointer",
                  opacity: currentIndex === 0 ? 0.4 : 1,
                  transition: "all 0.15s ease",
                  minHeight: "0",
                }}
                onMouseEnter={(e) => {
                  if (currentIndex !== 0) {
                    e.currentTarget.style.backgroundColor =
                      "color-mix(in srgb, var(--vscode-descriptionForeground) 25%, transparent)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (currentIndex !== 0) {
                    e.currentTarget.style.backgroundColor =
                      "color-mix(in srgb, var(--vscode-descriptionForeground) 15%, transparent)";
                  }
                }}
              >
                <span
                  className="codicon codicon-arrow-left"
                  style={{
                    fontSize: "11px",
                    lineHeight: "1",
                    display: "flex",
                    alignItems: "center",
                  }}
                />
                <span
                  style={{
                    lineHeight: "1",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  Previous
                </span>
              </button>

              <button
                onClick={() => {
                  let allAnswers = answers;

                  if (currentQuestion?.type === "multi") {
                    const selected =
                      (selectedOptions[currentQuestion.id] as string[]) || [];
                    if (selected.length > 0) {
                      const answer: QuestionAnswer = {
                        questionId: currentQuestion.id,
                        value: selected,
                      };
                      allAnswers = {
                        ...answers,
                        [currentQuestion.id]: answer,
                      };
                      setAnswers(allAnswers);
                      onAnswerProp?.(currentQuestion.id, selected);
                    }
                  }

                  if (currentQuestion?.type === "text") {
                    const value = textInputs[currentQuestion.id] || "";
                    if (value.trim().length > 0) {
                      const answer: QuestionAnswer = {
                        questionId: currentQuestion.id,
                        value: value.trim(),
                      };
                      allAnswers = {
                        ...answers,
                        [currentQuestion.id]: answer,
                      };
                      setAnswers(allAnswers);
                      onAnswerProp?.(currentQuestion.id, value.trim());
                    }
                  }

                  if (currentQuestion?.type === "confirm") {
                    const customValue = customValues[currentQuestion.id] || "";
                    if (customValue.trim().length > 0) {
                      const fullValue = `Ý kiến: ${customValue.trim()}`;
                      const answer: QuestionAnswer = {
                        questionId: currentQuestion.id,
                        value: fullValue,
                      };
                      allAnswers = {
                        ...answers,
                        [currentQuestion.id]: answer,
                      };
                      setAnswers(allAnswers);
                      onAnswerProp?.(currentQuestion.id, fullValue);
                    }
                  }

                  if (currentIndex < totalQuestions - 1) {
                    setCurrentIndex(currentIndex + 1);
                  } else {
                    setIsSummaryMode(true);
                    onAllAnsweredProp?.(allAnswers);
                  }
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "6px 14px",
                  backgroundColor: isLastQuestion
                    ? "color-mix(in srgb, var(--vscode-button-background) 20%, transparent)"
                    : "color-mix(in srgb, var(--vscode-descriptionForeground) 15%, transparent)",
                  color: isLastQuestion
                    ? "var(--vscode-button-background)"
                    : "var(--vscode-descriptionForeground)",
                  border: "none",
                  borderRadius: "4px",
                  fontSize: "11px",
                  fontWeight: 500,
                  lineHeight: "1",
                  cursor: "pointer",
                  opacity: 1,
                  transition: "all 0.15s ease",
                  minHeight: "0",
                }}
                onMouseEnter={(e) => {
                  if (isLastQuestion) {
                    e.currentTarget.style.backgroundColor =
                      "var(--vscode-button-background)";
                    e.currentTarget.style.color =
                      "var(--vscode-button-foreground)";
                  } else {
                    e.currentTarget.style.backgroundColor =
                      "color-mix(in srgb, var(--vscode-descriptionForeground) 25%, transparent)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (isLastQuestion) {
                    e.currentTarget.style.backgroundColor =
                      "color-mix(in srgb, var(--vscode-button-background) 20%, transparent)";
                    e.currentTarget.style.color =
                      "var(--vscode-button-background)";
                  } else {
                    e.currentTarget.style.backgroundColor =
                      "color-mix(in srgb, var(--vscode-descriptionForeground) 15%, transparent)";
                  }
                }}
              >
                <span
                  style={{
                    lineHeight: "1",
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  {isLastQuestion ? "Complete" : "Next"}
                </span>
                <span
                  className="codicon codicon-arrow-right"
                  style={{
                    fontSize: "11px",
                    lineHeight: "1",
                    display: "flex",
                    alignItems: "center",
                  }}
                />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export { QuestionAnswerBlock as QuestionBlock };
export default QuestionAnswerBlock;
