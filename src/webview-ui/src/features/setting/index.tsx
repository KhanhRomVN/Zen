/**
 * ------------------------------------------------------------------
 * SettingsPanel
 * ------------------------------------------------------------------
 * Panel cài đặt của Zen: General, Feature, About.
 * Header phẳng, tab dạng pill đơn giản, nội dung fade-in khi đổi tab.
 * ------------------------------------------------------------------
 */

import React, { useState } from "react";
import { SlidersHorizontal, Sparkles, Info, X } from "lucide-react";
import GeneralSettings from "./components/general/General";
import FeatureSettings from "./components/feature/Feature";
import AboutSettings from "./components/about/About";
import { SETTINGS_CSS, accentVars } from "./components/shared/ui";

const TABS: Array<{
  id: string;
  label: string;
  icon: React.ElementType;
  accent: string;
}> = [
  { id: "General", label: "General", icon: SlidersHorizontal, accent: "#4c9dfb" },
  { id: "Feature", label: "Feature", icon: Sparkles, accent: "#f0883e" },
  { id: "About", label: "About", icon: Info, accent: "#a78bfa" },
];

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose }) => {
  const [activeTab, setActiveTab] = useState("General");

  if (!isOpen) return null;

  const accent = (TABS.find((t) => t.id === activeTab) ?? TABS[0]).accent;

  return (
    <div
      style={{
        ...accentVars(accent),
        position: "absolute",
        inset: 0,
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--secondary-bg)",
      }}
    >
      <div
        style={{
          flexShrink: 0,
          padding: "14px 16px 6px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <span
              style={{
                fontSize: "16.75px",
                fontWeight: 700,
                color: "var(--primary-text)",
              }}
            >
              Settings
            </span>
            <span
              style={{
                fontSize: "14px",
                color: "var(--secondary-text)",
                opacity: 0.75,
              }}
            >
              Configure Zen extension settings
            </span>
          </div>
          <button
            type="button"
            className="zs-icon-btn"
            onClick={onClose}
            title="Close Settings"
          >
            <X size={15} />
          </button>
        </div>

        <div className="zs-tabs" role="tablist">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={activeTab === id}
              className={`zs-tab${activeTab === id ? " active" : ""}`}
              onClick={() => setActiveTab(id)}
            >
              <Icon size={14} />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 16px 28px" }}>
        <div
          key={activeTab}
          className="zs-fade"
          style={{ maxWidth: "720px", margin: "0 auto" }}
        >
          {activeTab === "General" && <GeneralSettings />}
          {activeTab === "Feature" && <FeatureSettings />}
          {activeTab === "About" && <AboutSettings />}
        </div>
      </div>

      <style>
        {`
          ${SETTINGS_CSS}
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