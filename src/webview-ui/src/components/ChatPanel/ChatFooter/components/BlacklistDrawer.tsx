import React from "react";
import BlacklistManager from "../../../SettingsPanel/BlacklistManager";

interface BlacklistDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const BlacklistDrawer: React.FC<BlacklistDrawerProps> = ({
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "absolute",
        bottom: "calc(100% + 12px)", // Open above ChatFooter with some margin
        left: "12px",
        right: "12px",
        backgroundColor: "var(--secondary-bg)",
        border: "1px solid var(--border-color)",
        borderRadius: "var(--border-radius)",
        boxShadow: "0 -4px 12px rgba(0,0,0,0.2)",
        zIndex: 1000,
        maxHeight: "80vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "12px 16px",
          borderBottom: "1px solid var(--border-color)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: "var(--tertiary-bg)",
        }}
      >
        <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 600 }}>
          Backup Blacklist
        </h3>
        <div style={{ cursor: "pointer", opacity: 0.7 }} onClick={onClose}>
          <svg
            width="16"
            height="16"
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
      <div style={{ padding: "16px", overflowY: "auto" }}>
        <BlacklistManager />
      </div>
    </div>
  );
};

export default BlacklistDrawer;
