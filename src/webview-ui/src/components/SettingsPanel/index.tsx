import React, { useState } from "react";
import { LanguageSelector, LANGUAGES } from "./LanguageSelector";
import { useSettings } from "../../context/SettingsContext";
import { useI18n } from "../../hooks/useI18n";

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
  const { apiUrl, setApiUrl, language, setLanguage, aiLanguage, setAiLanguage } = useSettings();
  const { t } = useI18n();
  const [closeHover, setCloseHover] = useState(false);
  const [isSimpleMode, setIsSimpleMode] = useState(() => {
    try { return localStorage.getItem("zen-simple-mode") !== "false"; } catch { return true; }
  });

  const toggleSimpleMode = () => {
    setIsSimpleMode((prev) => {
      const next = !prev;
      try { localStorage.setItem("zen-simple-mode", String(next)); } catch {}
      return next;
    });
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "absolute", top: 0, left: 0, right: 0, bottom: 0,
        width: "100%", height: "100%",
        backgroundColor: "var(--secondary-bg)",
        zIndex: 9999, display: "flex", flexDirection: "column", overflow: "auto",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px var(--spacing-md, 16px) 14px",
          borderBottom: "1px solid var(--border-color)",
          display: "flex", alignItems: "flex-start", justifyContent: "space-between",
          gap: "12px", backgroundColor: "var(--tertiary-bg)", flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
          {/* Neon square badge */}
          <div style={{
            width: "36px", height: "36px", borderRadius: "8px", flexShrink: 0,
            background: "linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.15))",
            border: "1px solid rgba(139,92,246,0.4)",
            display: "flex", alignItems: "center", justifyContent: "center",
            color: "#a78bfa",
          }}>
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
              <circle cx="12" cy="12" r="4"/>
            </svg>
          </div>
          <div>
            <span style={{ fontWeight: 700, fontSize: "13px", color: "var(--primary-text)", letterSpacing: "0.01em", display: "block", marginBottom: "3px" }}>
              {t("settings.title")}
            </span>
            <p style={{ margin: 0, fontSize: "11px", color: "var(--secondary-text)", opacity: 0.7, lineHeight: 1.4 }}>
              {t("settings.desc")}
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          onMouseEnter={() => setCloseHover(true)}
          onMouseLeave={() => setCloseHover(false)}
          style={{
            padding: "5px", borderRadius: "6px", flexShrink: 0,
            backgroundColor: closeHover ? "rgba(239,68,68,0.12)" : "rgba(128,128,128,0.12)",
            border: closeHover ? "1px solid rgba(239,68,68,0.4)" : "1px solid transparent",
            color: closeHover ? "#f87171" : "var(--secondary-text)",
            cursor: "pointer", transition: "all 0.15s ease",
          }}
          title="Close Settings"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6 6 18"/><path d="m6 6 12 12"/>
          </svg>
        </button>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1, overflowY: "auto", padding: "20px",
          display: "flex", flexDirection: "column", gap: "24px",
          backgroundColor: "var(--secondary-bg)",
        }}
      >
        {/* API URL */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label style={{ fontSize: "14px", fontWeight: 600, color: "var(--primary-text)" }}>
            {t("settings.backendApiUrl")}
          </label>
          <input
            type="text"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            placeholder="http://localhost:8888"
            style={inputStyle}
          />
        </div>

        {/* UI Language */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label style={{ fontSize: "14px", fontWeight: 600, color: "var(--primary-text)" }}>
            {t("settings.language")}
          </label>
          <LanguageSelector value={language} onChange={(v) => setLanguage(v === "vi" ? "vi" : "en")} className="w-full" />
        </div>

        {/* AI Response Language */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label style={{ fontSize: "14px", fontWeight: 600, color: "var(--primary-text)" }}>
            {t("settings.aiLanguage")}
          </label>
          <select
            value={aiLanguage}
            onChange={(e) => setAiLanguage(e.target.value)}
            style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}
          >
            {LANGUAGES.map((l) => (
              <option key={l.code} value={l.name}>{l.flag} {l.name}</option>
            ))}
          </select>
        </div>

        {/* Simple Mode Toggle */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px" }}>
          <div>
            <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--primary-text)", marginBottom: "3px" }}>
              {t("settings.simpleMode")}
            </div>
            <div style={{ fontSize: "11px", color: "var(--secondary-text)", opacity: 0.7 }}>
              {t("settings.simpleModeDesc")}
            </div>
          </div>
          <button
            onClick={toggleSimpleMode}
            style={{
              flexShrink: 0, width: "40px", height: "22px", borderRadius: "11px",
              border: "none", cursor: "pointer", position: "relative",
              backgroundColor: isSimpleMode ? "var(--vscode-button-background, #0e639c)" : "rgba(128,128,128,0.3)",
              transition: "background-color 0.2s ease",
            }}
          >
            <span style={{
              position: "absolute", top: "3px",
              left: isSimpleMode ? "21px" : "3px",
              width: "16px", height: "16px", borderRadius: "50%",
              backgroundColor: "#fff",
              transition: "left 0.2s ease",
            }} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;
