import React from "react";
import {
  Question,
  QuestionAnswer,
  QuestionType,
} from "@/features/chat/types/message";
import { getFileIconPath, getFolderIconPath } from "@/utils/fileIconMapper";

interface QuestionSummaryProps {
  questions: Question[];
  answers: Record<string, QuestionAnswer>;
  title?: string;
}

/**
 * Render a summary of all questions and their answers.
 * Used after all questions have been answered or when viewing past answers.
 */
const QuestionSummary: React.FC<QuestionSummaryProps> = ({
  questions,
  answers,
  title,
}) => {
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

  const renderLabelWithPath = (label: string) => {
    const pathRegex = /^([^\s]+(?:\/[^\s]+)+)$/;
    const match = pathRegex.exec(label.trim());

    if (!match) {
      return <span style={{ flex: 1 }}>{label}</span>;
    }

    const fullPath = match[1];
    const parts = fullPath.split("/");
    const nameWithExt = parts[parts.length - 1];

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

  const wrapperStyle = {
    display: "flex",
    flexDirection: "column" as const,
    paddingBottom: "12px",
    width: "100%",
  };

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
      </div>

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

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {questions.map((q, index) => {
            const answer = getAnswer(q.id);
            const isAnswered = !!answers[q.id];

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
                      color: isAnswered
                        ? "var(--vscode-button-background)"
                        : "var(--vscode-descriptionForeground)",
                      backgroundColor: isAnswered
                        ? "color-mix(in srgb, var(--vscode-button-background) 15%, transparent)"
                        : "color-mix(in srgb, var(--vscode-descriptionForeground) 15%, transparent)",
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
                    paddingLeft: "30px",
                    color: "var(--vscode-descriptionForeground)",
                    fontWeight: 400,
                    opacity: isAnswered ? 0.8 : 0.5,
                  }}
                >
                  {isAnswered ? (
                    <span style={{ display: "inline-block" }}>{answer}</span>
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

export default QuestionSummary;
