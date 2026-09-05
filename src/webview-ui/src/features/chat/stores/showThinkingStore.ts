import { create } from 'zustand';

/**
 * Store to control whether AI thinking blocks are visible in the chat.
 * Persists preference to localStorage (survives VS Code reloads).
 * Default: visible (true).
 *
 * Using Zustand selector-based subscription to avoid prop drilling.
 * See react-prop-drilling-render-cascade.md.
 */

const STORAGE_KEY = 'zen-show-thinking';

interface ShowThinkingStore {
  /** Whether thinking blocks should be rendered */
  isVisible: boolean;
  /** Toggle visibility */
  toggle: () => void;
  /** Explicit set */
  setVisible: (v: boolean) => void;
}

export const useShowThinkingStore = create<ShowThinkingStore>((set) => ({
  isVisible: (() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      // Default true when not set yet
      return stored === null ? true : stored === 'true';
    } catch {
      return true;
    }
  })(),

  toggle: () =>
    set((s) => {
      const next = !s.isVisible;
      try {
        localStorage.setItem(STORAGE_KEY, String(next));
      } catch {}
      return { isVisible: next };
    }),

  setVisible: (v) => {
    try {
      localStorage.setItem(STORAGE_KEY, String(v));
    } catch {}
    set({ isVisible: v });
  },
}));
