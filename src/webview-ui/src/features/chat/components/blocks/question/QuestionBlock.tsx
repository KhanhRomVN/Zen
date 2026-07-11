import React, { useState, useCallback, useEffect, useRef } from "react";
import { ToolHeader } from "../../tools/ToolHeader";
import {
  Question,
  QuestionAnswer,
  QuestionType,
} from "@/features/chat/types/message";
import { getFileIconPath, getFolderIconPath } from "@/utils/fileIconMapper";
import "./QuestionBlock.css";

interface QuestionAnswerBlockProps {
  questions?: Question[];
  options?: string[];
  onAnswer?: (questionId: string, value: string | string[] | boolean) => void;
  onAllAnswered?: (answers: Record<string, QuestionAnswer>) => void;
  disabled?: boolean;
  title?: string;
  /** Legacy props for single-question mode */
  selectedOption?: string;
  onOptionSelect?: (option: string) => void;
  optional?: boolean;
  /** Pre-filled answers from message state (injected after user submits) */
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
  // Determine if this is paginated mode (has questions array) or legacy mode (has options)
  const isPaginated = questionsProp && questionsProp.length > 0;
  const questions = isPaginated ? questionsProp! : [];
  const legacyOptions = optionsProp || [];

  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, QuestionAnswer>>({});
  const [selectedOptions, setSelectedOptions] = useState<
    Record<string, string | string[]>
  >({});
  const [textInputs, setTextInputs] = useState<Record<string, string>>({});
  const [confirmValues, setConfirmValues] = useState<Record<string, boolean>>(
    {},
  );
  // Store custom "Other" values separately so they persist when switching options
  const [customValues, setCustomValues] = useState<Record<string, string>>({});
  // Store multi-choice custom "Other" values separately
  const [multiCustomValues, setMultiCustomValues] = useState<
    Record<string, string>
  >({});
  // Internal state to control summary view (avoid relying on props)
  const [isSummaryMode, setIsSummaryModeState] = useState(false);
  // Ref to track summary mode across re-renders and re-mounts (giống cách TerminalBlock track state)
  const isSummaryModeRef = useRef(false);
  const logPrefix = useRef(`[Zen][QuestionAnswerBlock]`);

  // Refs for auto-resizing textareas
  const textareaRefs = useRef<Record<string, HTMLTextAreaElement | null>>({});

  // Wrapper to keep state and ref in sync
  const setIsSummaryMode = (value: boolean) => {
    isSummaryModeRef.current = value;
    setIsSummaryModeState(value);
  };

  /**
   * Render label with file/folder path detection
   * Format: <icon> <name> (<fullPath>)
   */
  const renderLabelWithPath = (label: string) => {
    // Detect file/folder path pattern: /path/to/file or path/to/file
    const pathRegex = /^([^\s]+(?:\/[^\s]+)+)$/;
    const match = pathRegex.exec(label.trim());

    if (!match) {
      // No path detected, return plain label
      return <span style={{ flex: 1 }}>{label}</span>;
    }

    const fullPath = match[1];
    const parts = fullPath.split("/");
    const nameWithExt = parts[parts.length - 1]; // Full filename with extension

    // Check if it's a folder (ends with /) or has no extension
    const isFolder = fullPath.endsWith("/") || !nameWithExt.includes(".");
    const iconPath = isFolder
      ? getFolderIconPath(nameWithExt, false)
      : getFileIconPath(nameWithExt);

    return (
      <span
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          gap: "6px",
        }}
      >
        <img
          src={iconPath}
          alt={isFolder ? "folder" : "file"}
          style={{
            width: "16px",
            height: "16px",
            flexShrink: 0,
          }}
        />
        <span style={{ fontWeight: 500 }}>{nameWithExt}</span>
        <span
          style={{
            fontSize: "11px",
            opacity: 0.6,
            fontWeight: 400,
          }}
        >
          ({fullPath})
        </span>
      </span>
    );
  };

  // Initialize state from questionAnswersProp when it changes (after user submits)
  useEffect(() => {
    if (questionAnswersProp && Object.keys(questionAnswersProp).length > 0) {
      // Pre-fill answers state
      setAnswers(questionAnswersProp);

      // Pre-fill other states based on question types
      const newSelectedOptions: Record<string, string | string[]> = {};
      const newTextInputs: Record<string, string> = {};
      const newConfirmValues: Record<string, boolean> = {};
      const newCustomValues: Record<string, string> = {};
      const newMultiCustomValues: Record<string, string> = {};

      questions.forEach((q) => {
        const answer = questionAnswersProp[q.id];
        if (!answer) return;

        if (q.type === "single") {
          const value = answer.value as string;
          newSelectedOptions[q.id] = value;

          // Extract custom value if it's "Other: ..."
          if (typeof value === "string" && value.startsWith("Other:")) {
            newCustomValues[q.id] = value.replace("Other:", "").trim();
          }
        } else if (q.type === "multi") {
          const values = answer.value as string[];
          newSelectedOptions[q.id] = values;

          // Extract custom value from multi-choice
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
            // Custom input for confirm
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

  // Auto-resize textareas: expand up to maxHeight (10 lines ~= 240px), shrink when content is deleted
  useEffect(() => {
    Object.entries(textareaRefs.current).forEach(([key, el]) => {
      if (!el) return;
      // Reset to auto so scrollHeight reflects actual content height
      el.style.height = "auto";
      const maxHeight = 240; // px, ~10 lines with 13px font + padding
      el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`;
      el.style.overflowY = el.scrollHeight > maxHeight ? "auto" : "hidden";
    });
  }, [customValues, multiCustomValues, textInputs]);

  // Legacy mode: single question with options
  const isLegacyMode = !isPaginated && legacyOptions.length > 0;
  const legacyAnswered = !!selectedOptionProp;

  // Compute totalQuestions early so it can be used in useEffect
  const totalQuestions = questions.length;
  const currentQuestion = isPaginated ? questions[currentIndex] : null;

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
    paddingBottom: "12px",
    width: "100%",
  };

  // --- Legacy rendering ---
  if (isLegacyMode) {
    const legacySelected = selectedOptionProp || null;
    return (
      <div style={wrapperStyle}>
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
        return "Single choice";
      case "multi":
        return "Multiple choice";
      case "text":
        return "Text input";
      case "confirm":
        return "Confirm";
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

    // Check if the last option is "Other" or similar (AI-provided "Other")
    const options = q.options || [];
    const lastOption = options.length > 0 ? options[options.length - 1] : "";
    const hasAiOther =
      lastOption.toLowerCase().includes("other") ||
      lastOption.toLowerCase().includes("khác");

    // Save custom value to selectedOptions when user types (for "Other" option)
    const updateCustomSelection = (value: string) => {
      // Always save the raw value to customValues
      setCustomValues((prev) => ({ ...prev, [q.id]: value }));

      if (value.trim()) {
        const fullValue = `Other: ${value.trim()}`;
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

    // Handle blur event to save the final value (avoid updating on every keystroke)
    const handleCustomInputBlur = (value: string) => {
      if (value.trim()) {
        const fullValue = `Other: ${value.trim()}`;
        const answer: QuestionAnswer = { questionId: q.id, value: fullValue };
        setAnswers((prev) => ({ ...prev, [q.id]: answer }));
        setSelectedOptions((prev) => ({ ...prev, [q.id]: fullValue }));
        onAnswerProp?.(q.id, fullValue);
      } else {
        // Clear if empty
        setAnswers((prev) => {
          const newState = { ...prev };
          delete newState[q.id];
          return newState;
        });
        setSelectedOptions((prev) => {
          const newState = { ...prev };
          delete newState[q.id];
          return newState;
        });
      }
    };

    // Render the "Other" input bar (used both for AI-provided and auto-added)
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
              const hasOtherValue =
                existingAnswer &&
                existingAnswer.toString().startsWith("Other:") &&
                existingAnswer.toString().length > "Other: ".length;

              if (savedCustomValue) {
                setCustomValues((prev) => ({
                  ...prev,
                  [q.id]: savedCustomValue,
                }));
                updateCustomSelection(savedCustomValue);
              } else if (hasOtherValue) {
                const existingText = existingAnswer
                  .toString()
                  .replace("Other: ", "");
                setCustomValues((prev) => ({ ...prev, [q.id]: existingText }));
                updateCustomSelection(existingText);
              }
            }
          }}
        >
          <textarea
            ref={(el) => {
              textareaRefs.current[`single-other-${q.id}`] = el;
            }}
            value={customValue}
            onChange={(e) => {
              // Only update local state, do NOT trigger answer updates
              setCustomValues((prev) => ({ ...prev, [q.id]: e.target.value }));
            }}
            onBlur={(e) => {
              // Save answer when user finishes typing (blur)
              handleCustomInputBlur(e.target.value);
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

    // Build the list of rendered items
    const renderedItems: React.ReactNode[] = [];

    // 1. Render regular option buttons
    options.forEach((option, index) => {
      // If this is the AI-provided "Other" option, render it as input bar (skip regular button)
      if (index === options.length - 1 && hasAiOther) {
        const isSelected = !!(
          selected && selected.toString().startsWith("Other:")
        );
        renderedItems.push(
          renderOtherInput(isSelected, "Other (your opinion)", `other-${q.id}`),
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

    // 2. ALWAYS add an "Other" input bar at the end for single-choice questions
    // (even if AI didn't include it) - but avoid duplicate if AI already had it
    if (!hasAiOther) {
      const isSelected = !!(
        selected && selected.toString().startsWith("Other:")
      );
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

  // Render multi question type
  const renderMulti = (q: Question) => {
    const isDisabled = disabled || isAllAnswered;
    const selected = (selectedOptions[q.id] as string[]) || [];
    const isAnswered = !!answers[q.id];
    // Use component-level state for multi-choice custom value
    const multiCustomValue = multiCustomValues[q.id] || "";

    // Get options - do NOT auto-add "Other" (we'll render it separately as input bar)
    const originalOptions = q.options || [];

    const handleMultiCustomChange = (value: string) => {
      // Only update local state, do NOT trigger answer updates on every keystroke
      setMultiCustomValues((prev) => ({ ...prev, [q.id]: value }));
    };

    // Handle blur to save the final multi-choice custom value
    const handleMultiCustomBlur = (value: string) => {
      if (value.trim()) {
        const fullValue = `Other: ${value.trim()}`;
        // Remove all previous "Other" entries
        const newSelected = selected.filter((opt) => !opt.startsWith("Other:"));
        newSelected.push(fullValue);
        setSelectedOptions({ ...selectedOptions, [q.id]: newSelected });
      } else {
        // If empty, remove "Other:" entries
        const newSelected = selected.filter((opt) => !opt.startsWith("Other:"));
        setSelectedOptions({ ...selectedOptions, [q.id]: newSelected });
      }
    };

    // Check if "Other:" is selected
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
                  onChange={() => handleMultiToggle(option)}
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

        {/* "Other" option with checkbox and input - always at the end */}
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
                  // Uncheck - clear custom value
                  setMultiCustomValues((prev) => ({
                    ...prev,
                    [q.id]: "",
                  }));
                  const newSelected = selected.filter(
                    (opt) => !opt.startsWith("Other:"),
                  );
                  setSelectedOptions({
                    ...selectedOptions,
                    [q.id]: newSelected,
                  });
                } else {
                  // Check - focus input
                  // Input onChange will handle adding to selectedOptions
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
              value={multiCustomValue}
              onChange={(e) => {
                // Only update local state
                handleMultiCustomChange(e.target.value);
              }}
              onBlur={(e) => {
                // Save to selectedOptions when user finishes typing
                handleMultiCustomBlur(e.target.value);
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

  // Render text question type
  const renderText = (q: Question) => {
    const isDisabled = disabled || isAllAnswered;
    const value = textInputs[q.id] || "";
    const isAnswered = !!answers[q.id];
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <textarea
          ref={(el) => {
            textareaRefs.current[`text-${q.id}`] = el;
          }}
          value={value}
          onChange={(e) =>
            setTextInputs({ ...textInputs, [q.id]: e.target.value })
          }
          onKeyDown={handleKeyDown}
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
      // Only update local customValues state, do NOT auto-save to answers
      setCustomValues((prev) => ({ ...prev, [q.id]: value }));

      // Clear confirm selection when user starts typing custom input
      if (value.trim() && selected !== undefined) {
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
              // Only update local state
              updateCustomSelection(e.target.value);
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

  // Render Summary view (copied from QuestionSummaryBlock)
  const renderSummary = () => {
    const answerCount = Object.keys(answers).length;
    const formatAnswer = (answer: QuestionAnswer): string => {
      const value = answer.value;
      if (Array.isArray(value)) {
        return value.join(", ");
      }
      if (typeof value === "boolean") {
        return value ? "Yes" : "No";
      }
      return String(value);
    };

    const getAnswer = (questionId: string): string => {
      const answer = answers[questionId];
      if (!answer) return "Not answered";
      return formatAnswer(answer);
    };

    return (
      <div style={wrapperStyle}>
        <ToolHeader
          title={
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "14px",
                color: "var(--vscode-editor-foreground)",
              }}
            >
              <span style={{ fontWeight: 500 }}>Question Summary</span>
              <span
                style={{
                  fontSize: "13px",
                  opacity: 0.6,
                  fontWeight: 400,
                }}
              >
                ({answerCount})
              </span>
            </div>
          }
          statusColor="var(--vscode-gitDecoration-addedResourceForeground, #3fb950)"
          icon={
            <span
              className="codicon codicon-question"
              style={{ fontSize: "14px" }}
            />
          }
        />
        <div>
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
                    padding: "6px 0",
                    borderRadius: "0",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      fontSize: "13px",
                      fontWeight: 500,
                      color: "var(--vscode-foreground)",
                    }}
                  >
                    {/* Badge number instead of plain text */}
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
                        color: "var(--vscode-button-background)",
                        backgroundColor:
                          "color-mix(in srgb, var(--vscode-button-background) 15%, transparent)",
                        borderRadius: "4px",
                      }}
                    >
                      {index + 1}
                    </span>
                    {renderLabelWithPath(q.label)}
                  </div>
                  <div
                    style={{
                      fontSize: "13px",
                      paddingLeft: "28px",
                      color: isAnswered
                        ? "var(--vscode-descriptionForeground)"
                        : "var(--vscode-descriptionForeground)",
                      fontWeight: isAnswered ? 400 : 400,
                      opacity: isAnswered ? 0.8 : 0.5,
                    }}
                  >
                    {isAnswered ? (
                      <span
                        style={{
                          display: "inline-block",
                        }}
                      >
                        {answer}
                      </span>
                    ) : (
                      <span style={{ fontStyle: "italic" }}>Not answered</span>
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
    <div style={wrapperStyle}>
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
              {`${answeredCount} / ${totalQuestions} answered`}
            </span>
          </div>
        }
        statusColor={undefined}
        icon={
          <span
            className="codicon codicon-question"
            style={{ fontSize: "14px" }}
          />
        }
        headerActions={isAllAnswered ? renderNavIcons() : undefined}
      />
      <div style={{ paddingLeft: "24px", marginTop: "8px" }}>
        {/* Question Label */}
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
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--vscode-descriptionForeground)",
              opacity: 0.6,
              minWidth: "auto",
              paddingRight: "4px",
            }}
          >
            {currentIndex + 1}.
          </span>
          <span style={{ flex: 1 }}>
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
          </span>
        </div>

        {/* Question Content */}
        <div style={{ padding: "2px 0" }}>{renderQuestionContent()}</div>

        {/* Navigation buttons - always visible except when in summary mode */}
        {!isSummaryMode && (
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              gap: "8px",
              marginTop: "12px",
            }}
          >
            {/* Skip button - ghost variant with underline on hover */}
            <button
              onClick={() => {
                // Skip current question - no need to answer
                if (currentIndex < totalQuestions - 1) {
                  setCurrentIndex(currentIndex + 1);
                } else {
                  // Câu cuối - chuyển sang summary mode
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

            {/* Previous button - soft variant with solid hover (using descriptionForeground color) */}
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

            {/* Next/Complete button - different variants based on isLastQuestion */}
            <button
              onClick={() => {
                let allAnswers = answers;

                // For multi-choice, save selected options as answer before proceeding
                if (currentQuestion?.type === "multi") {
                  const selected =
                    (selectedOptions[currentQuestion.id] as string[]) || [];
                  // Removed validation - allow moving forward even without selection
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

                // For text, save the text input as answer before proceeding
                if (currentQuestion?.type === "text") {
                  const value = textInputs[currentQuestion.id] || "";
                  // Removed validation - allow moving forward even without text
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

                // For confirm, save custom input if exists
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

                // Always allow navigation - removed isCurrentAnswered() check
                if (currentIndex < totalQuestions - 1) {
                  setCurrentIndex(currentIndex + 1);
                } else {
                  // All questions completed - trigger onAllAnswered with the latest answers
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
        )}

        {/* All answered indicator - removed */}
      </div>
    </div>
  );
};

export { QuestionAnswerBlock as QuestionBlock };
export default QuestionAnswerBlock;
