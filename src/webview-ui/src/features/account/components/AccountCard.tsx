/**
 * ------------------------------------------------------------------
 * AccountCard
 * ------------------------------------------------------------------
 * Card hiển thị thông tin tài khoản trong danh sách.
 * Hỗ trợ chọn, mở context menu (copy JSON, switch, delete), và mở rộng chi tiết.

 * Main features:
 * - Hiển thị thông tin provider, email, thống kê daily requests/tokens
 * - Context menu khi click chuột phải (Copy as JSON, Switch, Delete)
 * - Expand/collapse chi tiết tài khoản (ID, credential, usage...)
 * - Khi anySelected=true: click bất kỳ đâu trên card để toggle select
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
import React, { useState, useEffect, useRef } from "react";
import {
  Trash2,
  RefreshCw,
  CheckCircle,
  Activity,
  Coins,
  Fingerprint,
  KeyRound,
  BarChart3,
  Clock,
  FolderOpen,
  Copy,
  Key,
  Pencil,
  XCircle,
} from "lucide-react";
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
} from "../../../components/ui/Dropdown";
import { CopyableText } from "../utils";
import { getFaviconUrl } from "@/utils/favicon";
import {
  extractAccessToken,
  formatJwtExpiry,
  isJwtExpired,
  extractCookieSessionExpiry,
  formatExpiryMs,
} from "@/utils/jwt";
import { extensionService } from "../../../services/ExtensionService";
import { FlatAccount } from "../types";

// ─── Interfaces ─────────────────────────────────────────────────────────
interface AccountCardProps {
  account: FlatAccount;
  isSelected: boolean;
  anySelected: boolean;
  onToggleSelect: () => void;
  onDelete: () => void;
  onSwitch: () => void;
  onRefreshToken?: () => Promise<{ success: boolean; error?: string }>;
  onEdit?: () => void;
  providerConfig?: any;
}

// ─── Icons ──────────────────────────────────────────────────────────────
const SquareDashedMousePointerIcon: React.FC<{ size?: number }> = ({
  size = 16,
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12.034 12.681a.498.498 0 0 1 .647-.647l9 3.5a.5.5 0 0 1-.033.943l-3.444 1.068a1 1 0 0 0-.66.66l-1.067 3.443a.5.5 0 0 1-.943.033z" />
    <path d="M5 3a2 2 0 0 0-2 2" />
    <path d="M19 3a2 2 0 0 1 2 2" />
    <path d="M5 21a2 2 0 0 1-2-2" />
    <path d="M9 3h1" />
    <path d="M9 21h2" />
    <path d="M14 3h1" />
    <path d="M3 9v1" />
    <path d="M21 9v2" />
    <path d="M3 14v1" />
  </svg>
);

// ─── Component ──────────────────────────────────────────────────────────
const AccountCard: React.FC<AccountCardProps> = ({
  account,
  isSelected,
  anySelected,
  onToggleSelect,
  onDelete,
  onSwitch,
  onRefreshToken,
  onEdit,
  providerConfig,
}) => {
  const [expanded, setExpanded] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshStatus, setRefreshStatus] = useState<
    "idle" | "success" | "error"
  >("idle");
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const refreshStatusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  useEffect(() => {
    if (anySelected) setExpanded(false);
  }, [anySelected]);

  const providerIconUrl = providerConfig?.website
    ? getFaviconUrl(providerConfig.website)
    : null;

  const formatIsoDate = (iso: string) => {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return iso;
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const min = String(d.getMinutes()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd} ${hh}:${min}`;
  };

  const isBrowserConnection = providerConfig?.connection_type === "browser";
  const accessToken = extractAccessToken(account.credential || "");
  const expiryToken = accessToken;
  const tokenExpiry = expiryToken
    ? formatJwtExpiry(expiryToken)
    : (() => {
        const cookieExpMs = extractCookieSessionExpiry(
          account.credential || "",
        );
        return cookieExpMs !== null ? formatExpiryMs(cookieExpMs) : null;
      })();
  const isTokenExpired = expiryToken
    ? isJwtExpired(expiryToken)
    : (() => {
        const cookieExpMs = extractCookieSessionExpiry(
          account.credential || "",
        );
        return cookieExpMs !== null ? Date.now() >= cookieExpMs : false;
      })();

  const handleCardClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Khi đang ở selection mode: click bất kỳ đâu = toggle select
    if (anySelected) {
      onToggleSelect();
      return;
    }
    setExpanded(!expanded);
  };

  const handleCopyAccount = () => {
    const data = {
      id: account.id,
      provider_id: account.provider_id,
      email: account.email,
      credential: account.credential,
      auth_method: account.auth_method ?? null,
      usage: account.usage ?? null,
      reset_usage_at: account.reset_usage_at ?? null,
      is_active_cli: account.is_active_cli ?? false,
      total_requests: account.total_requests ?? null,
      successful_requests: account.successful_requests ?? null,
      total_tokens: account.total_tokens ?? null,
      period_requests: account.period_requests ?? null,
      period_tokens: account.period_tokens ?? null,
    };
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
  };

  const handleRefreshToken = async (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!onRefreshToken || isRefreshing) {
      console.warn("[AccountCard][handleRefreshToken] Aborted", {
        hasOnRefreshToken: !!onRefreshToken,
        isRefreshing,
      });
      return;
    }
    setIsRefreshing(true);
    setRefreshStatus("idle");
    setRefreshError(null);
    // Clear previous timer
    if (refreshStatusTimerRef.current)
      clearTimeout(refreshStatusTimerRef.current);
    try {
      const result = await onRefreshToken();
      if (result.success) {
        setRefreshStatus("success");
      } else {
        setRefreshStatus("error");
        setRefreshError(result.error || "Refresh failed");
      }
    } catch (err: any) {
      console.error("[AccountCard][handleRefreshToken] Exception:", err);
      setRefreshStatus("error");
      setRefreshError(err?.message || "Refresh failed");
    } finally {
      setIsRefreshing(false);
      // Auto-clear feedback sau 3s
      refreshStatusTimerRef.current = setTimeout(() => {
        setRefreshStatus("idle");
        setRefreshError(null);
      }, 3000);
    }
  };

  // Cleanup timer khi unmount
  useEffect(() => {
    return () => {
      if (refreshStatusTimerRef.current)
        clearTimeout(refreshStatusTimerRef.current);
    };
  }, []);

  // ── Selected card style: subtle highlight, no dashed border ──────────
  const cardStyle: React.CSSProperties = {
    backgroundColor: isSelected
      ? "color-mix(in srgb, var(--vscode-list-activeSelectionBackground, #3b82f6) 10%, var(--input-bg))"
      : "var(--input-bg)",
    border: isSelected
      ? "1.5px solid color-mix(in srgb, var(--vscode-focusBorder, #3b82f6) 60%, transparent)"
      : "1.5px solid transparent",
    borderRadius: "12px",
    transition: "all 0.15s ease",
    position: "relative",
    cursor: anySelected ? "pointer" : "default",
  };

  return (
    <Dropdown trigger="contextmenu">
      <DropdownTrigger asChild>
        <div
          className="account-card"
          style={cardStyle}
          onClick={handleCardClick}
        >
          {/* Main Card Content */}
          <div style={{ padding: "10px 12px" }}>
            {/* Checkmark indicator when selected (top-right corner, subtle) */}
            {isSelected && (
              <div
                style={{
                  position: "absolute",
                  top: "8px",
                  right: "8px",
                  width: "16px",
                  height: "16px",
                  borderRadius: "50%",
                  backgroundColor: "var(--vscode-focusBorder, #3b82f6)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  zIndex: 2,
                  flexShrink: 0,
                }}
              >
                <svg
                  width="10"
                  height="10"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="white"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
            )}

            {/* Account info row */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                paddingRight: isSelected ? "24px" : "0",
                transition: "padding-right 0.15s ease",
              }}
            >
              {/* Provider icon */}
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  backgroundColor: "rgba(128,128,128,0.1)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  overflow: "hidden",
                }}
              >
                {providerIconUrl ? (
                  <img
                    src={providerIconUrl}
                    alt={account.provider_id}
                    style={{
                      width: "20px",
                      height: "20px",
                      objectFit: "contain",
                    }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                      const parent = (e.target as HTMLImageElement)
                        .parentElement;
                      if (parent) {
                        const fb = document.createElement("div");
                        fb.style.cssText =
                          "width:20px;height:20px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:bold;";
                        fb.textContent = account.provider_id
                          .slice(0, 2)
                          .toUpperCase();
                        (e.target as HTMLImageElement).replaceWith(fb);
                      }
                    }}
                  />
                ) : (
                  <SquareDashedMousePointerIcon size={16} />
                )}
              </div>

              {/* Name + email */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p
                  style={{
                    margin: 0,
                    fontSize: "13px",
                    fontWeight: 500,
                    color: "var(--primary-text)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  <span style={{ fontWeight: 600 }}>
                    {providerConfig?.provider_name || account.provider_id}
                  </span>
                  <span
                    style={{ color: "var(--secondary-text)", margin: "0 4px" }}
                  >
                    |
                  </span>
                  <span style={{ color: "var(--secondary-text)" }}>
                    {account.email || "No email"}
                  </span>
                  {account.auth_method &&
                    (() => {
                      const method = account.auth_method;
                      const baseUri = (window as any).__zenImagesUri as
                        | string
                        | undefined;
                      const knownIcons = ["google", "github", "x"];
                      const hasIcon = knownIcons.includes(method) && baseUri;
                      return (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            marginLeft: "5px",
                            fontSize: "11px",
                            fontWeight: 600,
                            padding: "2px 7px",
                            borderRadius: "4px",
                            backgroundColor: "rgba(128,128,128,0.1)",
                            color: "var(--secondary-text)",
                            letterSpacing: "0.02em",
                            verticalAlign: "middle",
                            flexShrink: 0,
                          }}
                        >
                          {hasIcon ? (
                            <img
                              src={`${baseUri}/auth_icons/${method}.svg`}
                              alt={method}
                              style={{
                                width: "12px",
                                height: "12px",
                                objectFit: "contain",
                              }}
                            />
                          ) : (
                            <Key size={11} />
                          )}
                          {method}
                        </span>
                      );
                    })()}
                </p>

                {/* Period stats */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    marginTop: "2px",
                    overflow: "hidden",
                    minWidth: 0,
                  }}
                >
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      fontSize: "10px",
                      color: "var(--secondary-text)",
                      flexShrink: 0,
                    }}
                  >
                    <Activity
                      size={11}
                      style={{
                        color: "var(--vscode-testing-iconPassed, #22c55e)",
                      }}
                    />
                    {(account.period_requests ?? 0).toLocaleString()} req
                  </span>
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      fontSize: "10px",
                      color: "var(--secondary-text)",
                      flexShrink: 0,
                    }}
                  >
                    <Coins
                      size={11}
                      style={{
                        color:
                          "var(--vscode-editorWarning-foreground, #f97316)",
                      }}
                    />
                    {account.period_tokens !== undefined &&
                    account.period_tokens >= 1000000
                      ? (account.period_tokens / 1000000).toFixed(1) + "M"
                      : account.period_tokens !== undefined &&
                          account.period_tokens >= 1000
                        ? (account.period_tokens / 1000).toFixed(1) + "k"
                        : (account.period_tokens ?? 0)}{" "}
                    tokens
                  </span>
                  {account.usage != null && (
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        fontSize: "10px",
                        color:
                          Number(account.usage) >= 90
                            ? "var(--vscode-editorError-foreground, #ef4444)"
                            : Number(account.usage) >= 70
                              ? "var(--vscode-editorWarning-foreground, #f97316)"
                              : "var(--secondary-text)",
                        flexShrink: 0,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        maxWidth: "60px",
                      }}
                    >
                      <BarChart3
                        size={11}
                        style={{
                          flexShrink: 0,
                          color:
                            Number(account.usage) >= 90
                              ? "var(--vscode-editorError-foreground, #ef4444)"
                              : Number(account.usage) >= 70
                                ? "var(--vscode-editorWarning-foreground, #f97316)"
                                : "var(--vscode-charts-purple, #a855f7)",
                        }}
                      />
                      <span
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {Number(account.usage).toFixed(1)}%
                      </span>
                    </span>
                  )}
                  {account.reset_usage_at != null &&
                    (() => {
                      const resetDate = new Date(account.reset_usage_at);
                      if (isNaN(resetDate.getTime())) return null;
                      const diffMs = resetDate.getTime() - Date.now();
                      const isPast = diffMs <= 0;
                      const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
                      const label = isPast
                        ? "Reset done"
                        : diffHours < 1
                          ? "Resets <1h"
                          : diffHours < 24
                            ? `Resets ${diffHours}h`
                            : `Resets ${Math.ceil(diffHours / 24)}d`;
                      return (
                        <span
                          title={`Usage resets at: ${formatIsoDate(account.reset_usage_at)}`}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "3px",
                            fontSize: "10px",
                            color: isPast
                              ? "var(--vscode-testing-iconPassed, #22c55e)"
                              : "var(--vscode-editorWarning-foreground, #f97316)",
                            flexShrink: 0,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          <Clock
                            size={10}
                            style={{
                              flexShrink: 0,
                              color: isPast
                                ? "var(--vscode-testing-iconPassed, #22c55e)"
                                : "var(--vscode-editorWarning-foreground, #f97316)",
                            }}
                          />
                          <span
                            style={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {label}
                          </span>
                        </span>
                      );
                    })()}
                  {tokenExpiry && (
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        fontSize: "10px",
                        color: isTokenExpired
                          ? "var(--vscode-editorError-foreground, #ef4444)"
                          : "var(--secondary-text)",
                        flexShrink: 1,
                        overflow: "hidden",
                        minWidth: 0,
                      }}
                    >
                      <Clock
                        size={11}
                        style={{
                          flexShrink: 0,
                          color: isTokenExpired
                            ? "var(--vscode-editorError-foreground, #ef4444)"
                            : "var(--vscode-charts-blue, #3b82f6)",
                        }}
                      />
                      <span
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {isTokenExpired ? "Expired" : `Exp: ${tokenExpiry}`}
                      </span>
                    </span>
                  )}

                  {/* Refresh token feedback badge */}
                  {isRefreshing && (
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        fontSize: "10px",
                        color: "var(--vscode-charts-blue, #3b82f6)",
                        flexShrink: 0,
                      }}
                    >
                      <RefreshCw
                        size={10}
                        style={{ animation: "spin 1s linear infinite" }}
                      />
                      Refreshing…
                    </span>
                  )}
                  {!isRefreshing && refreshStatus === "success" && (
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        fontSize: "10px",
                        color: "var(--vscode-testing-iconPassed, #22c55e)",
                        flexShrink: 0,
                      }}
                    >
                      <CheckCircle size={10} />
                      Token refreshed
                    </span>
                  )}
                  {!isRefreshing && refreshStatus === "error" && (
                    <span
                      title={refreshError || "Refresh failed"}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        fontSize: "10px",
                        color: "var(--vscode-editorError-foreground, #ef4444)",
                        flexShrink: 0,
                        overflow: "hidden",
                        maxWidth: "120px",
                      }}
                    >
                      <XCircle size={10} style={{ flexShrink: 0 }} />
                      <span
                        style={{
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {refreshError || "Refresh failed"}
                      </span>
                    </span>
                  )}
                </div>
              </div>

              {/* Switch button */}
              {account.is_active_cli === false && (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onSwitch();
                  }}
                  style={{
                    padding: "4px 8px",
                    borderRadius: "6px",
                    backgroundColor:
                      "var(--vscode-button-secondaryBackground, rgba(128,128,128,0.15))",
                    border: "1px solid var(--border-color)",
                    color:
                      "var(--vscode-button-secondaryForeground, var(--secondary-text))",
                    fontSize: "10px",
                    fontWeight: 500,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    flexShrink: 0,
                  }}
                >
                  <RefreshCw size={10} /> Switch
                </button>
              )}

              {/* Active badge */}
              {account.is_active_cli === true && (
                <div
                  style={{
                    padding: "4px 8px",
                    borderRadius: "6px",
                    backgroundColor:
                      "var(--vscode-testing-iconPassed-background, rgba(34,197,94,0.1))",
                    border:
                      "1px solid var(--vscode-testing-iconPassed, rgba(34,197,94,0.3))",
                    color: "var(--vscode-testing-iconPassed, #22c55e)",
                    fontSize: "10px",
                    fontWeight: 500,
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    flexShrink: 0,
                  }}
                >
                  <CheckCircle size={10} /> Active
                </div>
              )}
            </div>
          </div>

          {/* Expanded detail section */}
          {expanded && !anySelected && (
            <div
              style={{
                borderTop: "1px solid var(--border-color)",
                backgroundColor: "var(--input-bg)",
                fontSize: "12px",
                borderRadius: "0 0 12px 12px",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "10px",
                  padding: "10px 12px",
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      fontSize: "10px",
                      color: "var(--secondary-text)",
                      marginBottom: "2px",
                    }}
                  >
                    <Fingerprint size={10} /> Account ID
                  </div>
                  <CopyableText value={account.id} monospace />
                </div>

                {!isBrowserConnection &&
                  account.credential &&
                  (() => {
                    let parsed: Record<string, any> | null = null;
                    try {
                      const raw = account.credential.trim();
                      if (raw.startsWith("{")) parsed = JSON.parse(raw);
                    } catch {
                      /* ignore */
                    }

                    if (parsed) {
                      return (
                        <>
                          {Object.entries(parsed).map(([key, val]) => (
                            <div key={key} style={{ minWidth: 0 }}>
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  fontSize: "10px",
                                  color: "var(--secondary-text)",
                                  marginBottom: "2px",
                                }}
                              >
                                <KeyRound size={10} /> {key}
                              </div>
                              <CopyableText
                                value={String(val ?? "")}
                                monospace
                              />
                            </div>
                          ))}
                        </>
                      );
                    }
                    return (
                      <div style={{ minWidth: 0 }}>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                            fontSize: "10px",
                            color: "var(--secondary-text)",
                            marginBottom: "2px",
                          }}
                        >
                          <KeyRound size={10} /> Credential
                        </div>
                        <CopyableText value={account.credential} monospace />
                      </div>
                    );
                  })()}

                {account.reset_usage_at != null && (
                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        fontSize: "10px",
                        color: "var(--secondary-text)",
                        marginBottom: "2px",
                      }}
                    >
                      <Clock size={10} /> Reset At
                    </div>
                    <div
                      style={{
                        fontSize: "11px",
                        fontWeight: 500,
                        color: "var(--primary-text)",
                      }}
                    >
                      {formatIsoDate(account.reset_usage_at)}
                    </div>
                  </div>
                )}
              </div>

              <div
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "10px",
                  color: "var(--secondary-text)",
                  paddingTop: "8px",
                  paddingBottom: "8px",
                  borderTop: "1px dashed var(--border-color)",
                  borderRadius: "0 0 12px 12px",
                  cursor: "pointer",
                  transition: "background-color 0.15s ease",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = "var(--hover-bg)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = "transparent")
                }
              >
                Click again to collapse
              </div>
            </div>
          )}

          <style>{`
            .account-card:hover {
              transform: translateY(-1px);
              box-shadow: 0 2px 8px rgba(0,0,0,0.12);
            }
            @keyframes spin {
              from { transform: rotate(0deg); }
              to { transform: rotate(360deg); }
            }
          `}</style>
        </div>
      </DropdownTrigger>

      <DropdownContent>
        <DropdownItem
          icon={<SquareDashedMousePointerIcon size={14} />}
          onClick={onToggleSelect}
        >
          {isSelected ? "Deselect" : "Select"} Account
        </DropdownItem>
        <DropdownItem icon={<Copy size={14} />} onClick={handleCopyAccount}>
          Copy as JSON
        </DropdownItem>
        {onEdit && (
          <DropdownItem icon={<Pencil size={14} />} onClick={onEdit}>
            Edit Account
          </DropdownItem>
        )}
        {onRefreshToken && providerConfig?.can_refresh_token && (
          <DropdownItem
            icon={
              isRefreshing ? (
                <RefreshCw
                  size={14}
                  style={{ animation: "spin 1s linear infinite" }}
                />
              ) : refreshStatus === "success" ? (
                <CheckCircle
                  size={14}
                  style={{ color: "var(--vscode-testing-iconPassed, #22c55e)" }}
                />
              ) : refreshStatus === "error" ? (
                <XCircle
                  size={14}
                  style={{
                    color: "var(--vscode-editorError-foreground, #ef4444)",
                  }}
                />
              ) : (
                <Key size={14} />
              )
            }
            onClick={() => handleRefreshToken()}
            disabled={isRefreshing}
          >
            {isRefreshing
              ? "Refreshing Token…"
              : refreshStatus === "success"
                ? "Token Refreshed!"
                : refreshStatus === "error"
                  ? "Retry Refresh Token"
                  : "Refresh Token"}
          </DropdownItem>
        )}
        {account.is_active_cli === false && (
          <DropdownItem icon={<RefreshCw size={14} />} onClick={onSwitch}>
            Switch to CLI
          </DropdownItem>
        )}
        {providerConfig?.connection_type === "browser" &&
          account.user_data_dir && (
            <DropdownItem
              icon={<FolderOpen size={14} />}
              onClick={() =>
                extensionService.postMessage({
                  command: "openFolder",
                  path: account.user_data_dir,
                })
              }
            >
              Open Profile Folder
            </DropdownItem>
          )}
        <DropdownItem
          icon={<Trash2 size={14} />}
          variant="error"
          onClick={onDelete}
        >
          Delete Account
        </DropdownItem>
      </DropdownContent>
    </Dropdown>
  );
};

export default AccountCard;
