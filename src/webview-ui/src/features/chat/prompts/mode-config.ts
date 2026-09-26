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

/**
 * Hard cap on total LINE COUNT across all files targeted by a single
 * read_file batch (turn). This replaces an earlier per-mode "estimated
 * token budget" design: a model cannot reliably estimate tokens, but it CAN
 * sum a concrete line-count number that list_files/find_files/grep already
 * report per file. Deliberately a single flat constant, not a per-mode
 * value — unlike write behavior, "how many lines is safe to read at once"
 * does not vary with how cautious/fast the mode is, so every mode shares
 * this one number. Consumed by:
 *   - constraints.ts     → READ-LINE-BUDGET
 *   - system-context.ts  → the READ-LINE-BUDGET summary line
 *   - tools-reference.ts → File Size Metadata note
 */
export const MAX_READ_LINES_PER_TURN = 1500;

export interface ModeBehaviorConfig {
  askConfirmation: "minimal" | "moderate" | "extensive" | "almost-never";
  commentStyle: "minimal" | "standard" | "comprehensive" | "standard";
  testBehavior: "none" | "propose-existing" | "write-new" | "propose-existing";
  explanationLevel: "one-line" | "brief" | "detailed" | "brief";
  readBeforeEdit: boolean;
  /**
   * WRITE-ONLY cap. Governs how many write_to_file / replace_in_file /
   * delete_file calls may run in a single turn without asking the user.
   * Consumed directly by:
   *   - constraints.ts     → WRITE-BATCH-LIMIT
   *   - system-context.ts  → MAX-WRITE-FILES-PER-REQUEST
   * so the two rules can never quote different numbers for the same mode.
   *
   * This field USED TO also gate read_file batches (old TOOL-BATCH-LIMIT /
   * MAX-FILES-PER-REQUEST applied the same fixed file-count to reads and
   * writes). That coupling has been removed: reading is no longer capped by
   * file COUNT, nor by an estimated token budget — see MAX_READ_LINES_PER_TURN
   * above, a flat, exactly-countable line-count cap driven by the line-count
   * metadata list_files, find_files, and grep now return per file.
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
