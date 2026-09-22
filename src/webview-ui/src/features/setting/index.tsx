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

// ── Icons ──
import { SlidersHorizontal, Database, Sparkles, Info } from "lucide-react";

// ── Components ──
import GeneralSettings from "./components/General";
import DatabaseSettings from "./components/Database";
import FeatureSettings from "./components/Feature";
import AboutSettings from "./components/About";

// ─── Tabs ───────────────────────────────────────────────────────────────
/** Danh sách tab Settings: mỗi tab có icon và màu nhận diện riêng. */
const TABS: Array<{
  id: string;
  label: string;
  icon: React.ElementType;
  color: string;
}> = [
  { id: "General", label: "General", icon: SlidersHorizontal, color: "#1e88e5" },
  { id: "Database", label: "Database", icon: Database, color: "#43a047" },
  { id: "Feature", label: "Feature", icon: Sparkles, color: "#fb8c00" },
  { id: "About", label: "About", icon: Info, color: "#8e24aa" },
];

// ─── Interfaces ─────────────────────────────────────────────────────────
interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose }) => {
  // ── State ──
  const [closeHover, setCloseHover] = useState(false);
  const [activeTab, setActiveTab] = useState("General");

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
        zIndex: 1000,
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
        {TABS.map(({ id, label, icon: Icon, color }) => {
          const isActive = activeTab === id;
          return (
            <span
              key={id}
              onClick={() => setActiveTab(id)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "10px 12px",
                fontSize: "13px",
                fontWeight: isActive ? 600 : 400,
                color: isActive
                  ? "var(--primary-text)"
                  : "var(--secondary-text)",
                cursor: "pointer",
                borderBottom: isActive
                  ? `2px solid ${color}`
                  : "2px solid transparent",
                transition: "all 0.15s ease",
                userSelect: "none",
              }}
            >
              <span
                style={{
                  display: "flex",
                  color,
                  opacity: isActive ? 1 : 0.7,
                  transition: "opacity 0.15s ease",
                }}
              >
                <Icon size={14} />
              </span>
              {label}
            </span>
          );
        })}
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
        {activeTab === "General" && <GeneralSettings />}
        {activeTab === "Database" && <DatabaseSettings />}
        {activeTab === "Feature" && <FeatureSettings />}
        {activeTab === "About" && <AboutSettings />}
      </div>

      <style>
        {`
          .language-dropdown-content > div {
            max-height: 180px !important;
          }
          .dropdown-searchbar {
            width: 100%;
            box-sizing: border-box;
            background-color: var(--input-bg);
            border-bottom: 1px solid var(--border-color);
          }
        `}
      </style>
    </div>
  );
};

export default SettingsPanel;
