import React, { useState, useRef, useEffect, useCallback } from "react";
import ReactDOM from "react-dom";
import { Trash2, RefreshCw, CheckCircle } from "lucide-react";
import { FlatAccount } from "./types";

interface AccountCardProps {
  account: FlatAccount;
  isSelected: boolean;
  anySelected: boolean;
  onToggleSelect: () => void;
  onDelete: () => void;
  onSwitch: () => void;
  providerConfig?: any;
}

// Custom icon: lucide-square-dashed-mouse-pointer
const SquareDashedMousePointerIcon: React.FC<{ size?: number }> = ({ size = 16 }) => (
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

// Measures available px width and truncates text to fit, with "..." suffix
const useTruncatedText = (fullText: string, fontStyle: string) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [displayText, setDisplayText] = useState(fullText);

  const computeTruncation = useCallback(() => {
    const el = containerRef.current;
    if (!el || !fullText) return;
    const availWidth = el.clientWidth;
    if (availWidth <= 0) return;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.font = fontStyle;
    const ellipsis = "...";
    const ellipsisWidth = ctx.measureText(ellipsis).width;
    if (ctx.measureText(fullText).width <= availWidth) {
      setDisplayText(fullText);
      return;
    }
    let lo = 0;
    let hi = fullText.length;
    while (lo < hi) {
      const mid = Math.floor((lo + hi + 1) / 2);
      if (ctx.measureText(fullText.slice(0, mid)).width + ellipsisWidth <= availWidth) lo = mid;
      else hi = mid - 1;
    }
    setDisplayText(lo > 0 ? fullText.slice(0, lo) + ellipsis : ellipsis);
  }, [fullText, fontStyle]);

  useEffect(() => {
    computeTruncation();
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(computeTruncation);
    ro.observe(el);
    return () => ro.disconnect();
  }, [computeTruncation]);

  return { containerRef, displayText };
};

const CopyableText: React.FC<{ value: string; monospace?: boolean }> = ({ value, monospace }) => {
  const [copied, setCopied] = useState(false);
  const [hovered, setHovered] = useState(false);
  const fontSize = "11px";
  const fontFamily = monospace ? "monospace" : "sans-serif";
  const { containerRef, displayText } = useTruncatedText(value || "", `${fontSize} ${fontFamily}`);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!value) return;
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={copied ? "Copied!" : value ? `Click to copy: ${value}` : "N/A"}
      style={{
        fontSize,
        fontFamily,
        // copied → success green, hover → link color, default → primary text
        color: copied
          ? "var(--vscode-testing-iconPassed, #22c55e)"
          : hovered
            ? "var(--vscode-textLink-foreground)"
            : "var(--primary-text)",
        cursor: value ? "pointer" : "default",
        transition: "color 0.15s ease",
        overflow: "hidden",
        whiteSpace: "nowrap",
        width: "100%",
      }}
    >
      {copied ? "✓ copied" : displayText || "N/A"}
    </div>
  );
};

const AccountCard: React.FC<AccountCardProps> = ({
  account,
  isSelected,
  anySelected,
  onToggleSelect,
  onDelete,
  onSwitch,
  providerConfig,
}) => {
  const [showMenu, setShowMenu] = useState(false);
  const [menuPosition, setMenuPosition] = useState({ x: 0, y: 0 });
  const [expanded, setExpanded] = useState(false);

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setMenuPosition({ x: e.clientX, y: e.clientY });
    setShowMenu(true);
  };

  const handleCardClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setExpanded(!expanded);
  };

  const handleSelectClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleSelect();
  };

  useEffect(() => {
    if (!showMenu) return;
    const close = () => setShowMenu(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [showMenu]);

  const handleCopyAccount = (e: React.MouseEvent) => {
    e.stopPropagation();
    setShowMenu(false);
    const data = {
      id: account.id,
      provider_id: account.provider_id,
      email: account.email,
      credential: account.credential,
      usage: account.usage ?? null,
      reset_period: account.reset_period ?? null,
      last_refreshed_at: account.last_refreshed_at ?? null,
      is_active_cli: account.is_active_cli ?? false,
      total_requests: account.total_requests ?? null,
      successful_requests: account.successful_requests ?? null,
      total_tokens: account.total_tokens ?? null,
      daily_requests: account.daily_requests ?? null,
      daily_tokens: account.daily_tokens ?? null,
    };
    navigator.clipboard.writeText(JSON.stringify(data, null, 2));
  };

  const getProviderIcon = () => {
    if (providerConfig?.website) {
      try {
        const url = new URL(providerConfig.website);
        return `${url.origin}/favicon.ico`;
      } catch {
        return null;
      }
    }
    return null;
  };

  const providerIconUrl = getProviderIcon();

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  // Portal-based context menu
  const contextMenu = showMenu
    ? ReactDOM.createPortal(
        <div
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            position: "fixed",
            top: menuPosition.y,
            left: menuPosition.x,
            backgroundColor: "var(--tertiary-bg)",
            border: "1px solid var(--border-color)",
            borderRadius: "10px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
            zIndex: 99999,
            minWidth: "180px",
            overflow: "hidden",
          }}
        >
          {/* Select */}
          <button
            onMouseDown={(e) => { e.stopPropagation(); setShowMenu(false); onToggleSelect(); }}
            style={menuBtnStyle}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--hover-bg)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24"
              fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12.034 12.681a.498.498 0 0 1 .647-.647l9 3.5a.5.5 0 0 1-.033.943l-3.444 1.068a1 1 0 0 0-.66.66l-1.067 3.443a.5.5 0 0 1-.943.033z" />
              <path d="M5 3a2 2 0 0 0-2 2" /><path d="M19 3a2 2 0 0 1 2 2" />
              <path d="M5 21a2 2 0 0 1-2-2" /><path d="M9 3h1" /><path d="M9 21h2" />
              <path d="M14 3h1" /><path d="M3 9v1" /><path d="M21 9v2" /><path d="M3 14v1" />
            </svg>
            <span>{isSelected ? "Deselect" : "Select"} Account</span>
          </button>

          {/* Copy JSON */}
          <button
            onMouseDown={handleCopyAccount}
            style={menuBtnStyle}
            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--hover-bg)")}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
              <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
            </svg>
            <span>Copy as JSON</span>
          </button>

          {/* Switch */}
          {account.is_active_cli === false && (
            <button
              onMouseDown={(e) => { e.stopPropagation(); setShowMenu(false); onSwitch(); }}
              style={menuBtnStyle}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--hover-bg)")}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
            >
              <RefreshCw size={12} />
              <span>Switch to CLI</span>
            </button>
          )}

          {/* Delete */}
          <button
            onMouseDown={(e) => { e.stopPropagation(); setShowMenu(false); onDelete(); }}
            style={{ ...menuBtnStyle, color: "var(--vscode-errorForeground, #f87171)" }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--vscode-inputValidation-errorBackground, rgba(239,68,68,0.1))";
            }}
            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
          >
            <Trash2 size={12} />
            <span>Delete Account</span>
          </button>
        </div>,
        document.body,
      )
    : null;

  return (
    <div
      className="account-card"
      onContextMenu={handleContextMenu}
      style={{
        backgroundColor: isSelected
          ? "var(--vscode-list-activeSelectionBackground, rgba(99,102,241,0.08))"
          : "var(--tertiary-bg)",
        border: isSelected
          ? "1px solid var(--vscode-focusBorder, rgba(99,102,241,0.4))"
          : "1px solid var(--border-color)",
        borderRadius: "12px",
        transition: "all 0.2s ease",
        position: "relative",
      }}
    >
      {/* Main Card Content */}
      <div onClick={handleCardClick} style={{ padding: "10px 12px", cursor: "pointer" }}>

        {/* Selection checkbox */}
        {anySelected && (
          <div
            style={{
              position: "absolute",
              left: "8px",
              top: "50%",
              transform: "translateY(-50%)",
              width: "18px",
              height: "18px",
              borderRadius: "4px",
              border: isSelected
                ? "1px solid var(--vscode-focusBorder)"
                : "1px solid var(--border-color)",
              backgroundColor: isSelected
                ? "var(--vscode-list-activeSelectionBackground, rgba(99,102,241,0.2))"
                : "rgba(128,128,128,0.08)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              zIndex: 1,
              flexShrink: 0,
              transition: "all 0.15s ease",
            }}
            onClick={handleSelectClick}
          >
            {isSelected && (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="var(--vscode-list-activeSelectionForeground, currentColor)"
                strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            )}
          </div>
        )}

        {/* Account info row */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            paddingLeft: anySelected ? "24px" : "0px",
            transition: "padding-left 0.15s ease",
          }}
        >
          {/* Provider icon */}
          <div
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              backgroundColor: "rgba(128,128,128,0.1)",
              color: "var(--vscode-foreground)",
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
                style={{ width: "20px", height: "20px", objectFit: "contain" }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                  const parent = (e.target as HTMLImageElement).parentElement;
                  if (parent) {
                    const fallback = document.createElement("div");
                    fallback.style.cssText =
                      "width:20px;height:20px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:bold;";
                    fallback.textContent = account.provider_id.slice(0, 2).toUpperCase();
                    (e.target as HTMLImageElement).replaceWith(fallback);
                  }
                }}
              />
            ) : (
              <SquareDashedMousePointerIcon size={16} />
            )}
          </div>

          {/* Name + email */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <p style={{
              margin: 0, fontSize: "13px", fontWeight: 500,
              color: "var(--primary-text)", overflow: "hidden",
              textOverflow: "ellipsis", whiteSpace: "nowrap",
            }}>
              <span style={{ fontWeight: 600 }}>
                {providerConfig?.provider_name || account.provider_id}
              </span>
              <span style={{ color: "var(--secondary-text)", margin: "0 4px" }}>|</span>
              <span>{account.email || "No email"}</span>
            </p>

            {/* Daily stats */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px", flexWrap: "wrap" }}>
              {account.daily_requests !== undefined && account.daily_requests > 0 && (
                <span style={{ fontSize: "9px", color: "var(--secondary-text)", opacity: 0.6 }}>
                  {account.daily_requests.toLocaleString()} req today
                </span>
              )}
              {account.daily_tokens !== undefined && account.daily_tokens > 0 && (
                <span style={{ fontSize: "9px", color: "var(--secondary-text)", opacity: 0.6 }}>
                  •{" "}
                  {account.daily_tokens >= 1000000
                    ? (account.daily_tokens / 1000000).toFixed(1) + "M"
                    : account.daily_tokens >= 1000
                      ? (account.daily_tokens / 1000).toFixed(1) + "k"
                      : account.daily_tokens}{" "}
                  tokens
                </span>
              )}
              {account.successful_requests !== undefined &&
                account.total_requests !== undefined &&
                account.total_requests > 0 && (
                  <span style={{
                    fontSize: "9px",
                    opacity: 0.8,
                    color: account.successful_requests / account.total_requests > 0.8
                      ? "var(--vscode-testing-iconPassed, #22c55e)"
                      : "var(--vscode-editorWarning-foreground, #f97316)",
                  }}>
                    •{" "}
                    {Math.round((account.successful_requests / account.total_requests) * 100)}% success rate
                  </span>
                )}
            </div>
          </div>

          {/* Switch button */}
          {account.is_active_cli === false && (
            <button
              onClick={(e) => { e.stopPropagation(); onSwitch(); }}
              style={{
                padding: "4px 8px",
                borderRadius: "6px",
                backgroundColor: "var(--vscode-button-secondaryBackground, rgba(128,128,128,0.15))",
                border: "1px solid var(--border-color)",
                color: "var(--vscode-button-secondaryForeground, var(--secondary-text))",
                fontSize: "10px",
                fontWeight: 500,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                flexShrink: 0,
              }}
            >
              <RefreshCw size={10} />
              Switch
            </button>
          )}

          {/* Active badge */}
          {account.is_active_cli === true && (
            <div style={{
              padding: "4px 8px",
              borderRadius: "6px",
              backgroundColor: "var(--vscode-testing-iconPassed-background, rgba(34,197,94,0.1))",
              border: "1px solid var(--vscode-testing-iconPassed, rgba(34,197,94,0.3))",
              color: "var(--vscode-testing-iconPassed, #22c55e)",
              fontSize: "10px",
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              gap: "4px",
              flexShrink: 0,
            }}>
              <CheckCircle size={10} />
              Active
            </div>
          )}
        </div>
      </div>

      {/* Expanded detail section */}
      {expanded && (
        <div style={{
          padding: "10px 0",
          borderTop: "1px solid var(--border-color)",
          backgroundColor: "var(--vscode-list-hoverBackground, rgba(128,128,128,0.04))",
          fontSize: "12px",
        }}>
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "10px",
            marginBottom: "10px",
            padding: "0 12px",
          }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: "10px", color: "var(--secondary-text)", marginBottom: "2px" }}>
                Account ID
              </div>
              <CopyableText value={account.id} monospace />
            </div>

            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: "10px", color: "var(--secondary-text)", marginBottom: "2px" }}>
                Credential
              </div>
              <CopyableText value={account.credential || ""} monospace />
            </div>

            {(account.usage != null || account.reset_period != null) && (
              <div>
                <div style={{ fontSize: "10px", color: "var(--secondary-text)", marginBottom: "2px" }}>
                  Usage
                </div>
                <div style={{ fontSize: "11px", fontWeight: 500, color: "var(--primary-text)" }}>
                  {account.usage ?? "—"}
                  {account.reset_period != null && (
                    <span style={{ fontSize: "10px", color: "var(--secondary-text)", marginLeft: "4px" }}>
                      / {account.reset_period}
                    </span>
                  )}
                </div>
              </div>
            )}

            {account.last_refreshed_at != null && (
              <div>
                <div style={{ fontSize: "10px", color: "var(--secondary-text)", marginBottom: "2px" }}>
                  Last Refreshed
                </div>
                <div style={{ fontSize: "11px", fontWeight: 500, color: "var(--primary-text)" }}>
                  {formatDate(account.last_refreshed_at)}
                </div>
              </div>
            )}
          </div>

          <div style={{
            fontSize: "10px",
            color: "var(--secondary-text)",
            textAlign: "center",
            paddingTop: "8px",
            margin: "0 12px",
            borderTop: "1px dashed var(--border-color)",
            opacity: 0.6,
          }}>
            Click again to collapse
          </div>
        </div>
      )}

      {contextMenu}

      <style>{`
        .account-card:hover {
          transform: translateY(-1px);
          border-color: var(--vscode-focusBorder);
          box-shadow: 0 2px 8px rgba(0,0,0,0.12);
        }
      `}</style>
    </div>
  );
};

const menuBtnStyle: React.CSSProperties = {
  width: "100%",
  padding: "8px 12px",
  display: "flex",
  alignItems: "center",
  gap: "8px",
  border: "none",
  backgroundColor: "transparent",
  color: "var(--primary-text)",
  fontSize: "12px",
  cursor: "pointer",
  textAlign: "left",
};

export default AccountCard;
