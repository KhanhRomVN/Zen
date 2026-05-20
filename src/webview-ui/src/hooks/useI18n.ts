import { useCallback } from "react";
import { useSettings } from "../context/SettingsContext";
import type { I18nKey, LanguageCode } from "../i18n";
import { t as translate } from "../i18n";

export function useI18n() {
  const { language } = useSettings();
  const lang = (language === "vi" ? "vi" : "en") as LanguageCode;

  const t = useCallback((key: I18nKey) => translate(lang, key), [lang]);
  return { t, lang };
}

