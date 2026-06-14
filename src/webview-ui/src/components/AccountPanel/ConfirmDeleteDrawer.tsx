import React from "react";
import { Loader2 } from "lucide-react";

interface ConfirmDeleteDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  loading: boolean;
  title: string;
  count: number;
}

const ConfirmDeleteDrawer: React.FC<ConfirmDeleteDrawerProps> = ({
  open,
  onOpenChange,
  onConfirm,
  loading,
  title,
  count,
}) => {
  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0,0,0,0.5)",
          zIndex: 200,
          animation: "cdFadeIn 0.15s ease",
        }}
        onClick={() => !loading && onOpenChange(false)}
      />

      {/* Bottom Sheet */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: "var(--tertiary-bg)",
          borderTop: "1px solid var(--border-color)",
          borderTopLeftRadius: "16px",
          borderTopRightRadius: "16px",
          boxShadow: "0 -8px 32px rgba(0,0,0,0.25)",
          zIndex: 201,
          animation: "cdSlideUp 0.22s ease",
          padding: "0 0 max(20px, env(safe-area-inset-bottom)) 0",
        }}
      >
        {/* Drag handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 6px" }}>
          <div style={{ width: "32px", height: "3px", borderRadius: "2px", backgroundColor: "var(--border-color)" }} />
        </div>

        {/* Content */}
        <div style={{ padding: "4px 16px 16px" }}>
          {/* Icon + text row */}
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "14px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                backgroundColor: "var(--vscode-inputValidation-errorBackground, rgba(239,68,68,0.1))",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="var(--vscode-errorForeground)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M3 6h18" />
                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
              </svg>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: "14px",
                  fontWeight: 600,
                  color: "var(--primary-text)",
                  marginBottom: "2px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {title}
              </div>
              <div style={{ fontSize: "11px", color: "var(--secondary-text)", opacity: 0.75 }}>
                {count > 1
                  ? `${count} accounts will be permanently removed.`
                  : "This account will be permanently removed."}
              </div>
            </div>
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              onClick={() => onOpenChange(false)}
              disabled={loading}
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: "8px",
                backgroundColor: "rgba(128,128,128,0.1)",
                border: "none",
                color: "var(--secondary-text)",
                fontSize: "12px",
                fontWeight: 500,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.5 : 1,
                transition: "opacity 0.15s ease",
              }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.backgroundColor = "rgba(128,128,128,0.18)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "rgba(128,128,128,0.1)"; }}
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              style={{
                flex: 1,
                padding: "8px 12px",
                borderRadius: "8px",
                backgroundColor: "var(--vscode-inputValidation-errorBackground, rgba(239,68,68,0.15))",
                border: "none",
                color: "var(--vscode-errorForeground)",
                fontSize: "12px",
                fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                opacity: loading ? 0.7 : 1,
                transition: "opacity 0.15s ease",
              }}
              onMouseEnter={(e) => { if (!loading) e.currentTarget.style.opacity = "0.8"; }}
              onMouseLeave={(e) => { e.currentTarget.style.opacity = loading ? "0.7" : "1"; }}
            >
              {loading && (
                <Loader2 size={12} style={{ animation: "cdSpin 1s linear infinite" }} />
              )}
              {loading ? "Deleting…" : "Delete"}
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes cdSlideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes cdFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes cdSpin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </>
  );
};

export default ConfirmDeleteDrawer;
