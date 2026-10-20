import { EnglishStats, Quiz } from "./types";

export const MOCK_QUIZZES: Quiz[] = [
  {
    id: "mc-1",
    type: "multiple-choice",
    title: "Choose the correct answer",
    focus: ["goes", "third person singular"],
    questions: [
      { id: "q1", question: "She ___ to school every day.", options: ["go", "goes", "going", "gone"], correctAnswers: ["goes"], explanation: "Chủ ngữ ngôi thứ 3 số ít → động từ thêm -es." },
      { id: "q2", question: "Which are fruits? (select all)", options: ["apple", "carrot", "banana", "potato"], correctAnswers: ["apple", "banana"], explanation: "Apple và banana là trái cây." },
    ],
  },
  {
    id: "mc-2",
    type: "multiple-choice",
    title: "Choose the correct answer",
    focus: ["look forward to", "in spite of"],
    questions: [
      { id: "q1", question: "I look forward to ___ you.", options: ["see", "seeing", "saw", "seen"], correctAnswers: ["seeing"], explanation: "Sau 'look forward to' dùng V-ing." },
      { id: "q2", question: "___ the rain, we went out.", options: ["Because of", "In spite of", "So that", "Unless"], correctAnswers: ["In spite of"], explanation: "'In spite of' diễn tả sự nhượng bộ." },
    ],
  },
  {
    id: "md-1",
    type: "matching-dropdown",
    title: "Match the words with their meanings",
    focus: ["banquet", "sprint", "exhausted"],
    options: ["a large meal", "to run quickly", "very tired", "a small house"],
    questions: [
      { id: "q1", question: "banquet", correctAnswer: "a large meal" },
      { id: "q2", question: "sprint", correctAnswer: "to run quickly" },
      { id: "q3", question: "exhausted", correctAnswer: "very tired" },
    ],
  },
  {
    id: "md-2",
    type: "matching-dropdown",
    title: "Match the words with their meanings",
    focus: ["benevolent", "abundant", "reluctant"],
    options: ["kind and generous", "existing in large quantities", "unwilling to do something", "extremely small"],
    questions: [
      { id: "q1", question: "benevolent", correctAnswer: "kind and generous" },
      { id: "q2", question: "abundant", correctAnswer: "existing in large quantities" },
      { id: "q3", question: "reluctant", correctAnswer: "unwilling to do something" },
    ],
  },
  {
    id: "gfd-1",
    type: "gap-fill-dropdown",
    title: "Fill in the blanks",
    focus: ["went", "fruit"],
    instruction: "Choose the correct word for each gap.",
    question: "Yesterday I <gap id='g1'/> to the market and bought some <gap id='g2'/>.",
    gapOptions: { g1: ["go", "went", "gone"], g2: ["fruit", "fruits", "fruity"] },
    answers: [
      { id: "g1", answer: ["went"], score: 1 },
      { id: "g2", answer: ["fruit"], score: 1 },
    ],
  },
  {
    id: "gfd-2",
    type: "gap-fill-dropdown",
    title: "Fill in the blanks",
    focus: ["as soon as", "be used to"],
    instruction: "Choose the correct word for each gap.",
    question: "I will call you <gap id='g1'/> I arrive. I am not <gap id='g2'/> getting up early.",
    gapOptions: { g1: ["as soon as", "as long", "as far"], g2: ["use to", "used to", "using to"] },
    answers: [
      { id: "g1", answer: ["as soon as"], score: 1 },
      { id: "g2", answer: ["used to"], score: 1 },
    ],
  },
  {
    id: "gft-1",
    type: "gap-fill-typing",
    title: "Type the missing words",
    focus: ["goes"],
    instruction: "Write the correct form of the verb.",
    question: "He <gap id='g1'/> (go) to work by bus every morning.",
    hasAudio: false,
    answers: [{ id: "g1", answer: ["goes"], score: 1 }],
  },
  {
    id: "gft-2",
    type: "gap-fill-typing",
    title: "Type the missing words",
    focus: ["exhausted", "abundant"],
    instruction: "Write the missing word from the hint.",
    question: "After the marathon she was <gap id='g1'/> (very tired). Fresh water is <gap id='g2'/> (plentiful) here.",
    hasAudio: false,
    answers: [
      { id: "g1", answer: ["exhausted"], score: 1 },
      { id: "g2", answer: ["abundant"], score: 1 },
    ],
  },
  {
    id: "sb-1",
    type: "sentence-builder",
    title: "Build the sentence",
    focus: ["jumps over"],
    instruction: "Arrange the words to form a correct sentence.",
    words: ["The", "quick", "brown", "fox", "jumps", "over", "lazy", "dog"],
    correctSentence: "The quick brown fox jumps over lazy dog",
  },
  {
    id: "sb-2",
    type: "sentence-builder",
    title: "Build the sentence",
    focus: ["look forward to"],
    instruction: "Arrange the words to form a correct sentence.",
    words: ["We", "look", "forward", "to", "meeting", "you", "soon"],
    correctSentence: "We look forward to meeting you soon",
  },
  {
    id: "st-1",
    type: "sentence-transformation",
    title: "Rewrite the sentence",
    focus: ["passive voice", "doesn't"],
    sentenceTransformations: [
      {
        id: "st1",
        instruction: "Change to passive voice.",
        source: "The chef cooked the meal.",
        targetWithGaps: "The meal <gap id='g1'/> <gap id='g2'/> by the chef.",
        answers: { g1: ["was"], g2: ["cooked"] },
      },
      {
        id: "st2",
        instruction: "Change to negative form.",
        source: "She likes coffee.",
        targetWithGaps: "She <gap id='g1'/> like coffee.",
        answers: { g1: ["doesn't", "does not"] },
      },
    ],
  },
  {
    id: "st-2",
    type: "sentence-transformation",
    title: "Rewrite the sentence",
    focus: ["in spite of", "be used to"],
    sentenceTransformations: [
      {
        id: "st1",
        instruction: "Rewrite using 'in spite of'.",
        source: "Although it rained, we went out.",
        targetWithGaps: "<gap id='g1'/> <gap id='g2'/> the rain, we went out.",
        answers: { g1: ["In"], g2: ["spite of"] },
      },
    ],
  },
  {
    id: "ec-1",
    type: "error-correction",
    title: "Find and correct the error",
    focus: ["doesn't", "has"],
    errorCorrections: [
      { id: "ec1", sentence: "She don't like apples.", errors: [{ token: "don't", correction: "doesn't" }], explanation: "Chủ ngữ 'She' → dùng 'doesn't'." },
      { id: "ec2", sentence: "He have two brothers.", errors: [{ token: "have", correction: "has" }], explanation: "Chủ ngữ 'He' → dùng 'has'." },
    ],
  },
  {
    id: "ec-2",
    type: "error-correction",
    title: "Find and correct the error",
    focus: ["much", "were"],
    errorCorrections: [
      { id: "ec1", sentence: "There are too much people here.", errors: [{ token: "much", correction: "many" }], explanation: "'people' đếm được → dùng 'many'." },
      { id: "ec2", sentence: "They was late for class.", errors: [{ token: "was", correction: "were" }], explanation: "Chủ ngữ 'They' → dùng 'were'." },
    ],
  },
  {
    id: "we-1",
    type: "writing-essay",
    title: "Write a short essay",
    focus: ["favorite hobby"],
    prompt: "Describe your favorite hobby in 80-100 words. Explain why you enjoy it and how often you do it.",
    minWords: 80,
    maxWords: 100,
  },
  {
    id: "we-2",
    type: "writing-essay",
    title: "Write a short essay",
    focus: ["daily routine"],
    prompt: "Describe your daily routine in 60-80 words. Mention at least three activities and the time you do them.",
    minWords: 60,
    maxWords: 80,
  },
  {
    id: "fc-1",
    type: "flashcard",
    title: "Vocabulary Flashcards",
    focus: ["abundant", "benevolent"],
    flashcards: [
      { id: "fc1", front: "abundant", back: "existing in large quantities; more than enough" },
      { id: "fc2", front: "benevolent", back: "kind and generous" },
    ],
  },
  {
    id: "fc-2",
    type: "flashcard",
    title: "Phrase Flashcards",
    focus: ["look forward to", "in spite of"],
    flashcards: [
      { id: "fc1", front: "look forward to", back: "to feel happy about something that is going to happen" },
      { id: "fc2", front: "in spite of", back: "without being affected by; despite" },
    ],
  },
  {
    id: "bd-1",
    type: "builder",
    title: "Build the correct answer",
    focus: ["could you please"],
    questions: [
      {
        id: "q1",
        question: "Form a polite request to open the window.",
        options: ["Could", "you", "please", "open", "the", "window", "close", "door"],
        correctIndices: [0, 1, 2, 3, 4, 5],
        explanation: "Câu yêu cầu lịch sự: Could you please + V + ...",
      },
    ],
  },
  {
    id: "bd-2",
    type: "builder",
    title: "Build the correct answer",
    focus: ["as soon as"],
    questions: [
      {
        id: "q1",
        question: "Say you will reply immediately after reading the email.",
        options: ["I", "will", "reply", "as", "soon", "as", "read", "it", "never"],
        correctIndices: [0, 1, 2, 3, 4, 5, 6, 7],
        explanation: "'as soon as' + mệnh đề thời gian ở hiện tại.",
      },
    ],
  },
];

const buildMockDaily = () => {
  const answered = [12, 20, 0, 15, 18, 10, 25, 0, 14, 22, 16, 9, 20, 18];
  const correct = [8, 15, 0, 11, 14, 7, 20, 0, 9, 17, 12, 6, 16, 13];
  return answered.map((a, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (answered.length - 1 - i));
    return { date: d.toISOString().slice(0, 10), answered: a, correct: correct[i] };
  });
};

const now = Date.now();
const DAY = 86400000;

export const MOCK_INITIAL_STATS: EnglishStats = {
  totalSessions: 21,
  totalAnswered: 199,
  totalCorrect: 148,
  streakDays: 6,
  masteredCount: 34,
  daily: buildMockDaily(),
  byType: {
    "multiple-choice": { answered: 40, correct: 34 },
    "matching-dropdown": { answered: 24, correct: 18 },
    "gap-fill-dropdown": { answered: 20, correct: 15 },
    "gap-fill-typing": { answered: 22, correct: 14 },
    "sentence-builder": { answered: 18, correct: 15 },
    "sentence-transformation": { answered: 16, correct: 9 },
    "error-correction": { answered: 19, correct: 12 },
    "writing-essay": { answered: 6, correct: 4 },
    flashcard: { answered: 24, correct: 19 },
    builder: { answered: 10, correct: 8 },
  },
  weak: [
    { text: "exhausted", kind: "word", misses: 4, lastMissedAt: now - 1 * DAY },
    { text: "benevolent", kind: "word", misses: 3, lastMissedAt: now - 2 * DAY },
    { text: "look forward to", kind: "phrase", misses: 3, lastMissedAt: now - 1 * DAY },
    { text: "in spite of", kind: "phrase", misses: 2, lastMissedAt: now - 3 * DAY },
    { text: "abundant", kind: "word", misses: 2, lastMissedAt: now - 4 * DAY },
    { text: "be used to", kind: "phrase", misses: 2, lastMissedAt: now - 5 * DAY },
    { text: "banquet", kind: "word", misses: 1, lastMissedAt: now - 6 * DAY },
    { text: "as soon as", kind: "phrase", misses: 1, lastMissedAt: now - 6 * DAY },
  ],
};