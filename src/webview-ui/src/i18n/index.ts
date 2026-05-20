import { en } from "./en";
import { vi } from "./vi";

export type LanguageCode = "en" | "vi";

export const dictionaries: Record<LanguageCode, typeof en> = {
  en,
  vi,
};

export type I18nKey =
  | "settings.title"
  | "settings.backendApiUrl"
  | "settings.backendApiUrlHelp"
  | "settings.language"
  | "settings.languageHelp"
  | "chat.connectionErrorPlaceholder";

export function t(lang: LanguageCode, key: I18nKey): string {
  const dict = dictionaries[lang] || dictionaries.en;
  const parts = key.split(".");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let node: any = dict;
  for (const p of parts) node = node?.[p];
  return typeof node === "string" ? node : key;
}
