import React, { useEffect, useRef, useState } from "react";
import { Clock, SkipForward, X } from "lucide-react";
import { getQuiz } from "./engine";
import {
  BuilderView,
  MatchingDropdownView,
  MultipleChoiceView,
  SentenceBuilderView,
} from "./quizzes/ChoiceQuizzes";
import {
  GapFillDropdownView,
  GapFillTypingView,
  SentenceTransformationView,
} from "./quizzes/GapQuizzes";
import {
  ErrorCorrectionView,
  FlashcardView,
  WritingEssayView,
} from "./quizzes/TextQuizzes";
import {
  DraftContext,
  FOCUS_COLOR,
  QuizOutcome,
  QuizViewProps,
  cardStyle,
  ghostBtnStyle,
  labelStyle,
} from "./quizzes/shared";
import { createDraftStore } from "./storage";
import { ActiveSession, GameConfig, Quiz, QUIZ_TYPE_META } from "./types";

interface Props {
  session: ActiveSession;
  config: GameConfig;
  onProgress: (session: ActiveSession) => void;
  onFinish: (session: ActiveSession) => void;
  onQuit: () => void;
}

const renderQuiz = (
  quiz: Quiz,
  common: Omit<QuizViewProps<unknown>, "quiz">,
): React.ReactNode => {
  switch (quiz.type) {
    case "multiple-choice":
      return <MultipleChoiceView quiz={quiz} {...common} />;
    case "matching-dropdown":
      return <MatchingDropdownView quiz={quiz} {...common} />;
    case "gap-fill-dropdown":
      return <GapFillDropdownView quiz={quiz} {...common} />;
    case "gap-fill-typing":
      return <GapFillTypingView quiz={quiz} {...common} />;
    case "sentence-builder":
      return <SentenceBuilderView quiz={quiz} {...common} />;
    case "sentence-transformation":
      return <SentenceTransformationView quiz={quiz} {...common} />;
    case "error-correction":
      return <ErrorCorrectionView quiz={quiz} {...common} />;
    case "writing-essay":
      return <WritingEssayView quiz={quiz} {...common} />;
    case "flashcard":
      return <FlashcardView quiz={quiz} {...common} />;
    case "builder":
      return <BuilderView quiz={quiz} {...common} />;
  }
};

const fmt = (sec: number): string => {
  const s = Math.max(0, sec);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

const PlayScreen: React.FC<Props> = ({
  session,
  config,
  onProgress,
  onFinish,
  onQuit,
}) => {
  const [now, setNow] = useState(Date.now());
  const sessionRef = useRef(session);
  sessionRef.current = session;

  useEffect(() => {
    if (session.deadline === null) return;
    const timer = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (session.deadline !== null && t >= session.deadline) {
        clearInterval(timer);
        onFinish(sessionRef.current);
      }
    }, 1000);
    return () => clearInterval(timer);
  }, [session.deadline]);

  const total = session.quizIds.length;
  const quiz = getQuiz(session.quizIds[session.index]);
  const draft = React.useMemo(
    () => createDraftStore(`${session.startedAt}:${session.index}`),
    [session.startedAt, session.index],
  );

  const advance = (result: ActiveSession["results"][number]) => {
    const next: ActiveSession = {
      ...session,
      results: [...session.results, result],
      index: session.index + 1,
    };
    if (next.index >= total) onFinish(next);
    else onProgress(next);
  };

  const handleFinish = (outcome: QuizOutcome) => {
    if (!quiz) return;
    advance({ quizId: quiz.id, ...outcome });
  };

  const handleSkip = () => {
    if (!quiz) return;
    advance({ quizId: quiz.id, correct: false, score: 0, total: 0, skipped: true });
  };

  if (!quiz) {
    return (
      <div style={{ fontSize: "13px" }}>
        Question not found.{" "}
        <button onClick={onQuit}>Back to home</button>
      </div>
    );
  }

  const typeLabel =
    QUIZ_TYPE_META.find((m) => m.type === quiz.type)?.label ?? quiz.type;
  const percent = (session.index / total) * 100;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      <div style={{ ...cardStyle, gap: "10px", padding: "12px 14px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "13px", fontWeight: 700 }}>
            Question {session.index + 1}
            <span style={{ color: "var(--secondary-text)", fontWeight: 500 }}>
              {" "}
              / {total}
            </span>
          </span>
          {session.deadline !== null && (
            <span
              style={{
                display: "flex",
                alignItems: "center",
                gap: "4px",
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--vscode-editorWarning-foreground, #f59e0b)",
              }}
            >
              <Clock size={12} />
              {fmt(Math.round((session.deadline - now) / 1000))}
            </span>
          )}
          <div style={{ marginLeft: "auto", display: "flex", gap: "6px" }}>
            <button
              className="zg-btn"
              onClick={handleSkip}
              title="Skip this question"
              style={{
                ...ghostBtnStyle,
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <SkipForward size={12} />
              Skip
            </button>
            <button
              className="zg-btn"
              onClick={onQuit}
              title="Quit session"
              style={{
                ...ghostBtnStyle,
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <X size={12} />
              Quit
            </button>
          </div>
        </div>
        <div
          style={{
            height: "6px",
            borderRadius: "3px",
            background: "rgba(128,128,128,0.2)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              width: `${percent}%`,
              height: "100%",
              borderRadius: "3px",
              background: `linear-gradient(to right, ${FOCUS_COLOR}, var(--vscode-textLink-foreground, #3b82f6))`,
              transition: "width 0.3s ease",
            }}
          />
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <span style={labelStyle}>{typeLabel}</span>
        <div
          style={{
            fontSize: "16px",
            fontWeight: 700,
            letterSpacing: "-0.01em",
          }}
        >
          {quiz.title}
        </div>
      </div>

      <DraftContext.Provider value={draft}>
        <div
          key={`${session.index}-${quiz.id}`}
          className="zg-enter"
          style={{ ...cardStyle, gap: "14px" }}
        >
          {renderQuiz(quiz, {
            showExplanation: config.showExplanation,
            instantFeedback: config.instantFeedback,
            shuffleOptions: config.shuffleOptions,
            onFinish: handleFinish,
          })}
        </div>
      </DraftContext.Provider>
    </div>
  );
};

export default PlayScreen;