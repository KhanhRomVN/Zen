/**
 * Appended to the first user message sent after a generation was paused/stopped.
 * Instructs the AI to review relevant files before resuming.
 */
export const AFTER_PAUSE_REMINDER = `

---
**Note:** The previous generation was interrupted. Before continuing, review the current content of any files relevant to the ongoing task to ensure your understanding reflects the actual current state.`;
