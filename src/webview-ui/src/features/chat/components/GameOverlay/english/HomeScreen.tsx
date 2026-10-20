import React, { useState } from "react";
import {
  EnglishStats,
  GameConfig,
  QUIZ_TYPE_META,
  QuizType,
  WeakItem,
} from "./types";
import {
  OK_COLOR,
  cardStyle,
  choiceStyle,
  controlStyle,
  primaryBtnStyle,
} from "./quizzes/shared";

interface Props {
  stats: EnglishStats;
  config: GameConfig;
  notice: string | null;
  onConfigChange: (config: GameConfig) => void;
  onStart: () => void;
}

const sectionTitle: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 700,
  color: "var(--vscode-foreground)",
};
const muted: React.CSSProperties = {
  fontSize: "12px",
  color: "var(--secondary-text)",
};
const chipStyle: React.CSSProperties = {
  padding: "3px 10px",
  borderRadius: "999px",
  background: "rgba(128, 128, 128, 0.16)",
  fontSize: "12px",
};

const pct = (a: number, b: number): number => (b === 0 ? 0 : Math.round((a / b) * 100));

const StatCard: React.FC<{ label: string; value: string }> = ({ label, value }) => (
  <div style={{ ...cardStyle, flex: "1 1 120px", gap: "4px", alignItems: "center" }}>
    <div style={{ fontSize: "20px", fontWeight: 700 }}>{value}</div>
    <div style={muted}>{label}</div>
  </div>
);

const Toggle: React.FC<{
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}> = ({ label, value, onChange }) => (
  <label
    style={{
      display: "flex",
      alignItems: "center",
      gap: "8px",
      fontSize: "13px",
      cursor: "pointer",
    }}
  >
    <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} />
    {label}
  </label>
);

const DailyChart: React.FC<{ daily: EnglishStats["daily"] }> = ({ daily }) => {
  const days = daily.slice(-14);
  const max = Math.max(1, ...days.map((d) => d.answered));
  return (
    <div style={{ display: "flex", alignItems: "flex-end", gap: "4px", height: "90px" }}>
      {days.map((d) => (
        <div
          key={d.date}
          title={`${d.date}: ${d.correct}/${d.answered}`}
          style={{
            flex: 1,
            height: `${Math.max(2, (d.answered / max) * 100)}%`,
            display: "flex",
            flexDirection: "column",
            justifyContent: "flex-end",
            background: "rgba(128,128,128,0.25)",
            borderRadius: "2px",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: `${pct(d.correct, d.answered)}%`,
              background: OK_COLOR,
            }}
          />
        </div>
      ))}
    </div>
  );
};

const WeakList: React.FC<{ weak: WeakItem[] }> = ({ weak }) => {
  const [tab, setTab] = useState<"word" | "phrase">("word");
  const items = weak.filter((w) => w.kind === tab);
  return (
    <div style={cardStyle}>
      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        <span style={sectionTitle}>Needs practice</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: "6px" }}>
          {(
            [
              ["word", "Words"],
              ["phrase", "Phrases"],
            ] as const
          ).map(([k, label]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              style={{ ...choiceStyle(tab === k, null), padding: "3px 10px" }}
            >
              {label} ({weak.filter((w) => w.kind === k).length})
            </button>
          ))}
        </div>
      </div>
      {items.length === 0 ? (
        <div style={muted}>Nothing here yet.</div>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {items.map((w) => (
            <span key={w.text} title={`Missed ${w.misses} times`} style={chipStyle}>
              {w.text} <span style={muted}>×{w.misses}</span>
            </span>
          ))}
        </div>
      )}
    </div>
  );
};

const HomeScreen: React.FC<Props> = ({
  stats,
  config,
  notice,
  onConfigChange,
  onStart,
}) => {
  const set = <K extends keyof GameConfig>(key: K, value: GameConfig[K]) =>
    onConfigChange({ ...config, [key]: value });

  const toggleType = (t: QuizType) => {
    const has = config.selectedTypes.includes(t);
    if (has && config.selectedTypes.length === 1) return;
    set(
      "selectedTypes",
      has ? config.selectedTypes.filter((x) => x !== t) : [...config.selectedTypes, t],
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
        <StatCard label="Accuracy" value={`${pct(stats.totalCorrect, stats.totalAnswered)}%`} />
        <StatCard label="Sessions" value={String(stats.totalSessions)} />
        <StatCard label="Day streak" value={`${stats.streakDays}`} />
        <StatCard label="Mastered" value={String(stats.masteredCount)} />
      </div>

      <div style={cardStyle}>
        <span style={sectionTitle}>Last 14 days</span>
        <DailyChart daily={stats.daily} />
        <span style={muted}>Green: correct answers out of total answers per day</span>
      </div>

      <div style={cardStyle}>
        <span style={sectionTitle}>By question type</span>
        {QUIZ_TYPE_META.map((m) => {
          const s = stats.byType[m.type] || { answered: 0, correct: 0 };
          const p = pct(s.correct, s.answered);
          return (
            <div key={m.type} style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <div style={{ flex: "0 0 34%", fontSize: "12px" }}>{m.label}</div>
              <div
                style={{
                  flex: 1,
                  height: "6px",
                  borderRadius: "3px",
                  background: "rgba(128,128,128,0.25)",
                  overflow: "hidden",
                }}
              >
                <div style={{ width: `${p}%`, height: "100%", background: OK_COLOR }} />
              </div>
              <div style={{ ...muted, width: "36px", textAlign: "right" }}>{p}%</div>
            </div>
          );
        })}
      </div>

      <WeakList weak={stats.weak} />

      <div style={cardStyle}>
        <span style={sectionTitle}>Session settings</span>

        <Toggle
          label="Randomize all question types"
          value={config.randomTypes}
          onChange={(v) => set("randomTypes", v)}
        />
        {!config.randomTypes && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
            {QUIZ_TYPE_META.map((m) => (
              <button
                key={m.type}
                title={m.hint}
                onClick={() => toggleType(m.type)}
                style={{
                  ...choiceStyle(config.selectedTypes.includes(m.type), null),
                  padding: "4px 10px",
                }}
              >
                {m.label}
              </button>
            ))}
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "13px" }}>Questions:</span>
          {[5, 10, 15, 20].map((n) => (
            <button
              key={n}
              onClick={() => set("count", n)}
              style={{ ...choiceStyle(config.count === n, null), padding: "3px 10px" }}
            >
              {n}
            </button>
          ))}
          <input
            type="number"
            min={1}
            max={100}
            value={config.count}
            onChange={(e) =>
              set("count", Math.min(100, Math.max(1, Number(e.target.value) || 1)))
            }
            style={{ ...controlStyle, width: "70px" }}
          />
        </div>

        <Toggle
          label="Prioritize weak words/phrases"
          value={config.focusWeakOnly}
          onChange={(v) => set("focusWeakOnly", v)}
        />
        <Toggle
          label="Shuffle options"
          value={config.shuffleOptions}
          onChange={(v) => set("shuffleOptions", v)}
        />
        <Toggle
          label="Show explanations"
          value={config.showExplanation}
          onChange={(v) => set("showExplanation", v)}
        />
        <Toggle
          label="Instant feedback after each question"
          value={config.instantFeedback}
          onChange={(v) => set("instantFeedback", v)}
        />
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Toggle
            label="Time limit"
            value={config.timeLimitEnabled}
            onChange={(v) => set("timeLimitEnabled", v)}
          />
          {config.timeLimitEnabled && (
            <>
              <input
                type="number"
                min={1}
                max={120}
                value={config.timeLimitMinutes}
                onChange={(e) =>
                  set(
                    "timeLimitMinutes",
                    Math.min(120, Math.max(1, Number(e.target.value) || 1)),
                  )
                }
                style={{ ...controlStyle, width: "70px" }}
              />
              <span style={muted}>min (closing the overlay cancels the session)</span>
            </>
          )}
        </div>
      </div>

      {notice && <div style={{ ...muted, color: "var(--vscode-errorForeground, #f85149)" }}>{notice}</div>}
      <button onClick={onStart} style={{ ...primaryBtnStyle(false), alignSelf: "stretch", padding: "10px" }}>
        Start
      </button>
    </div>
  );
};

export default HomeScreen;