import React from "react";
import { shuffle } from "../engine";
import {
  GapFillDropdownQuiz,
  GapFillTypingQuiz,
  SentenceTransformationQuiz,
} from "../types";
import {
  GapText,
  QuizFooter,
  QuizViewProps,
  cardStyle,
  controlStyle,
  markBorder,
  matchesAny,
  useDraftState,
  useQuizFlow,
} from "./shared";

const columnStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "14px",
};

const hintStyle: React.CSSProperties = {
  fontSize: "13px",
  color: "var(--secondary-text)",
};

export const GapFillDropdownView: React.FC<
  QuizViewProps<GapFillDropdownQuiz>
> = ({ quiz, instantFeedback, shuffleOptions, onFinish }) => {
  const [optionMap] = useDraftState<Record<string, string[]>>(
    "options",
    (() => {
      const out: Record<string, string[]> = {};
      Object.keys(quiz.gapOptions).forEach((id) => {
        out[id] = shuffleOptions ? shuffle(quiz.gapOptions[id]) : quiz.gapOptions[id];
      });
      return out;
    })(),
  );
  const [vals, setVals] = useDraftState<Record<string, string>>("vals", {});
  const isOk = (id: string) => {
    const ans = quiz.answers.find((a) => a.id === id);
    return !!ans && matchesAny(vals[id] || "", ans.answer);
  };
  const flow = useQuizFlow(
    () => {
      const score = quiz.answers.filter((a) => isOk(a.id)).length;
      return {
        correct: score === quiz.answers.length,
        score,
        total: quiz.answers.length,
      };
    },
    instantFeedback,
    onFinish,
  );

  return (
    <div style={columnStyle}>
      <div style={cardStyle}>
        <div style={hintStyle}>{quiz.instruction}</div>
        <GapText
          text={quiz.question}
          renderGap={(id) => {
            const mark = flow.checked ? (isOk(id) ? "ok" : "bad") : null;
            const ans = quiz.answers.find((a) => a.id === id);
            return (
              <>
                <select
                  value={vals[id] || ""}
                  disabled={flow.checked}
                  onChange={(e) =>
                    setVals((prev) => ({ ...prev, [id]: e.target.value }))
                  }
                  style={{ ...controlStyle, borderColor: markBorder(mark) }}
                >
                  <option value="">—</option>
                  {(optionMap[id] || []).map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
                {mark === "bad" && ans && (
                  <span style={{ ...hintStyle, marginLeft: "6px" }}>
                    → {ans.answer[0]}
                  </span>
                )}
              </>
            );
          }}
        />
      </div>
      <QuizFooter
        flow={flow}
        instantFeedback={instantFeedback}
        canSubmit={quiz.answers.every((a) => !!vals[a.id])}
      />
    </div>
  );
};

export const GapFillTypingView: React.FC<QuizViewProps<GapFillTypingQuiz>> = ({
  quiz,
  instantFeedback,
  onFinish,
}) => {
  const [vals, setVals] = useDraftState<Record<string, string>>("vals", {});
  const isOk = (id: string) => {
    const ans = quiz.answers.find((a) => a.id === id);
    return !!ans && matchesAny(vals[id] || "", ans.answer);
  };
  const flow = useQuizFlow(
    () => {
      const score = quiz.answers.filter((a) => isOk(a.id)).length;
      return {
        correct: score === quiz.answers.length,
        score,
        total: quiz.answers.length,
      };
    },
    instantFeedback,
    onFinish,
  );

  return (
    <div style={columnStyle}>
      <div style={cardStyle}>
        <div style={hintStyle}>{quiz.instruction}</div>
        <GapText
          text={quiz.question}
          renderGap={(id) => {
            const mark = flow.checked ? (isOk(id) ? "ok" : "bad") : null;
            const ans = quiz.answers.find((a) => a.id === id);
            return (
              <>
                <input
                  value={vals[id] || ""}
                  disabled={flow.checked}
                  onChange={(e) =>
                    setVals((prev) => ({ ...prev, [id]: e.target.value }))
                  }
                  style={{
                    ...controlStyle,
                    width: "120px",
                    borderColor: markBorder(mark),
                  }}
                />
                {mark === "bad" && ans && (
                  <span style={{ ...hintStyle, marginLeft: "6px" }}>
                    → {ans.answer[0]}
                  </span>
                )}
              </>
            );
          }}
        />
      </div>
      <QuizFooter
        flow={flow}
        instantFeedback={instantFeedback}
        canSubmit={quiz.answers.every((a) => (vals[a.id] || "").trim() !== "")}
      />
    </div>
  );
};

export const SentenceTransformationView: React.FC<
  QuizViewProps<SentenceTransformationQuiz>
> = ({ quiz, instantFeedback, onFinish }) => {
  const [vals, setVals] = useDraftState<Record<string, string>>("vals", {});
  const keyOf = (tid: string, gid: string) => `${tid}:${gid}`;
  const gapOk = (
    t: SentenceTransformationQuiz["sentenceTransformations"][number],
    gid: string,
  ) => matchesAny(vals[keyOf(t.id, gid)] || "", t.answers[gid] || []);
  const itemOk = (
    t: SentenceTransformationQuiz["sentenceTransformations"][number],
  ) => Object.keys(t.answers).every((gid) => gapOk(t, gid));
  const flow = useQuizFlow(
    () => {
      const total = quiz.sentenceTransformations.length;
      const score = quiz.sentenceTransformations.filter(itemOk).length;
      return { correct: score === total, score, total };
    },
    instantFeedback,
    onFinish,
  );
  const allFilled = quiz.sentenceTransformations.every((t) =>
    Object.keys(t.answers).every(
      (gid) => (vals[keyOf(t.id, gid)] || "").trim() !== "",
    ),
  );

  return (
    <div style={columnStyle}>
      {quiz.sentenceTransformations.map((t) => (
        <div key={t.id} style={cardStyle}>
          <div style={hintStyle}>{t.instruction}</div>
          <div style={{ fontSize: "14px", fontWeight: 600 }}>{t.source}</div>
          <GapText
            text={t.targetWithGaps}
            renderGap={(gid) => {
              const mark = flow.checked ? (gapOk(t, gid) ? "ok" : "bad") : null;
              return (
                <>
                  <input
                    value={vals[keyOf(t.id, gid)] || ""}
                    disabled={flow.checked}
                    onChange={(e) =>
                      setVals((prev) => ({
                        ...prev,
                        [keyOf(t.id, gid)]: e.target.value,
                      }))
                    }
                    style={{
                      ...controlStyle,
                      width: "110px",
                      borderColor: markBorder(mark),
                    }}
                  />
                  {mark === "bad" && (
                    <span style={{ ...hintStyle, marginLeft: "6px" }}>
                      → {(t.answers[gid] || [])[0]}
                    </span>
                  )}
                </>
              );
            }}
          />
        </div>
      ))}
      <QuizFooter
        flow={flow}
        instantFeedback={instantFeedback}
        canSubmit={allFilled}
      />
    </div>
  );
};