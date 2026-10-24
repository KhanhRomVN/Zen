import React, { useState } from "react";
import { Loader2, X, AlertCircle, ExternalLink } from "lucide-react";
import { extensionService } from "../../../services/ExtensionService";
import { CopyableText } from "../utils";
import {
  AuthGlyph,
  ProviderFavicon,
  sharedBackdrop,
  sharedSheet,
} from "./AddAccountShared";
import {
  AUTH_LABELS,
  hasInvalidEmailChar,
  splitAuthMethod,
  type DeviceCodeInfo,
} from "./addAccount.utils";

export const DeviceCodeDrawer: React.FC<{
  info: DeviceCodeInfo;
  error: string;
  onClose: () => void;
}> = ({ info, error, onClose }) => {
  const [urlCopied, setUrlCopied] = useState(false);
  const [codeCopied, setCodeCopied] = useState(false);

  const flash = (text: string, set: (v: boolean) => void) => {
    navigator.clipboard.writeText(text);
    set(true);
    setTimeout(() => set(false), 1500);
  };

  const openBrowser = () => {
    extensionService.postMessage({
      command: "openBrowserWithProfile",
      url: info.verification_url,
      ...(info.profileUserDataDir
        ? { userDataDir: info.profileUserDataDir }
        : {}),
      ...(info.profileDirectory
        ? { profileDirectory: info.profileDirectory }
        : {}),
    });
  };

  const okColor = "var(--vscode-testing-iconPassed, #22c55e)";
  const linkColor =
    "var(--vscode-textLink-foreground, var(--vscode-button-background))";
  const codeGroups = info.user_code.split("-").filter(Boolean);
  const steps = [
    "Open the verification page in your browser",
    "Confirm the code shown above",
    "Come back here, it continues automatically",
  ];

  const svgProps = {
    width: 13,
    height: 13,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };
  const checkIcon = (
    <svg {...svgProps} strokeWidth="2.5" style={{ animation: "aaFadeIn 0.15s ease" }}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
  const copyIcon = (
    <svg {...svgProps} strokeWidth="2">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );

  const softBtn = (tone: "neutral" | "primary" | "ok"): React.CSSProperties => ({
    flex: 1,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: "6px",
    height: "34px",
    borderRadius: "9px",
    border: "none",
    fontSize: "12px",
    fontWeight: 600,
    cursor: "pointer",
    whiteSpace: "nowrap",
    transition: "all 0.15s ease",
    backgroundColor:
      tone === "primary"
        ? "rgba(var(--primary-rgb, 0,120,212), 0.12)"
        : tone === "ok"
          ? "rgba(34,197,94,0.12)"
          : "rgba(128,128,128,0.12)",
    color:
      tone === "primary"
        ? linkColor
        : tone === "ok"
          ? okColor
          : "var(--primary-text)",
  });

  return (
    <>
      {sharedBackdrop(() => onClose())}
      {sharedSheet(
        <>
          {/* Header */}
          <div
            style={{
              padding: "12px 16px",
              borderBottom: "1px solid var(--border-color)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              flexShrink: 0,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: "16px",
                  fontWeight: 700,
                  color: "var(--primary-text)",
                }}
              >
                Device Authorization
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  marginTop: "4px",
                  fontSize: "12px",
                  color: "var(--secondary-text)",
                  minWidth: 0,
                }}
              >
                <ProviderFavicon provider={info.provider} size={14} />
                <span style={{ fontWeight: 600, color: "var(--primary-text)" }}>
                  {info.provider.provider_name}
                </span>
                {info.profileLabel && (
                  <>
                    <span style={{ opacity: 0.4 }}>·</span>
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {info.profileLabel}
                    </span>
                  </>
                )}
              </div>
            </div>
            <button
              onClick={() => onClose()}
              style={{
                padding: "6px",
                borderRadius: "4px",
                border: "none",
                background: "transparent",
                color: "var(--secondary-text)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                flexShrink: 0,
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

          {/* Body */}
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
            {/* Code hero */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "12px",
                padding: "20px 16px 16px",
                borderRadius: "14px",
                backgroundColor: "var(--input-bg)",
              }}
            >
              <div
                style={{
                  fontSize: "10px",
                  fontWeight: 600,
                  letterSpacing: "0.1em",
                  textTransform: "uppercase",
                  color: "var(--secondary-text)",
                  opacity: 0.7,
                }}
              >
                Your code
              </div>
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px" }}
              >
                {codeGroups.map((group, i) => (
                  <span
                    key={i}
                    style={{
                      fontSize: "28px",
                      fontWeight: 700,
                      fontFamily: "monospace",
                      letterSpacing: "0.2em",
                      padding: "8px 8px 8px calc(14px + 0.2em)",
                      borderRadius: "10px",
                      backgroundColor: "rgba(128,128,128,0.12)",
                      color: "var(--primary-text)",
                      lineHeight: 1.2,
                    }}
                  >
                    {group}
                  </span>
                ))}
              </div>
              <div style={{ display: "flex", gap: "8px", width: "100%" }}>
                <button
                  onClick={() => flash(info.user_code, setCodeCopied)}
                  style={softBtn(codeCopied ? "ok" : "neutral")}
                >
                  {codeCopied ? checkIcon : copyIcon}
                  {codeCopied ? "Copied" : "Copy code"}
                </button>
                <button onClick={openBrowser} style={softBtn("primary")}>
                  <ExternalLink size={13} />
                  Open Browser
                </button>
              </div>
            </div>

            {/* Verification URL */}
            <div style={{ position: "relative" }}>
              <input
                readOnly
                value={info.verification_url}
                style={{
                  width: "100%",
                  padding: "8px 36px 8px 12px",
                  borderRadius: "8px",
                  backgroundColor: "var(--input-bg)",
                  border: "none",
                  color: "var(--secondary-text)",
                  fontSize: "12px",
                  fontFamily: "monospace",
                  outline: "none",
                  boxSizing: "border-box",
                  height: "34px",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              />
              <button
                onClick={() => flash(info.verification_url, setUrlCopied)}
                title="Copy URL"
                style={{
                  position: "absolute",
                  right: "6px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  padding: "4px",
                  borderRadius: "4px",
                  border: "none",
                  background: "transparent",
                  color: urlCopied ? okColor : "var(--secondary-text)",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  transition: "color 0.2s ease",
                }}
              >
                {urlCopied ? checkIcon : copyIcon}
              </button>
            </div>

            {/* Steps */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "10px",
                padding: "12px 14px",
                borderRadius: "12px",
                border: "1px solid var(--border-color)",
              }}
            >
              {steps.map((text, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    fontSize: "12px",
                    color: "var(--secondary-text)",
                  }}
                >
                  <span
                    style={{
                      width: "18px",
                      height: "18px",
                      borderRadius: "50%",
                      backgroundColor: "rgba(128,128,128,0.14)",
                      color: "var(--primary-text)",
                      fontSize: "10px",
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {i + 1}
                  </span>
                  {text}
                </div>
              ))}
            </div>

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

          {/* Status footer */}
          <div
            style={{
              padding: "12px 16px 16px",
              borderTop: "1px solid var(--border-color)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              fontSize: "12px",
              color: "var(--secondary-text)",
              flexShrink: 0,
            }}
          >
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                backgroundColor: "#f59e0b",
                animation: "aaPulse 1.4s ease-in-out infinite",
              }}
            />
            Waiting for authorization…
          </div>
        </>,
        "50%",
      )}
      <style>{`
        @keyframes aaSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes aaFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes aaPulse { 0%, 100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.35; transform: scale(0.75); } }
      `}</style>
    </>
  );
};
export const ConfirmAccountDrawer: React.FC<{
  account: any;
  error: string;
  confirmLoading: boolean;
  onChange: (account: any) => void;
  onConfirm: () => void;
  onClose: () => void;
}> = ({ account, error, confirmLoading, onChange, onConfirm, onClose }) => {
  const credValue =
    account.credential || account.user_data_dir || "";
  let credParsed: Record<string, any> | null = null;
  try {
    const raw = credValue.trim();
    if (raw.startsWith("{")) credParsed = JSON.parse(raw);
  } catch {
    /* ignore */
  }
  return (
    <>
      {sharedBackdrop(() => {
        onClose();
      })}
      {sharedSheet(
        <>
          {/* Header */}
          <div
            style={{
              padding: "12px 16px 12px",
              borderBottom: "1px solid var(--border-color)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexShrink: 0,
            }}
          >
            <div
              style={{ display: "flex", alignItems: "center", gap: "10px" }}
            >
              <div>
                <div
                  style={{
                    fontSize: "16px",
                    fontWeight: 700,
                    color: "var(--primary-text)",
                  }}
                >
                  Confirm Account
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    color: "var(--secondary-text)",
                    opacity: 0.7,
                  }}
                >
                  Review captured details
                </div>
              </div>
            </div>
            <button
              onClick={() => {
                onClose();
              }}
              style={{
                padding: "6px",
                borderRadius: "4px",
                border: "none",
                background: "transparent",
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
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              {/* Email */}
              <div>
                <label
                  style={{
                    fontSize: "12px",
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
                  value={account.email || ""}
                  onChange={(e) =>
                    onChange({
                      ...account,
                      email: e.target.value,
                    })
                  }
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    backgroundColor: "var(--input-bg)",
                    border:
                      !account.email ||
                      hasInvalidEmailChar(account.email)
                        ? "1.5px dashed var(--vscode-inputValidation-errorBorder, rgba(239,68,68,0.6))"
                        : "1.5px dashed transparent",
                    color: "var(--primary-text)",
                    fontSize: "13px",
                    outline: "none",
                    boxSizing: "border-box",
                    height: "34px",
                  }}
                />
              </div>

              {/* Auth Method */}
              {account.auth_method && (
                <div>
                  <label
                    style={{
                      fontSize: "12px",
                      fontWeight: 500,
                      color: "var(--secondary-text)",
                      display: "block",
                      marginBottom: "5px",
                    }}
                  >
                    Auth Method
                  </label>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    {(() => {
                      const baseUri = (window as any).__zenImagesUri as
                        | string
                        | undefined;
                      const method = account.auth_method as string;
                      const hasIcon = false && baseUri;
                      return (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            fontSize: "12px",
                            fontWeight: 500,
                            padding: "3px 8px",
                            borderRadius: "6px",
                            backgroundColor: "rgba(128,128,128,0.1)",
                            color: "var(--primary-text)",
                          }}
                        >
                          {hasIcon ? (
                            <img
                              src={`${baseUri}/auth_icons/${method}.svg`}
                              alt={method}
                              style={{
                                width: "13px",
                                height: "13px",
                                objectFit: "contain",
                              }}
                            />
                          ) : (
                            splitAuthMethod(method).map((part) => (
                              <AuthGlyph key={part} method={part} size={13} />
                            ))
                          )}
                          {splitAuthMethod(method)
                            .map((part) => AUTH_LABELS[part] ?? part)
                            .join(" · ")}
                        </span>
                      );
                    })()}
                  </div>
                </div>
              )}

              {/* Credential — expand section style, no padding/border on wrapper */}
              {credValue && (
                <div>
                  <div style={{ fontSize: "12px" }}>
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "10px",
                      }}
                    >
                      {credParsed ? (
                        Object.entries(credParsed).map(([key, val]) => (
                          <div key={key} style={{ minWidth: 0 }}>
                            <div
                              style={{
                                fontSize: "12px",
                                color: "var(--secondary-text)",
                                marginBottom: "2px",
                              }}
                            >
                              {key}
                            </div>
                            <CopyableText
                              value={String(val ?? "")}
                              monospace
                              fontSize="13px"
                            />
                          </div>
                        ))
                      ) : (
                        <div style={{ minWidth: 0 }}>
                          <div
                            style={{
                              fontSize: "12px",
                              color: "var(--secondary-text)",
                              marginBottom: "2px",
                            }}
                          >
                            {account.user_data_dir ? "Path" : "Token"}
                          </div>
                          <CopyableText
                            value={credValue}
                            monospace
                            fontSize="13px"
                          />
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

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
              onClick={() => {
                onClose();
              }}
              style={{
                padding: "8px 14px",
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
              onClick={onConfirm}
              disabled={confirmLoading || !account.email}
              style={{
                padding: "8px 14px",
                borderRadius: "9px",
                backgroundColor:
                  confirmLoading || !account.email
                    ? "rgba(128,128,128,0.1)"
                    : "rgba(var(--primary-rgb, 0,120,212), 0.12)",
                border: "none",
                color:
                  confirmLoading || !account.email
                    ? "var(--secondary-text)"
                    : "var(--vscode-textLink-foreground, var(--vscode-button-background))",
                fontSize: "12px",
                fontWeight: 600,
                cursor:
                  confirmLoading || !account.email
                    ? "not-allowed"
                    : "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
                whiteSpace: "nowrap",
                transition: "all 0.15s ease",
              }}
            >
              {confirmLoading && (
                <Loader2
                  size={13}
                  style={{ animation: "aaSpin 1s linear infinite" }}
                />
              )}
              {confirmLoading ? "Adding…" : "Confirm"}
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
};
