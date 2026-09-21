/**
 * ------------------------------------------------------------------
 * EditAccountDrawer
 * ------------------------------------------------------------------
 * Bottom-sheet drawer chỉnh sửa email + credential của một account.
 * Nếu credential là JSON, các key được flatten thành từng field riêng
 * (ví dụ credential.accessToken, credential.refreshToken...).
 *
 * Main features:
 * - Field động: email + các key trong credential (JSON) hoặc credential thô
 * - Auto-switch input ↔ textarea khi nội dung vượt quá 1 dòng
 *   (textarea có max-height ~5 dòng, sau đó scroll)
 * - Lưu qua PUT /v1/accounts/:id
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── React ──
import React, { useEffect, useMemo, useState } from "react";

// ── UI ──
import { Loader2, X, AlertCircle } from "lucide-react";
import { getFaviconUrl } from "@/utils/favicon";

// ── Hooks ──
import { useDbFetch } from "../../../services/useDbFetch";

// ── Types ──
import { FlatAccount } from "../types";

// ─── Interfaces ─────────────────────────────────────────────────────────
interface EditAccountDrawerProps {
  open: boolean;
  account: FlatAccount | null;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
  /** Provider config để hiển thị favicon + provider_name trong header */
  providerConfig?: { provider_name?: string; website?: string } | null;
}

// Số ký tự tối đa để ước lượng field chỉ chiếm 1 dòng.
// Vượt ngưỡng này → tự động chuyển sang textarea.
const SINGLE_LINE_CHAR_THRESHOLD = 60;

// ─── AutoField ──────────────────────────────────────────────────────────
/**
 * Field input tự động chuyển giữa input 1 dòng và textarea nhiều dòng.
 * Textarea giới hạn max-height ~5 dòng (khoảng 5 * 18px + padding).
 */
const AutoField: React.FC<{
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}> = ({ label, value, onChange, disabled }) => {
  const useTextarea = value.length > SINGLE_LINE_CHAR_THRESHOLD || value.includes("\n");

  const baseStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 12px",
    borderRadius: "8px",
    backgroundColor: "var(--input-bg)",
    border: "none",
    color: "var(--primary-text)",
    fontSize: "13px",
    fontFamily: useTextarea ? "monospace" : "inherit",
    outline: "none",
    boxSizing: "border-box",
    resize: "none",
    lineHeight: "18px",
  };

  return (
    <div style={{ minWidth: 0 }}>
      <label
        style={{
          fontSize: "11px",
          fontWeight: 500,
          color: "var(--secondary-text)",
          display: "block",
          marginBottom: "5px",
          fontFamily: "monospace",
        }}
      >
        {label}
      </label>
      {useTextarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          style={{
            ...baseStyle,
            minHeight: "34px",
            maxHeight: "108px", // ~5 dòng * 18px + padding
            overflowY: "auto",
            paddingTop: "8px",
            paddingBottom: "8px",
          }}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          style={{ ...baseStyle, height: "34px" }}
        />
      )}
    </div>
  );
};

// ─── Component ──────────────────────────────────────────────────────────
const EditAccountDrawer: React.FC<EditAccountDrawerProps> = ({
  open,
  account,
  onOpenChange,
  onSuccess,
  providerConfig,
}) => {
  // ── State ──
  const [email, setEmail] = useState("");
  // Map key → value của các field credential
  const [credFields, setCredFields] = useState<Array<{ key: string; value: string }>>([]);
  // Ghi nhớ credential ban đầu có phải JSON không (để rebuild khi save)
  const [credIsJson, setCredIsJson] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // ── Store ──
  const dbFetch = useDbFetch();

  // ── Derived ──
  // Parse credential thành các field khi account thay đổi
  const parsedInitial = useMemo(() => {
    if (!account) return { isJson: false, fields: [] as Array<{ key: string; value: string }> };
    const raw = (account.credential || "").trim();
    if (raw.startsWith("{")) {
      try {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
          return {
            isJson: true,
            fields: Object.entries(parsed).map(([k, v]) => ({
              key: k,
              value: typeof v === "string" ? v : JSON.stringify(v),
            })),
          };
        }
      } catch {
        // fallthrough — coi như string thô
      }
    }
    return {
      isJson: false,
      fields: raw ? [{ key: "credential", value: account.credential || "" }] : [],
    };
  }, [account]);

  // ── Effects ──
  useEffect(() => {
    if (!open || !account) return;
    setEmail(account.email || "");
    setCredFields(parsedInitial.fields);
    setCredIsJson(parsedInitial.isJson);
    setError("");
  }, [open, account, parsedInitial]);

  // ── Handlers ──
  const handleFieldChange = (key: string, value: string) => {
    setCredFields((prev) =>
      prev.map((f) => (f.key === key ? { ...f, value } : f)),
    );
  };

  const handleSave = async () => {
    if (!account) return;
    setSaving(true);
    setError("");
    try {
      // Build credential string
      let credential: string;
      if (credIsJson) {
        const obj: Record<string, string> = {};
        for (const f of credFields) obj[f.key] = f.value;
        credential = JSON.stringify(obj);
      } else {
        credential = credFields[0]?.value ?? "";
      }

      const response = await dbFetch(`/v1/accounts/${account.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), credential }),
      });
      const data = await response.json();
      if (data.success) {
        onSuccess();
        onOpenChange(false);
      } else {
        setError(data.message || "Failed to update account");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setSaving(false);
    }
  };

  if (!open || !account) return null;

  // ── Render ──
  return (
    <>
      <div
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0,0,0,0.55)",
          zIndex: 200,
          animation: "eaFadeIn 0.15s ease",
        }}
        onClick={() => onOpenChange(false)}
      />
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          backgroundColor: "var(--tertiary-bg)",
          borderTop: "1px solid var(--border-color)",
          boxShadow: "0 -8px 32px rgba(0,0,0,0.25)",
          zIndex: 201,
          maxHeight: "80%",
          display: "flex",
          flexDirection: "column",
          animation: "eaSlideUp 0.22s ease",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid var(--border-color)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
            <div>
              <div
                style={{
                  fontSize: "16px",
                  fontWeight: 700,
                  color: "var(--primary-text)",
                }}
              >
                Edit Account
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "5px",
                  fontSize: "11px",
                  color: "var(--secondary-text)",
                  opacity: 0.7,
                  minWidth: 0,
                }}
              >
                {providerConfig?.website && (
                  <img
                    src={getFaviconUrl(providerConfig.website, 16)}
                    alt=""
                    width={12}
                    height={12}
                    style={{ borderRadius: "2px", flexShrink: 0 }}
                    onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
                  />
                )}
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {providerConfig?.provider_name || account.provider_id}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={() => onOpenChange(false)}
            style={{
              padding: "6px",
              borderRadius: "4px",
              border: "none",
              background: "transparent",
              color: "var(--secondary-text)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(244,67,54,0.15)";
              e.currentTarget.style.color = "#f44336";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "var(--secondary-text)";
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Fields */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "14px 16px",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          <AutoField
            label="email"
            value={email}
            onChange={setEmail}
            disabled={saving}
          />

          {credFields.map((f) => (
            <AutoField
              key={f.key}
              label={f.key}
              value={f.value}
              onChange={(v) => handleFieldChange(f.key, v)}
              disabled={saving}
            />
          ))}

          {error && (
            <div
              style={{
                backgroundColor:
                  "var(--vscode-inputValidation-errorBackground, rgba(239,68,68,0.08))",
                borderRadius: "8px",
                padding: "8px 10px",
                fontSize: "12px",
                color: "var(--vscode-errorForeground)",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <AlertCircle size={12} />
              <span>{error}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div
          style={{
            padding: "12px 16px 12px",
            borderTop: "1px solid var(--border-color)",
            display: "flex",
            justifyContent: "flex-end",
            gap: "8px",
            flexShrink: 0,
          }}
        >
          <button
            onClick={() => onOpenChange(false)}
            disabled={saving}
            style={{
              padding: "8px 14px",
              borderRadius: "9px",
              backgroundColor: "rgba(128,128,128,0.08)",
              border: "none",
              color: "var(--secondary-text)",
              fontSize: "12px",
              fontWeight: 500,
              cursor: saving ? "not-allowed" : "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !email.trim()}
            style={{
              padding: "8px 14px",
              borderRadius: "9px",
              backgroundColor: "rgba(34,197,94,0.12)",
              border: "none",
              color: "var(--vscode-testing-iconPassed, #22c55e)",
              fontSize: "12px",
              fontWeight: 600,
              cursor: saving || !email.trim() ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: "6px",
              opacity: !email.trim() ? 0.5 : saving ? 0.7 : 1,
              whiteSpace: "nowrap",
            }}
          >
            {saving && (
              <Loader2
                size={13}
                style={{ animation: "eaSpin 1s linear infinite" }}
              />
            )}
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>

      <style>{`
        @keyframes eaSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes eaFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes eaSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
};

export default EditAccountDrawer;