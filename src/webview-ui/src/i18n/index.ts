import { en, I18nDict } from "./en";
import { vi } from "./vi";

export type LanguageCode = "en" | "vi";

export const dictionaries: Record<LanguageCode, I18nDict> = { en, vi };

// Dot-notation paths for I18nDict
type DotPaths<T, Prefix extends string = ""> = {
  [K in keyof T]: T[K] extends string
    ? `${Prefix}${K & string}`
    : DotPaths<T[K], `${Prefix}${K & string}.`>;
}[keyof T];

export type I18nKey = DotPaths<I18nDict>;

export function t(lang: LanguageCode, key: I18nKey): string {
  const dict: any = dictionaries[lang] ?? dictionaries.en;
  const parts = key.split(".");
  let node: any = dict;
  for (const p of parts) node = node?.[p];
  return typeof node === "string" ? node : key;
}
