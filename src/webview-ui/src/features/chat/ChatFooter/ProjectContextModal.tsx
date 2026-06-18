import React, { useState, useEffect } from "react";

interface ProjectContext {
  projectName: string;
  language: string;
  description: string;
  keyFiles: string; // Stored as text, parsed as needed
}

interface ProjectContextModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialContext: ProjectContext | null;
  onSave: (context: ProjectContext) => void;
}

const ProjectContextModal: React.FC<ProjectContextModalProps> = ({
  isOpen,
  onClose,
  initialContext,
  onSave,
}) => {
  const [context, setContext] = useState<ProjectContext>({
    projectName: "",
    language: "",
    description: "",
    keyFiles: "",
  });

  useEffect(() => {
    if (isOpen) {
      if (initialContext) {
        setContext(initialContext);
      } else {
        // Reset or keep defaults if strictly null
        setContext({
          projectName: "",
          language: "",
          description: "",
          keyFiles: "",
        });
      }
    }
  }, [isOpen, initialContext]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          backgroundColor: "var(--vscode-editor-background)",
          border: "1px solid var(--vscode-widget-border)",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.4)",
          borderRadius: "6px",
          width: "500px",
          maxWidth: "90vw",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <div>
          <h3 style={{ margin: 0, color: "var(--vscode-editor-foreground)" }}>
            Project Context
          </h3>
          <p
            style={{
              margin: "8px 0 0",
              fontSize: "12px",
              color: "var(--vscode-descriptionForeground)",
            }}
          >
            Provide high-level context about this project for the AI. This will
            be injected into the first prompt of a conversation.
          </p>
        </div>

        {/* Form Fields */}
        <div style={{ display: "flex", gap: "10px" }}>
          <div style={{ flex: 1 }}>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                marginBottom: "4px",
                color: "var(--vscode-input-placeholderForeground)",
              }}
            >
              Project Name
            </label>
            <input
              type="text"
              value={context.projectName}
              onChange={(e) =>
                setContext((prev) => ({ ...prev, projectName: e.target.value }))
              }
              style={{
                width: "100%",
                padding: "8px",
                backgroundColor: "var(--vscode-input-background)",
                color: "var(--vscode-input-foreground)",
                border: "1px solid var(--vscode-input-border)",
                outline: "none",
              }}
              placeholder="e.g. Zen Extension"
            />
          </div>
          <div style={{ flex: 1 }}>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                marginBottom: "4px",
                color: "var(--vscode-input-placeholderForeground)",
              }}
            >
              Main Language
            </label>
            <input
              type="text"
              value={context.language}
              onChange={(e) =>
                setContext((prev) => ({ ...prev, language: e.target.value }))
              }
              style={{
                width: "100%",
                padding: "8px",
                backgroundColor: "var(--vscode-input-background)",
                color: "var(--vscode-input-foreground)",
                border: "1px solid var(--vscode-input-border)",
                outline: "none",
              }}
              placeholder="e.g. TypeScript"
            />
          </div>
        </div>

        <div>
          <label
            style={{
              display: "block",
              fontSize: "12px",
              marginBottom: "4px",
              color: "var(--vscode-input-placeholderForeground)",
            }}
          >
            Description
          </label>
          <textarea
            value={context.description}
            onChange={(e) =>
              setContext((prev) => ({ ...prev, description: e.target.value }))
            }
            style={{
              width: "100%",
              height: "80px",
              padding: "8px",
              backgroundColor: "var(--vscode-input-background)",
              color: "var(--vscode-input-foreground)",
              border: "1px solid var(--vscode-input-border)",
              outline: "none",
              resize: "vertical",
            }}
            placeholder="Briefly describe what this project does..."
          />
        </div>

        <div>
          <label
            style={{
              display: "block",
              fontSize: "12px",
              marginBottom: "4px",
              color: "var(--vscode-input-placeholderForeground)",
            }}
          >
            Key Files (List root files or important modules)
          </label>
          <textarea
            value={context.keyFiles}
            onChange={(e) =>
              setContext((prev) => ({ ...prev, keyFiles: e.target.value }))
            }
            style={{
              width: "100%",
              height: "80px",
              padding: "8px",
              backgroundColor: "var(--vscode-input-background)",
              color: "var(--vscode-input-foreground)",
              border: "1px solid var(--vscode-input-border)",
              outline: "none",
              resize: "vertical",
            }}
            placeholder="src/extension.ts - Main entry point&#10;src/webview-ui - Frontend code"
          />
        </div>

        {/* Footer Buttons */}
        <div
          style={{
            display: "flex",
            justifyContent: "flex-end",
            gap: "10px",
            marginTop: "10px",
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "6px 12px",
              background: "transparent",
              color: "var(--vscode-button-foreground)",
              border: "1px solid var(--vscode-button-border, transparent)",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(context)}
            style={{
              padding: "6px 12px",
              backgroundColor: "var(--vscode-button-background)",
              color: "var(--vscode-button-foreground)",
              border: "none",
              cursor: "pointer",
            }}
          >
            Save Context
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProjectContextModal;
