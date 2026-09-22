import { buildIdentityPrompt } from "./identity";
import { buildSystemContext, type SystemInfo } from "./system-context";
import { buildWorkflow } from "./workflow";
import { buildConstraints } from "./constraints";
import { TOOL_VALIDATION } from "./tool-validation";
import { TOOLS_REFERENCE } from "./tools-reference";
import type { SystemPromptMode, PromptLengthMode } from "./mode-config";

export type { SystemPromptMode, PromptLengthMode } from "./mode-config";

export interface PromptModeConfig {
  language: string;
  systemInfo: SystemInfo;
  promptLengthMode?: PromptLengthMode;
}

export function buildPromptForMode(
  config: PromptModeConfig,
  mode: SystemPromptMode,
): string {
  const { language, systemInfo, promptLengthMode = "long" } = config;

  // None - Không gửi system prompt nào cả
  if (promptLengthMode === "none") {
    return "";
  }

  // Xử lý độ dài prompt
  if (promptLengthMode === "short") {
    // Short - Ultra compact: chỉ identity, workflow cơ bản, tools reference, system context
    const sections = [
      buildIdentityPrompt(language, mode),
      buildWorkflow(mode),
      TOOLS_REFERENCE,
      buildSystemContext(systemInfo),
    ];
    return sections.join("\n\n---\n\n");
  } else if (promptLengthMode === "medium") {
    // Medium - Loại bỏ EXAMPLES, giữ phần còn lại
    const sections = [
      buildIdentityPrompt(language, mode),
      buildWorkflow(mode),
      buildConstraints(mode),
      TOOL_VALIDATION,
      TOOLS_REFERENCE,
      buildSystemContext(systemInfo),
    ];
    return sections.join("\n\n---\n\n");
  } else {
    // Long - Full prompt với EXAMPLES
    const sections = [
      buildIdentityPrompt(language, mode),
      buildWorkflow(mode),
      buildConstraints(mode),
      TOOL_VALIDATION,
      TOOLS_REFERENCE,
      buildSystemContext(systemInfo),
    ];
    return sections.join("\n\n---\n\n");
  }
}
