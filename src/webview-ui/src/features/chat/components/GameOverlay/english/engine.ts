import { MOCK_QUIZZES } from "./mockData";
import {
  ActiveSession,
  EnglishStats,
  GameConfig,
  Quiz,
  SessionSummary,
  WeakItem,
} from "./types";

export const shuffle = <T>(arr: T[]): T[] => {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

export const classifyFocus = (text: string): "word" | "phrase" =>
  text.trim().includes(" ") ? "phrase" : "word";

export const getQuiz = (id: string): Quiz | undefined =>
  MOCK_QUIZZES.find((q) => q.id === id);

const todayKey = (): string => new Date().toISOString().slice(0, 10);

export const buildSession = (
  config: GameConfig,
  stats: EnglishStats,
): ActiveSession | null => {
  const allowedTypes = config.randomTypes
    ? null
    : new Set(config.selectedTypes);
  let pool = MOCK_QUIZZES.filter(
    (q) => !allowedTypes || allowedTypes.has(q.type),
  );

  if (config.focusWeakOnly) {
    const weakTexts = new Set(stats.weak.map((w) => w.text));
    const weakPool = pool.filter((q) => q.focus.some((f) => weakTexts.has(f)));
    if (weakPool.length > 0) pool = weakPool;
  }

  if (pool.length === 0) return null;

  const ids: string[] = [];
  while (ids.length < config.count) {
    shuffle(pool).forEach((q) => {
      if (ids.length < config.count) ids.push(q.id);
    });
  }

  const startedAt = Date.now();
  return {
    quizIds: ids,
    index: 0,
    results: [],
    startedAt,
    deadline: config.timeLimitEnabled
      ? startedAt + config.timeLimitMinutes * 60000
      : null,
  };
};

export const summarizeSession = (session: ActiveSession): SessionSummary => {
  const missed = new Set<string>();
  session.results.forEach((r) => {
    if (!r.correct) getQuiz(r.quizId)?.focus.forEach((f) => missed.add(f));
  });
  return {
    results: session.results,
    weak: Array.from(missed).map((text) => ({
      text,
      kind: classifyFocus(text),
    })),
    correct: session.results.filter((r) => r.correct).length,
    skipped: session.results.filter((r) => r.skipped).length,
    total: session.results.length,
    durationSec: Math.round((Date.now() - session.startedAt) / 1000),
  };
};

export const mergeStats = (
  stats: EnglishStats,
  session: ActiveSession,
  summary: SessionSummary,
): EnglishStats => {
  const missedTexts = new Set(summary.weak.map((w) => w.text));
  const clearedTexts = new Set<string>();
  const byType = { ...stats.byType };

  session.results.forEach((r) => {
    const quiz = getQuiz(r.quizId);
    if (!quiz) return;
    const prev = byType[quiz.type] || { answered: 0, correct: 0 };
    byType[quiz.type] = {
      answered: prev.answered + 1,
      correct: prev.correct + (r.correct ? 1 : 0),
    };
    if (r.correct) quiz.focus.forEach((f) => clearedTexts.add(f));
  });

  let mastered = stats.masteredCount;
  const weakMap = new Map<string, WeakItem>(stats.weak.map((w) => [w.text, w]));

  missedTexts.forEach((text) => {
    const existing = weakMap.get(text);
    weakMap.set(text, {
      text,
      kind: classifyFocus(text),
      misses: (existing?.misses || 0) + 1,
      lastMissedAt: Date.now(),
    });
  });

  clearedTexts.forEach((text) => {
    if (missedTexts.has(text)) return;
    const existing = weakMap.get(text);
    if (!existing) return;
    if (existing.misses <= 1) {
      weakMap.delete(text);
      mastered += 1;
    } else {
      weakMap.set(text, { ...existing, misses: existing.misses - 1 });
    }
  });

  const today = todayKey();
  const daily = stats.daily.map((d) => ({ ...d }));
  const last = daily[daily.length - 1];
  if (last && last.date === today) {
    last.answered += summary.total;
    last.correct += summary.correct;
  } else {
    daily.push({
      date: today,
      answered: summary.total,
      correct: summary.correct,
    });
  }

  let streak = 0;
  for (let i = daily.length - 1; i >= 0; i--) {
    if (daily[i].answered > 0) streak += 1;
    else break;
  }

  return {
    totalSessions: stats.totalSessions + 1,
    totalAnswered: stats.totalAnswered + summary.total,
    totalCorrect: stats.totalCorrect + summary.correct,
    streakDays: streak,
    masteredCount: mastered,
    daily: daily.slice(-30),
    byType,
    weak: Array.from(weakMap.values()).sort((a, b) => b.misses - a.misses),
  };
};
