import { MOCK_INITIAL_STATS } from "./mockData";
import { EnglishPersist, GameConfig, GameId, QUIZ_TYPE_META } from "./types";

const ENGLISH_KEY = "zen_game_english_state";
const LAST_GAME_KEY = "zen_game_last";

const scopedKey = (base: string): string => {
  try {
    const wp = (window as any).__zenWorkspaceFolderPath as string | null;
    return wp ? `${base}__${wp}` : `${base}__global`;
  } catch {
    return `${base}__global`;
  }
};

export const DEFAULT_CONFIG: GameConfig = {
  selectedTypes: QUIZ_TYPE_META.map((m) => m.type),
  randomTypes: true,
  count: 10,
  focusWeakOnly: false,
  shuffleOptions: true,
  showExplanation: true,
  instantFeedback: true,
  timeLimitEnabled: false,
  timeLimitMinutes: 10,
};

export const createDefaultState = (): EnglishPersist => ({
  screen: "home",
  config: DEFAULT_CONFIG,
  session: null,
  summary: null,
  stats: MOCK_INITIAL_STATS,
});

export const loadEnglishState = (): EnglishPersist => {
  try {
    const raw = localStorage.getItem(scopedKey(ENGLISH_KEY));
    if (!raw) return createDefaultState();
    const parsed = JSON.parse(raw) as Partial<EnglishPersist>;
    const base = createDefaultState();
    return {
      ...base,
      ...parsed,
      config: { ...DEFAULT_CONFIG, ...(parsed.config || {}) },
    };
  } catch {
    return createDefaultState();
  }
};

export const saveEnglishState = (state: EnglishPersist): void => {
  try {
    localStorage.setItem(scopedKey(ENGLISH_KEY), JSON.stringify(state));
  } catch {}
};

export const loadLastGame = (): GameId => {
  try {
    const saved = localStorage.getItem(scopedKey(LAST_GAME_KEY));
    return saved === "english" ? "english" : "menu";
  } catch {
    return "menu";
  }
};

export const saveLastGame = (game: GameId): void => {
  try {
    localStorage.setItem(scopedKey(LAST_GAME_KEY), game);
  } catch {}
};

const DRAFT_KEY = "zen_game_english_draft";

export interface DraftStore {
  get: (key: string) => unknown;
  set: (key: string, value: unknown) => void;
}

export const createDraftStore = (id: string): DraftStore => {
  let data: Record<string, unknown> = {};
  try {
    const raw = localStorage.getItem(scopedKey(DRAFT_KEY));
    if (raw) {
      const parsed = JSON.parse(raw) as {
        id: string;
        data: Record<string, unknown>;
      };
      if (parsed.id === id) data = parsed.data || {};
    }
  } catch {}
  return {
    get: (key) => data[key],
    set: (key, value) => {
      data[key] = value;
      try {
        localStorage.setItem(scopedKey(DRAFT_KEY), JSON.stringify({ id, data }));
      } catch {}
    },
  };
};

export const clearDraft = (): void => {
  try {
    localStorage.removeItem(scopedKey(DRAFT_KEY));
  } catch {}
};