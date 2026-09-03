/**
 * ------------------------------------------------------------------
 * GeneralSettings
 * ------------------------------------------------------------------
 * Tab General trong Settings Panel
 * Bao gồm: Backend API URL, AI Language, Commit Message Language
 * ------------------------------------------------------------------
 */

import React from "react";
import { useSettings } from "../../../context/SettingsContext";
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
} from "../../../components/ui/Dropdown";
import { LANGUAGES } from "../components/LanguageSelector";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  fontSize: "13px",
  backgroundColor: "var(--input-bg)",
  border: "none",
  borderRadius: "8px",
  color: "var(--primary-text)",
  outline: "none",
  boxSizing: "border-box",
  height: "34px",
};

const GeneralSettings: React.FC = () => {
  const {
    apiUrl,
    setApiUrl,
    aiLanguage,
    setAiLanguage,
    commitMessageLanguage,
    setCommitMessageLanguage,
  } = useSettings();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "20px",
      }}
    >
      {/* Backend API URL */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <label
          style={{
            fontSize: "14px",
            fontWeight: 600,
            color: "var(--primary-text)",
          }}
        >
          Backend API URL
        </label>
        <input
          type="text"
          value={apiUrl}
          onChange={(e) => setApiUrl(e.target.value)}
          placeholder="http://localhost:8888"
          style={inputStyle}
        />
        <div
          style={{
            fontSize: "11px",
            color: "var(--secondary-text)",
            opacity: 0.7,
            marginTop: "2px",
          }}
        >
          The proxy server or mock server URL (e.g. http://localhost:8888)
        </div>
      </div>

      {/* AI Language Selection */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <label
          style={{
            fontSize: "14px",
            fontWeight: 600,
            color: "var(--primary-text)",
          }}
        >
          AI Language
        </label>
        <Dropdown align="start" side="bottom" sideOffset={4}>
          <DropdownTrigger asChild>
            <button
              type="button"
              style={{
                ...inputStyle,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span>{LANGUAGES.find((l) => l.name === aiLanguage)?.flag || "🌐"}</span>
                <span>{aiLanguage}</span>
              </span>
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
            </button>
          </DropdownTrigger>
          <DropdownContent className="language-dropdown-content">
            {LANGUAGES.map((lang) => (
              <DropdownItem
                key={lang.code}
                icon={<span>{lang.flag}</span>}
                onClick={() => setAiLanguage(lang.name)}
              >
                {lang.name}
              </DropdownItem>
            ))}
          </DropdownContent>
        </Dropdown>
        <div
          style={{
            fontSize: "11px",
            color: "var(--secondary-text)",
            opacity: 0.7,
            marginTop: "2px",
          }}
        >
          Language used for AI reasoning (&lt;thinking&gt;) and explanations
          (&lt;markdown&gt;)
        </div>
      </div>

      {/* Commit Message Language Selection */}
      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
        <label
          style={{
            fontSize: "14px",
            fontWeight: 600,
            color: "var(--primary-text)",
          }}
        >
          Commit Message Language
        </label>
        <Dropdown align="start" side="bottom" sideOffset={4}>
          <DropdownTrigger asChild>
            <button
              type="button"
              style={{
                ...inputStyle,
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                cursor: "pointer",
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span>
                  {LANGUAGES.find((l) => l.code === commitMessageLanguage)?.flag || "🌐"}
                </span>
                <span>
                  {LANGUAGES.find((l) => l.code === commitMessageLanguage)?.name || commitMessageLanguage}
                </span>
              </span>
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
            </button>
          </DropdownTrigger>
          <DropdownContent className="language-dropdown-content">
            {LANGUAGES.map((lang) => (
              <DropdownItem
                key={lang.code}
                icon={<span>{lang.flag}</span>}
                onClick={() => setCommitMessageLanguage(lang.code)}
              >
                {lang.name}
              </DropdownItem>
            ))}
          </DropdownContent>
        </Dropdown>
        <div
          style={{
            fontSize: "11px",
            color: "var(--secondary-text)",
            opacity: 0.7,
            marginTop: "2px",
          }}
        >
          Language used to generate commit messages from git status
        </div>
      </div>
    </div>
  );
};

export default GeneralSettings;
