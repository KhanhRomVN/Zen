export type SystemPromptMode =
  | "fast"
  | "balanced"
  | "thorough"
  | "autopilot"
  | "short"
  | "none";

// NOTE: PromptLengthMode controls how much of the system prompt is SENT
// (short/medium/long/none = which sections are included).
// SystemPromptMode controls how the AI BEHAVES (ask-confirmation style,
// comment style, test behavior, batch caps).
// They happen to share the names "short" and "none", but they are unrelated
// axes — a UI selector combines a SystemPromptMode with a PromptLengthMode
// independently. Do not assume PromptLengthMode="short" implies
// SystemPromptMode="short", or vice versa.
export type PromptLengthMode = "short" | "medium" | "long" | "none";

export interface ModeBehaviorConfig {
  askConfirmation: "minimal" | "moderate" | "extensive" | "almost-never";
  commentStyle: "minimal" | "standard" | "comprehensive" | "standard";
  testBehavior: "none" | "propose-existing" | "write-new" | "propose-existing";
  explanationLevel: "one-line" | "brief" | "detailed" | "brief";
  readBeforeEdit: boolean;
  /**
   * Single source of truth for "how many tool calls of the same type / files
   * may be read-written-replaced per turn without asking the user".
   * Consumed directly by:
   *   - constraints.ts     → TOOL-BATCH-LIMIT
   *   - system-context.ts  → MAX-FILES-PER-REQUEST
   * so the two rules can never quote different numbers for the same mode.
   *
   * There used to be a second, separate `maxFilesPerTurn` field here that was
   * never read anywhere in the prompt builders and had already drifted out
   * of sync with this one (both were maintained by hand in parallel) — it
   * has been removed rather than wired in, since a single field covers both
   * use sites.
   */
  maxBatchSize: number;
  runVerifyAfterChange: boolean;
}

const FAST_BEHAVIOR: ModeBehaviorConfig = {
  askConfirmation: "minimal",
  commentStyle: "minimal",
  testBehavior: "none",
  explanationLevel: "one-line",
  readBeforeEdit: true,
  maxBatchSize: 5,
  runVerifyAfterChange: false,
};

export const MODE_BEHAVIORS: Record<SystemPromptMode, ModeBehaviorConfig> = {
  fast: FAST_BEHAVIOR,
  balanced: {
    askConfirmation: "moderate",
    commentStyle: "standard",
    testBehavior: "propose-existing",
    explanationLevel: "brief",
    readBeforeEdit: true,
    maxBatchSize: 3,
    runVerifyAfterChange: false,
  },
  thorough: {
    askConfirmation: "extensive",
    commentStyle: "comprehensive",
    testBehavior: "write-new",
    explanationLevel: "detailed",
    readBeforeEdit: true,
    maxBatchSize: 2,
    runVerifyAfterChange: true,
  },
  autopilot: {
    askConfirmation: "almost-never",
    commentStyle: "standard",
    testBehavior: "propose-existing",
    explanationLevel: "brief",
    readBeforeEdit: true,
    maxBatchSize: 4,
    runVerifyAfterChange: false,
  },
  // "short" and "none" (SystemPromptMode) intentionally mirror "fast" behavior.
  // They exist so a caller can pick a SystemPromptMode even when only
  // PromptLengthMode is meaningfully set to "short"/"none" for that request.
  short: FAST_BEHAVIOR,
  none: FAST_BEHAVIOR,
};
