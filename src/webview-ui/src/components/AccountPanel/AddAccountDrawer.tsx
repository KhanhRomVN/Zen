import React, { useState, useEffect } from "react";
import { Loader2, X, AlertCircle, ShieldCheck } from "lucide-react";
import { useSettings } from "../../context/SettingsContext";

interface Provider {
  provider_id: string;
  provider_name: string;
  website: string;
  icon?: string;
  is_enabled?: boolean;
  auth_methods?: string[];
  platform?: string;
  connection_type?: string;
  auth_method?: string;
}

interface AddAccountDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

const getProviderIconUrl = (website: string) => {
  if (!website) return "";
  try {
    const url = new URL(website);
    return `${url.origin}/favicon.ico`;
  } catch {
    return "";
  }
};

// List row card
const ProviderRow: React.FC<{
  provider: Provider;
  onSelect: () => void;
  loading: boolean;
}> = ({ provider, onSelect, loading }) => {
  const [imgError, setImgError] = useState(false);
  const [hovered, setHovered] = useState(false);
  const iconUrl = getProviderIconUrl(provider.website);
  const disabled = provider.is_enabled === false || loading;

  const connectionType = provider.connection_type || "https";
  const platform = provider.platform || "web";
  const authMethod =
    provider.auth_method ||
    (provider.auth_methods && provider.auth_methods.length > 0 ? provider.auth_methods[0] : null);

  const connectionBadgeColor =
    connectionType === "browser"
      ? { bg: "rgba(251,146,60,0.12)", color: "var(--vscode-editorWarning-foreground, #f97316)" }
      : { bg: "rgba(34,197,94,0.1)", color: "var(--vscode-testing-iconPassed, #22c55e)" };

  return (
    <div
      onClick={() => !disabled && onSelect()}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "10px 12px",
        borderRadius: "10px",
        border: "1px solid var(--border-color)",
        backgroundColor: hovered && !disabled
          ? "var(--hover-bg, rgba(128,128,128,0.07))"
          : "var(--secondary-bg)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        transition: "all 0.13s ease",
      }}
    >
      {/* Favicon badge */}
      <div
        style={{
          width: "38px",
          height: "38px",
          borderRadius: "10px",
          backgroundColor: "rgba(128,128,128,0.1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          flexShrink: 0,
        }}
      >
        {iconUrl && !imgError ? (
          <img
            src={iconUrl}
            alt={provider.provider_name}
            style={{ width: "22px", height: "22px", objectFit: "contain" }}
            onError={() => setImgError(true)}
          />
        ) : (
          <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--vscode-foreground)", opacity: 0.7 }}>
            {provider.provider_name.slice(0, 2).toUpperCase()}
          </span>
        )}
      </div>

      {/* Text info */}
      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Row 1: provider_name + connection_type badge */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
          <span
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--primary-text)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {provider.provider_name}
          </span>
          <span
            style={{
              fontSize: "9px",
              fontWeight: 600,
              padding: "2px 7px",
              borderRadius: "5px",
              backgroundColor: connectionBadgeColor.bg,
              color: connectionBadgeColor.color,
              flexShrink: 0,
              textTransform: "uppercase",
              letterSpacing: "0.04em",
            }}
          >
            {connectionType}
          </span>
        </div>

        {/* Row 2: platform + auth_method */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "3px" }}>
          <span style={{ fontSize: "11px", color: "var(--secondary-text)", opacity: 0.7 }}>
            {platform}
          </span>
          {authMethod && (
            <>
              <span style={{ fontSize: "10px", color: "var(--secondary-text)", opacity: 0.4 }}>·</span>
              <span style={{ fontSize: "11px", color: "var(--secondary-text)", opacity: 0.7 }}>
                {authMethod}
              </span>
            </>
          )}
          {provider.is_enabled === false && (
            <span
              style={{
                fontSize: "9px",
                padding: "1px 5px",
                borderRadius: "4px",
                backgroundColor: "rgba(128,128,128,0.15)",
                color: "var(--secondary-text)",
                marginLeft: "2px",
              }}
            >
              Soon
            </span>
          )}
        </div>
      </div>

      {/* Arrow */}
      {!disabled && (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ color: "var(--secondary-text)", opacity: 0.4, flexShrink: 0 }}
        >
          <path d="m9 18 6-6-6-6" />
        </svg>
      )}
    </div>
  );
};

const AddAccountDrawer: React.FC<AddAccountDrawerProps> = ({ open, onOpenChange, onSuccess }) => {
  const { apiUrl } = useSettings();
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [error, setError] = useState("");

  // Confirmation state
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingAccount, setPendingAccount] = useState<any>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  useEffect(() => {
    if (!open) {
      setError("");
      setShowConfirm(false);
      setPendingAccount(null);
      return;
    }
    fetchProviders();
  }, [open]);

  const fetchProviders = async () => {
    setLoadingProviders(true);
    try {
      const response = await fetch(`${apiUrl}/v1/providers`);
      const data = await response.json();
      if (data.success && data.data) {
        const sorted = [...data.data].sort((a: Provider, b: Provider) => {
          if (a.is_enabled === b.is_enabled) return 0;
          return a.is_enabled ? -1 : 1;
        });
        setProviders(sorted);
      }
    } catch {
      setError("Failed to load providers");
    } finally {
      setLoadingProviders(false);
    }
  };

  const handleLogin = async (provider: Provider) => {
    if (!provider || provider.is_enabled === false) return;
    setLoading(true);
    setError("");
    try {
      const response = await fetch(`${apiUrl}/v1/accounts/login/${provider.provider_id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method: "basic" }),
      });
      const data = await response.json();
      if (data.success && data.account) {
        setPendingAccount(data.account);
        setShowConfirm(true);
      } else {
        setError(data.message || "Login failed");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAccount = async () => {
    if (!pendingAccount) return;
    setConfirmLoading(true);
    try {
      const response = await fetch(`${apiUrl}/v1/accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: pendingAccount.id || crypto.randomUUID(),
          provider_id: pendingAccount.provider_id,
          email: pendingAccount.email,
          credential: pendingAccount.credential,
        }),
      });
      const data = await response.json();
      if (data.success) {
        onSuccess();
        onOpenChange(false);
      } else {
        setError(data.message || "Failed to save account");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setConfirmLoading(false);
    }
  };

  if (!open) return null;

  const sharedBackdrop = (onClickBackdrop: () => void) => (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0,0,0,0.55)",
        zIndex: 200,
        animation: "aaFadeIn 0.15s ease",
      }}
      onClick={onClickBackdrop}
    />
  );

  const sharedSheet = (children: React.ReactNode, height: string = "50%") => (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: "var(--tertiary-bg)",
        borderTop: "1px solid var(--border-color)",
        borderTopLeftRadius: "18px",
        borderTopRightRadius: "18px",
        boxShadow: "0 -8px 32px rgba(0,0,0,0.25)",
        zIndex: 201,
        height,
        display: "flex",
        flexDirection: "column",
        animation: "aaSlideUp 0.22s ease",
      }}
    >
      {/* Drag handle */}
      <div style={{ display: "flex", justifyContent: "center", padding: "10px 0 6px", flexShrink: 0 }}>
        <div style={{ width: "32px", height: "3px", borderRadius: "2px", backgroundColor: "var(--border-color)" }} />
      </div>
      {children}
    </div>
  );

  // ── Confirmation view ──────────────────────────────────────────────────────
  if (showConfirm && pendingAccount) {
    return (
      <>
        {sharedBackdrop(() => { setShowConfirm(false); setPendingAccount(null); })}
        {sharedSheet(
          <>
            {/* Header */}
            <div
              style={{
                padding: "4px 16px 12px",
                borderBottom: "1px solid var(--border-color)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexShrink: 0,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "9px",
                    backgroundColor: "var(--vscode-testing-iconPassed-background, rgba(128,128,128,0.1))",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <ShieldCheck size={16} color="var(--vscode-testing-iconPassed, currentColor)" />
                </div>
                <div>
                  <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--primary-text)" }}>
                    Confirm Account
                  </div>
                  <div style={{ fontSize: "12px", color: "var(--secondary-text)", opacity: 0.7 }}>
                    Review captured details
                  </div>
                </div>
              </div>
              <button
                onClick={() => { setShowConfirm(false); setPendingAccount(null); }}
                style={{
                  padding: "7px",
                  borderRadius: "6px",
                  border: "none",
                  backgroundColor: "rgba(128,128,128,0.1)",
                  color: "var(--secondary-text)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Fields */}
            <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div>
                  <label
                    style={{
                      fontSize: "11px",
                      fontWeight: 500,
                      color: "var(--secondary-text)",
                      display: "block",
                      marginBottom: "5px",
                    }}
                  >
                    Email / Identifier
                  </label>
                  <input
                    type="email"
                    value={pendingAccount.email || ""}
                    onChange={(e) => setPendingAccount({ ...pendingAccount, email: e.target.value })}
                    style={{
                      width: "100%",
                      padding: "9px 11px",
                      borderRadius: "9px",
                      backgroundColor: "var(--input-bg)",
                      border: "1px solid var(--border-color)",
                      color: "var(--primary-text)",
                      fontSize: "13px",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
                <div>
                  <label
                    style={{
                      fontSize: "11px",
                      fontWeight: 500,
                      color: "var(--secondary-text)",
                      display: "block",
                      marginBottom: "5px",
                    }}
                  >
                    Credential / Token
                  </label>
                  <input
                    type="text"
                    value={
                      pendingAccount.credential
                        ? `${pendingAccount.credential.substring(0, 10)}...${pendingAccount.credential.slice(-5)}`
                        : "N/A"
                    }
                    readOnly
                    style={{
                      width: "100%",
                      padding: "9px 11px",
                      borderRadius: "9px",
                      backgroundColor: "var(--input-bg)",
                      border: "1px solid var(--border-color)",
                      color: "var(--secondary-text)",
                      fontSize: "12px",
                      fontFamily: "monospace",
                      outline: "none",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                {error && (
                  <div
                    style={{
                      backgroundColor: "var(--vscode-inputValidation-errorBackground, rgba(239,68,68,0.08))",
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
            </div>

            {/* Actions */}
            <div
              style={{
                padding: "12px 16px 20px",
                borderTop: "1px solid var(--border-color)",
                display: "flex",
                gap: "8px",
                flexShrink: 0,
              }}
            >
              <button
                onClick={() => { setShowConfirm(false); setPendingAccount(null); }}
                style={{
                  flex: 1,
                  padding: "9px",
                  borderRadius: "9px",
                  backgroundColor: "rgba(128,128,128,0.1)",
                  border: "none",
                  color: "var(--secondary-text)",
                  fontSize: "12px",
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                Back
              </button>
              <button
                onClick={handleConfirmAccount}
                disabled={confirmLoading || !pendingAccount.email}
                style={{
                  flex: 2,
                  padding: "9px",
                  borderRadius: "9px",
                  backgroundColor: "var(--vscode-button-background)",
                  border: "none",
                  color: "var(--vscode-button-foreground)",
                  fontSize: "12px",
                  fontWeight: 600,
                  cursor: confirmLoading ? "not-allowed" : "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  opacity: !pendingAccount.email ? 0.5 : 1,
                }}
              >
                {confirmLoading && <Loader2 size={13} style={{ animation: "aaSpin 1s linear infinite" }} />}
                {confirmLoading ? "Adding…" : "Confirm & Add"}
              </button>
            </div>
          </>,
          "auto",
        )}
        <style>{`
          @keyframes aaSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
          @keyframes aaFadeIn { from { opacity: 0; } to { opacity: 1; } }
          @keyframes aaSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        `}</style>
      </>
    );
  }

  // ── Main provider selection view ───────────────────────────────────────────
  return (
    <>
      {sharedBackdrop(() => onOpenChange(false))}
      {sharedSheet(
        <>
          {/* Header */}
          <div
            style={{
              padding: "4px 16px 12px",
              borderBottom: "1px solid var(--border-color)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexShrink: 0,
            }}
          >
            <div>
              <div style={{ fontSize: "17px", fontWeight: 700, color: "var(--primary-text)" }}>
                Add Account
              </div>
              <div style={{ fontSize: "13px", color: "var(--secondary-text)", opacity: 0.7, marginTop: "3px" }}>
                Choose a provider to continue
              </div>
            </div>
            <button
              onClick={() => onOpenChange(false)}
              style={{
                padding: "7px",
                borderRadius: "6px",
                border: "none",
                backgroundColor: "rgba(128,128,128,0.1)",
                color: "var(--secondary-text)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
              }}
            >
              <X size={17} />
            </button>
          </div>

          {/* Provider list */}
          <div style={{ flex: 1, overflowY: "auto", padding: "10px 16px" }}>
            {loadingProviders ? (
              <div
                style={{
                  height: "120px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "10px",
                  color: "var(--secondary-text)",
                }}
              >
                <Loader2
                  size={24}
                  style={{ animation: "aaSpin 1s linear infinite", color: "var(--vscode-foreground)" }}
                />
                <span style={{ fontSize: "12px" }}>Loading providers…</span>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                {providers.map((p) => (
                  <ProviderRow
                    key={p.provider_id}
                    provider={p}
                    onSelect={() => handleLogin(p)}
                    loading={loading}
                  />
                ))}
              </div>
            )}

            {error && (
              <div
                style={{
                  marginTop: "10px",
                  backgroundColor: "var(--vscode-inputValidation-errorBackground, rgba(239,68,68,0.08))",
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

          {loading && (
            <div
              style={{
                padding: "10px 16px 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                color: "var(--secondary-text)",
                fontSize: "12px",
                flexShrink: 0,
              }}
            >
              <Loader2 size={14} style={{ animation: "aaSpin 1s linear infinite" }} />
              Logging in…
            </div>
          )}
        </>,
      )}
      <style>{`
        @keyframes aaSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes aaFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes aaSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
};

export default AddAccountDrawer;
