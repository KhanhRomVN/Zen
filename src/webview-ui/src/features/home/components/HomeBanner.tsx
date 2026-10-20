/**
 * ------------------------------------------------------------------
 * HomeBanner
 * ------------------------------------------------------------------
 * Banner thống nhất cho màn Home: mất kết nối backend, có bản cập nhật
 * Zen / AIWeb2API, và gợi ý thêm account khi chưa có account nào.
 * Màu sắc lấy từ VS Code theme variables; mỗi variant chỉ đổi bộ biến --zb-*.
 * ------------------------------------------------------------------
 */

// ─── Imports ───────────────────────────────────────────────────────────
import React from "react";
import { UpdateInfo } from "@/context/BackendConnectionContext";

// ─── Types ──────────────────────────────────────────────────────────────
interface HomeBannerProps {
  isConnected: boolean;
  zenUpdateInfo: UpdateInfo | null;
  apiUpdateInfo: UpdateInfo | null;
  totalAccounts: number;
  accountsLoaded: boolean;
  onOpenAccounts?: () => void;
}

interface BannerProps {
  variant: "error" | "warning" | "info" | "success";
  icon: React.ReactNode;
  title: string;
  badge: React.ReactNode;
  children: React.ReactNode;
  action?: React.ReactNode;
}

// ─── Styles (CSS-in-JS via <style>) ─────────────────────────────────────
const styles = `
  .zen-banner-stack { display: flex; flex-direction: column; gap: 8px; width: 100%; }

  .zen-banner {
    --zb-rgb: 239,68,68;
    --zb-fg: var(--vscode-editorError-foreground, #ef4444);
    --zb-border: var(--vscode-editorError-border, rgba(239,68,68,.5));
    --zb-bg: var(--vscode-editorError-background, rgba(239,68,68,.13));
    --zb-soft: var(--vscode-editorError-bgSoft, rgba(239,68,68,.14));
    --zb-highlight: var(--vscode-editorError-highlight, rgba(239,68,68,.12));
    --zb-shimmer: var(--vscode-editorError-shimmer, rgba(239,68,68,.08));
    --zb-link: linear-gradient(90deg, #ff4d4d, #ff9f1c, #ffe14d, #3ddc84, #3b9bff, #8b5cf6, #ff4dc4, #ff4d4d);
    position: relative;
    width: 100%;
    display: flex; gap: 14px; align-items: center;
    padding: 16px;
    border-radius: 12px;
    border: 1px dashed var(--zb-border);
    background:
      radial-gradient(120% 140% at 0% 0%, var(--zb-bg), transparent 55%),
      var(--vscode-sideBar-background, #0f131c);
    overflow: hidden;
    animation: zen-banner-glow 3s ease-in-out infinite;
    box-sizing: border-box;
  }
  .zen-banner--warning {
    --zb-rgb: 234,179,8;
    --zb-fg: var(--vscode-editorWarning-foreground, #eab308);
    --zb-border: var(--vscode-editorWarning-border, rgba(234,179,8,.5));
    --zb-bg: var(--vscode-editorWarning-background, rgba(234,179,8,.13));
    --zb-soft: var(--vscode-editorWarning-bgSoft, rgba(234,179,8,.14));
    --zb-highlight: var(--vscode-editorWarning-highlight, rgba(234,179,8,.12));
    --zb-shimmer: var(--vscode-editorWarning-shimmer, rgba(234,179,8,.08));
    --zb-link: linear-gradient(90deg, #ffe14d, #ff9f1c, #eab308, #fbbf24, #ffe14d);
  }
  .zen-banner--info {
    --zb-rgb: 59,130,246;
    --zb-fg: var(--vscode-textLink-foreground, #3b82f6);
    --zb-border: rgba(59,130,246,.5);
    --zb-bg: rgba(59,130,246,.13);
    --zb-soft: rgba(59,130,246,.14);
    --zb-highlight: rgba(59,130,246,.12);
    --zb-shimmer: rgba(59,130,246,.08);
    --zb-link: linear-gradient(90deg, #60a5fa, #3b82f6, #8b5cf6, #60a5fa);
  }
  .zen-banner--success {
    --zb-rgb: 34,197,94;
    --zb-fg: var(--vscode-testing-iconPassed, #22c55e);
    --zb-border: rgba(34,197,94,.5);
    --zb-bg: rgba(34,197,94,.13);
    --zb-soft: rgba(34,197,94,.14);
    --zb-highlight: rgba(34,197,94,.12);
    --zb-shimmer: rgba(34,197,94,.08);
    --zb-link: linear-gradient(90deg, #4ade80, #22c55e, #14b8a6, #4ade80);
  }
  @keyframes zen-banner-glow {
    0%, 100% { box-shadow: 0 0 0 0 rgba(var(--zb-rgb), 0), 0 8px 28px -14px rgba(var(--zb-rgb), .15); }
    50%      { box-shadow: 0 0 0 1px var(--zb-highlight), 0 8px 28px -10px rgba(var(--zb-rgb), .35); }
  }
  .zen-banner::after {
    content: ""; position: absolute; top: 0; bottom: 0; left: -40%; width: 30%;
    background: linear-gradient(100deg, transparent, var(--zb-shimmer), transparent);
    animation: zen-banner-sweep 5s ease-in-out infinite;
    pointer-events: none;
  }
  @keyframes zen-banner-sweep {
    0%, 55% { left: -40%; }
    100%    { left: 130%; }
  }

  .zen-banner-icon {
    flex: none; width: 40px; height: 40px; border-radius: 10px;
    display: grid; place-items: center;
    background: var(--zb-soft);
    color: var(--zb-fg);
    position: relative;
  }
  .zen-banner-icon svg { width: 20px; height: 20px; }
  .zen-banner-icon::after {
    content: ""; position: absolute; inset: 0; border-radius: inherit;
    border: 1px solid var(--zb-fg);
    animation: zen-banner-ping 2.2s ease-out infinite;
    opacity: 0;
  }
  @keyframes zen-banner-ping {
    0%   { opacity: .7; transform: scale(1); }
    100% { opacity: 0;  transform: scale(1.6); }
  }
  .zen-banner-icon::before {
    content: ""; position: absolute; inset: -5px; border-radius: 14px;
    border: 1px dashed var(--zb-border);
    animation: zen-banner-orbit 8s linear infinite;
  }
  @keyframes zen-banner-orbit { to { transform: rotate(360deg); } }

  .zen-banner--error .zen-banner-icon svg { animation: zen-banner-jolt-x 3s linear infinite; }
  .zen-banner--warning .zen-banner-icon svg,
  .zen-banner--success .zen-banner-icon svg { animation: zen-banner-jolt-y 3s linear infinite; }
  @keyframes zen-banner-jolt-x {
    0%, 70%, 80%, 100% { transform: translateX(0); }
    72% { transform: translateX(-1.5px); }
    74% { transform: translateX(1.5px); }
    76% { transform: translateX(-1px); }
    78% { transform: translateX(1px); }
  }
  @keyframes zen-banner-jolt-y {
    0%, 70%, 80%, 100% { transform: translateY(0); }
    72% { transform: translateY(-1.5px); }
    74% { transform: translateY(1.5px); }
    76% { transform: translateY(-1px); }
    78% { transform: translateY(1px); }
  }
  .zen-banner-icon .gap { animation: zen-banner-flicker 3s steps(1) infinite; }
  @keyframes zen-banner-flicker {
    0%, 70%, 78%, 100% { opacity: 1; }
    72%, 76% { opacity: .2; }
  }

  .zen-banner-body { flex: 1; min-width: 0; position: relative; z-index: 1; }
  .zen-banner-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .zen-banner-title {
    font-size: 14px; font-weight: 600; letter-spacing: .01em;
    color: var(--vscode-foreground, #e8ecf4);
  }
  .zen-banner-badge {
    display: inline-flex; align-items: center; gap: 6px; line-height: 1;
    font-size: 11px; font-weight: 500;
    color: var(--zb-fg);
    padding: 2px 8px; border-radius: 4px;
    background: var(--zb-soft);
    border: 1px dashed var(--zb-border);
  }
  .zen-banner-dot {
    flex: none; display: block; width: 6px; height: 6px;
    border-radius: 50%; background: currentColor;
    animation: zen-banner-blink 1.4s ease-in-out infinite;
  }
  @keyframes zen-banner-blink { 50% { opacity: .25; } }
  .zen-banner-versions { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 600; }
  .zen-banner-arrow { opacity: .7; }

  .zen-banner-text {
    margin-top: 6px; font-size: 13px; line-height: 1.55;
    color: var(--vscode-descriptionForeground, #8b95a8);
    text-align: left;
  }
  .zen-banner-link {
    font-weight: 700; text-decoration: none;
    background: var(--zb-link);
    background-size: 200% 100%;
    -webkit-background-clip: text; background-clip: text;
    -webkit-text-fill-color: transparent; color: transparent;
    animation: zen-banner-shimmer 4s linear infinite;
    position: relative;
  }
  .zen-banner-link::after {
    content: ""; position: absolute; left: 0; right: 0; bottom: -1px; height: 1px;
    background: inherit; background-size: 200% 100%;
    opacity: .6;
  }
  .zen-banner-link:hover::after { opacity: 1; }
  @keyframes zen-banner-shimmer { to { background-position: 200% 0; } }
  .zen-banner-link:focus-visible { outline: 2px solid var(--vscode-focusBorder, #3b82f6); outline-offset: 2px; border-radius: 2px; }

  .zen-banner-action {
    flex: none; position: relative; z-index: 1; cursor: pointer;
    display: inline-flex; align-items: center; white-space: nowrap; text-decoration: none;
    font-family: inherit; font-size: 12px; font-weight: 600; line-height: 1;
    padding: 8px 14px; border-radius: 6px;
    color: var(--zb-fg);
    background: var(--zb-soft);
    border: 1px dashed var(--zb-border);
  }
  .zen-banner-action:hover { background: rgba(var(--zb-rgb), .25); }
  .zen-banner-action:focus-visible { outline: 2px solid var(--vscode-focusBorder, #3b82f6); outline-offset: 2px; }

  @media (prefers-reduced-motion: reduce) {
    .zen-banner, .zen-banner::after,
    .zen-banner-icon::before, .zen-banner-icon::after,
    .zen-banner-icon svg, .zen-banner-icon .gap,
    .zen-banner-dot, .zen-banner-link { animation: none; }
  }
`;

// ─── Icons ─────────────────────────────────────────────────────────────
const svgProps = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 2,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

const ConnectionIcon = (
  <svg {...svgProps}>
    <path d="M9 7V3M15 7V3M7 7h10v3a5 5 0 01-2 4" />
    <path d="M9 14a5 5 0 01-2-4" />
    <path className="gap" d="M12 17v4M4 4l16 16" />
  </svg>
);

const UpdateIcon = (
  <svg {...svgProps}>
    <circle cx="12" cy="12" r="10" />
    <polyline points="16 12 12 8 8 12" />
    <line x1="12" y1="16" x2="12" y2="8" />
  </svg>
);

const AccountIcon = (
  <svg {...svgProps}>
    <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <line x1="19" y1="8" x2="19" y2="14" />
    <line x1="22" y1="11" x2="16" y2="11" />
  </svg>
);

// ─── Sub-components ─────────────────────────────────────────────────────
const ExternalLink: React.FC<{ href: string; children: React.ReactNode }> = ({
  href,
  children,
}) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="zen-banner-link"
  >
    {children}
  </a>
);

const ActionLink: React.FC<{ href: string; children: React.ReactNode }> = ({
  href,
  children,
}) => (
  <a
    href={href}
    target="_blank"
    rel="noopener noreferrer"
    className="zen-banner-action"
  >
    {children}
  </a>
);

const VersionBadge: React.FC<{ info: UpdateInfo }> = ({ info }) => (
  <span className="zen-banner-versions">
    <span>{info.currentVersion}</span>
    <span className="zen-banner-arrow">→</span>
    <span>{info.latestVersion}</span>
  </span>
);

const Banner: React.FC<BannerProps> = ({
  variant,
  icon,
  title,
  badge,
  children,
  action,
}) => (
  <div
    className={`zen-banner zen-banner--${variant}`}
    role={variant === "error" ? "alert" : "status"}
  >
    <div className="zen-banner-icon" aria-hidden="true">
      {icon}
    </div>
    <div className="zen-banner-body">
      <div className="zen-banner-head">
        <span className="zen-banner-title">{title}</span>
        <span className="zen-banner-badge">
          <span className="zen-banner-dot"></span>
          {badge}
        </span>
      </div>
      <p className="zen-banner-text">{children}</p>
    </div>
    {action}
  </div>
);

// ─── Component ─────────────────────────────────────────────────────────
const HomeBanner: React.FC<HomeBannerProps> = ({
  isConnected,
  zenUpdateInfo,
  apiUpdateInfo,
  totalAccounts,
  accountsLoaded,
  onOpenAccounts,
}) => {
  const showNoAccount = isConnected && accountsLoaded && totalAccounts === 0;

  if (isConnected && !zenUpdateInfo && !apiUpdateInfo && !showNoAccount) {
    return null;
  }

  return (
    <>
      <style>{styles}</style>
      <div className="zen-banner-stack">
        {!isConnected && (
          <Banner
            variant="error"
            icon={ConnectionIcon}
            title="Connection Failed"
            badge="Not connected to AIWeb2API"
            action={
              <ActionLink href="https://github.com/KhanhRomVN/AIWeb2API/releases/latest">
                Download
              </ActionLink>
            }
          >
            Zen requires{" "}
            <ExternalLink href="https://github.com/KhanhRomVN/AIWeb2API">
              AIWeb2API
            </ExternalLink>{" "}
            backend running. Make sure AIWeb2API is installed and running before
            using Zen.
          </Banner>
        )}

        {zenUpdateInfo && (
          <Banner
            variant="success"
            icon={UpdateIcon}
            title="Update available"
            badge={<VersionBadge info={zenUpdateInfo} />}
            action={
              <ActionLink href="https://github.com/KhanhRomVN/Zen/releases/latest">
                Download
              </ActionLink>
            }
          >
            A new version of{" "}
            <ExternalLink href="https://github.com/KhanhRomVN/Zen/releases/latest">
              Zen
            </ExternalLink>{" "}
            is available. Download the latest release to get the newest features
            and fixes.
          </Banner>
        )}

        {apiUpdateInfo && (
          <Banner
            variant="warning"
            icon={UpdateIcon}
            title="Update available"
            badge={<VersionBadge info={apiUpdateInfo} />}
            action={
              <ActionLink href="https://github.com/KhanhRomVN/AIWeb2API/releases/latest">
                Download
              </ActionLink>
            }
          >
            A new version of{" "}
            <ExternalLink href="https://github.com/KhanhRomVN/AIWeb2API/releases/latest">
              AIWeb2API
            </ExternalLink>{" "}
            is available. Download and replace the current binary to get the
            latest features and fixes.
          </Banner>
        )}

        {showNoAccount && (
          <Banner
            variant="info"
            icon={AccountIcon}
            title="No account yet"
            badge="Setup required"
            action={
              onOpenAccounts && (
                <button
                  type="button"
                  className="zen-banner-action"
                  onClick={onOpenAccounts}
                >
                  Add account
                </button>
              )
            }
          >
            Add at least one provider account to start chatting with Zen.
          </Banner>
        )}
      </div>
    </>
  );
};

export default HomeBanner;
