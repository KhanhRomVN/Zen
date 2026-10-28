const DEEPSEEK_NOTES = `# PROVIDER NOTES
- Do NOT use DSML (DeepSeek Markup Language, i.e. tags like <｜DSML｜calls>, <｜DSML｜invoke>, <｜DSML｜parameter>) for tool calls. Emit tool calls ONLY in the exact format defined in this system prompt.`;

export const buildProviderNotes = (providerId?: string): string =>
  (providerId ?? "").toLowerCase() === "deepseek" ? DEEPSEEK_NOTES : "";