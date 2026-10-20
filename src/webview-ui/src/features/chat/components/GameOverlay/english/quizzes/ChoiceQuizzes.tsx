import React from "react";
import { shuffle } from "../engine";
import {
  BuilderQuiz,
  MatchingDropdownQuiz,
  MultipleChoiceQuiz,
  SentenceBuilderQuiz,
} from "../types";
import {
  QuizFooter,
  QuizViewProps,
  choiceStyle,
  controlStyle,
  joinNotes,
  markBorder,
  normalize,
  sameSet,
  subQuizStyle,
  useDraftState,
  useQuizFlow,
} from "./shared";

const columnStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "14px",
};

const listStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
};

export const MultipleChoiceView: React.FC<
  QuizViewProps<MultipleChoiceQuiz>
> = ({ quiz, showExplanation, instantFeedback, shuffleOptions, onFinish }) => {
  const [optionLists] = useDraftState<string[][]>(
    "options",
    quiz.questions.map((q) => (shuffleOptions ? shuffle(q.options) : q.options)),
  );
  const [sel, setSel] = useDraftState<Record<string, string[]>>("sel", {});
  const flow = useQuizFlow(
    () => {
      const score = quiz.questions.filter((q) =>
        sameSet(sel[q.id] || [], q.correctAnswers),
      ).length;
      return {
        correct: score === quiz.questions.length,
        score,
        total: quiz.questions.length,
      };
    },
    instantFeedback,
    onFinish,
  );

  const toggle = (
    q: MultipleChoiceQuiz["questions"][number],
    opt: string,
  ) => {
    if (flow.checked) return;
    setSel((prev) => {
      const cur = prev[q.id] || [];
      if (q.correctAnswers.length <= 1) return { ...prev, [q.id]: [opt] };
      return {
        ...prev,
        [q.id]: cur.includes(opt) ? cur.filter((x) => x !== opt) : [...cur, opt],
      };
    });
  };

  return (
    <div style={columnStyle}>
      <div style={listStyle}>
        {quiz.questions.map((q, qi) => {
          const multi = q.correctAnswers.length > 1;
          return (
            <div key={q.id} style={subQuizStyle(qi)}>
              <div style={{ fontSize: "14px", fontWeight: 600 }}>
                {qi + 1}. {q.question}
                {multi && (
                  <span
                    style={{
                      marginLeft: "8px",
                      fontSize: "11px",
                      fontWeight: 400,
                      color: "var(--secondary-text)",
                    }}
                  >
                    (select all that apply)
                  </span>
                )}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {optionLists[qi].map((opt) => {
                  const picked = (sel[q.id] || []).includes(opt);
                  const mark = !flow.checked
                    ? null
                    : q.correctAnswers.includes(opt)
                      ? "ok"
                      : picked
                        ? "bad"
                        : null;
                  return (
                    <button
                      key={opt}
                      className="zg-choice"
                      onClick={() => toggle(q, opt)}
                      style={choiceStyle(picked, mark)}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <QuizFooter
        flow={flow}
        instantFeedback={instantFeedback}
        canSubmit={quiz.questions.every((q) => (sel[q.id] || []).length > 0)}
        note={
          showExplanation
            ? joinNotes(quiz.questions.map((q) => q.explanation))
            : undefined
        }
      />
    </div>
  );
};

export const MatchingDropdownView: React.FC<
  QuizViewProps<MatchingDropdownQuiz>
> = ({ quiz, instantFeedback, shuffleOptions, onFinish }) => {
  const [options] = useDraftState<string[]>(
    "options",
    shuffleOptions ? shuffle(quiz.options) : quiz.options,
  );
  const [vals, setVals] = useDraftState<Record<string, string>>("vals", {});
  const flow = useQuizFlow(
    () => {
      const score = quiz.questions.filter(
        (q) => normalize(vals[q.id] || "") === normalize(q.correctAnswer),
      ).length;
      return {
        correct: score === quiz.questions.length,
        score,
        total: quiz.questions.length,
      };
    },
    instantFeedback,
    onFinish,
  );

  return (
    <div style={columnStyle}>
      <div style={listStyle}>
        {quiz.questions.map((q, qi) => {
          const ok = normalize(vals[q.id] || "") === normalize(q.correctAnswer);
          const mark = flow.checked ? (ok ? "ok" : "bad") : null;
          return (
            <div
              key={q.id}
              style={{
                ...subQuizStyle(qi),
                flexDirection: "row",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <div style={{ flex: "0 0 38%", fontSize: "14px", fontWeight: 600 }}>
                {q.question}
              </div>
              <select
                value={vals[q.id] || ""}
                disabled={flow.checked}
                onChange={(e) =>
                  setVals((prev) => ({ ...prev, [q.id]: e.target.value }))
                }
                style={{
                  ...controlStyle,
                  flex: 1,
                  borderColor: markBorder(mark),
                }}
              >
                <option value="">— select —</option>
                {options.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
              {mark === "bad" && (
                <span style={{ fontSize: "12px", color: "var(--secondary-text)" }}>
                  → {q.correctAnswer}
                </span>
              )}
            </div>
          );
        })}
      </div>
      <QuizFooter
        flow={flow}
        instantFeedback={instantFeedback}
        canSubmit={quiz.questions.every((q) => !!vals[q.id])}
      />
    </div>
  );
};

interface Token {
  idx: number;
  word: string;
}

const makeTokens = (words: string[], doShuffle: boolean): Token[] => {
  const tokens = words.map((word, idx) => ({ idx, word }));
  return doShuffle ? shuffle(tokens) : tokens;
};

const WordArranger: React.FC<{
  tokens: Token[];
  selected: number[];
  locked: boolean;
  mark: "ok" | "bad" | null;
  onChange: (next: number[]) => void;
}> = ({ tokens, selected, locked, mark, onChange }) => {
  const wordOf = (i: number) => tokens.find((t) => t.idx === i)?.word ?? "";
  const chip = (active: boolean, m: "ok" | "bad" | null): React.CSSProperties => ({
    ...choiceStyle(active, m),
    padding: "4px 10px",
  });
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      <div
        style={{
          minHeight: "44px",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "6px",
          padding: "8px",
          border: "1px dashed var(--border-color)",
          borderRadius: "8px",
        }}
      >
        {selected.length === 0 && (
          <span style={{ fontSize: "12px", color: "var(--secondary-text)" }}>
            Tap the words below to build the sentence
          </span>
        )}
        {selected.map((i) => (
          <button
            key={i}
            className="zg-choice"
            disabled={locked}
            onClick={() => onChange(selected.filter((x) => x !== i))}
            style={chip(true, mark)}
          >
            {wordOf(i)}
          </button>
        ))}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
        {tokens
          .filter((t) => !selected.includes(t.idx))
          .map((t) => (
            <button
              key={t.idx}
              className="zg-choice"
              disabled={locked}
              onClick={() => onChange([...selected, t.idx])}
              style={chip(false, null)}
            >
              {t.word}
            </button>
          ))}
      </div>
    </div>
  );
};

export const SentenceBuilderView: React.FC<
  QuizViewProps<SentenceBuilderQuiz>
> = ({ quiz, instantFeedback, shuffleOptions, onFinish }) => {
  const [tokens] = useDraftState<Token[]>(
    "tokens",
    makeTokens(quiz.words, shuffleOptions),
  );
  const [selected, setSelected] = useDraftState<number[]>("selected", []);
  const built = () => selected.map((i) => quiz.words[i]).join(" ");
  const isOk = () => normalize(built()) === normalize(quiz.correctSentence);
  const flow = useQuizFlow(
    () => ({ correct: isOk(), score: isOk() ? 1 : 0, total: 1 }),
    instantFeedback,
    onFinish,
  );

  return (
    <div style={columnStyle}>
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <div style={{ fontSize: "13px", color: "var(--secondary-text)" }}>
          {quiz.instruction}
        </div>
        <WordArranger
          tokens={tokens}
          selected={selected}
          locked={flow.checked}
          mark={flow.checked ? (isOk() ? "ok" : "bad") : null}
          onChange={setSelected}
        />
      </div>
      <QuizFooter
        flow={flow}
        instantFeedback={instantFeedback}
        canSubmit={selected.length > 0}
        note={`Answer: ${quiz.correctSentence}`}
      />
    </div>
  );
};

export const BuilderView: React.FC<QuizViewProps<BuilderQuiz>> = ({
  quiz,
  showExplanation,
  instantFeedback,
  shuffleOptions,
  onFinish,
}) => {
  const [tokenLists] = useDraftState<Token[][]>(
    "tokens",
    quiz.questions.map((q) => makeTokens(q.options, shuffleOptions)),
  );
  const [picked, setPicked] = useDraftState<Record<string, number[]>>(
    "picked",
    {},
  );
  const joined = (q: BuilderQuiz["questions"][number], idxs: number[]) =>
    idxs.map((i) => q.options[i]).join(" ");
  const isOk = (q: BuilderQuiz["questions"][number]) =>
    normalize(joined(q, picked[q.id] || [])) ===
    normalize(joined(q, q.correctIndices));
  const flow = useQuizFlow(
    () => {
      const score = quiz.questions.filter(isOk).length;
      return {
        correct: score === quiz.questions.length,
        score,
        total: quiz.questions.length,
      };
    },
    instantFeedback,
    onFinish,
  );

  return (
    <div style={columnStyle}>
      <div style={listStyle}>
        {quiz.questions.map((q, qi) => (
          <div key={q.id} style={subQuizStyle(qi)}>
            <div style={{ fontSize: "14px", fontWeight: 600 }}>{q.question}</div>
            <WordArranger
              tokens={tokenLists[qi]}
              selected={picked[q.id] || []}
              locked={flow.checked}
              mark={flow.checked ? (isOk(q) ? "ok" : "bad") : null}
              onChange={(next) => setPicked((prev) => ({ ...prev, [q.id]: next }))}
            />
          </div>
        ))}
      </div>
      <QuizFooter
        flow={flow}
        instantFeedback={instantFeedback}
        canSubmit={quiz.questions.every((q) => (picked[q.id] || []).length > 0)}
        note={joinNotes(
          quiz.questions.map(
            (q) =>
              `Answer: ${joined(q, q.correctIndices)}${showExplanation && q.explanation ? ` — ${q.explanation}` : ""}`,
          ),
        )}
      />
    </div>
  );
};