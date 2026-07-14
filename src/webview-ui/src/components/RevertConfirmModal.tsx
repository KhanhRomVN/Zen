import React from "react";
import { createPortal } from "react-dom";

interface RevertConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title?: string;
  description?: string;
}

const RevertConfirmModal: React.FC<RevertConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title = "Revert conversation?",
  description = "This will restore all modified files to their state before this message. Messages after this point will be removed.",
}) => {
  if (!isOpen) return null;

  return createPortal(
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        backgroundColor: "rgba(0,0,0,0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "var(--vscode-editor-background)",
          border: "1px solid var(--border-color)",
          borderRadius: "8px",
          padding: "20px 24px",
          minWidth: "300px",
          maxWidth: "400px",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            fontWeight: 600,
            fontSize: "14px",
            marginBottom: "8px",
          }}
        >
          {title}
        </div>
        <div
          style={{
            fontSize: "12px",
            color: "var(--secondary-text)",
            marginBottom: "16px",
          }}
        >
          {description}
        </div>
        <div
          style={{
            display: "flex",
            gap: "8px",
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "5px 14px",
              borderRadius: "4px",
              fontSize: "12px",
              cursor: "pointer",
              background: "transparent",
              border: "1px solid var(--border-color)",
              color: "var(--primary-text)",
            }}
          >
            Cancel
          </button>
          <button
            onClick={() => {
              onClose();
              onConfirm();
            }}
            style={{
              padding: "5px 14px",
              borderRadius: "4px",
              fontSize: "12px",
              cursor: "pointer",
              background: "var(--vscode-button-background)",
              border: "none",
              color: "var(--vscode-button-foreground)",
              fontWeight: 600,
            }}
          >
            Revert
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default RevertConfirmModal;