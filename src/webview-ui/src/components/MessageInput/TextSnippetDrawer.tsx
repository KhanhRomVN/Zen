import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface TextSnippetDrawerProps {
  isOpen: boolean;
  content: string;
  title: string;
  onClose: () => void;
}

const TextSnippetDrawer: React.FC<TextSnippetDrawerProps> = ({
  isOpen,
  content,
  title,
  onClose,
}) => {
  const drawerRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Prevent body scroll when drawer is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const drawerContent = (
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
          zIndex: 99998,
          animation: "fadeIn 0.2s ease-out",
        }}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          maxHeight: "70vh",
          backgroundColor: "var(--vscode-editor-background, #1e1e1e)",
          borderTop: "1px solid var(--border-color)",
          boxShadow: "0 -4px 12px rgba(0, 0, 0, 0.3)",
          zIndex: 99999,
          display: "flex",
          flexDirection: "column",
          animation: "slideUp 0.3s ease-out",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "12px 16px 12px 16px",
            borderBottom: "1px solid var(--vscode-editorWidget-border, rgba(128, 128, 128, 0.3))",
            backgroundColor: "var(--vscode-editor-background, #1e1e1e)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
            }}
          >
            {/* Title and Description */}
            <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
              <h3
                style={{
                  margin: 0,
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "var(--vscode-foreground, #ffffff)",
                }}
              >
                Text Snippet
              </h3>
              <div
                style={{
                  fontSize: "11px",
                  color: "var(--vscode-descriptionForeground, #888)",
                }}
              >
                Large pasted text content
              </div>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "6px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "4px",
              color: "var(--vscode-foreground, #ffffff)",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(244, 67, 54, 0.15)";
              e.currentTarget.style.color = "#f44336";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "var(--vscode-foreground, #ffffff)";
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content */}
        <div
          style={{
            flex: 1,
            overflow: "auto",
            padding: "16px",
          }}
        >
          <pre
            style={{
              margin: 0,
              fontFamily: "var(--vscode-editor-font-family, 'Courier New', monospace)",
              fontSize: "11px",
              lineHeight: "1.5",
              color: "var(--vscode-editor-foreground, #d4d4d4)",
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {content}
          </pre>
        </div>
      </div>

      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </>
  );

  // Use portal to render at document body level
  return createPortal(drawerContent, document.body);
};

export default TextSnippetDrawer;
