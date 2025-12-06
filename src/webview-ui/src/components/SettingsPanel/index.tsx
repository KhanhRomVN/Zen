import React, { useState } from "react";
import ModelsPanel from "./ModelsPanel";
import ContextPanel from "./ContextPanel";
import NotificationsPanel from "./NotificationsPanel";
import RulePromptPanel from "./RulePromptPanel";

interface SettingsPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

type PanelView =
  | "main"
  | "models"
  | "context"
  | "checkpoints"
  | "notifications"
  | "rule-prompt";

const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose }) => {
  const [currentView, setCurrentView] = useState<PanelView>("main");

  if (!isOpen) return null;

  // Main view - danh sách cards
  if (currentView === "main") {
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
        {/* Header */}
        <div
          style={{
            padding: "var(--spacing-lg)",
            borderBottom: "1px solid var(--border-color)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: "var(--secondary-bg)",
          }}
        >
          <h2
            style={{
              fontSize: "var(--font-size-xl)",
              fontWeight: 600,
              color: "var(--primary-text)",
              margin: 0,
            }}
          >
            Settings
          </h2>
          <div
            style={{
              cursor: "pointer",
              padding: "var(--spacing-xs)",
              borderRadius: "var(--border-radius)",
              transition: "background-color 0.2s",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            onClick={onClose}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--hover-bg)";
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

        {/* Cards List */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "var(--spacing-md)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--spacing-sm)",
          }}
        >
          {/* Models Card */}
          <div
            style={{
              padding: "var(--spacing-md)",
              backgroundColor: "var(--primary-bg)",
              border: "1px solid var(--border-color)",
              borderRadius: "var(--border-radius-lg)",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onClick={() => setCurrentView("models")}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--hover-bg)";
              e.currentTarget.style.borderColor = "var(--accent-text)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "var(--primary-bg)";
              e.currentTarget.style.borderColor = "var(--border-color)";
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--spacing-sm)",
                marginBottom: "var(--spacing-xs)",
              }}
            >
              <span style={{ fontSize: "20px" }}>🤖</span>
              <span
                style={{
                  fontSize: "var(--font-size-md)",
                  fontWeight: 600,
                  color: "var(--primary-text)",
                }}
              >
                Models Management
              </span>
            </div>
            <p
              style={{
                margin: 0,
                fontSize: "var(--font-size-xs)",
                color: "var(--secondary-text)",
                lineHeight: 1.4,
              }}
            >
              Quản lý danh sách AI models có sẵn
            </p>
          </div>

          {/* Context Window Card */}
          <div
            style={{
              padding: "var(--spacing-md)",
              backgroundColor: "var(--primary-bg)",
              border: "1px solid var(--border-color)",
              borderRadius: "var(--border-radius-lg)",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onClick={() => setCurrentView("context")}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--hover-bg)";
              e.currentTarget.style.borderColor = "var(--accent-text)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "var(--primary-bg)";
              e.currentTarget.style.borderColor = "var(--border-color)";
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--spacing-sm)",
                marginBottom: "var(--spacing-xs)",
              }}
            >
              <span style={{ fontSize: "20px" }}>📏</span>
              <span
                style={{
                  fontSize: "var(--font-size-md)",
                  fontWeight: 600,
                  color: "var(--primary-text)",
                }}
              >
                Context Window
              </span>
            </div>
            <p
              style={{
                margin: 0,
                fontSize: "var(--font-size-xs)",
                color: "var(--secondary-text)",
                lineHeight: 1.4,
              }}
            >
              Cấu hình kích thước context window
            </p>
          </div>

          {/* Checkpoints Card */}
          <div
            style={{
              padding: "var(--spacing-md)",
              backgroundColor: "var(--primary-bg)",
              border: "1px solid var(--border-color)",
              borderRadius: "var(--border-radius-lg)",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onClick={() => setCurrentView("checkpoints")}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--hover-bg)";
              e.currentTarget.style.borderColor = "var(--accent-text)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "var(--primary-bg)";
              e.currentTarget.style.borderColor = "var(--border-color)";
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--spacing-sm)",
                marginBottom: "var(--spacing-xs)",
              }}
            >
              <span style={{ fontSize: "20px" }}>💾</span>
              <span
                style={{
                  fontSize: "var(--font-size-md)",
                  fontWeight: 600,
                  color: "var(--primary-text)",
                }}
              >
                Checkpoints
              </span>
            </div>
            <p
              style={{
                margin: 0,
                fontSize: "var(--font-size-xs)",
                color: "var(--secondary-text)",
                lineHeight: 1.4,
              }}
            >
              Quản lý các điểm lưu trữ dự án
            </p>
          </div>

          {/* Notifications Card */}
          <div
            style={{
              padding: "var(--spacing-md)",
              backgroundColor: "var(--primary-bg)",
              border: "1px solid var(--border-color)",
              borderRadius: "var(--border-radius-lg)",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onClick={() => setCurrentView("notifications")}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--hover-bg)";
              e.currentTarget.style.borderColor = "var(--accent-text)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "var(--primary-bg)";
              e.currentTarget.style.borderColor = "var(--border-color)";
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--spacing-sm)",
                marginBottom: "var(--spacing-xs)",
              }}
            >
              <span style={{ fontSize: "20px" }}>🔔</span>
              <span
                style={{
                  fontSize: "var(--font-size-md)",
                  fontWeight: 600,
                  color: "var(--primary-text)",
                }}
              >
                Notifications
              </span>
            </div>
            <p
              style={{
                margin: 0,
                fontSize: "var(--font-size-xs)",
                color: "var(--secondary-text)",
                lineHeight: 1.4,
              }}
            >
              Cấu hình thông báo và alerts
            </p>
          </div>

          {/* Rule Prompt Card */}
          <div
            style={{
              padding: "var(--spacing-md)",
              backgroundColor: "var(--primary-bg)",
              border: "1px solid var(--border-color)",
              borderRadius: "var(--border-radius-lg)",
              cursor: "pointer",
              transition: "all 0.2s",
            }}
            onClick={() => setCurrentView("rule-prompt")}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--hover-bg)";
              e.currentTarget.style.borderColor = "var(--accent-text)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "var(--primary-bg)";
              e.currentTarget.style.borderColor = "var(--border-color)";
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--spacing-sm)",
                marginBottom: "var(--spacing-xs)",
              }}
            >
              <span style={{ fontSize: "20px" }}>📝</span>
              <span
                style={{
                  fontSize: "var(--font-size-md)",
                  fontWeight: 600,
                  color: "var(--primary-text)",
                }}
              >
                Rule Prompt
              </span>
            </div>
            <p
              style={{
                margin: 0,
                fontSize: "var(--font-size-xs)",
                color: "var(--secondary-text)",
                lineHeight: 1.4,
              }}
            >
              Cấu hình system prompt mặc định cho request đầu tiên
            </p>
          </div>
        </div>
      </div>
    );
  }

  // Render specific panel based on currentView
  return (
    <>
      {currentView === "models" && (
        <ModelsPanel onBack={() => setCurrentView("main")} />
      )}
      {currentView === "context" && (
        <ContextPanel onBack={() => setCurrentView("main")} />
      )}
      {currentView === "notifications" && (
        <NotificationsPanel onBack={() => setCurrentView("main")} />
      )}
      {currentView === "rule-prompt" && (
        <RulePromptPanel onBack={() => setCurrentView("main")} />
      )}
    </>
  );
};

export default SettingsPanel;
