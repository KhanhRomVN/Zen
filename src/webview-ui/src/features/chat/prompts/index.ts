import { buildIdentityPrompt } from "./identity";
import { WORKFLOW } from "./workflow";
import { TOOLS_REFERENCE } from "./tools-reference";
import { buildSystemContext } from "./system-context";
import type { SystemInfo } from "./system-context";
import { EXAMPLES } from "./examples";
import { CONSTRAINTS } from "./constraints";
import { TOOL_VALIDATION } from "./tool-validation";

export { buildIdentityPrompt } from "./identity";
export { WORKFLOW } from "./workflow";
export { TOOLS_REFERENCE } from "./tools-reference";
export { buildSystemContext } from "./system-context";
export type { SystemInfo } from "./system-context";
export { EXAMPLES } from "./examples";
export { CONSTRAINTS } from "./constraints";
export { TOOL_VALIDATION } from "./tool-validation";

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
