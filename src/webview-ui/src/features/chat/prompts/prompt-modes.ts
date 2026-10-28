// src/webview-ui/src/features/chat/prompts/prompt-modes.ts
import { buildIdentityPrompt } from "./identity";
import { buildSystemContext, type SystemInfo } from "./system-context";
import { buildWorkflow } from "./workflow";
import { buildConstraints } from "./constraints";
import { TOOL_VALIDATION, TOOL_VALIDATION_JSON } from "./tool-validation";
import { TOOLS_REFERENCE, TOOLS_REFERENCE_JSON } from "./tools-reference";
import { buildExample } from "./example";
import type { SystemPromptMode, PromptLengthMode } from "./mode-config";

export type { SystemPromptMode, PromptLengthMode } from "./mode-config";

export interface PromptModeConfig {
  language: string;
  systemInfo: SystemInfo;
  promptLengthMode?: PromptLengthMode;
  diagnosticEnabled?: boolean;
  toolFormat?: "xml" | "json";
}

export function buildPromptForMode(
  config: PromptModeConfig,
  mode: SystemPromptMode,
): string {
  const {
    language,
    systemInfo,
    promptLengthMode = "long",
    diagnosticEnabled = true,
    toolFormat = "xml",
  } = config;

  const toolsRef =
    toolFormat === "json" ? TOOLS_REFERENCE_JSON : TOOLS_REFERENCE;
  const toolValidation =
    toolFormat === "json" ? TOOL_VALIDATION_JSON : TOOL_VALIDATION;

  // None — không gửi system prompt nào cả
  if (promptLengthMode === "none") {
    return "";
  }

  if (promptLengthMode === "short") {
    // Short — Ultra compact: static tool reference + minimal identity/workflow + system context.
    const sections = [
      toolsRef,
      buildIdentityPrompt(language, mode, toolFormat),
      buildWorkflow(mode, toolFormat),
      buildSystemContext(systemInfo, mode),
    ];
    return sections.join("\n\n---\n\n");
  }

  if (promptLengthMode === "medium") {
    const sections = [
      toolValidation,
      toolsRef,
      buildIdentityPrompt(language, mode, toolFormat),
      buildWorkflow(mode, toolFormat),
      buildConstraints(mode, language, diagnosticEnabled, toolFormat),
      buildSystemContext(systemInfo, mode),
    ];
    return sections.join("\n\n---\n\n");
  }

  // Long — full prompt, including EXAMPLES (itself now trimmed per-mode,
  // see buildExample in example.ts).
  const sections = [
    toolValidation,
    toolsRef,
    buildExample(mode, toolFormat),
    buildIdentityPrompt(language, mode, toolFormat),
    buildWorkflow(mode, toolFormat),
    buildConstraints(mode, language, diagnosticEnabled, toolFormat),
    buildSystemContext(systemInfo, mode),
  ];
  return sections.join("\n\n---\n\n");
}
