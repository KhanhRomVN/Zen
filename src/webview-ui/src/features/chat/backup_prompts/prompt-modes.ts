import { buildIdentityPrompt } from "./identity";
import { buildSystemContext, type SystemInfo } from "./system-context";
import { buildWorkflow } from "./workflow";
import { buildConstraints } from "./constraints";
import { TOOL_VALIDATION } from "./tool-validation";
import { TOOLS_REFERENCE } from "./tools-reference";
import { EXAMPLES } from "./examples";
import type { SystemPromptMode } from "./mode-config";

export type { SystemPromptMode } from "./mode-config";

export interface PromptModeConfig {
  language: string;
  systemInfo: SystemInfo;
}

/**
 * Build system prompt cho từng mode.
 * Không đưa tên mode vào prompt — AI không cần biết mode đang dùng.
 */
export function buildPromptForMode(
  config: PromptModeConfig,
  mode: SystemPromptMode,
): string {
  const { language, systemInfo } = config;

  const sections = [
    buildIdentityPrompt(language, mode),
    buildWorkflow(mode),
    buildConstraints(mode),
    TOOL_VALIDATION,
    TOOLS_REFERENCE,
    buildSystemContext(systemInfo),
    EXAMPLES,
  ];

  return sections.join("\n\n---\n\n");
}
