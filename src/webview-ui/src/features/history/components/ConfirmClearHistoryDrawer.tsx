/**
 * ------------------------------------------------------------------
 * ConfirmClearHistoryDrawer
 * ------------------------------------------------------------------
 * Bottom-sheet drawer xác nhận xóa toàn bộ lịch sử hội thoại.
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
import React from "react";
import { Trash2 } from "lucide-react";

// ─── Interfaces ─────────────────────────────────────────────────────────
interface ConfirmClearHistoryDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  totalCount?: number;
}

// ─── Component ──────────────────────────────────────────────────────────
const ConfirmClearHistoryDrawer: React.FC<ConfirmClearHistoryDrawerProps> = ({
  open,
  onOpenChange,
  onConfirm,
  totalCount,
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
          animation: "cchFadeIn 0.15s ease",
        }}
        onClick={() => onOpenChange(false)}
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
          animation: "cchSlideUp 0.22s ease",
        }}
      >
        {/* Drag handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 6px" }}>
          <div
            style={{
              width: "32px",
              height: "3px",
              borderRadius: "2px",
              backgroundColor: "var(--border-color)",
            }}
          />
        </div>

        {/* Content */}
        <div
          style={{
            padding: "12px 16px 16px",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "10px",
          }}
        >
          {/* Badge icon */}
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "10px",
              backgroundColor: "rgba(239,68,68,0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Trash2 size={20} color="var(--vscode-errorForeground, #ef4444)" />
          </div>

          {/* Title */}
          <div
            style={{
              fontSize: "15px",
              fontWeight: 700,
              color: "var(--primary-text)",
              textAlign: "center",
            }}
          >
            Clear All History?
          </div>

          {/* Description */}
          <div
            style={{
              fontSize: "12px",
              color: "var(--secondary-text)",
              opacity: 0.8,
              textAlign: "center",
              lineHeight: 1.5,
            }}
          >
            {totalCount !== undefined && totalCount > 0 ? (
              <span>
                This will permanently delete{" "}
                <strong style={{ color: "var(--primary-text)" }}>
                  {totalCount} conversation{totalCount > 1 ? "s" : ""}
                </strong>
                . This action cannot be undone.
              </span>
            ) : (
              <span>
                This will permanently delete all saved conversations. This action cannot be undone.
              </span>
            )}
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", gap: "8px", width: "100%", marginTop: "4px" }}>
            <button
              onClick={() => onOpenChange(false)}
              style={{
                flex: 1,
                padding: "9px",
                borderRadius: "9px",
                backgroundColor: "rgba(128,128,128,0.08)",
                border: "none",
                color: "var(--secondary-text)",
                fontSize: "12px",
                fontWeight: 500,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onConfirm();
                onOpenChange(false);
              }}
              style={{
                flex: 1,
                padding: "9px",
                borderRadius: "9px",
                backgroundColor: "rgba(239,68,68,0.12)",
                border: "none",
                color: "var(--vscode-errorForeground, #ef4444)",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                whiteSpace: "nowrap",
              }}
            >
              <Trash2 size={12} />
              Delete All
            </button>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes cchSlideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
        @keyframes cchFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
    </>
  );
};

export default ConfirmClearHistoryDrawer;
