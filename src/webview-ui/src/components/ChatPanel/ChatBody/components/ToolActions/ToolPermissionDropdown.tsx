import React from "react";
import { useSettings } from "../../../../../context/SettingsContext";

const ShieldCheckIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>
    <path d="m9 12 2 2 4-4"/>
  </svg>
);

const TriangleAlertIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/>
    <path d="M12 9v4"/>
    <path d="M12 17h.01"/>
  </svg>
);

const ToolPermissionDropdown: React.FC<{ toolId: string }> = ({ toolId }) => {
  const { toolPermissions, setToolPermission } = useSettings();
  const [open, setOpen] = React.useState(false);
  const permission = toolPermissions[toolId] || "full_access";

  return (
    <div style={{ position: "relative", flexShrink: 0 }}>
      <button
        onClick={(e) => {
          e.stopPropagation();
          setOpen(!open);
        }}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
          padding: "2px 6px",
          fontSize: "10px",
          fontWeight: 600,
          borderRadius: "4px",
          border: "1px solid var(--vscode-widget-border)",
          background: "var(--vscode-editor-background)",
          color: "var(--vscode-foreground)",
          cursor: "pointer",
          opacity: 0.7,
          letterSpacing: "0.3px",
          lineHeight: 1,
        }}
        title="Tool permission"
      >
        {permission === "full_access" ? <TriangleAlertIcon /> : <ShieldCheckIcon />}
        {permission === "full_access" ? "Full access" : "Review"}
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <>
          <div onClick={() => setOpen(false)} style={{ position: "fixed", inset: 0, zIndex: 999 }} />
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              right: 0,
              zIndex: 1000,
              backgroundColor: "color-mix(in srgb, var(--input-bg) 100%, black 15%)",
              border: "1px solid var(--vscode-widget-border)",
              borderRadius: "6px",
              overflow: "hidden",
              boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
              minWidth: "120px",
            }}
          >
            <button
              onClick={(e) => { e.stopPropagation(); setToolPermission(toolId, "full_access"); setOpen(false); }}
              style={{
                display: "flex", alignItems: "center", gap: "6px",
                width: "100%", padding: "6px 10px", fontSize: "11px",
                fontWeight: 500, textAlign: "left", border: "none", cursor: "pointer",
                background: permission === "full_access" ? "var(--vscode-button-background)" : "transparent",
                color: permission === "full_access" ? "var(--vscode-button-foreground)" : "var(--vscode-foreground)",
              }}
            >
              <TriangleAlertIcon /> Full access
            </button>
            <button
              disabled
              title="Review mode coming soon"
              style={{
                display: "flex", alignItems: "center", gap: "6px",
                width: "100%", padding: "6px 10px", fontSize: "11px",
                fontWeight: 500, textAlign: "left", border: "none", cursor: "not-allowed",
                background: "transparent", color: "var(--vscode-foreground)", opacity: 0.35,
              }}
            >
              <ShieldCheckIcon /> Review
            </button>
          </div>
        </>
      )}
    </div>
  );
};

export default ToolPermissionDropdown;
