export interface ProviderStyle {
  name: string;
  bg: string;
  border: string;
  fg: string;
}

const PROVIDER_STYLES: Record<string, ProviderStyle> = {
  deepseek: {
    name: "DeepSeek",
    bg: "#3b82f615",
    border: "#3b82f630",
    fg: "#3b82f6",
  },
  chatgpt: {
    name: "ChatGPT",
    bg: "#10b98115",
    border: "#10b98130",
    fg: "#10b981",
  },
  gemini: {
    name: "Gemini",
    bg: "#a855f715",
    border: "#a855f730",
    fg: "#a855f7",
  },
  grok: {
    name: "Grok",
    bg: "#ef444415",
    border: "#ef444430",
    fg: "#ef4444",
  },
  claude: {
    name: "Claude",
    bg: "#f59e0b15",
    border: "#f59e0b30",
    fg: "#f59e0b",
  },
};

const DEFAULT_STYLE: ProviderStyle = {
  name: "AI",
  bg: "#6b728015",
  border: "#6b728030",
  fg: "#6b7280",
};

export function getProviderStyle(provider?: string): ProviderStyle {
  if (!provider) return DEFAULT_STYLE;
  const normalized = provider.toLowerCase();

  // Basic matching logic
  if (normalized.includes("claude") || normalized.includes("anthropic"))
    return PROVIDER_STYLES.claude;
  if (normalized.includes("gemini") || normalized.includes("google"))
    return PROVIDER_STYLES.gemini;
  if (normalized.includes("openai") || normalized.includes("gpt"))
    return PROVIDER_STYLES.chatgpt;
  if (normalized.includes("deepseek")) return PROVIDER_STYLES.deepseek;
  if (normalized.includes("grok") || normalized.includes("xai"))
    return PROVIDER_STYLES.grok;

  return PROVIDER_STYLES[normalized] || DEFAULT_STYLE;
}
