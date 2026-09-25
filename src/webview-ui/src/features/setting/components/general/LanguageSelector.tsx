/**
 * ------------------------------------------------------------------
 * LanguageSelector
 * ------------------------------------------------------------------
 * Dropdown chọn ngôn ngữ kèm emoji flag.
 * Hỗ trợ đóng khi click ra ngoài.

 * Main features:
 * - Chọn ngôn ngữ từ danh sách LANGUAGES
 * - Hiển thị flag + tên ngôn ngữ
 * - Tự đóng dropdown khi click ra ngoài
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── React ──
import React, { useState, useEffect, useRef } from "react";
import { getCountryFlagEmoji } from "../../../../utils/countryFlags";

// ─── Interfaces ─────────────────────────────────────────────────────────
interface LanguageSelectorProps {
  value: string | null;
  onChange: (value: string) => void;
  className?: string;
}

// ─── Constants ──────────────────────────────────────────────────────────
// Popular languages with emoji flags
const POPULAR_LANGUAGES = [
  { code: "en", name: "English", countryCode: "US" },
  { code: "vi", name: "Vietnamese", countryCode: "VN" },
  { code: "zh", name: "Chinese", countryCode: "CN" },
  { code: "ja", name: "Japanese", countryCode: "JP" },
  { code: "ko", name: "Korean", countryCode: "KR" },
  { code: "fr", name: "French", countryCode: "FR" },
  { code: "de", name: "German", countryCode: "DE" },
  { code: "es", name: "Spanish", countryCode: "ES" },
  { code: "pt", name: "Portuguese", countryCode: "PT" },
  { code: "it", name: "Italian", countryCode: "IT" },
  { code: "ru", name: "Russian", countryCode: "RU" },
  { code: "ar", name: "Arabic", countryCode: "SA" },
  { code: "hi", name: "Hindi", countryCode: "IN" },
  { code: "bn", name: "Bengali", countryCode: "BD" },
  { code: "id", name: "Indonesian", countryCode: "ID" },
  { code: "th", name: "Thai", countryCode: "TH" },
  { code: "nl", name: "Dutch", countryCode: "NL" },
  { code: "pl", name: "Polish", countryCode: "PL" },
  { code: "tr", name: "Turkish", countryCode: "TR" },
  { code: "sv", name: "Swedish", countryCode: "SE" },
  { code: "no", name: "Norwegian", countryCode: "NO" },
  { code: "da", name: "Danish", countryCode: "DK" },
  { code: "fi", name: "Finnish", countryCode: "FI" },
  { code: "el", name: "Greek", countryCode: "GR" },
  { code: "he", name: "Hebrew", countryCode: "IL" },
  { code: "uk", name: "Ukrainian", countryCode: "UA" },
  { code: "cs", name: "Czech", countryCode: "CZ" },
  { code: "ro", name: "Romanian", countryCode: "RO" },
];

export const LANGUAGES = POPULAR_LANGUAGES.map((lang) => ({
  code: lang.code,
  name: lang.name,
  flag: getCountryFlagEmoji(lang.countryCode),
}));

// Custom Chevron Icons
const ChevronDownIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m6 9 6 6 6-6" />
  </svg>
);

const ChevronUpIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="m18 15-6-6-6 6" />
  </svg>
);
