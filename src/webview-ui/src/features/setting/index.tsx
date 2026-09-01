/**
 * ------------------------------------------------------------------
 * SettingsPanel
 * ------------------------------------------------------------------
 * Panel cài đặt — backend URL, ngôn ngữ AI, ngôn ngữ commit message,
 * max files per session, và cấu hình Universal AI Provider.

 * Main features:
 * - Cấu hình Backend API URL
 * - Chọn ngôn ngữ AI và ngôn ngữ commit message
 * - Giới hạn số files mỗi phiên
 * - Cấu hình Universal AI Provider
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── React ──
import React, { useState } from "react";

// ── Components ──
import { LANGUAGES } from "./components/LanguageSelector";
import UniversalAIProviderForm from "./components/UniversalAIProviderForm";

// ── Hooks ──
import { useSettings } from "../../context/SettingsContext";

// ─── Interfaces ─────────────────────────────────────────────────────────
interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

// ─── Constants ──────────────────────────────────────────────────────────
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

// ─── Component ──────────────────────────────────────────────────────────
const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose }) => {
  // ── State ──
  const [closeHover, setCloseHover] = useState(false);

  // ── Store ──
  const {
    apiUrl,
    setApiUrl,
    aiLanguage,
    setAiLanguage,
    commitMessageLanguage,
    setCommitMessageLanguage,
    maxFilesPerSession,
    setMaxFilesPerSession,
  } = useSettings();

  if (!isOpen) return null;

  // ── Render ──
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
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "16px 20px",
          borderBottom: "1px solid var(--border-color)",
          backgroundColor: "var(--panel-bg)",
        }}
      >
        <h2
          style={{
            margin: 0,
            fontSize: "16px",
            fontWeight: 600,
            color: "var(--primary-text)",
          }}
        >
          Zen Settings
        </h2>
        <button
          onClick={onClose}
          onMouseEnter={() => setCloseHover(true)}
          onMouseLeave={() => setCloseHover(false)}
          style={{
            background: "none",
            border: "none",
            color: closeHover ? "#fff" : "var(--secondary-text)",
            cursor: "pointer",
            fontSize: "18px",
            padding: "4px 8px",
            borderRadius: "4px",
            lineHeight: 1,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            transition: "all 0.15s ease",
            backgroundColor: closeHover
              ? "rgba(255, 255, 255, 0.1)"
              : "transparent",
          }}
        >
          ✕
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
          <select
            value={aiLanguage}
            onChange={(e) => setAiLanguage(e.target.value)}
            style={{
              ...inputStyle,
              cursor: "pointer",
            }}
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.name}>
                {lang.flag} {lang.name}
              </option>
            ))}
          </select>
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
          <select
            value={commitMessageLanguage}
            onChange={(e) =>
              setCommitMessageLanguage(e.target.value as "en" | "vi")
            }
            style={{
              ...inputStyle,
              cursor: "pointer",
            }}
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

        {/* Target OS & Shell Environment */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "var(--primary-text)",
            }}
          >
            Target OS & Shell
          </label>
          <div
            style={{
              fontSize: "12px",
              color: "var(--secondary-text)",
              opacity: 0.75,
              marginTop: "-4px",
            }}
          >
            Operating system & shell conventions for CLI command execution
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              padding: "10px 14px",
              borderRadius: "8px",
              border: "1px solid var(--border-color)",
              backgroundColor: "var(--input-bg)",
            }}
          >
            <span style={{ fontSize: "18px" }}>⚡</span>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--primary-text)" }}>
                Auto Detect
              </span>
              <span style={{ fontSize: "11px", color: "var(--secondary-text)", opacity: 0.8 }}>
                Automatically detects host environment (Windows / Linux / macOS) for CLI execution
              </span>
            </div>
          </div>
        </div>

        {/* Max Files Per Session */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "var(--primary-text)",
            }}
          >
            Max Files Per Session
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <input
              type="number"
              min={1}
              max={100}
              value={maxFilesPerSession}
              onChange={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val)) {
                  setMaxFilesPerSession(val);
                }
              }}
              style={{
                ...inputStyle,
                width: "100px",
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontSize: "13px",
                color: "var(--secondary-text)",
              }}
            >
              files per conversation session
            </span>
          </div>
          <div
            style={{
              fontSize: "11px",
              color: "var(--secondary-text)",
              opacity: 0.7,
              marginTop: "2px",
            }}
          >
            Maximum number of files AI can read or write in a single conversation session.
            Default: 5. Range: 1–100.
          </div>
        </div>

        {/* Universal AI Provider */}
        <UniversalAIProviderForm />
      </div>
    </div>
  );
};

export default SettingsPanel;