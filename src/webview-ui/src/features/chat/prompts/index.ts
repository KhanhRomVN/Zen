import { buildIdentityPrompt } from "./identity";
import { WORKFLOW } from "./workflow";
import { TOOLS_REFERENCE } from "./tools-reference";
import { buildSystemContext } from "./system-context";
import type { SystemInfo } from "./system-context";
import { EXAMPLES } from "./examples";
import { CONSTRAINTS } from "./constraints";
import { buildAccessModePrompt } from "./access-mode";
import { TOOL_VALIDATION } from "./tool-validation";

export { buildIdentityPrompt } from "./identity";
export { WORKFLOW } from "./workflow";
export { TOOLS_REFERENCE } from "./tools-reference";
export { buildSystemContext } from "./system-context";
export type { SystemInfo } from "./system-context";
export { EXAMPLES } from "./examples";
export { CONSTRAINTS } from "./constraints";
export { buildAccessModePrompt } from "./access-mode";
export {
  CHECKPOINT_REMINDER,
  CHECKPOINT_INTERVAL,
  buildPermissionModeTag,
  XML_TOOL_SYNTAX_REMINDER,
} from "./reminder";
export { TOOL_VALIDATION } from "./tool-validation";

interface PromptConfig {
  language: string;
  systemInfo: SystemInfo;
  permissionMode?: string;
}

export const combinePrompts = (config: PromptConfig): string => {
  const { language, systemInfo, permissionMode } = config;

  const sections = [
    buildIdentityPrompt(language), // 1. Who I am + top-level rules
    WORKFLOW, // 2. How I work
    CONSTRAINTS, // 3. Critical constraints
    TOOL_VALIDATION, // 4. Tool validation & error prevention
    TOOLS_REFERENCE, // 5. What tools exist + tag usage
    buildSystemContext(systemInfo), // 6. Environment context
    ...(permissionMode ? [buildAccessModePrompt(permissionMode)] : []), // 7. Active permission mode
    EXAMPLES, // 8. Reference patterns
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
