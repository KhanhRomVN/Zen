import { buildIdentityPrompt } from "./identity";
import { WORKFLOW } from "./workflow";
import { TOOLS_REFERENCE } from "./tools-reference";
import { buildSystemContext } from "./system-context";
import type { SystemInfo } from "./system-context";
import { EXAMPLES } from "./examples";
import { CONSTRAINTS } from "./constraints";
import { TOOL_VALIDATION } from "./tool-validation";
import { buildPromptForMode } from "./prompt-modes";
import type { SystemPromptMode, PromptModeConfig } from "./prompt-modes";

export { buildIdentityPrompt } from "./identity";
export { WORKFLOW } from "./workflow";
export { TOOLS_REFERENCE } from "./tools-reference";
export { buildSystemContext } from "./system-context";
export type { SystemInfo } from "./system-context";
export { EXAMPLES } from "./examples";
export { CONSTRAINTS } from "./constraints";
export { TOOL_VALIDATION } from "./tool-validation";
export { buildPromptForMode } from "./prompt-modes";
export type { SystemPromptMode, PromptModeConfig } from "./prompt-modes";

interface PromptConfig {
  language: string;
  systemInfo: SystemInfo;
}

export const combinePrompts = (config: PromptConfig): string => {
  const { language, systemInfo } = config;

  const sections = [
    buildIdentityPrompt(language), // 1. Who I am + top-level rules
    WORKFLOW, // 2. How I work
    CONSTRAINTS, // 3. Critical constraints
    TOOL_VALIDATION, // 4. Tool validation & error prevention
    TOOLS_REFERENCE, // 5. What tools exist + tag usage
    buildSystemContext(systemInfo), // 6. Environment context
    EXAMPLES, // 7. Reference patterns
  ];

  return sections.join("\n\n---\n\n");
};

/**
 * Build system prompt theo mode (simple/promax).
 * simple -> combinePrompts goc; promax -> buildPromptForMode.
 */
export const combinePromptsForMode = (
  config: PromptModeConfig,
  mode: SystemPromptMode,
): string => {
  if (mode === "simple") {
    return combinePrompts(config);
  }
  return buildPromptForMode(config, mode);
};

export const getDefaultPrompt = (language: string = "English"): string => {
  return combinePrompts({
    language,
    systemInfo: {
      os: "Unknown OS",
      ide: "Zen IDE",
      shell: "unknown",
      homeDir: "~",
      cwd: ".",
      language,
    },
  });
};
