/**
 * ------------------------------------------------------------------
 * GeneralSettings
 * ------------------------------------------------------------------
 * Tab General trong Settings Panel. Được chia thành các GroupSection:
 * - Backend Connection: URL backend + Chromium profile folder
 * - Language: ngôn ngữ AI + ngôn ngữ commit message
 * Database Managers đã được tách sang tab riêng (xem Database.tsx).
 * ------------------------------------------------------------------
 */

import React from "react";
import { Server, Languages } from "lucide-react";
import { useSettings } from "../../../context/SettingsContext";
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
} from "../../../components/ui/Dropdown";
import { LANGUAGES } from "./LanguageSelector";
import GroupSection from "./GroupSection";

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
    chromiumProfileDir,
    setChromiumProfileDir,
  } = useSettings();

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "28px",
      }}
    >
      {/* Backend Connection */}
      <GroupSection
        icon={<Server size={16} />}
        color="#1565c0"
        title="Backend Connection"
        description="Backend API address and Chromium profile folder."
      >
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
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "var(--primary-text)",
            }}
          >
            Chromium Profile Folder
          </label>
          <input
            type="text"
            value={chromiumProfileDir}
            onChange={(e) => setChromiumProfileDir(e.target.value)}
            placeholder="/home/user/.elara/profiles"
            style={inputStyle}
          />
        </div>
      </GroupSection>

      {/* Language */}
      <GroupSection
        icon={<Languages size={16} />}
        color="#6a1b9a"
        title="Language"
        description="AI response language and commit message language."
      >
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
          <Dropdown align="start" side="bottom" sideOffset={4} searchable>
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
                <span
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <span>
                    {LANGUAGES.find((l) => l.name === aiLanguage)?.flag || "🌐"}
                  </span>
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
          <Dropdown align="start" side="bottom" sideOffset={4} searchable>
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
                <span
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <span>
                    {LANGUAGES.find((l) => l.code === commitMessageLanguage)
                      ?.flag || "🌐"}
                  </span>
                  <span>
                    {LANGUAGES.find((l) => l.code === commitMessageLanguage)
                      ?.name || commitMessageLanguage}
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
        </div>
      </GroupSection>
    </div>
  );
};

export default GeneralSettings;