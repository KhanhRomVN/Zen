import React, { useState, useEffect } from "react";
import { AlertTriangle, Check, X, HardDrive } from "lucide-react";

interface LargeBinaryFile {
  filePath: string;
  extension: string;
  size: number;
}

interface LargeBinaryBackupDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  files: LargeBinaryFile[];
  onDecision: (extension: string, allow: boolean) => void;
}

const LargeBinaryBackupDrawer: React.FC<LargeBinaryBackupDrawerProps> = ({
  isOpen,
  onClose,
  files,
  onDecision,
}) => {
  if (!isOpen || files.length === 0) return null;

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  return (
    <div
      className="fixed bottom-0 left-0 right-0 z-[101] bg-[var(--vscode-sideBar-background)] border-t border-[var(--vscode-panel-border)] shadow-2xl transition-all duration-300 transform translate-y-0 flex flex-col"
      style={{
        maxHeight: "350px",
      }}
    >
      <div className="p-4 border-b border-[var(--vscode-panel-border)] flex items-center justify-between bg-[var(--vscode-editor-background)]">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-[var(--vscode-problemsWarningIcon-foreground)] bg-opacity-10 rounded">
            <AlertTriangle
              className="text-[var(--vscode-problemsWarningIcon-foreground)]"
              size={18}
            />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--vscode-foreground)]">
              Large Binary Files Detected
            </h3>
            <p className="text-[10px] text-[var(--vscode-descriptionForeground)]">
              Confirm if you want to keep these files in your backup history.
            </p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 hover:bg-[var(--vscode-toolbar-hoverBackground)] rounded transition-colors text-[var(--vscode-descriptionForeground)]"
        >
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
        <div className="space-y-1">
          {files.map((file, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-2 rounded hover:bg-[var(--vscode-list-hoverBackground)] group transition-colors"
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <HardDrive
                  size={14}
                  className="text-[var(--vscode-descriptionForeground)] flex-shrink-0"
                />
                <div className="flex flex-col min-w-0">
                  <span className="text-xs text-[var(--vscode-foreground)] truncate font-mono">
                    {file.filePath.split("/").pop()}
                  </span>
                  <span className="text-[10px] text-[var(--vscode-descriptionForeground)]">
                    {formatSize(file.size)} (.{file.extension})
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onDecision(file.extension, true)}
                  className="p-1.5 text-[var(--vscode-gitDecoration-addedResourceForeground)] hover:bg-[var(--vscode-gitDecoration-addedResourceForeground)] hover:bg-opacity-10 rounded transition-colors"
                  title="Keep Always"
                >
                  <Check size={14} />
                </button>
                <button
                  onClick={() => onDecision(file.extension, false)}
                  className="p-1.5 text-[var(--vscode-gitDecoration-deletedResourceForeground)] hover:bg-[var(--vscode-gitDecoration-deletedResourceForeground)] hover:bg-opacity-10 rounded transition-colors"
                  title="Never Backup"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="p-3 bg-[var(--vscode-editor-background)] border-t border-[var(--vscode-panel-border)] flex gap-2">
        <button
          onClick={() => {
            // Apply Keep to all extensions in list
            const extensions = Array.from(
              new Set(files.map((f) => f.extension)),
            );
            extensions.forEach((ext) => onDecision(ext, true));
            onClose();
          }}
          className="flex-1 py-1.5 bg-[var(--vscode-button-background)] hover:bg-[var(--vscode-button-hoverBackground)] text-[var(--vscode-button-foreground)] rounded text-xs font-medium transition-colors"
        >
          Keep All
        </button>
        <button
          onClick={() => {
            // Apply Delete to all extensions in list
            const extensions = Array.from(
              new Set(files.map((f) => f.extension)),
            );
            extensions.forEach((ext) => onDecision(ext, false));
            onClose();
          }}
          className="flex-1 py-1.5 bg-[var(--vscode-button-secondaryBackground)] hover:bg-[var(--vscode-button-secondaryHoverBackground)] text-[var(--vscode-button-secondaryForeground)] rounded text-xs font-medium transition-colors"
        >
          Discard All
        </button>
      </div>
    </div>
  );
};

export default LargeBinaryBackupDrawer;
