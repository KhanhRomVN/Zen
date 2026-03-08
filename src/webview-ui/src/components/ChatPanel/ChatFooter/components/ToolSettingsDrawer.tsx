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
  ShieldCheck,
  Terminal,
  BookOpen,
  Edit3,
  Layout,
  Crosshair,
  Link,
  X,
} from "lucide-react";

interface ToolSettingsDrawerProps {
  isOpen: boolean;
  onClose: () => void;
}

const TOOL_DESCRIPTIONS: Record<string, string> = {
  read_file: "Read the content of any file.",
  write_to_file: "Create or overwrite a file entirely.",
  replace_in_file: "Edit code using search and replace blocks.",
  list_files: "List files and directories in a path.",
  search_files: "Search for text strings across the codebase.",
  ask_bypass_gitignore: "Request permission to access ignored files.",
  run_command: "Execute a terminal command (bash/sh).",
  read_workspace_context: "Read the project's workspace.md knowledge file.",
  update_workspace_context: "Update the project's workspace.md knowledge file.",
  get_file_outline: "Get the class and function structure of a file.",
  get_symbol_definition: "Find the definition of a specific symbol.",
  get_references: "Find all references to a specific symbol.",
};

const TOOL_ICONS: Record<string, React.ReactNode> = {
  read_file: <FileText size={16} />,
  write_to_file: <FilePlus size={16} />,
  replace_in_file: <FileCode size={16} />,
  list_files: <List size={16} />,
  search_files: <Search size={16} />,
  ask_bypass_gitignore: <ShieldCheck size={16} />,
  run_command: <Terminal size={16} />,
  read_workspace_context: <BookOpen size={16} />,
  update_workspace_context: <Edit3 size={16} />,
  get_file_outline: <Layout size={16} />,
  get_symbol_definition: <Crosshair size={16} />,
  get_references: <Link size={16} />,
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
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0,0,0,0.4)",
          zIndex: 1000,
          backdropFilter: "blur(2px)",
        }}
      />
      {/* Drawer */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          height: "60%",
          backgroundColor: "var(--vscode-sideBar-background)",
          borderTop: "1px solid var(--vscode-widget-border)",
          zIndex: 1001,
          display: "flex",
          flexDirection: "column",
          padding: "16px",
          boxShadow: "0 -4px 12px rgba(0,0,0,0.2)",
          borderTopLeftRadius: "12px",
          borderTopRightRadius: "12px",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "16px",
          }}
        >
          <span style={{ fontWeight: 600, fontSize: "14px", opacity: 0.9 }}>
            Tool Execution Permissions
          </span>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "var(--vscode-foreground)",
              cursor: "pointer",
              opacity: 0.7,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div
          style={{
            flex: 1,
            overflowY: "auto",
            display: "grid",
            gridTemplateColumns: "1fr",
            gap: "12px",
            paddingBottom: "20px",
          }}
        >
          {Object.keys(defaultToolPermissions).map((toolId) => {
            const permission = toolPermissions[toolId] || "auto";
            const toolColor = getToolColor(toolId as any);

            return (
              <div
                key={toolId}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "4px 0",
                }}
              >
                {/* Tool Icon */}
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "6px",
                    backgroundColor: `${toolColor}1A`,
                    color: toolColor,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {TOOL_ICONS[toolId] || <Terminal size={16} />}
                </div>

                {/* Info */}
                <div
                  style={{ flex: 1, display: "flex", flexDirection: "column" }}
                >
                  <span
                    style={{
                      fontSize: "12px",
                      fontWeight: 600,
                      fontFamily: "monospace",
                    }}
                  >
                    {toolId}
                  </span>
                  <span
                    style={{
                      fontSize: "11px",
                      opacity: 0.6,
                      marginTop: "2px",
                    }}
                  >
                    {TOOL_DESCRIPTIONS[toolId]}
                  </span>
                </div>

                {/* Toggle logic */}
                <div
                  style={{
                    display: "flex",
                    backgroundColor: "var(--vscode-editor-background)",
                    borderRadius: "6px",
                    padding: "2px",
                    border: "1px solid var(--vscode-widget-border)",
                  }}
                >
                  <button
                    onClick={() => setToolPermission(toolId, "auto")}
                    style={{
                      padding: "2px 8px",
                      fontSize: "10px",
                      borderRadius: "4px",
                      border: "none",
                      cursor: "pointer",
                      backgroundColor:
                        permission === "auto"
                          ? "var(--vscode-button-background)"
                          : "transparent",
                      color:
                        permission === "auto"
                          ? "var(--vscode-button-foreground)"
                          : "var(--vscode-foreground)",
                      fontWeight: 500,
                    }}
                  >
                    Auto
                  </button>
                  <button
                    onClick={() => setToolPermission(toolId, "request")}
                    style={{
                      padding: "2px 8px",
                      fontSize: "10px",
                      borderRadius: "4px",
                      border: "none",
                      cursor: "pointer",
                      backgroundColor:
                        permission === "request"
                          ? "var(--vscode-button-background)"
                          : "transparent",
                      color:
                        permission === "request"
                          ? "var(--vscode-button-foreground)"
                          : "var(--vscode-foreground)",
                      fontWeight: 500,
                    }}
                  >
                    Request
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
