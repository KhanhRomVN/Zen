import { buildIdentityPrompt } from "./identity";
import { WORKFLOW } from "./workflow";
import { TOOLS_REFERENCE } from "./tools-reference";
import { buildSystemContext } from "./system-context";
import type { SystemInfo } from "./system-context";
import { EXAMPLES } from "./examples";

export { buildIdentityPrompt } from "./identity";
export { WORKFLOW } from "./workflow";
export { TOOLS_REFERENCE } from "./tools-reference";
export { buildSystemContext } from "./system-context";
export type { SystemInfo } from "./system-context";
export { EXAMPLES } from "./examples";

interface PromptConfig {
  language: string;
  systemInfo: SystemInfo;
}

export const combinePrompts = (config: PromptConfig): string => {
  const { language, systemInfo } = config;

  const sections = [
    buildIdentityPrompt(language), // 1. Who I am + top-level rules
    WORKFLOW, // 2. How I work + all critical constraints
    TOOLS_REFERENCE, // 3. What tools exist + tag usage
    buildSystemContext(systemInfo), // 4. Environment context
    EXAMPLES, // 5. Reference patterns
  ];

  return sections.join("\n\n---\n\n");
};

/**
 * Fallback prompt — real values should come from window.api.app.getSystemInfo()
 */
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
