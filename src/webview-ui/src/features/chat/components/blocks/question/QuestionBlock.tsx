import React, { useState, useCallback, useEffect, useRef } from "react";
import { ToolHeader } from "../../tools/ToolHeader";
import {
  Question,
  QuestionAnswer,
  QuestionType,
} from "@/features/chat/types/message";
import "./QuestionBlock.css";

interface QuestionAnswerBlockProps {
  questions?: Question[];
  options?: string[];
  onAnswer?: (questionId: string, value: string | string[] | boolean) => void;
  onAllAnswered?: (answers: Record<string, QuestionAnswer>) => void;
  initialAnswers?: Record<string, QuestionAnswer>;
  disabled?: boolean;
  title?: string;
  /** Legacy props for single-question mode */
  selectedOption?: string;
  onOptionSelect?: (option: string) => void;
  optional?: boolean;
}

const QuestionAnswerBlock: React.FC<QuestionAnswerBlockProps> = ({
  questions: questionsProp,
  options: optionsProp,
  onAnswer: onAnswerProp,
  onAllAnswered: onAllAnsweredProp,
  initialAnswers = {},
  disabled = false,
  title,
  selectedOption: selectedOptionProp,
  onOptionSelect: onOptionSelectProp,
  optional,
}) => {
  // Determine if this is paginated mode (has questions array) or legacy mode (has options)
  const isPaginated = questionsProp && questionsProp.length > 0;
  const questions = isPaginated ? questionsProp! : [];
  const legacyOptions = optionsProp || [];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] =
    useState<Record<string, QuestionAnswer>>(initialAnswers);
  const [selectedOptions, setSelectedOptions] = useState<
    Record<string, string | string[]>
  >({});
  const [textInputs, setTextInputs] = useState<Record<string, string>>({});
  const [confirmValues, setConfirmValues] = useState<Record<string, boolean>>(
    {},
  );
  // Store custom "Khác" values separately so they persist when switching options
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  // Store multi-choice custom "Khác" values separately
  const [multiCustomValues, setMultiCustomValues] = useState<
    Record<string, string>
  >({});
  // Internal state to control summary view (avoid relying on props)
  const [isSummaryMode, setIsSummaryModeState] = useState(false);
  // Ref to track summary mode across re-renders and re-mounts (giống cách TerminalBlock track state)
  const isSummaryModeRef = useRef(false);
  // Ref to track if we've restored from initialAnswers (prevent re-initialization)
  const hasRestoredRef = useRef(false);
  const logPrefix = useRef(`[Zen][QuestionAnswerBlock]`);

  // Wrapper to keep state and ref in sync
  const setIsSummaryMode = (value: boolean) => {
    isSummaryModeRef.current = value;
    setIsSummaryModeState(value);
  };

  // Legacy mode: single question with options
  const isLegacyMode = !isPaginated && legacyOptions.length > 0;
  const legacyAnswered = !!selectedOptionProp;

  // Sync initialAnswers to answers state when it changes (for history load)
  // ✅ FIX: Giống TerminalBlock - chỉ restore 1 lần, track bằng ref
  useEffect(() => {
    const initialAnswersKeys = Object.keys(initialAnswers);
    const hasInitialAnswers = isPaginated && initialAnswersKeys.length > 0;

    console.log(`${logPrefix.current} useEffect[initialAnswers]`, {
      hasInitialAnswers,
      initialAnswersKeys,
      hasRestoredRef: hasRestoredRef.current,
      isSummaryModeRef: isSummaryModeRef.current,
      questionsLength: questions.length,
    });

    if (hasInitialAnswers) {
      // ✅ FIX: Nếu đã restore rồi, không restore lại (tránh re-initialization)
      if (hasRestoredRef.current) {
        console.log(
          `${logPrefix.current} Already restored, skipping re-initialization`,
        );
        return;
      }

      // ✅ Mark as restored (track state giống TerminalBlock track writtenCharsRef)
      hasRestoredRef.current = true;

      // ✅ FIX: Khi có initialAnswers, tự động chuyển sang summaryMode
      // (giống TerminalBlock tự động hiển thị output khi có logs)
      const totalQuestions = questions.length;
      const answeredCount = initialAnswersKeys.length;
      if (answeredCount === totalQuestions) {
        console.log(
          `${logPrefix.current} All questions answered (${answeredCount}/${totalQuestions}), switching to summaryMode`,
        );
        setIsSummaryMode(true);
      }

      setAnswers(initialAnswers);
      // Also restore selectedOptions and confirmValues from initialAnswers
      Object.entries(initialAnswers).forEach(([qId, answer]) => {
        const question = questions.find((q) => q.id === qId);
        if (!question) return;
        if (question.type === "confirm") {
          setConfirmValues((prev) => ({
            ...prev,
            [qId]: answer.value as boolean,
          }));
        } else if (question.type === "single" || question.type === "multi") {
          const value = answer.value;
          // Only set selectedOptions if value is a string or string[]
          if (typeof value === "string" || Array.isArray(value)) {
            setSelectedOptions((prev) => ({ ...prev, [qId]: value }));
          }
        }
        // For text, the value is stored in answers, textInputs will be populated from answers when rendering
      });

      console.log(`${logPrefix.current} Restored answers:`, {
        answers: initialAnswers,
        isSummaryMode: isSummaryModeRef.current,
      });
    } else {
      // ✅ Reset hasRestoredRef when no initialAnswers (new question)
      hasRestoredRef.current = false;
      console.log(
        `${logPrefix.current} No initialAnswers, reset hasRestoredRef`,
      );
    }
  }, [initialAnswers, isPaginated, questions]);

  const currentQuestion = isPaginated ? questions[currentIndex] : null;
  const totalQuestions = questions.length;
  const isLastQuestion = currentIndex === totalQuestions - 1;
  const isAllAnswered = isPaginated
    ? Object.keys(answers).length === totalQuestions
    : legacyAnswered;

  // Check if current question is answered
  const isCurrentAnswered = useCallback(() => {
    if (!isPaginated || !currentQuestion) return false;
    const q = currentQuestion;
    // For multi-choice: check selectedOptions directly (answers may not be saved yet)
    if (q.type === "multi") {
      const selected = (selectedOptions[q.id] as string[]) || [];
      return selected.length > 0;
    }
    // For single-choice: check selectedOptions (answers is also set but selectedOptions is more immediate)
    if (q.type === "single") {
      const selected = selectedOptions[q.id] as string;
      return !!selected && selected.length > 0;
    }
    // For text: check textInputs
    if (q.type === "text") {
      const value = textInputs[q.id] || "";
      return value.trim().length > 0;
    }
    // For confirm: check confirmValues OR answers (for custom input)
    if (q.type === "confirm") {
      const hasConfirmValue = confirmValues[q.id] !== undefined;
      const hasAnswer = answers[q.id] !== undefined;
      return hasConfirmValue || hasAnswer;
    }
    // Fallback to answers for other types
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
        // Switch to summary mode immediately when all questions are answered
        setIsSummaryMode(true);
        onAllAnsweredProp?.(newAnswers);
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
    // Do NOT auto-advance or call onAllAnswered - let navigation button handle it
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (currentQuestion?.type === "text") {
        handleTextSubmit();
      }
    }
  };

  // Determine the outer wrapper style - consistent with other tools
  const wrapperStyle = {
    display: "flex",
    flexDirection: "column" as const,
    gap: "6px",
    paddingBottom: "12px",
    width: "100%",
  };

  // --- Legacy rendering ---
  if (isLegacyMode) {
    const legacySelected = selectedOptionProp || null;
    return (
      <div className="timeline-item" style={wrapperStyle}>
        <ToolHeader
          title="QUESTION"
          statusColor={
            legacyAnswered
              ? "var(--vscode-gitDecoration-addedResourceForeground, #3fb950)"
              : "var(--vscode-descriptionForeground)"
          }
          icon={
            <span
              className="codicon codicon-question"
              style={{ fontSize: "14px" }}
            />
          }
        />
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

  const getTypeLabel = (type: QuestionType): string => {
    switch (type) {
      case "single":
        return "Chọn một";
      case "multi":
        return "Chọn nhiều";
      case "text":
        return "Nhập văn bản";
      case "confirm":
        return "Xác nhận";
      default:
        return "";
    }
  };

  // Determine status color for ToolHeader dot
  const getStatusColor = () => {
    if (isAllAnswered)
      return "var(--vscode-gitDecoration-addedResourceForeground, #3fb950)";
    if (isCurrentAnswered())
      return "var(--vscode-gitDecoration-addedResourceForeground, #3fb950)";
    return "var(--vscode-descriptionForeground)";
  };

  // Render single question type
  const renderSingle = (q: Question) => {
    const isDisabled = disabled || isAllAnswered;
    // Use answers as the source of truth for selected value
    const selected = (answers[q.id]?.value as string) || "";
    // Get custom value from component-level state
    const customValue = customValues[q.id] || "";

    // Check if the last option is "Khác" or similar (AI-provided "Khác")
    const options = q.options || [];
    const lastOption = options.length > 0 ? options[options.length - 1] : "";
    const hasAiOther =
      lastOption.toLowerCase().includes("khác") ||
      lastOption.toLowerCase().includes("other");

    // Save custom value to selectedOptions when user types (for "Khác" option)
    const updateCustomSelection = (value: string) => {
      // Always save the raw value to customValues
      setCustomValues((prev) => ({ ...prev, [q.id]: value }));

      if (value.trim()) {
        const fullValue = `Khác: ${value.trim()}`;
        // Update selectedOptions directly
        setSelectedOptions((prev) => ({
          ...prev,
          [q.id]: fullValue,
        }));
        // Also update the answer
        const answer: QuestionAnswer = { questionId: q.id, value: fullValue };
        setAnswers((prev) => ({ ...prev, [q.id]: answer }));
        onAnswerProp?.(q.id, fullValue);
      } else {
        // If empty, clear selection
        setSelectedOptions((prev) => {
          const newState = { ...prev };
          delete newState[q.id];
          return newState;
        });
        setAnswers((prev) => {
          const newState = { ...prev };
          delete newState[q.id];
          return newState;
        });
      }
    };

    // Render the "Khác" input bar (used both for AI-provided and auto-added)
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
              const savedCustomValue = customValues[q.id] || "";
              const existingAnswer = (answers[q.id]?.value as string) || "";
              const hasKhacValue =
                existingAnswer &&
                existingAnswer.toString().startsWith("Khác:") &&
                existingAnswer.toString().length > "Khác: ".length;

              if (savedCustomValue) {
                setCustomValues((prev) => ({
                  ...prev,
                  [q.id]: savedCustomValue,
                }));
                updateCustomSelection(savedCustomValue);
              } else if (hasKhacValue) {
                const existingText = existingAnswer
                  .toString()
                  .replace("Khác: ", "");
                setCustomValues((prev) => ({ ...prev, [q.id]: existingText }));
                updateCustomSelection(existingText);
              }
            }
          }}
        >
          <input
            type="text"
            value={customValue}
            onChange={(e) => {
              setCustomValues((prev) => ({ ...prev, [q.id]: e.target.value }));
              updateCustomSelection(e.target.value);
            }}
            onFocus={(e) => e.target.select()}
            placeholder={placeholder}
            disabled={isDisabled}
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
            }}
          />
        </div>
      );
    };

    // Build the list of rendered items
    const renderedItems: React.ReactNode[] = [];

    // 1. Render regular option buttons
    options.forEach((option, index) => {
      // If this is the AI-provided "Khác" option, render it as input bar (skip regular button)
      if (index === options.length - 1 && hasAiOther) {
        const isSelected = !!(
          selected && selected.toString().startsWith("Khác:")
        );
        renderedItems.push(
          renderOtherInput(
            isSelected,
            "Khác (ý kiến của bạn)",
            `other-${q.id}`,
          ),
        );
        return;
      }

      // Regular option button
      const isSelected = selected === option;
      renderedItems.push(
        <button
          key={`${q.id}-${option}`}
          onClick={() => handleSingleSelect(option)}
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

    // 2. ALWAYS add a "Khác" input bar at the end for single-choice questions
    // (even if AI didn't include it) - but avoid duplicate if AI already had it
    if (!hasAiOther) {
      const isSelected = !!(
        selected && selected.toString().startsWith("Khác:")
      );
      renderedItems.push(
        renderOtherInput(
          isSelected,
          "Khác (ý kiến của bạn)",
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

  // Render multi question type
  const renderMulti = (q: Question) => {
    const isDisabled = disabled || isAllAnswered;
    const selected = (selectedOptions[q.id] as string[]) || [];
    const isAnswered = !!answers[q.id];
    // Use component-level state for multi-choice custom value
    const multiCustomValue = multiCustomValues[q.id] || "";

    // Get options and ensure "Khác" is always included as a system option
    const originalOptions = q.options || [];
    const hasOther = originalOptions.some(
      (opt) =>
        opt.toLowerCase().includes("khác") ||
        opt.toLowerCase().includes("other"),
    );

    // If "Khác" is not present, add it as the last option
    const options = hasOther ? originalOptions : [...originalOptions, "Khác"];
    const otherOptionText = "Khác";
    const hasOtherOption = true; // Always true because we ensure "Khác" exists

    // Only log when user interacts - remove verbose render logging

    const handleMultiCustomChange = (value: string) => {
      setMultiCustomValues((prev) => ({ ...prev, [q.id]: value }));
      // Only update selectedOptions with the custom value, do NOT auto-save answers
      if (value.trim()) {
        const fullValue = `Khác: ${value.trim()}`;
        // Remove all previous "Khác" entries (both the placeholder and any previous custom values)
        const newSelected = selected.filter(
          (opt) => opt !== otherOptionText && !opt.startsWith("Khác:"),
        );
        newSelected.push(fullValue);
        setSelectedOptions({ ...selectedOptions, [q.id]: newSelected });
        // Do NOT call setAnswers or onAnswerProp here - answer will be saved via navigation buttons
      } else {
        // If empty, just select "Khác" without custom text
        if (!selected.includes(otherOptionText)) {
          const newSelected = [...selected, otherOptionText];
          setSelectedOptions({ ...selectedOptions, [q.id]: newSelected });
          // Do NOT call setAnswers or onAnswerProp here - answer will be saved via navigation buttons
        }
      }
    };

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        {options.map((option) => {
          const isSelected = selected.includes(option);
          const isOther = hasOtherOption && option === otherOptionText;
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
                  onChange={() => {
                    if (isOther) {
                      // Toggle "Khác" selection - just like other options
                      if (selected.includes(option)) {
                        // Unselect "Khác"
                        const newSelected = selected.filter(
                          (opt) => opt !== option,
                        );
                        setSelectedOptions({
                          ...selectedOptions,
                          [q.id]: newSelected,
                        });
                        // Clear custom value when unselecting
                        setMultiCustomValues((prev) => ({
                          ...prev,
                          [q.id]: "",
                        }));
                      } else {
                        // Select "Khác"
                        const newSelected = [...selected, option];
                        setSelectedOptions({
                          ...selectedOptions,
                          [q.id]: newSelected,
                        });
                      }
                    } else {
                      // Regular option toggle
                      handleMultiToggle(option);
                    }
                  }}
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
                {isOther ? (
                  // For "Khác" option: show label + inline input bar (like oneChoice)
                  <>
                    <input
                      type="text"
                      value={multiCustomValue}
                      onChange={(e) => {
                        setMultiCustomValues((prev) => ({
                          ...prev,
                          [q.id]: e.target.value,
                        }));
                        // Only update selectedOptions, do NOT auto-save answers
                        handleMultiCustomChange(e.target.value);
                      }}
                      placeholder="Khác (ý kiến của bạn)"
                      disabled={isDisabled}
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
                      }}
                      onFocus={(e) => e.target.select()}
                    />
                  </>
                ) : (
                  <span style={{ fontSize: "13px" }}>{option}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  // Render text question type
  const renderText = (q: Question) => {
    const isDisabled = disabled || isAllAnswered;
    const value = textInputs[q.id] || "";
    const isAnswered = !!answers[q.id];
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <textarea
          value={value}
          onChange={(e) =>
            setTextInputs({ ...textInputs, [q.id]: e.target.value })
          }
          onKeyDown={handleKeyDown}
          placeholder="Nhập câu trả lời của bạn..."
          disabled={isDisabled || isAnswered}
          style={{
            width: "100%",
            minHeight: "80px",
            backgroundColor: "var(--vscode-input-background)",
            color: "var(--vscode-input-foreground)",
            border: "1px solid var(--vscode-input-border)",
            borderRadius: "4px",
            padding: "8px",
            fontSize: "13px",
            fontFamily: "inherit",
            resize: "vertical",
            outline: "none",
          }}
        />
        {/* No submit button - use Enter key or navigation buttons to submit */}
      </div>
    );
  };

  // Render confirm question type
  const renderConfirm = (q: Question) => {
    const isDisabled = disabled || isAllAnswered;
    const isAnswered = !!answers[q.id];
    const selected = confirmValues[q.id];
    const greenColor =
      "var(--vscode-gitDecoration-addedResourceForeground, #3fb950)";
    const redColor =
      "var(--vscode-gitDecoration-deletedResourceForeground, #f85149)";
    const customValue = customValues[q.id] || "";

    const updateCustomSelection = (value: string) => {
      setCustomValues((prev) => ({ ...prev, [q.id]: value }));
      if (value.trim()) {
        const fullValue = `Ý kiến: ${value.trim()}`;
        const answer: QuestionAnswer = { questionId: q.id, value: fullValue };
        setAnswers((prev) => ({ ...prev, [q.id]: answer }));
        // Clear confirm selection so "Có"/"Không" become unselected
        setConfirmValues((prev) => {
          const newState = { ...prev };
          delete newState[q.id];
          return newState;
        });
        onAnswerProp?.(q.id, fullValue);
      } else {
        setAnswers((prev) => {
          const newState = { ...prev };
          delete newState[q.id];
          return newState;
        });
        setConfirmValues((prev) => {
          const newState = { ...prev };
          delete newState[q.id];
          return newState;
        });
      }
    };

    // Render option bar for "Có" and "Không" (like single-choice)
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
              handleConfirm(value);
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
        {/* "Có" option bar */}
        {renderOptionBar(true, "Có", greenColor, selected === true)}

        {/* "Không" option bar */}
        {renderOptionBar(false, "Không", redColor, selected === false)}

        {/* Input bar for custom answer (like single-choice "Khác") */}
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
          <input
            type="text"
            value={customValue}
            onChange={(e) => {
              setCustomValues((prev) => ({ ...prev, [q.id]: e.target.value }));
              updateCustomSelection(e.target.value);
            }}
            onFocus={(e) => e.target.select()}
            placeholder="Ý kiến khác..."
            disabled={isDisabled}
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
            }}
          />
        </div>
      </div>
    );
  };
  const renderQuestionContent = () => {
    if (!currentQuestion) return null;
    const isReadOnly = isAllAnswered || disabled;
    switch (currentQuestion.type) {
      case "single":
        return renderSingle(currentQuestion);
      case "multi":
        return renderMulti(currentQuestion);
      case "text":
        return renderText(currentQuestion);
      case "confirm":
        return renderConfirm(currentQuestion);
      default:
        return null;
    }
  };

  const answeredCount = Object.keys(answers).length;

  // Navigation icons for view mode (after all answered)
  const renderNavIcons = () => {
    // Only show if more than 1 question
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
          title="Câu hỏi trước"
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
          title="Câu hỏi tiếp theo"
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

  // Render Summary view (copied from QuestionSummaryBlock)
  const renderSummary = () => {
    const answerCount = Object.keys(answers).length;
    const statusColor =
      answerCount === totalQuestions
        ? "var(--vscode-gitDecoration-addedResourceForeground, #3fb950)"
        : "var(--vscode-descriptionForeground)";

    const formatAnswer = (answer: QuestionAnswer): string => {
      const value = answer.value;
      if (Array.isArray(value)) {
        return value.join(", ");
      }
      if (typeof value === "boolean") {
        return value ? "✅ Có" : "❌ Không";
      }
      return String(value);
    };

    const getAnswer = (questionId: string): string => {
      const answer = answers[questionId];
      if (!answer) return "Chưa trả lời";
      return formatAnswer(answer);
    };

    return (
      <div className="timeline-item" style={wrapperStyle}>
        <ToolHeader
          title={
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "12px",
                color: "var(--vscode-editor-foreground)",
              }}
            >
              <span style={{ fontWeight: 600, opacity: 0.8 }}>QUESTION</span>
              <span
                style={{
                  fontSize: "10px",
                  opacity: 0.5,
                  fontWeight: 400,
                  marginLeft: "4px",
                }}
              >
                ✅ Đã trả lời {answerCount}/{totalQuestions}
              </span>
            </div>
          }
          statusColor={statusColor}
          icon={
            <span
              className="codicon codicon-question"
              style={{ fontSize: "14px" }}
            />
          }
        />
        <div style={{ paddingLeft: "36px", marginTop: "8px" }}>
          {title && (
            <div
              style={{
                fontSize: "13px",
                fontWeight: 500,
                color: "var(--vscode-foreground)",
                marginBottom: "12px",
                padding: "4px 0",
              }}
            >
              {title}
            </div>
          )}

          <div
            style={{ display: "flex", flexDirection: "column", gap: "10px" }}
          >
            {questions.map((q, index) => {
              const answer = getAnswer(q.id);
              const isAnswered = !!answers[q.id];
              const typeLabel = getTypeLabel(q.type);

              return (
                <div
                  key={q.id}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "2px",
                    padding: "6px 12px",
                    borderRadius: "0",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "var(--vscode-foreground)",
                    }}
                  >
                    <span
                      style={{
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "var(--vscode-descriptionForeground)",
                        opacity: 0.6,
                        minWidth: "28px",
                      }}
                    >
                      {index + 1}.
                    </span>
                    <span style={{ marginLeft: "-2px" }}>{q.label}</span>
                  </div>
                  <div
                    style={{
                      fontSize: "13px",
                      paddingLeft: "30px",
                      color: isAnswered
                        ? "var(--vscode-foreground)"
                        : "var(--vscode-descriptionForeground)",
                      fontWeight: isAnswered ? 500 : 400,
                      opacity: isAnswered ? 1 : 0.5,
                    }}
                  >
                    {isAnswered ? (
                      <span
                        style={{
                          display: "inline-block",
                          padding: "2px 10px",
                          backgroundColor:
                            "color-mix(in srgb, var(--vscode-button-background) 15%, transparent)",
                          borderRadius: "4px",
                          fontSize: "12px",
                        }}
                      >
                        {answer}
                      </span>
                    ) : (
                      <span style={{ fontStyle: "italic" }}>Chưa trả lời</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  // If in summary mode, render summary view
  const willRenderSummary = isSummaryMode && isPaginated;
  if (willRenderSummary) {
    return renderSummary();
  }

  return (
    <div className="timeline-item" style={wrapperStyle}>
      <ToolHeader
        title={
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "12px",
              color: "var(--vscode-editor-foreground)",
            }}
          >
            <span style={{ fontWeight: 600, opacity: 0.8 }}>QUESTION</span>
            <span
              style={{
                fontSize: "10px",
                opacity: 0.5,
                fontWeight: 400,
                marginLeft: "4px",
              }}
            >
              {`${answeredCount} / ${totalQuestions} đã trả lời`}
            </span>
          </div>
        }
        statusColor={getStatusColor()}
        icon={
          <span
            className="codicon codicon-question"
            style={{ fontSize: "14px" }}
          />
        }
        headerActions={isAllAnswered ? renderNavIcons() : undefined}
      />
      <div style={{ paddingLeft: "36px", marginTop: "8px" }}>
        {/* Question Label */}
        <div
          style={{
            fontSize: "14px",
            fontWeight: 500,
            color: "var(--vscode-foreground)",
            padding: "4px 0 8px 0",
          }}
        >
          {currentQuestion?.label}
          {currentQuestion?.type && (
            <span
              style={{
                fontSize: "10px",
                fontWeight: 400,
                color: "var(--vscode-descriptionForeground)",
                marginLeft: "8px",
                opacity: 0.6,
                textTransform: "uppercase",
                letterSpacing: "0.3px",
              }}
            >
              ({getTypeLabel(currentQuestion.type)})
            </span>
          )}
        </div>

        {/* Question Content */}
        <div style={{ padding: "2px 0" }}>{renderQuestionContent()}</div>

        {/* Navigation buttons - always visible except when in summary mode */}
        {!isSummaryMode && (
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "8px",
              marginTop: "8px",
            }}
          >
            <button
              onClick={() => setCurrentIndex(Math.max(0, currentIndex - 1))}
              disabled={currentIndex === 0}
              style={{
                padding: "4px 12px",
                backgroundColor: "transparent",
                color: "var(--vscode-foreground)",
                border: "none",
                fontSize: "11px",
                cursor: currentIndex === 0 ? "default" : "pointer",
                opacity: currentIndex === 0 ? 0.3 : 0.7,
              }}
            >
              ← Trước
            </button>
            <button
              onClick={() => {
                let allAnswers = answers;
                // For multi-choice, save selected options as answer before proceeding
                if (currentQuestion?.type === "multi") {
                  const selected =
                    (selectedOptions[currentQuestion.id] as string[]) || [];
                  if (selected.length === 0) return; // Must select at least one
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

                // For text, save the text input as answer before proceeding
                if (currentQuestion?.type === "text") {
                  const value = textInputs[currentQuestion.id] || "";
                  if (value.trim().length === 0) return; // Must have content
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

                if (isCurrentAnswered()) {
                  if (currentIndex < totalQuestions - 1) {
                    setCurrentIndex(currentIndex + 1);
                  } else {
                    // All questions answered - trigger onAllAnswered with the latest answers
                    setIsSummaryMode(true);
                    onAllAnsweredProp?.(allAnswers);
                  }
                }
              }}
              disabled={!isCurrentAnswered()}
              style={{
                padding: "4px 12px",
                backgroundColor: isCurrentAnswered()
                  ? "var(--vscode-button-background)"
                  : "transparent",
                color: isCurrentAnswered()
                  ? "var(--vscode-button-foreground)"
                  : "var(--vscode-foreground)",
                border: "none",
                borderRadius: "4px",
                fontSize: "11px",
                fontWeight: 500,
                cursor: isCurrentAnswered() ? "pointer" : "default",
                opacity: isCurrentAnswered() ? 1 : 0.3,
              }}
            >
              {isLastQuestion ? "Hoàn tất →" : "Tiếp theo →"}
            </button>
          </div>
        )}

        {/* All answered indicator - removed */}
      </div>
    </div>
  );
};

export { QuestionAnswerBlock as QuestionBlock };
export default QuestionAnswerBlock;
