import { buildIdentityPrompt } from "./identity";
import { CONSTRAINTS } from "./constraints";
import { WORKFLOW } from "./workflow";
import { TOOLS_REFERENCE } from "./tools-reference";
import { buildSystemContext } from "./system-context";
import type { SystemInfo } from "./system-context";
import { EXAMPLES } from "./examples";

// Export individual modules for flexibility
export { buildIdentityPrompt } from "./identity";
export { CONSTRAINTS } from "./constraints";
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

  const identity = buildIdentityPrompt(language);
  const system = buildSystemContext(systemInfo);

  return [
    identity,
    CONSTRAINTS,
    WORKFLOW,
    TOOLS_REFERENCE,
    system,
    EXAMPLES,
  ].join("\n\n---\n\n");
};

/**
 * This is primarily for fallback.
 * Real values should be passed from usePlaygroundLogic using window.api.app.getSystemInfo()
 */
export const getDefaultPrompt = (language: string = "English"): string => {
  return combinePrompts({
    language,
    systemInfo: {
      os: "Unknown OS",
      ide: "Elara IDE",
      shell: "unknown",
      homeDir: "~",
      cwd: ".",
      language,
    },
  });
};
