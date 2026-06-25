import React, { useState, useCallback, useEffect, useRef } from "react";
import { Question, QuestionAnswer, QuestionType } from "../../types/message";
import { ToolHeader } from "../tools/ToolHeader";

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
  const logPrefix = useRef(`[Zen][QuestionAnswerBlock]`);

  // Legacy mode: single question with options
  const isLegacyMode = !isPaginated && legacyOptions.length > 0;
  const legacyAnswered = !!selectedOptionProp;

  // Log initial render
  useEffect(() => {
    if (isPaginated) {
      console.log(
        `${logPrefix.current} Initialized with ${questions.length} questions (paginated)`,
        {
          questions: questions.map((q) => ({
            id: q.id,
            type: q.type,
            label: q.label,
          })),
          initialAnswers: Object.keys(initialAnswers),
        },
      );
    } else if (isLegacyMode) {
      console.log(
        `${logPrefix.current} Initialized with ${legacyOptions.length} options (legacy)`,
      );
    }
  }, []);

  // Log when answers changes (for debugging selection issues)
  useEffect(() => {
    console.log(
      `${logPrefix.current} answers changed:`,
      Object.keys(answers).reduce(
        (acc, key) => {
          acc[key] = answers[key]?.value;
          return acc;
        },
        {} as Record<string, any>,
      ),
    );
  }, [answers]);

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
  }, [isPaginated, currentQuestion, answers, selectedOptions, textInputs, confirmValues]);

  const handleSingleSelect = (option: string) => {
    if (disabled || !isPaginated || !currentQuestion) {
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
    if (disabled || !isPaginated || !currentQuestion) return;
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

  const handleMultiSubmit = () => {
    if (disabled || !isPaginated || !currentQuestion) return;
    const value = (selectedOptions[currentQuestion.id] as string[]) || [];
    if (value.length === 0) return;
    console.log(
      `${logPrefix.current} Multi submit: question="${currentQuestion.id}", selected=${value.length} options`,
    );
    const answer: QuestionAnswer = { questionId: currentQuestion.id, value };
    const newAnswers = { ...answers, [currentQuestion.id]: answer };
    setAnswers(newAnswers);
    onAnswerProp?.(currentQuestion.id, value);
    setTimeout(() => {
      if (currentIndex < totalQuestions - 1) {
        console.log(
          `${logPrefix.current} Advancing to question ${currentIndex + 1} (of ${totalQuestions})`,
        );
        setCurrentIndex(currentIndex + 1);
      } else {
        console.log(
          `${logPrefix.current} All questions answered! (${Object.keys(newAnswers).length}/${totalQuestions})`,
        );
        onAllAnsweredProp?.(newAnswers);
      }
    }, 300);
  };

  const handleTextSubmit = () => {
    if (disabled || !isPaginated || !currentQuestion) return;
    const value = textInputs[currentQuestion.id] || "";
    if (value.trim().length === 0) return;
    console.log(
      `${logPrefix.current} Text submit: question="${currentQuestion.id}", value="${value.trim().substring(0, 50)}..."`,
    );
    const answer: QuestionAnswer = {
      questionId: currentQuestion.id,
      value: value.trim(),
    };
    const newAnswers = { ...answers, [currentQuestion.id]: answer };
    setAnswers(newAnswers);
    onAnswerProp?.(currentQuestion.id, value.trim());
    setTimeout(() => {
      if (currentIndex < totalQuestions - 1) {
        console.log(
          `${logPrefix.current} Advancing to question ${currentIndex + 1} (of ${totalQuestions})`,
        );
        setCurrentIndex(currentIndex + 1);
      } else {
        console.log(
          `${logPrefix.current} All questions answered! (${Object.keys(newAnswers).length}/${totalQuestions})`,
        );
        onAllAnsweredProp?.(newAnswers);
      }
    }, 300);
  };

  const handleConfirm = (value: boolean) => {
    if (disabled || !isPaginated || !currentQuestion) return;
    console.log(
      `${logPrefix.current} Confirm: question="${currentQuestion.id}", value=${value}`,
    );
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
        console.log(`${logPrefix.current} Enter key pressed, submitting text`);
        handleTextSubmit();
      }
    }
  };

  // Log when all answered state changes
  useEffect(() => {
    if (isPaginated && isAllAnswered && totalQuestions > 0) {
      console.log(
        `${logPrefix.current} ✅ All ${totalQuestions} questions answered!`,
      );
    }
  }, [isAllAnswered, totalQuestions, isPaginated]);

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
    const renderOtherInput = (isSelected: boolean, placeholder: string, key: string) => {
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
            if (!disabled && !isSelected) {
              e.currentTarget.style.borderLeftColor =
                "var(--vscode-descriptionForeground)";
              e.currentTarget.style.backgroundColor =
                "color-mix(in srgb, var(--vscode-descriptionForeground) 10%, transparent)";
            }
          }}
          onMouseLeave={(e) => {
            if (!disabled && !isSelected) {
              e.currentTarget.style.borderLeftColor =
                "var(--vscode-descriptionForeground)";
              e.currentTarget.style.backgroundColor = "transparent";
            }
          }}
          onClick={() => {
            if (!disabled && !isSelected) {
              const savedCustomValue = customValues[q.id] || "";
              const existingAnswer = (answers[q.id]?.value as string) || "";
              const hasKhacValue =
                existingAnswer &&
                existingAnswer.toString().startsWith("Khác:") &&
                existingAnswer.toString().length > "Khác: ".length;

              if (savedCustomValue) {
                setCustomValues((prev) => ({ ...prev, [q.id]: savedCustomValue }));
                updateCustomSelection(savedCustomValue);
              } else if (hasKhacValue) {
                const existingText = existingAnswer.toString().replace("Khác: ", "");
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
            disabled={disabled}
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
        const isSelected = !!(selected && selected.toString().startsWith("Khác:"));
        renderedItems.push(
          renderOtherInput(isSelected, "Khác (ý kiến của bạn)", `other-${q.id}`)
        );
        return;
      }

      // Regular option button
      const isSelected = selected === option;
      renderedItems.push(
        <button
          key={`${q.id}-${option}`}
          onClick={() => handleSingleSelect(option)}
          disabled={disabled}
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
            cursor: disabled ? "default" : "pointer",
            fontSize: "13px",
            fontWeight: isSelected ? 600 : 400,
            textAlign: "left",
            transition:
              "background-color 0.15s ease, color 0.15s ease, border-color 0.15s ease, font-weight 0.15s ease",
            opacity: 1,
            width: "100%",
          }}
          onMouseEnter={(e) => {
            if (!disabled && !isSelected) {
              e.currentTarget.style.borderLeftColor =
                "var(--vscode-descriptionForeground)";
              e.currentTarget.style.color = "var(--vscode-foreground)";
              e.currentTarget.style.background =
                "color-mix(in srgb, var(--vscode-descriptionForeground) 10%, transparent)";
            }
          }}
          onMouseLeave={(e) => {
            if (!disabled && !isSelected) {
              e.currentTarget.style.borderLeftColor =
                "var(--vscode-descriptionForeground)";
              e.currentTarget.style.color = "var(--vscode-foreground)";
              e.currentTarget.style.background = "transparent";
            }
          }}
        >
          {option}
        </button>
      );
    });

    // 2. ALWAYS add a "Khác" input bar at the end for single-choice questions
    // (even if AI didn't include it) - but avoid duplicate if AI already had it
    if (!hasAiOther) {
      const isSelected = !!(selected && selected.toString().startsWith("Khác:"));
      renderedItems.push(
        renderOtherInput(isSelected, "Khác (ý kiến của bạn)", `auto-other-${q.id}`)
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

    console.log(`${logPrefix.current} renderMulti:`, {
      questionId: q.id,
      originalOptionsCount: originalOptions.length,
      optionsCount: options.length,
      optionsList: options.map((opt, i) => `[${i}] "${opt}"`).join(", "),
      hasOtherOption,
      otherOptionText,
      selected,
      isAnswered,
      multiCustomValue,
    });

    const handleMultiCustomChange = (value: string) => {
      setMultiCustomValues((prev) => ({ ...prev, [q.id]: value }));
      // Only update selectedOptions with the custom value, do NOT auto-save answers
      if (value.trim()) {
        const fullValue = `Khác: ${value.trim()}`;
        // Replace the "Khác" selection with the full value
        const newSelected = selected.filter((opt) => opt !== otherOptionText);
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
                  cursor: disabled || isAnswered ? "default" : "pointer",
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
                    console.log(
                      `${logPrefix.current} Multi checkbox clicked:`,
                      {
                        option,
                        isOther,
                        isSelected,
                        selected,
                        disabled,
                      },
                    );
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
                        console.log(`${logPrefix.current} Unselected "Khác":`, {
                          newSelected,
                        });
                      } else {
                        // Select "Khác"
                        const newSelected = [...selected, option];
                        setSelectedOptions({
                          ...selectedOptions,
                          [q.id]: newSelected,
                        });
                        console.log(`${logPrefix.current} Selected "Khác":`, {
                          newSelected,
                        });
                      }
                    } else {
                      // Regular option toggle
                      handleMultiToggle(option);
                    }
                  }}
                  disabled={disabled}
                  style={{
                    accentColor: isSelected
                      ? "var(--vscode-button-background)"
                      : "var(--vscode-descriptionForeground)",
                    width: "16px",
                    height: "16px",
                    cursor: disabled || isAnswered ? "default" : "pointer",
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
                      placeholder="Nhập ý kiến của bạn..."
                      disabled={disabled}
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
          disabled={disabled || isAnswered}
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
    const isAnswered = !!answers[q.id];
    const selected = confirmValues[q.id];
    const greenColor = "var(--vscode-gitDecoration-addedResourceForeground, #3fb950)";
    const redColor = "var(--vscode-gitDecoration-deletedResourceForeground, #f85149)";
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
      isSelected: boolean
    ) => {
      const borderColor = isSelected ? color : "var(--vscode-descriptionForeground)";
      const bgColor = isSelected
        ? `color-mix(in srgb, ${color} 20%, transparent)`
        : "transparent";

      return (
        <div
          onClick={() => {
            if (!disabled) {
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
            cursor: disabled ? "default" : "pointer",
            fontSize: "13px",
            fontWeight: isSelected ? 600 : 400,
            color: isSelected ? color : "var(--vscode-foreground)",
            transition: "all 0.15s ease",
            opacity: 1,
            width: "100%",
          }}
          onMouseEnter={(e) => {
            if (!disabled && !isSelected) {
              e.currentTarget.style.borderLeftColor = "var(--vscode-descriptionForeground)";
              e.currentTarget.style.color = "var(--vscode-foreground)";
              e.currentTarget.style.backgroundColor = "color-mix(in srgb, var(--vscode-descriptionForeground) 10%, transparent)";
            }
          }}
          onMouseLeave={(e) => {
            if (!disabled && !isSelected) {
              e.currentTarget.style.borderLeftColor = "var(--vscode-descriptionForeground)";
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
      <div style={{ display: "flex", flexDirection: "column", gap: "4px", padding: "4px 0" }}>
        {/* "Có" option bar */}
        {renderOptionBar(
          true,
          "Có",
          greenColor,
          selected === true
        )}

        {/* "Không" option bar */}
        {renderOptionBar(
          false,
          "Không",
          redColor,
          selected === false
        )}

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
            if (!disabled && !customValue.trim()) {
              e.currentTarget.style.borderLeftColor = "var(--vscode-descriptionForeground)";
              e.currentTarget.style.backgroundColor = "color-mix(in srgb, var(--vscode-descriptionForeground) 10%, transparent)";
            }
          }}
          onMouseLeave={(e) => {
            if (!disabled && !customValue.trim()) {
              e.currentTarget.style.borderLeftColor = "var(--vscode-descriptionForeground)";
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
            disabled={disabled}
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
              {isAllAnswered
                ? "✅ Đã trả lời tất cả"
                : `${answeredCount} / ${totalQuestions} đã trả lời`}
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

        {/* Navigation buttons - always visible except when all questions answered */}
        {!isAllAnswered && (
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
                  console.log(
                    `${logPrefix.current} Multi-choice answer saved:`,
                    {
                      questionId: currentQuestion.id,
                      selected,
                    },
                  );
                }

                if (isCurrentAnswered()) {
                  if (currentIndex < totalQuestions - 1) {
                    setCurrentIndex(currentIndex + 1);
                  } else {
                    // All questions answered - trigger onAllAnswered with the latest answers
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

        {/* All answered indicator */}
        {isAllAnswered && (
          <div
            style={{
              padding: "8px 12px",
              marginTop: "8px",
              backgroundColor:
                "color-mix(in srgb, var(--vscode-gitDecoration-addedResourceForeground, #3fb950) 15%, transparent)",
              border:
                "1px solid color-mix(in srgb, var(--vscode-gitDecoration-addedResourceForeground, #3fb950) 30%, transparent)",
              borderRadius: "6px",
              fontSize: "12px",
              color: "var(--vscode-foreground)",
              textAlign: "center",
            }}
          >
            ✅ Đã trả lời tất cả {totalQuestions} câu hỏi
          </div>
        )}
      </div>
    </div>
  );
};

export default QuestionAnswerBlock;
