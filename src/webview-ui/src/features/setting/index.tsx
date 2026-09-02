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
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
} from "@/components/ui/Dropdown";

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

// ─── Component ──────────────────────────────────────────────────────────
const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose }) => {
  // ── State ──
  const [closeHover, setCloseHover] = useState(false);
  const [activeTab, setActiveTab] = useState("General");

  // ── Store ──
  const {
    apiUrl,
    setApiUrl,
    aiLanguage,
    setAiLanguage,
    commitMessageLanguage,
    setCommitMessageLanguage,
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
      {/* Header - Following AccountsPanel style */}
      <div
        style={{
          padding: "16px 16px 7px",
          borderTop: "1px solid var(--border-color)",
          flexShrink: 0,
          backgroundColor: "var(--tertiary-bg)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div>
              <div style={{ marginBottom: "3px" }}>
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: "16px",
                    color: "var(--primary-text)",
                    letterSpacing: "0.01em",
                  }}
                >
                  Zen Settings
                </span>
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  color: "var(--secondary-text)",
                  opacity: 0.7,
                  lineHeight: 1.4,
                }}
              >
                Configure Zen extension settings
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
              backgroundColor: closeHover
                ? "var(--vscode-inputValidation-errorBackground, rgba(239,68,68,0.12))"
                : "rgba(128,128,128,0.1)",
              border: "none",
              color: closeHover
                ? "var(--vscode-errorForeground)"
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
      </div>

      {/* Tabbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
          padding: "0 16px",
          borderBottom: "1px solid var(--border-color)",
          backgroundColor: "var(--tertiary-bg)",
          flexShrink: 0,
        }}
      >
        {["General", "Feature", "About"].map((tab) => (
          <span
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "10px 12px",
              fontSize: "13px",
              fontWeight: activeTab === tab ? 600 : 400,
              color: activeTab === tab ? "var(--primary-text)" : "var(--secondary-text)",
              cursor: "pointer",
              borderBottom: activeTab === tab ? "2px solid var(--vscode-focusBorder, #007acc)" : "2px solid transparent",
              transition: "all 0.15s ease",
              userSelect: "none",
            }}
          >
            {tab}
          </span>
        ))}
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
        {activeTab === "General" && (
          <>
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
          </>
        )}

        {activeTab === "About" && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "16px",
              padding: "32px 16px",
              textAlign: "center",
            }}
          >
            <img
              src={`${(window as any).__zenImagesUri}/icon.png`}
              alt="Zen Logo"
              style={{
                width: "72px",
                height: "72px",
                objectFit: "contain",
                borderRadius: "16px",
              }}
            />
            <div>
              <div
                style={{
                  fontSize: "24px",
                  fontWeight: 800,
                  color: "var(--primary-text)",
                }}
              >
                Zen
              </div>
              <p
                style={{
                  fontSize: "13px",
                  color: "var(--secondary-text)",
                  opacity: 0.8,
                  marginTop: "4px",
                }}
              >
                AI-powered coding assistant extension for VSCode
              </p>
            </div>
            <div
              style={{
                width: "100%",
                maxWidth: "400px",
                padding: "16px",
                borderRadius: "12px",
                border: "1px solid var(--border-color)",
                backgroundColor: "var(--tertiary-bg)",
                display: "flex",
                alignItems: "center",
                gap: "12px",
              }}
            >
              <span style={{ fontSize: "20px" }}>👨‍💻</span>
              <div style={{ textAlign: "left" }}>
                <div
                  style={{
                    fontSize: "13px",
                    fontWeight: 600,
                    color: "var(--primary-text)",
                  }}
                >
                  Developer
                </div>
                <a
                  href="https://github.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: "12px",
                    color: "var(--vscode-textLink-foreground, #3794ff)",
                    textDecoration: "none",
                    marginTop: "2px",
                    display: "inline-block",
                  }}
                >
                  github.com
                </a>
              </div>
            </div>
          </div>
        )}

        {activeTab === "Feature" && (
          <div
            style={{
              textAlign: "center",
              color: "var(--secondary-text)",
              opacity: 0.7,
              fontSize: "13px",
              padding: "32px 16px",
            }}
          >
            Feature settings coming soon
          </div>
        )}
      </div>

      <style>
        {`
          .language-dropdown-content > div {
            max-height: 180px !important;
          }
        `}
      </style>
    </div>
  );
};

export default SettingsPanel;