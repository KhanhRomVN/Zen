import { buildIdentityPrompt } from "./identity";
import { buildSystemContext, type SystemInfo } from "./system-context";
import { buildWorkflow } from "./workflow";
import { buildConstraints } from "./constraints";
import { TOOL_VALIDATION } from "./tool-validation";
import { TOOLS_REFERENCE } from "./tools-reference";
import { buildExample } from "./example";
import type { SystemPromptMode, PromptLengthMode } from "./mode-config";

export type { SystemPromptMode, PromptLengthMode } from "./mode-config";

export interface PromptModeConfig {
  language: string;
  systemInfo: SystemInfo;
  promptLengthMode?: PromptLengthMode;
}

/**
 * Section ordering rule (see note below on caching): content that is
 * 100% identical across every request — TOOL_VALIDATION, TOOLS_REFERENCE,
 * and the EXAMPLE block — none of these read `mode`, `language`, or
 * `systemInfo` beyond the small, enumerable mode switch in buildExample —
 * comes FIRST, forming a stable prefix that provider-side prompt caching
 * can reuse turn after turn and across users/modes. Content that varies by
 * mode/language (identity, workflow, constraints) comes next, and the most
 * volatile block — system info, which can change mid-session (cwd, shell) —
 * goes LAST, so its churn never invalidates the cache of everything before
 * it.
 */
export function buildPromptForMode(
  config: PromptModeConfig,
  mode: SystemPromptMode,
): string {
  const { language, systemInfo, promptLengthMode = "long" } = config;

  // None — không gửi system prompt nào cả
  if (promptLengthMode === "none") {
    return "";
  }

  if (promptLengthMode === "short") {
    // Short — Ultra compact: static tool reference + minimal identity/workflow + system context.
    const sections = [
      TOOLS_REFERENCE,
      buildIdentityPrompt(language, mode),
      buildWorkflow(mode),
      buildSystemContext(systemInfo, mode),
    ];
    return sections.join("\n\n---\n\n");
  }

  if (promptLengthMode === "medium") {
    // Medium — full behavior rules and tool docs, but WITHOUT the large
    // worked-EXAMPLES block. This used to be byte-for-byte identical to
    // "long" (dead branching); it is now genuinely lighter, which is the
    // whole point of having a separate "medium" level.
    const sections = [
      TOOL_VALIDATION,
      TOOLS_REFERENCE,
      buildIdentityPrompt(language, mode),
      buildWorkflow(mode),
      buildConstraints(mode, language),
      buildSystemContext(systemInfo, mode),
    ];
    return sections.join("\n\n---\n\n");
  }

  // Long — full prompt, including EXAMPLES (itself now trimmed per-mode,
  // see buildExample in example.ts).
  const sections = [
    TOOL_VALIDATION,
    TOOLS_REFERENCE,
    buildExample(mode),
    buildIdentityPrompt(language, mode),
    buildWorkflow(mode),
    buildConstraints(mode, language),
    buildSystemContext(systemInfo, mode),
  ];
  return sections.join("\n\n---\n\n");
}
