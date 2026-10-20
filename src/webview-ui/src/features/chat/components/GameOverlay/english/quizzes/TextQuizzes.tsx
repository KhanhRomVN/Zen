import React from "react";
import { ErrorCorrectionQuiz, FlashcardQuiz, WritingEssayQuiz } from "../types";
import {
  OK_COLOR,
  QuizFooter,
  QuizViewProps,
  cardStyle,
  choiceStyle,
  controlStyle,
  joinNotes,
  markBorder,
  normalize,
  primaryBtnStyle,
  useDraftState,
  useQuizFlow,
} from "./shared";

const columnStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "14px",
};

type ErrorItem = ErrorCorrectionQuiz["errorCorrections"][number];

const stripPunct = (w: string): string => w.replace(/^[^\w']+|[^\w']+$/g, "");

const evalItem = (item: ErrorItem, picks: Record<number, string>): boolean => {
  const toks = item.sentence.split(/\s+/);
  const picked = Object.keys(picks).map(Number);
  if (picked.length !== item.errors.length) return false;
  return item.errors.every((err) =>
    picked.some(
      (i) =>
        normalize(stripPunct(toks[i])) === normalize(err.token) &&
        normalize(picks[i]) === normalize(err.correction),
    ),
  );
};

export const ErrorCorrectionView: React.FC<
  QuizViewProps<ErrorCorrectionQuiz>
> = ({ quiz, showExplanation, instantFeedback, onFinish }) => {
  const [picks, setPicks] = useDraftState<Record<string, Record<number, string>>>(
    "picks",
    {},
  );
  const flow = useQuizFlow(
    () => {
      const score = quiz.errorCorrections.filter((it) =>
        evalItem(it, picks[it.id] || {}),
      ).length;
      return {
        correct: score === quiz.errorCorrections.length,
        score,
        total: quiz.errorCorrections.length,
      };
    },
    instantFeedback,
    onFinish,
  );

  const toggleToken = (itemId: string, idx: number) => {
    if (flow.checked) return;
    setPicks((prev) => {
      const cur = { ...(prev[itemId] || {}) };
      if (idx in cur) delete cur[idx];
      else cur[idx] = "";
      return { ...prev, [itemId]: cur };
    });
  };

  const setCorrection = (itemId: string, idx: number, value: string) =>
    setPicks((prev) => ({
      ...prev,
      [itemId]: { ...(prev[itemId] || {}), [idx]: value },
    }));

  const canSubmit = quiz.errorCorrections.every((it) => {
    const cur = picks[it.id] || {};
    const keys = Object.keys(cur);
    return keys.length > 0 && keys.every((k) => cur[Number(k)].trim() !== "");
  });

  return (
    <div style={columnStyle}>
      {quiz.errorCorrections.map((it) => {
        const toks = it.sentence.split(/\s+/);
        const cur = picks[it.id] || {};
        const mark = flow.checked
          ? evalItem(it, cur)
            ? "ok"
            : "bad"
          : null;
        return (
          <div key={it.id} style={cardStyle}>
            <div style={{ fontSize: "13px", color: "var(--secondary-text)" }}>
              Tap the wrong word, then type the correction
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
              {toks.map((tok, i) => (
                <button
                  key={i}
                  disabled={flow.checked}
                  onClick={() => toggleToken(it.id, i)}
                  style={{
                    ...choiceStyle(i in cur, mark),
                    padding: "4px 10px",
                  }}
                >
                  {tok}
                </button>
              ))}
            </div>
            {Object.keys(cur).map((k) => {
              const i = Number(k);
              return (
                <div
                  key={k}
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <span style={{ fontSize: "13px" }}>
                    {stripPunct(toks[i])} →
                  </span>
                  <input
                    value={cur[i]}
                    disabled={flow.checked}
                    onChange={(e) => setCorrection(it.id, i, e.target.value)}
                    style={{
                      ...controlStyle,
                      width: "140px",
                      borderColor: markBorder(mark),
                    }}
                  />
                </div>
              );
            })}
          </div>
        );
      })}
      <QuizFooter
        flow={flow}
        instantFeedback={instantFeedback}
        canSubmit={canSubmit}
        note={joinNotes(
          quiz.errorCorrections.map(
            (it) =>
              `${it.errors.map((e) => `${e.token} → ${e.correction}`).join(", ")}${showExplanation && it.explanation ? ` — ${it.explanation}` : ""}`,
          ),
        )}
      />
    </div>
  );
};

const countWords = (text: string): number =>
  text.trim() === "" ? 0 : text.trim().split(/\s+/).length;

export const WritingEssayView: React.FC<QuizViewProps<WritingEssayQuiz>> = ({
  quiz,
  instantFeedback,
  onFinish,
}) => {
  const [text, setText] = useDraftState<string>("text", "");
  const words = countWords(text);
  const inRange = words >= quiz.minWords && words <= quiz.maxWords;
  const flow = useQuizFlow(
    () => ({ correct: inRange, score: inRange ? 1 : 0, total: 1 }),
    instantFeedback,
    onFinish,
  );

  return (
    <div style={columnStyle}>
      <div style={cardStyle}>
        <div style={{ fontSize: "14px", fontWeight: 600 }}>{quiz.prompt}</div>
        <textarea
          value={text}
          disabled={flow.checked}
          onChange={(e) => setText(e.target.value)}
          rows={8}
          style={{
            ...controlStyle,
            resize: "vertical",
            lineHeight: 1.5,
            fontFamily: "inherit",
          }}
        />
        <div
          style={{
            fontSize: "12px",
            color: inRange ? OK_COLOR : "var(--secondary-text)",
          }}
        >
          {words} words (required {quiz.minWords}-{quiz.maxWords})
        </div>
      </div>
      <QuizFooter
        flow={flow}
        instantFeedback={instantFeedback}
        canSubmit={words > 0}
        note="Mock: only the word count is checked; content is not graded by AI yet."
      />
    </div>
  );
};

export const FlashcardView: React.FC<QuizViewProps<FlashcardQuiz>> = ({
  quiz,
  onFinish,
}) => {
  const [index, setIndex] = useDraftState<number>("index", 0);
  const [flipped, setFlipped] = useDraftState<boolean>("flipped", false);
  const [known, setKnown] = useDraftState<number>("known", 0);
  const total = quiz.flashcards.length;
  const card = quiz.flashcards[index];

  const mark = (remembered: boolean) => {
    const nextKnown = known + (remembered ? 1 : 0);
    if (index + 1 >= total) {
      onFinish({ correct: nextKnown === total, score: nextKnown, total });
      return;
    }
    setKnown(nextKnown);
    setIndex(index + 1);
    setFlipped(false);
  };

  return (
    <div style={columnStyle}>
      <div style={{ fontSize: "12px", color: "var(--secondary-text)" }}>
        Card {index + 1}/{total}
      </div>
      <div
        onClick={() => setFlipped((v) => !v)}
        style={{
          ...cardStyle,
          minHeight: "150px",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          cursor: "pointer",
          fontSize: flipped ? "15px" : "22px",
          fontWeight: flipped ? 400 : 700,
          userSelect: "none",
        }}
      >
        {flipped ? card.back : card.front}
        {!flipped && (
          <span style={{ fontSize: "11px", fontWeight: 400, color: "var(--secondary-text)" }}>
            Tap to flip
          </span>
        )}
      </div>
      {flipped && (
        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <button onClick={() => mark(false)} style={primaryBtnStyle(false)}>
            Not yet
          </button>
          <button onClick={() => mark(true)} style={primaryBtnStyle(false)}>
            Got it
          </button>
        </div>
      )}
    </div>
  );
};