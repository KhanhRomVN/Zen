export type SystemPromptMode = "fast" | "balanced" | "thorough" | "autopilot";

export interface ModeBehaviorConfig {
  askConfirmation: "minimal" | "moderate" | "extensive" | "almost-never";
  commentStyle: "minimal" | "standard" | "comprehensive";
  testBehavior: "none" | "propose-existing" | "write-new";
  explanationLevel: "one-line" | "brief" | "detailed";
  readBeforeEdit: boolean;
  maxBatchSize: number;
  maxFilesPerTurn: number;
  runVerifyAfterChange: boolean;
}

export const MODE_BEHAVIORS: Record<SystemPromptMode, ModeBehaviorConfig> = {
  fast: {
    askConfirmation: "minimal",
    commentStyle: "minimal",
    testBehavior: "none",
    explanationLevel: "one-line",
    readBeforeEdit: true,
    maxBatchSize: 5,
    maxFilesPerTurn: 5,
    runVerifyAfterChange: false,
  },
  balanced: {
    askConfirmation: "moderate",
    commentStyle: "standard",
    testBehavior: "propose-existing",
    explanationLevel: "brief",
    readBeforeEdit: true,
    maxBatchSize: 3,
    maxFilesPerTurn: 3,
    runVerifyAfterChange: false,
  },
  thorough: {
    askConfirmation: "extensive",
    commentStyle: "comprehensive",
    testBehavior: "write-new",
    explanationLevel: "detailed",
    readBeforeEdit: true,
    maxBatchSize: 2,
    maxFilesPerTurn: 2,
    runVerifyAfterChange: true,
  },
  autopilot: {
    askConfirmation: "almost-never",
    commentStyle: "standard",
    testBehavior: "propose-existing",
    explanationLevel: "brief",
    readBeforeEdit: true,
    maxBatchSize: 4,
    maxFilesPerTurn: 4,
    runVerifyAfterChange: false,
  },
};
