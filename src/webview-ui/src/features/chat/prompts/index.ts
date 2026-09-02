import { buildPromptForMode } from "./prompt-modes";
import type { SystemPromptMode, PromptModeConfig } from "./prompt-modes";

export { buildIdentityPrompt } from "./identity";
export { buildWorkflow } from "./workflow";
export { TOOLS_REFERENCE } from "./tools-reference";
export { buildSystemContext } from "./system-context";
export type { SystemInfo } from "./system-context";
export { EXAMPLES } from "./examples";
export { buildConstraints } from "./constraints";
export { TOOL_VALIDATION } from "./tool-validation";
export { buildPromptForMode } from "./prompt-modes";
export type { SystemPromptMode, PromptModeConfig } from "./prompt-modes";
export { MODE_BEHAVIORS } from "./mode-config";
export type { ModeBehaviorConfig } from "./mode-config";

interface PromptConfig {
  language: string;
  systemInfo: import("./system-context").SystemInfo;
}

/**
 * Build system prompt cho mode balanced (mặc định).
 * Không đưa tên mode vào prompt.
 */
export const combinePrompts = (config: PromptConfig): string => {
  return buildPromptForMode(config, "balanced");
};

/**
 * Build system prompt theo mode.
 * Không đưa tên mode vào prompt — AI chỉ thấy các quy tắc hành vi.
 */
export const combinePromptsForMode = (
  config: PromptModeConfig,
  mode: SystemPromptMode,
): string => {
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
