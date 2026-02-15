import React from "react";

interface ConfirmDialogProps {
  isOpen: boolean;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
  confirmText?: string;
  cancelText?: string;
}

const ConfirmDialog: React.FC<ConfirmDialogProps> = ({
  isOpen,
  message,
  onConfirm,
  onCancel,
  confirmText = "Confirm",
  cancelText = "Cancel",
}) => {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: "rgba(0, 0, 0, 0.5)",
          zIndex: 9999,
        }}
        onClick={onCancel}
      />
      {/* Dialog */}
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          backgroundColor: "var(--primary-bg)",
          border: "1px solid var(--border-color)",
          borderRadius: "var(--border-radius-lg)",
          padding: "var(--spacing-lg)",
          zIndex: 10000,
          minWidth: "300px",
          maxWidth: "500px",
          boxShadow: "0 4px 12px rgba(0, 0, 0, 0.3)",
        }}
      >
        <div
          style={{
            marginBottom: "var(--spacing-lg)",
            color: "var(--primary-text)",
            fontSize: "var(--font-size-md)",
            lineHeight: "1.5",
          }}
        >
          {message}
        </div>
        <div
          style={{
            display: "flex",
            gap: "var(--spacing-sm)",
            justifyContent: "flex-end",
          }}
        >
          <button
            onClick={onCancel}
            style={{
              padding: "var(--spacing-sm) var(--spacing-md)",
              backgroundColor: "var(--button-secondary)",
              color: "var(--primary-text)",
              border: "1px solid var(--border-color)",
              borderRadius: "var(--border-radius)",
              cursor: "pointer",
              fontSize: "var(--font-size-sm)",
              fontWeight: 500,
            }}
          >
            {cancelText}
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: "var(--spacing-sm) var(--spacing-md)",
              backgroundColor: "var(--error-color)",
              color: "#ffffff",
              border: "none",
              borderRadius: "var(--border-radius)",
              cursor: "pointer",
              fontSize: "var(--font-size-sm)",
              fontWeight: 500,
            }}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </>
  );
};

export default ConfirmDialog;
