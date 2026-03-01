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
        bottom: "0", // Attach to the bottom of the container
        left: "0",
        right: "0",
        backgroundColor: "var(--secondary-bg)",
        border: "1px solid var(--border-color)",
        borderRadius: "var(--border-radius)",
        boxShadow: "0 -4px 12px rgba(0,0,0,0.2)",
        zIndex: 1000,
        height: "70vh",
        maxHeight: "70vh",
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Content */}
      <div style={{ padding: "16px", overflowY: "auto", height: "100%" }}>
        <BlacklistManager onClose={onClose} />
      </div>
    </div>
  );
};

export default BlacklistDrawer;
