import React from "react";
import { LanguageSelector } from "./LanguageSelector";
import { useSettings } from "../../context/SettingsContext";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose }) => {
  const { apiUrl, setApiUrl, language, setLanguage } = useSettings();

  const handleApiUrlChange = (value: string) => {
    setApiUrl(value);
  };

  const handleLanguageChange = (value: string) => {
    setLanguage(value);
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100vw",
        height: "100vh",
        backgroundColor: "#252526",
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        overflow: "auto",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px",
          borderBottom: "1px solid #3e3e42",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: "#252526",
        }}
      >
        <h2
          style={{
            fontSize: "16px",
            fontWeight: 600,
            color: "#cccccc",
            margin: 0,
          }}
        >
          Settings
        </h2>
        <div
          style={{
            cursor: "pointer",
            padding: "4px",
            borderRadius: "4px",
            transition: "background-color 0.2s",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={onClose}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "#2a2d2e";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </div>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          backgroundColor: "#252526",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: "#cccccc",
            }}
          >
            Backend API URL
          </label>
          <input
            type="text"
            value={apiUrl}
            onChange={(e) => handleApiUrlChange(e.target.value)}
            placeholder="http://localhost:8888"
            style={{
              width: "100%",
              padding: "8px",
              backgroundColor: "#3c3c3c",
              border: "1px solid #3e3e42",
              borderRadius: "4px",
              color: "#cccccc",
              fontSize: "12px",
              outline: "none",
            }}
          />
          <span
            style={{
              fontSize: "11px",
              color: "#858585",
            }}
          >
            Địa chỉ API để lấy danh sách models và accounts.
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <label
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: "#cccccc",
            }}
          >
            Language
          </label>
          <LanguageSelector
            value={language}
            onChange={handleLanguageChange}
            className="w-full"
          />
          <span
            style={{
              fontSize: "11px",
              color: "#858585",
            }}
          >
            Ngôn ngữ giao diện và phản hồi của AI.
          </span>
        </div>
      </div>
    </div>
  );
};

export default SettingsPanel;
