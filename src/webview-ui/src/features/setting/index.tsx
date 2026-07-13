import React, { useState } from "react";
import { LANGUAGES } from "./components/LanguageSelector";
import UniversalAIProviderForm from "./components/UniversalAIProviderForm";
import { useSettings } from "../../context/SettingsContext";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  backgroundColor: "var(--input-bg)",
  border: "1px solid var(--border-color)",
  borderRadius: "6px",
  color: "var(--primary-text)",
  fontSize: "14px",
  outline: "none",
  boxSizing: "border-box",
};

const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose }) => {
  const {
    apiUrl,
    setApiUrl,
    aiLanguage,
    setAiLanguage,
    commitMessageLanguage,
    setCommitMessageLanguage,
  } = useSettings();
  const [closeHover, setCloseHover] = useState(false);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "var(--secondary-bg)",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        overflow: "auto",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px var(--spacing-md, 16px) 14px",
          borderTop: "1px solid var(--border-color)",
          borderBottom: "1px solid var(--border-color)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
          backgroundColor: "var(--tertiary-bg)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {/* Icon badge - VSCode theme neutral */}
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              flexShrink: 0,
              background: "rgba(128,128,128,0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "var(--vscode-foreground)",
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
              <circle cx="12" cy="12" r="4" />
            </svg>
          </div>
          <div>
            <span
              style={{
                fontWeight: 700,
                fontSize: "14px",
                color: "var(--primary-text)",
                letterSpacing: "0.01em",
                display: "block",
                marginBottom: "3px",
              }}
            >
              Settings
            </span>
            <p
              style={{
                margin: 0,
                fontSize: "12px",
                color: "var(--secondary-text)",
                opacity: 0.7,
                lineHeight: 1.4,
              }}
            >
              Configure Zen preferences and behavior
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          onMouseEnter={() => setCloseHover(true)}
          onMouseLeave={() => setCloseHover(false)}
          style={{
            padding: "5px",
            borderRadius: "6px",
            flexShrink: 0,
            alignSelf: "center",
            backgroundColor: closeHover
              ? "rgba(239,68,68,0.12)"
              : "rgba(128,128,128,0.12)",
            border: "none",
            color: closeHover
              ? "var(--vscode-errorForeground, #f87171)"
              : "var(--secondary-text)",
            cursor: "pointer",
            transition: "all 0.15s ease",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          title="Close Settings"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "24px",
          backgroundColor: "var(--secondary-bg)",
        }}
      >
        {/* API URL */}
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

        {/* AI Response Language */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "var(--primary-text)",
            }}
          >
            AI Response Language
          </label>
          <select
            value={aiLanguage}
            onChange={(e) => setAiLanguage(e.target.value)}
            style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.name}>
                {l.flag} {l.name}
              </option>
            ))}
          </select>
        </div>

        {/* Commit Message Language */}
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
          <select
            value={commitMessageLanguage}
            onChange={(e) =>
              setCommitMessageLanguage(e.target.value as "en" | "vi")
            }
            style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}
          >
            <option value="en">🇬🇧 English</option>
            <option value="vi">🇻🇳 Tiếng Việt</option>
          </select>
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

        {/* Universal AI Provider */}
        <UniversalAIProviderForm />
      </div>
    </div>
  );
};

export default SettingsPanel;
