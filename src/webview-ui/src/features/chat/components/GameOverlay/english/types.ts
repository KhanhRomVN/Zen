export type QuizType =
  | "multiple-choice"
  | "matching-dropdown"
  | "gap-fill-dropdown"
  | "gap-fill-typing"
  | "sentence-builder"
  | "sentence-transformation"
  | "error-correction"
  | "writing-essay"
  | "flashcard"
  | "builder";

export const QUIZ_TYPE_META: { type: QuizType; label: string; hint: string }[] = [
  { type: "multiple-choice", label: "Multiple Choice", hint: "Click chọn" },
  { type: "matching-dropdown", label: "Matching Dropdown", hint: "Ghép bằng dropdown" },
  { type: "gap-fill-dropdown", label: "Gap Fill Dropdown", hint: "Điền chỗ trống bằng dropdown" },
  { type: "gap-fill-typing", label: "Gap Fill Typing", hint: "Gõ vào chỗ trống" },
  { type: "sentence-builder", label: "Sentence Builder", hint: "Xếp từ thành câu" },
  { type: "sentence-transformation", label: "Sentence Transformation", hint: "Viết lại câu" },
  { type: "error-correction", label: "Error Correction", hint: "Tìm và sửa lỗi" },
  { type: "writing-essay", label: "Writing Essay", hint: "Viết đoạn văn" },
  { type: "flashcard", label: "Flashcard", hint: "Lật thẻ học từ" },
  { type: "builder", label: "Builder", hint: "Chọn từ xây câu" },
];

export interface QuizBase {
  id: string;
  type: QuizType;
  title: string;
  focus: string[];
}

export interface GapAnswer {
  id: string;
  answer: string[];
  score: number;
}

export interface MultipleChoiceQuiz extends QuizBase {
  type: "multiple-choice";
  questions: {
    id: string;
    question: string;
    options: string[];
    correctAnswers: string[];
    explanation?: string;
  }[];
}

export interface MatchingDropdownQuiz extends QuizBase {
  type: "matching-dropdown";
  options: string[];
  questions: { id: string; question: string; correctAnswer: string }[];
}

export interface GapFillDropdownQuiz extends QuizBase {
  type: "gap-fill-dropdown";
  instruction: string;
  question: string;
  gapOptions: Record<string, string[]>;
  answers: GapAnswer[];
}

export interface GapFillTypingQuiz extends QuizBase {
  type: "gap-fill-typing";
  instruction: string;
  question: string;
  hasAudio: boolean;
  answers: GapAnswer[];
}

export interface SentenceBuilderQuiz extends QuizBase {
  type: "sentence-builder";
  instruction: string;
  words: string[];
  correctSentence: string;
}

export interface SentenceTransformationQuiz extends QuizBase {
  type: "sentence-transformation";
  sentenceTransformations: {
    id: string;
    instruction: string;
    source: string;
    targetWithGaps: string;
    answers: Record<string, string[]>;
  }[];
}

export interface ErrorCorrectionQuiz extends QuizBase {
  type: "error-correction";
  errorCorrections: {
    id: string;
    sentence: string;
    errors: { token: string; correction: string }[];
    explanation?: string;
  }[];
}

export interface WritingEssayQuiz extends QuizBase {
  type: "writing-essay";
  prompt: string;
  minWords: number;
  maxWords: number;
}

export interface FlashcardQuiz extends QuizBase {
  type: "flashcard";
  flashcards: { id: string; front: string; back: string }[];
}

export interface BuilderQuiz extends QuizBase {
  type: "builder";
  questions: {
    id: string;
    question: string;
    options: string[];
    correctIndices: number[];
    explanation?: string;
  }[];
}

export type Quiz =
  | MultipleChoiceQuiz
  | MatchingDropdownQuiz
  | GapFillDropdownQuiz
  | GapFillTypingQuiz
  | SentenceBuilderQuiz
  | SentenceTransformationQuiz
  | ErrorCorrectionQuiz
  | WritingEssayQuiz
  | FlashcardQuiz
  | BuilderQuiz;

export interface QuizResult {
  quizId: string;
  correct: boolean;
  score: number;
  total: number;
  skipped?: boolean;
}

export interface GameConfig {
  selectedTypes: QuizType[];
  randomTypes: boolean;
  count: number;
  focusWeakOnly: boolean;
  shuffleOptions: boolean;
  showExplanation: boolean;
  instantFeedback: boolean;
  timeLimitEnabled: boolean;
  timeLimitMinutes: number;
}

export interface WeakItem {
  text: string;
  kind: "word" | "phrase";
  misses: number;
  lastMissedAt: number;
}

export interface DailyStat {
  date: string;
  answered: number;
  correct: number;
}

export interface EnglishStats {
  totalSessions: number;
  totalAnswered: number;
  totalCorrect: number;
  streakDays: number;
  masteredCount: number;
  daily: DailyStat[];
  byType: Record<string, { answered: number; correct: number }>;
  weak: WeakItem[];
}

export interface ActiveSession {
  quizIds: string[];
  index: number;
  results: QuizResult[];
  startedAt: number;
  deadline: number | null;
}

export interface SessionSummary {
  results: QuizResult[];
  weak: { text: string; kind: "word" | "phrase" }[];
  correct: number;
  total: number;
  skipped: number;
  durationSec: number;
}

export type EnglishScreen = "home" | "playing" | "result";

export interface EnglishPersist {
  screen: EnglishScreen;
  config: GameConfig;
  session: ActiveSession | null;
  summary: SessionSummary | null;
  stats: EnglishStats;
}

export type GameId = "menu" | "english";