export interface Provider {
  provider_id: string;
  provider_name: string;
  description?: string;
  website: string;
  website_url?: string;
  is_enabled?: boolean;
  auth_methods?: string[];
  connection_type?: string;
  auth_method?: string;
}

export interface ProfileEntry {
  folder: string;
  label?: string;
  avatar?: string;
}

export interface DeviceCodeInfo {
  user_code: string;
  verification_url: string;
  pollContext: string;
  poll_interval: number;
  provider: Provider;
  profileUserDataDir?: string;
  profileDirectory?: string;
  profileLabel?: string;
}

export const AUTH_LABELS: Record<string, string> = {
  google: "Google",
  github: "GitHub",
  microsoft: "Microsoft",
  apple: "Apple",
  x: "X / xAI",
  basic: "Basic",
};
export const ICON_METHODS = ["google", "github", "microsoft", "apple", "x"];

export const authIconFile = (method: string): string =>
  method === "apple" || method === "microsoft"
    ? `${method}.png`
    : `${method}.svg`;

export const splitAuthMethod = (method: string): string[] =>
  method.split("_").filter(Boolean);

export const isMergedAuth = (method: string): boolean =>
  splitAuthMethod(method).length > 1;

export const getProviderMethods = (p: any): string[] => {
  const raw = p?.auth_method ?? p?.auth_methods;
  if (!raw) return [];
  if (Array.isArray(raw))
    return raw.filter((m: any) => typeof m === "string" && m.length > 0);
  if (typeof raw === "string" && raw.trim()) {
    try {
      const parsed = JSON.parse(raw.trim());
      return Array.isArray(parsed) ? parsed.filter((m: any) => m) : [];
    } catch {
      return raw
        .trim()
        .split(/[,;|\s]+/)
        .filter((m: string) => m.length > 0);
    }
  }
  return [];
};

/** Email chứa ký tự "*" (email bị che) → không hợp lệ để tạo account. */
export const hasInvalidEmailChar = (value: string): boolean =>
  value.includes("*");

export const resolveAccountEmail = (
  email: string | undefined,
  profileLabel?: string,
): string => {
  const current = (email || "").trim();
  if (current && !hasInvalidEmailChar(current)) return current;
  const fromProfile = profileLabel?.match(/[^\s<>()]+@[^\s<>()]+\.[^\s<>()]+/)?.[0];
  return fromProfile && !hasInvalidEmailChar(fromProfile)
    ? fromProfile
    : current;
};
