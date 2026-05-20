import React from "react";
import {
  useSettings,
  defaultToolPermissions,
} from "../../../../context/SettingsContext";
import { getToolColor } from "../../ChatBody/utils";
import {
  FileText,
  FilePlus,
  FileCode,
  List,
  Search,
  Terminal,
} from "lucide-react";

interface ToolSettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const TOOL_ICONS: Record<string, React.ReactNode> = {
  read_file: <FileText size={14} />,
  write_to_file: <FilePlus size={14} />,
  replace_in_file: <FileCode size={14} />,
  list_files: <List size={14} />,
  search_files: <Search size={14} />,
  run_command: <Terminal size={14} />,
};

const ToolSettingsDrawer: React.FC<ToolSettingsDrawerProps> = ({
  isOpen,
  onClose,
}) => {
  const { toolPermissions, setToolPermission } = useSettings();

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
      {/* Dropdown */}
      <div
        style={{
          position: "absolute",
          bottom: "calc(100% + 8px)",
          left: 0,
          width: "280px",
          backgroundColor: "var(--vscode-sideBar-background)",
          border: "1px solid var(--vscode-widget-border)",
          borderRadius: "8px",
          zIndex: 1000,
          boxShadow: "0 -4px 16px rgba(0,0,0,0.25)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "8px 12px",
            borderBottom: "1px solid var(--vscode-widget-border)",
            fontSize: "11px",
            fontWeight: 600,
            opacity: 0.6,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
          }}
        >
          Tool Permissions
        </div>

        {/* Tool list */}
        <div style={{ maxHeight: "320px", overflowY: "auto" }}>
          {Object.keys(defaultToolPermissions).map((toolId) => {
            const permission = toolPermissions[toolId] || "full_access";
            const toolColor = getToolColor(toolId as any);

            return (
              <div
                key={toolId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "6px 12px",
                  borderBottom: "1px solid var(--vscode-widget-border)",
                }}
              >
                {/* Icon */}
                <div
                  style={{
                    width: "24px",
                    height: "24px",
                    borderRadius: "4px",
                    backgroundColor: `${toolColor}1A`,
                    color: toolColor,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {TOOL_ICONS[toolId] || <Terminal size={14} />}
                </div>

                {/* Tool name */}
                <span
                  style={{
                    flex: 1,
                    fontSize: "11px",
                    fontFamily: "monospace",
                    fontWeight: 500,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {toolId}
                </span>

                {/* Toggle */}
                <div
                  style={{
                    display: "flex",
                    backgroundColor: "var(--vscode-editor-background)",
                    borderRadius: "4px",
                    padding: "2px",
                    border: "1px solid var(--vscode-widget-border)",
                    flexShrink: 0,
                  }}
                >
                  <button
                    onClick={() => setToolPermission(toolId, "full_access")}
                    style={{
                      padding: "2px 7px",
                      fontSize: "10px",
                      borderRadius: "3px",
                      border: "none",
                      cursor: "pointer",
                      backgroundColor:
                        permission === "full_access"
                          ? "var(--vscode-button-background)"
                          : "transparent",
                      color:
                        permission === "full_access"
                          ? "var(--vscode-button-foreground)"
                          : "var(--vscode-foreground)",
                      fontWeight: 500,
                    }}
                  >
                    Full Access
                  </button>
                  <button
                    disabled
                    title="Review mode coming soon"
                    style={{
                      padding: "2px 7px",
                      fontSize: "10px",
                      borderRadius: "3px",
                      border: "none",
                      cursor: "not-allowed",
                      backgroundColor: "transparent",
                      color: "var(--vscode-foreground)",
                      fontWeight: 500,
                      opacity: 0.35,
                    }}
                  >
                    Review
                  </button>
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
