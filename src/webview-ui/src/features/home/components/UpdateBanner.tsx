/**
 * ------------------------------------------------------------------
 * UpdateBanner
 * ------------------------------------------------------------------
 * Banner hiển thị thông báo cần cập nhật AIWeb2API khi version đang
 * chạy cũ hơn latest release trên GitHub.
 * Chỉ hiện khi health check trả về version field và GitHub API xác
 * nhận có bản mới hơn.
 *
 * Style: dùng cùng hệ thống với InstallationBanner (CSS-in-JS via
 * <style>), màu vàng/warning thay cho đỏ/error.
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
import React from "react";
import { UpdateInfo } from "@/context/BackendConnectionContext";

// ─── Types ──────────────────────────────────────────────────────────────
interface UpdateBannerProps {
  updateInfo: UpdateInfo | null;
}

// ─── Styles (CSS-in-JS via <style>) ─────────────────────────────────────
const styles = `
  .zen-update-banner {
    position: relative;
    width: 100%; max-width: 480px;
    display: flex; gap: 14px; align-items: center;
    padding: 16px;
    border-radius: 12px;
    border: 1px dashed var(--vscode-editorWarning-border, rgba(234,179,8,.5));
    background:
      radial-gradient(120% 140% at 0% 0%, var(--vscode-editorWarning-background, rgba(234,179,8,.13)), transparent 55%),
      var(--vscode-sideBar-background, #0f131c);
    overflow: hidden;
    animation: zen-update-glow 3s ease-in-out infinite;
    box-sizing: border-box;
    margin-bottom: 12px;
  }
  @keyframes zen-update-glow {
    0%, 100% { box-shadow: 0 0 0 0 rgba(234,179,8,0), 0 8px 28px -14px rgba(234,179,8,.15); }
    50%      { box-shadow: 0 0 0 1px var(--vscode-editorWarning-highlight, rgba(234,179,8,.12)), 0 8px 28px -10px rgba(234,179,8,.35); }
  }
  .zen-update-banner::after {
    content: ""; position: absolute; top: 0; bottom: 0; left: -40%; width: 30%;
    background: linear-gradient(100deg, transparent, var(--vscode-editorWarning-shimmer, rgba(234,179,8,.08)), transparent);
    animation: zen-update-sweep 5s ease-in-out infinite;
    pointer-events: none;
  }
  @keyframes zen-update-sweep {
    0%, 55% { left: -40%; }
    100%    { left: 130%; }
  }

  .zen-update-icon {
    flex: none; width: 40px; height: 40px; border-radius: 10px;
    display: grid; place-items: center;
    background: var(--vscode-editorWarning-bgSoft, rgba(234,179,8,.14));
    color: var(--vscode-editorWarning-foreground, #eab308);
    position: relative;
  }
  .zen-update-icon svg { width: 20px; height: 20px; }
  .zen-update-icon::after {
    content: ""; position: absolute; inset: 0; border-radius: inherit;
    border: 1px solid var(--vscode-editorWarning-foreground, #eab308);
    animation: zen-update-ping 2.2s ease-out infinite;
    opacity: 0;
  }
  @keyframes zen-update-ping {
    0%   { opacity: .7; transform: scale(1); }
    100% { opacity: 0;  transform: scale(1.6); }
  }
  .zen-update-icon::before {
    content: ""; position: absolute; inset: -5px; border-radius: 14px;
    border: 1px dashed var(--vscode-editorWarning-border, rgba(234,179,8,.55));
    animation: zen-update-orbit 8s linear infinite;
  }
  @keyframes zen-update-orbit { to { transform: rotate(360deg); } }

  .zen-update-icon svg { animation: zen-update-jolt 3s linear infinite; }
  @keyframes zen-update-jolt {
    0%, 70%, 80%, 100% { transform: translateY(0); }
    72% { transform: translateY(-1.5px); }
    74% { transform: translateY(1.5px); }
    76% { transform: translateY(-1px); }
    78% { transform: translateY(1px); }
  }

  .zen-update-body { flex: 1; min-width: 0; position: relative; z-index: 1; }
  .zen-update-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .zen-update-title {
    font-size: 14px; font-weight: 600; letter-spacing: .01em;
    color: var(--vscode-foreground, #e8ecf4);
  }
  .zen-update-badge {
    display: inline-flex; align-items: center; gap: 6px; line-height: 1;
    font-size: 11px; font-weight: 500;
    color: var(--vscode-editorWarning-foreground, #eab308);
    padding: 2px 8px; border-radius: 4px;
    background: var(--vscode-editorWarning-bgSoft, rgba(234,179,8,.12));
    border: 1px dashed var(--vscode-editorWarning-border, rgba(234,179,8,.45));
  }
  .zen-update-dot {
    flex: none; display: block; width: 6px; height: 6px;
    border-radius: 50%; background: currentColor;
    animation: zen-update-blink 1.4s ease-in-out infinite;
  }
  @keyframes zen-update-blink { 50% { opacity: .25; } }

  .zen-update-text {
    margin-top: 6px; font-size: 13px; line-height: 1.55;
    color: var(--vscode-descriptionForeground, #8b95a8);
    text-align: left;
  }
  .zen-update-versions {
    display: inline-flex; align-items: center; gap: 6px;
    font-size: 12px; font-weight: 600;
    color: var(--vscode-editorWarning-foreground, #eab308);
  }
  .zen-update-arrow { opacity: .7; }

  .zen-update-link {
    font-weight: 700; text-decoration: none;
    background: linear-gradient(90deg, #ffe14d, #ff9f1c, #eab308, #fbbf24, #ffe14d);
    background-size: 200% 100%;
    -webkit-background-clip: text; background-clip: text;
    -webkit-text-fill-color: transparent; color: transparent;
    animation: zen-update-shimmer 3s linear infinite;
    position: relative;
  }
  .zen-update-link::after {
    content: ""; position: absolute; left: 0; right: 0; bottom: -1px; height: 1px;
    background: inherit; background-size: 200% 100%;
    opacity: .6;
  }
  .zen-update-link:hover::after { opacity: 1; }
  @keyframes zen-update-shimmer { to { background-position: 200% 0; } }
  .zen-update-link:focus-visible { outline: 2px solid var(--vscode-focusBorder, #3b82f6); outline-offset: 2px; border-radius: 2px; }

  @media (prefers-reduced-motion: reduce) {
    .zen-update-banner, .zen-update-banner::after,
    .zen-update-icon::before, .zen-update-icon::after,
    .zen-update-icon svg, .zen-update-dot, .zen-update-link { animation: none; }
  }
`;

// ─── Component ──────────────────────────────────────────────────────────
const UpdateBanner: React.FC<UpdateBannerProps> = ({ updateInfo }) => {
  if (!updateInfo) return null;

  const { currentVersion, latestVersion } = updateInfo;

  return (
    <>
      <style>{styles}</style>
      <div className="zen-update-banner" role="alert" aria-live="polite">
        <div className="zen-update-icon" aria-hidden="true">
          {/* Arrow-up-circle icon */}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="10" />
            <polyline points="16 12 12 8 8 12" />
            <line x1="12" y1="16" x2="12" y2="8" />
          </svg>
        </div>

        <div className="zen-update-body">
          <div className="zen-update-head">
            <span className="zen-update-title">Update available</span>
            <span className="zen-update-badge">
              <span className="zen-update-dot"></span>
              <span className="zen-update-versions">
                <span>{currentVersion}</span>
                <span className="zen-update-arrow">→</span>
                <span>{latestVersion}</span>
              </span>
            </span>
          </div>

          <p className="zen-update-text">
            A new version of{" "}
            <a
              href="https://github.com/KhanhRomVN/AIWeb2API/releases/latest"
              target="_blank"
              rel="noopener noreferrer"
              className="zen-update-link"
            >
              AIWeb2API
            </a>{" "}
            is available. Download and replace the current binary to get the latest features and fixes.
          </p>
        </div>
      </div>
    </>
  );
};

export default UpdateBanner;
