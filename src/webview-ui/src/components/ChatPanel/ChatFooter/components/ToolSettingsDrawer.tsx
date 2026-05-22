import React from "react";
import { useSettings, PermissionMode } from "../../../../context/SettingsContext";
import {
  Zap,
  FileCode,
  Brain,
  ShieldCheck,
  Ban,
  Eye,
} from "lucide-react";

interface ToolSettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const PERMISSION_MODES = [
  {
    id: "bypassPermissions",
    icon: <Zap size={14} />,
    color: "var(--vscode-editorBracketHighlight-foreground3, #f59e0b)",
    labelEn: "Full Access (Bypass)",
    labelVi: "Cho phép toàn bộ (Bypass)",
    descEn: "All tools execute automatically without prompting.",
    descVi: "Tự động chạy mọi công cụ mà không cần hỏi người dùng.",
  },
  {
    id: "acceptEdits",
    icon: <FileCode size={14} />,
    color: "var(--vscode-symbolIcon-interfaceForeground, #3b82f6)",
    labelEn: "Auto File Edits",
    labelVi: "Tự động sửa File",
    descEn: "Reads and file writes execute automatically; commands require approval.",
    descVi: "Đọc/Ghi file tự động; chạy lệnh Terminal & Sub-agent cần phê duyệt.",
  },
  {
    id: "auto",
    icon: <Brain size={14} />,
    color: "var(--vscode-symbolIcon-constructorForeground, #10b981)",
    labelEn: "Auto Reads",
    labelVi: "Tự động Đọc file",
    descEn: "Safe read-only tools execute automatically; file writes and commands require approval.",
    descVi: "Các công cụ đọc file tự chạy; chỉnh sửa file & chạy lệnh cần phê duyệt.",
  },
  {
    id: "default",
    icon: <ShieldCheck size={14} />,
    color: "var(--vscode-disabledForeground, #a3a3a3)",
    labelEn: "Ask Every Time",
    labelVi: "Hỏi mọi lúc (Mặc định)",
    descEn: "All tools require manual confirmation before running.",
    descVi: "Mọi công cụ đều cần bạn xác nhận trước khi chạy.",
  },
  {
    id: "dontAsk",
    icon: <Ban size={14} />,
    color: "var(--vscode-errorForeground, #ef4444)",
    labelEn: "Deny All (Silent)",
    labelVi: "Chặn toàn bộ (Deny All)",
    descEn: "All tools are automatically blocked without prompting.",
    descVi: "Tự động chặn tất cả các công cụ mà không cần hỏi.",
  },
  {
    id: "plan",
    icon: <Eye size={14} />,
    color: "var(--vscode-symbolIcon-classForeground, #8b5cf6)",
    labelEn: "Read Only (Plan)",
    labelVi: "Chỉ đọc (Read Only Plan)",
    descEn: "Safe reads execute automatically; file writes and commands are automatically blocked.",
    descVi: "Tự động đọc file; tự động chặn chỉnh sửa file & chạy lệnh Terminal.",
  },
] as const;

const ToolSettingsDrawer: React.FC<ToolSettingsDrawerProps> = ({
  isOpen,
  onClose,
}) => {
  const { permissionMode, setPermissionMode, language } = useSettings();
  const isVi = language === "vi";

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 999,
        }}
      />
      {/* Dropdown container */}
      <div
        style={{
          position: "absolute",
          bottom: "calc(100% + 8px)",
          left: 0,
          width: "320px",
          backgroundColor: "var(--vscode-sideBar-background)",
          border: "1px solid var(--vscode-widget-border)",
          borderRadius: "8px",
          zIndex: 1000,
          boxShadow: "0 -4px 16px rgba(0,0,0,0.25)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "10px 14px",
            borderBottom: "1px solid var(--vscode-widget-border)",
            fontSize: "11px",
            fontWeight: 600,
            opacity: 0.8,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: "var(--vscode-foreground)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{isVi ? "Chế độ Quyền hạn" : "Permission Mode"}</span>
        </div>

        {/* Mode list */}
        <div style={{ maxHeight: "360px", overflowY: "auto", padding: "6px" }}>
          {PERMISSION_MODES.map((mode) => {
            const isSelected = permissionMode === mode.id;
            const label = isVi ? mode.labelVi : mode.labelEn;
            const desc = isVi ? mode.descVi : mode.descEn;

            return (
              <div
                key={mode.id}
                onClick={() => {
                  setPermissionMode(mode.id as PermissionMode);
                }}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "10px",
                  padding: "8px 10px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  marginBottom: "4px",
                  transition: "all 0.15s ease-in-out",
                  backgroundColor: isSelected
                    ? "var(--vscode-list-activeSelectionBackground)"
                    : "transparent",
                  color: isSelected
                    ? "var(--vscode-list-activeSelectionForeground)"
                    : "var(--vscode-foreground)",
                  border: isSelected
                    ? "1px solid var(--vscode-focusBorder, rgba(0,0,0,0.2))"
                    : "1px solid transparent",
                }}
                onMouseEnter={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor =
                      "var(--vscode-list-hoverBackground)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isSelected) {
                    e.currentTarget.style.backgroundColor = "transparent";
                  }
                }}
              >
                {/* Icon wrapper */}
                <div
                  style={{
                    width: "24px",
                    height: "24px",
                    borderRadius: "4px",
                    backgroundColor: isSelected
                      ? "rgba(255, 255, 255, 0.12)"
                      : `${mode.color}1A`,
                    color: isSelected ? "inherit" : mode.color,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    marginTop: "2px",
                  }}
                >
                  {mode.icon}
                </div>

                {/* Text content */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "2px",
                    flex: 1,
                  }}
                >
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      lineHeight: "1.2",
                    }}
                  >
                    {label}
                  </span>
                  <span
                    style={{
                      fontSize: "10.5px",
                      opacity: isSelected ? 0.9 : 0.6,
                      lineHeight: "1.3",
                    }}
                  >
                    {desc}
                  </span>
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
