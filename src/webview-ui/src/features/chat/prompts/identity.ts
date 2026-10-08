// src/webview-ui/src/features/chat/prompts/identity.ts
import type { SystemPromptMode } from "./mode-config";

/**
 * Mode-dependent behavior text (ask-confirmation style, comment style, test
 * behavior, explanation depth) used to be duplicated here AND in
 * constraints.ts, hand-written twice with different wording for the same
 * ModeBehaviorConfig switch. That duplication is exactly how the
 * RESPONSE-LANGUAGE hardcode bug happened (this file drifted to a hardcoded
 * "Vietnamese" while constraints.ts correctly used `${language}`). All of
 * that mode-behavior text now lives ONCE, in constraints.ts — this file only
 * carries identity-level rules that don't vary by mode, plus a pointer.
 *
 * toolFormat matters here for exactly one line: conversation_title. In XML
 * mode it is emitted as a <conversation_title>...</conversation_title> tag;
 * in JSON mode it is an ordinary JSON tool call
 * ({"tool":"conversation_title","params":{"title":"..."}}). Note the
 * contrast with <markdown>, which stays XML-shaped in BOTH modes because it
 * is a UI/render tag, not a tool.
 */
export const buildIdentityPrompt = (
  language: string,
  mode: SystemPromptMode = "balanced",
  toolFormat: "xml" | "json" = "xml",
) => {
  const titleInstruction =
    toolFormat === "json"
      ? `- Every first response in a conversation MUST include a conversation title tool call once, written in the user's language: \`{"tool":"conversation_title","params":{"title":"Short title"}}\`. Refresh it whenever the task changes.`
      : `- Every first response in a conversation MUST include a <conversation_title>Short title</conversation_title> tag once, written in the user's language. Refresh it whenever the task changes.`;

  return `You are an expert AI coding assistant. Language: ${language}.
${titleInstruction}
- No filler ("Sure!", "Certainly!", "Great question!") — respond directly.
- No play-by-play narration ("Now I will read...") — just act.
- Never say "I cannot run commands" — use run_command or offer it. Exception: in read-only permission mode, state plainly that run_command is blocked and offer to help switch permission modes.
- Read files before editing them. Never chain dependent tool calls or predict tool outputs in a single turn.
- Batch all independent operations in one message, respecting the per-type tool call caps.
- All <markdown> prose must be written in ${language}; code, identifiers, and error messages stay as-is. (<markdown> is a UI tag, not a tool call — it keeps this XML form in every tool format.)
- Assumption/confirmation behavior, comment style, test behavior, and explanation depth for the current "${mode}" mode are defined once, in the CONSTRAINTS section below — follow those; there is no separate restatement of them here.`;
};
