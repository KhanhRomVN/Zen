/**
 * ------------------------------------------------------------------
 * ConfirmDeleteAccountDrawer
 * ------------------------------------------------------------------
 * Bottom-sheet drawer xác nhận xóa tài khoản.
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
import React from "react";
import { Loader2, Trash2 } from "lucide-react";
import { getFaviconUrl } from "@/utils/favicon";

// ─── Interfaces ─────────────────────────────────────────────────────────
interface ConfirmDeleteAccountDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
  loading: boolean;
  email?: string;
  providerName?: string;
  websiteUrl?: string;
  count: number;
}

// ─── Component ──────────────────────────────────────────────────────────
const ConfirmDeleteAccountDrawer: React.FC<ConfirmDeleteAccountDrawerProps> = ({
  open,
  onOpenChange,
  onConfirm,
  loading,
  email,
  providerName,
  websiteUrl,
  count,
}) => {
  if (!open) return null;

  const faviconUrl = websiteUrl ? getFaviconUrl(websiteUrl) : null;
  const isBulk = count > 1;

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
          padding: "0",
        }}
      >
        {/* Drag handle */}
        <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 6px" }}>
          <div style={{ width: "32px", height: "3px", borderRadius: "2px", backgroundColor: "var(--border-color)" }} />
        </div>

        {/* Content */}
        <div style={{ padding: "12px 16px 16px", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>

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
            Delete Account?
          </div>

          {/* Account info */}
          <div
            style={{
              fontSize: "12px",
              color: "var(--secondary-text)",
              opacity: 0.8,
              textAlign: "center",
              lineHeight: 1.5,
            }}
          >
            {isBulk ? (
              <span>Do you want to permanently delete {count} selected accounts? This action cannot be undone.</span>
            ) : (
              <span>
                Do you want to permanently delete
                {(providerName || email) && (
                  <>
                    {" "}the account
                    {faviconUrl && (
                      <img
                        src={faviconUrl}
                        alt=""
                        width={12}
                        height={12}
                        style={{ borderRadius: "2px", flexShrink: 0, verticalAlign: "middle", margin: "0 3px" }}
                        onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                      />
                    )}
                    {providerName && <strong style={{ color: "var(--primary-text)", fontWeight: 600 }}>{providerName}</strong>}
                    {providerName && email && " · "}
                    {email && <strong style={{ color: "var(--primary-text)", fontWeight: 600 }}>{email}</strong>}
                  </>
                )}
                ? This action cannot be undone.
              </span>
            )}
          </div>

          {/* Buttons */}
          <div style={{ display: "flex", gap: "8px", width: "100%", marginTop: "4px" }}>
            <button
              onClick={() => onOpenChange(false)}
              disabled={loading}
              style={{
                flex: 1,
                padding: "9px",
                borderRadius: "9px",
                backgroundColor: "rgba(128,128,128,0.08)",
                border: "none",
                color: "var(--secondary-text)",
                fontSize: "12px",
                fontWeight: 500,
                cursor: loading ? "not-allowed" : "pointer",
                opacity: loading ? 0.5 : 1,
                whiteSpace: "nowrap",
              }}
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              disabled={loading}
              style={{
                flex: 1,
                padding: "9px",
                borderRadius: "9px",
                backgroundColor: "rgba(239,68,68,0.12)",
                border: "none",
                color: "var(--vscode-errorForeground, #ef4444)",
                fontSize: "12px",
                fontWeight: 600,
                cursor: loading ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                opacity: loading ? 0.7 : 1,
                whiteSpace: "nowrap",
              }}
            >
              {loading && <Loader2 size={12} style={{ animation: "cdSpin 1s linear infinite" }} />}
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

export default ConfirmDeleteAccountDrawer;
