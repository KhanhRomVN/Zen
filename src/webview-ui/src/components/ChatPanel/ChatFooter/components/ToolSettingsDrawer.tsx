import React from "react";
import { useSettings, PermissionMode } from "../../../../context/SettingsContext";
import { useI18n } from "../../../../hooks/useI18n";
import { Zap, FileCode, Brain, ShieldCheck, Ban, Eye } from "lucide-react";

interface ToolSettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const PERMISSION_MODES = [
  { id: "bypassPermissions", icon: <Zap size={14} />, color: "var(--vscode-editorBracketHighlight-foreground3, #f59e0b)", labelKey: "settings.bypassPermissionsLabel" as const, descKey: "settings.bypassPermissionsDesc" as const },
  { id: "acceptEdits",       icon: <FileCode size={14} />, color: "var(--vscode-symbolIcon-interfaceForeground, #3b82f6)", labelKey: "settings.acceptEditsLabel" as const, descKey: "settings.acceptEditsDesc" as const },
  { id: "auto",              icon: <Brain size={14} />, color: "var(--vscode-symbolIcon-constructorForeground, #10b981)", labelKey: "settings.autoLabel" as const, descKey: "settings.autoDesc" as const },
  { id: "plan",              icon: <Eye size={14} />, color: "var(--vscode-symbolIcon-classForeground, #8b5cf6)", labelKey: "settings.planLabel" as const, descKey: "settings.planDesc" as const },
] as const;

const ToolSettingsDrawer: React.FC<ToolSettingsDrawerProps> = ({ isOpen, onClose }) => {
  const { permissionMode, setPermissionMode } = useSettings();
  const { t } = useI18n();

  if (!isOpen) return null;

  return (
    <>
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 999 }} />
      <div style={{
        position: "absolute", bottom: "calc(100% + 8px)", left: 0, width: "320px",
        backgroundColor: "var(--vscode-sideBar-background)", border: "1px solid var(--vscode-widget-border)",
        borderRadius: "8px", zIndex: 1000, boxShadow: "0 -4px 16px rgba(0,0,0,0.25)",
        overflow: "hidden", display: "flex", flexDirection: "column",
      }}>
        <div style={{
          padding: "10px 14px", borderBottom: "1px solid var(--vscode-widget-border)",
          fontSize: "11px", fontWeight: 600, opacity: 0.8, textTransform: "uppercase",
          letterSpacing: "0.05em", color: "var(--vscode-foreground)",
        }}>
          <span>{t("settings.permissionMode")}</span>
        </div>

        <div style={{ maxHeight: "360px", overflowY: "auto", padding: "6px" }}>
          {PERMISSION_MODES.map((mode) => {
            const isSelected = permissionMode === mode.id;
            return (
              <div
                key={mode.id}
                onClick={() => setPermissionMode(mode.id as PermissionMode)}
                style={{
                  display: "flex", alignItems: "flex-start", gap: "10px",
                  padding: "8px 10px", borderRadius: "6px", cursor: "pointer", marginBottom: "4px",
                  backgroundColor: isSelected ? "var(--vscode-list-activeSelectionBackground)" : "transparent",
                  color: isSelected ? "var(--vscode-list-activeSelectionForeground)" : "var(--vscode-foreground)",
                  border: isSelected ? "1px solid var(--vscode-focusBorder, rgba(0,0,0,0.2))" : "1px solid transparent",
                }}
                onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = "var(--vscode-list-hoverBackground)"; }}
                onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.backgroundColor = "transparent"; }}
              >
                <div style={{
                  width: "24px", height: "24px", borderRadius: "4px", flexShrink: 0, marginTop: "2px",
                  backgroundColor: isSelected ? "rgba(255,255,255,0.12)" : `${mode.color}1A`,
                  color: isSelected ? "inherit" : mode.color,
                  display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {mode.icon}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "2px", flex: 1 }}>
                  <span style={{ fontSize: "12px", fontWeight: 600, lineHeight: "1.2" }}>{t(mode.labelKey)}</span>
                  <span style={{ fontSize: "10.5px", opacity: isSelected ? 0.9 : 0.6, lineHeight: "1.3" }}>{t(mode.descKey)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};

export default ToolSettingsDrawer;
