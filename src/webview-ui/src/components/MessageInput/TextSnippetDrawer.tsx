import React, { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

interface TextSnippetDrawerProps {
  isOpen: boolean;
  content: string;
  title: string;
  onClose: () => void;
  snippetNumber?: number; // For displaying "Snippet[1]"
  lineCount?: number; // For displaying line count
}

const TextSnippetDrawer: React.FC<TextSnippetDrawerProps> = ({
  isOpen,
  content,
  title,
  onClose,
  snippetNumber,
  lineCount,
}) => {
  const drawerRef = useRef<HTMLDivElement>(null);

  // Format title
  const displayTitle = snippetNumber && lineCount 
    ? `Snippet[${snippetNumber}] (${lineCount} lines)`
    : title;

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
          borderTopLeftRadius: "24px",
          borderTopRightRadius: "24px",
          boxShadow: "0 -4px 12px rgba(0, 0, 0, 0.3)",
          zIndex: 99999,
          display: "flex",
          flexDirection: "column",
          animation: "slideUp 0.3s ease-out",
        }}
      >
        {/* Drag Handle */}
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            paddingTop: "8px",
            paddingBottom: "4px",
            backgroundColor: "var(--vscode-editor-background, #1e1e1e)",
            borderTopLeftRadius: "24px",
            borderTopRightRadius: "24px",
          }}
        >
          <div
            style={{
              width: "40px",
              height: "4px",
              backgroundColor: "var(--vscode-editorWidget-border, rgba(128, 128, 128, 0.5))",
              borderRadius: "2px",
            }}
          />
        </div>

        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 16px 12px 16px",
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
            {/* Icon Badge */}
            <div
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "var(--vscode-editor-background, rgba(128, 128, 128, 0.1))",
                border: "1.5px solid var(--vscode-editorWidget-border, rgba(128, 128, 128, 0.4))",
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
                <line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
                <line x1="10" y1="9" x2="8" y2="9" />
              </svg>
            </div>
            
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
                {displayTitle}
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
