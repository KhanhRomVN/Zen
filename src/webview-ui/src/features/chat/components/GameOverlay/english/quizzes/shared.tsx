import React, { useState } from "react";

export interface QuizOutcome {
  correct: boolean;
  score: number;
  total: number;
}

export interface QuizViewProps<T> {
  quiz: T;
  showExplanation: boolean;
  instantFeedback: boolean;
  shuffleOptions: boolean;
  onFinish: (outcome: QuizOutcome) => void;
}

export const OK_COLOR = "var(--vscode-testing-iconPassed, #3fb950)";
export const BAD_COLOR = "var(--vscode-testing-iconFailed, #f85149)";
export const FOCUS_COLOR = "var(--vscode-focusBorder, #007fd4)";

export type GapPart =
  | { kind: "text"; value: string }
  | { kind: "gap"; id: string };

export const parseGaps = (text: string): GapPart[] => {
  const parts: GapPart[] = [];
  const re = /<gap id='([^']+)'\s*\/>/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      parts.push({ kind: "text", value: text.slice(last, m.index) });
    }
    parts.push({ kind: "gap", id: m[1] });
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    parts.push({ kind: "text", value: text.slice(last) });
  }
  return parts;
};

export const normalize = (s: string): string =>
  s
    .trim()
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, " ");

export const matchesAny = (input: string, answers: string[]): boolean =>
  answers.some((a) => normalize(a) === normalize(input));

export const sameSet = (a: string[], b: string[]): boolean =>
  a.length === b.length && a.every((x) => b.includes(x));

export const joinNotes = (notes: (string | undefined)[]): string | undefined => {
  const filled = notes.filter(Boolean);
  return filled.length > 0 ? filled.join("\n") : undefined;
};

export interface DraftStoreLike {
  get: (key: string) => unknown;
  set: (key: string, value: unknown) => void;
}

export const DraftContext = React.createContext<DraftStoreLike | null>(null);

export const useDraftState = <T,>(
  key: string,
  initial: T,
): [T, React.Dispatch<React.SetStateAction<T>>] => {
  const store = React.useContext(DraftContext);
  const [value, setValue] = useState<T>(() => {
    const saved = store?.get(key);
    return saved !== undefined ? (saved as T) : initial;
  });
  React.useEffect(() => {
    store?.set(key, value);
  }, [value]);
  return [value, setValue];
};

export const useQuizFlow = (
  compute: () => QuizOutcome,
  instantFeedback: boolean,
  onFinish: (outcome: QuizOutcome) => void,
) => {
  const [outcome, setOutcome] = useDraftState<QuizOutcome | null>(
    "outcome",
    null,
  );
  const submit = () => {
    const result = compute();
    if (instantFeedback) setOutcome(result);
    else onFinish(result);
  };
  const next = () => {
    if (outcome) onFinish(outcome);
  };
  return { outcome, checked: outcome !== null, submit, next };
};

export type QuizFlow = ReturnType<typeof useQuizFlow>;

export const GameStyles: React.FC = () => (
  <style>{`
    @keyframes zgFadeIn {
      from { opacity: 0; transform: translateY(8px); }
      to   { opacity: 1; transform: translateY(0); }
    }
    @keyframes zgPulse {
      0%, 100% { opacity: 1; }
      50% { opacity: .25; }
    }
    .zg-enter { animation: zgFadeIn 0.35s ease-out; }
    .zg-card {
      transition: transform .15s ease, border-color .15s ease, box-shadow .15s ease;
    }
    .zg-card:hover {
      transform: translateY(-2px);
      border-color: var(--vscode-focusBorder) !important;
      box-shadow: 0 4px 12px rgba(0,0,0,0.12);
    }
    .zg-choice:hover { border-color: var(--vscode-focusBorder) !important; }
    .zg-btn:not(:disabled):hover { filter: brightness(1.12); }
    .zg-scroll::-webkit-scrollbar { width: 4px; height: 4px; }
    .zg-scroll::-webkit-scrollbar-track { background: transparent; }
    .zg-scroll::-webkit-scrollbar-thumb {
      background: var(--vscode-scrollbarSlider-background, rgba(128,128,128,0.4));
      border-radius: 4px;
    }
    .zg-scroll { scrollbar-width: thin; }
  `}</style>
);

export const IconBadge: React.FC<{
  icon: React.ReactNode;
  color: string;
  bg: string;
  size?: number;
}> = ({ icon, color, bg, size = 32 }) => (
  <div
    style={{
      flexShrink: 0,
      width: `${size}px`,
      height: `${size}px`,
      borderRadius: "6px",
      backgroundColor: bg,
      color,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
    }}
  >
    {icon}
  </div>
);

export const labelStyle: React.CSSProperties = {
  fontSize: "10px",
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  color: "var(--secondary-text)",
};

export const cardStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "12px",
  padding: "14px",
  borderRadius: "8px",
  boxSizing: "border-box",
  border: "1px solid transparent",
  backgroundColor: "var(--vscode-editor-background, #1e1e1e)",
};

export const subQuizStyle = (index: number): React.CSSProperties => ({
  display: "flex",
  flexDirection: "column",
  gap: "10px",
  padding: index === 0 ? "0 0 14px" : "14px 0",
  borderTop: index === 0 ? "none" : "1px solid var(--border-color)",
});

export const controlStyle: React.CSSProperties = {
  padding: "6px 10px",
  borderRadius: "6px",
  border: "1px solid var(--border-color)",
  background: "rgba(128, 128, 128, 0.08)",
  color: "var(--vscode-foreground)",
  fontSize: "13px",
  outline: "none",
  transition: "border-color 0.15s ease",
};

export const markBorder = (mark: "ok" | "bad" | null): string =>
  mark === "ok"
    ? OK_COLOR
    : mark === "bad"
      ? BAD_COLOR
      : "var(--border-color)";

export const choiceStyle = (
  selected: boolean,
  mark: "ok" | "bad" | null,
): React.CSSProperties => ({
  textAlign: "left",
  padding: "9px 12px",
  borderRadius: "8px",
  fontSize: "13px",
  fontFamily: "inherit",
  cursor: mark ? "default" : "pointer",
  color: "var(--vscode-foreground)",
  transition: "border-color 0.15s ease, background 0.15s ease",
  border: `1px solid ${mark ? markBorder(mark) : selected ? FOCUS_COLOR : "var(--border-color)"}`,
  background:
    mark === "ok"
      ? "rgba(63, 185, 80, 0.12)"
      : mark === "bad"
        ? "rgba(248, 81, 73, 0.12)"
        : selected
          ? "rgba(0, 127, 212, 0.14)"
          : "rgba(128, 128, 128, 0.08)",
});

export const primaryBtnStyle = (disabled: boolean): React.CSSProperties => ({
  alignSelf: "flex-end",
  padding: "8px 20px",
  borderRadius: "6px",
  border: "none",
  background: disabled
    ? "rgba(128, 128, 128, 0.16)"
    : "var(--vscode-button-background, #0e639c)",
  color: disabled
    ? "var(--vscode-foreground)"
    : "var(--vscode-button-foreground, #fff)",
  fontSize: "13px",
  fontWeight: 600,
  cursor: disabled ? "not-allowed" : "pointer",
  opacity: disabled ? 0.5 : 1,
});

export const ghostBtnStyle: React.CSSProperties = {
  padding: "4px 10px",
  borderRadius: "6px",
  border: "1px solid var(--border-color)",
  background: "transparent",
  color: "var(--secondary-text)",
  fontSize: "11px",
  fontWeight: 600,
  cursor: "pointer",
};

export const QuizFooter: React.FC<{
  flow: QuizFlow;
  canSubmit: boolean;
  instantFeedback: boolean;
  note?: string;
}> = ({ flow, canSubmit, instantFeedback, note }) => {
  const { outcome, checked } = flow;
  const disabled = !checked && !canSubmit;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {checked && outcome && (
        <div
          className="zg-enter"
          style={{
            padding: "10px 12px",
            borderRadius: "8px",
            fontSize: "13px",
            border: `1px solid ${outcome.correct ? OK_COLOR : BAD_COLOR}`,
            background: outcome.correct
              ? "rgba(63, 185, 80, 0.10)"
              : "rgba(248, 81, 73, 0.10)",
          }}
        >
          <strong style={{ color: outcome.correct ? OK_COLOR : BAD_COLOR }}>
            {outcome.correct
              ? "Correct"
              : `Incorrect (${outcome.score}/${outcome.total})`}
          </strong>
          {note && (
            <div
              style={{
                marginTop: "6px",
                whiteSpace: "pre-line",
                color: "var(--secondary-text)",
              }}
            >
              {note}
            </div>
          )}
        </div>
      )}
      <button
        className="zg-btn"
        disabled={disabled}
        onClick={checked ? flow.next : flow.submit}
        style={primaryBtnStyle(disabled)}
      >
        {checked ? "Continue" : instantFeedback ? "Check" : "Next"}
      </button>
    </div>
  );
};

export const GapText: React.FC<{
  text: string;
  renderGap: (id: string) => React.ReactNode;
}> = ({ text, renderGap }) => (
  <div
    style={{
      fontSize: "14px",
      lineHeight: "2.3",
      color: "var(--vscode-foreground)",
    }}
  >
    {parseGaps(text).map((p, i) =>
      p.kind === "text" ? (
        <span key={i}>{p.value}</span>
      ) : (
        <span key={i} style={{ margin: "0 4px" }}>
          {renderGap(p.id)}
        </span>
      ),
    )}
  </div>
);