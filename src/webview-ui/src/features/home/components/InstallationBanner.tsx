/**
 * ------------------------------------------------------------------
 * InstallationBanner
 * ------------------------------------------------------------------
 * Banner hiển thị yêu cầu cài đặt AIWeb2API backend khi không kết nối.
 * Áp dụng UI tham khảo: dashed border, glow animation, icon ping/jolt.
 * Màu sắc lấy từ VS Code theme variables (--vscode-editorError-*).
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
import React from "react";

// ─── Types ──────────────────────────────────────────────────────────────
interface InstallationBannerProps {
  isConnected: boolean;
}

// ─── Styles (CSS-in-JS via <style>) ─────────────────────────────────────
const styles = `
  .zen-install-banner {
    position: relative;
    width: 100%; max-width: 480px;
    display: flex; gap: 14px; align-items: center;
    padding: 16px;
    border-radius: 12px;
    border: 1px dashed var(--vscode-editorError-border, rgba(239,68,68,.5));
    background:
      radial-gradient(120% 140% at 0% 0%, var(--vscode-editorError-background, rgba(239,68,68,.13)), transparent 55%),
      var(--vscode-sideBar-background, #0f131c);
    overflow: hidden;
    animation: zen-glow 3s ease-in-out infinite;
    box-sizing: border-box;
    margin-bottom: 12px;
  }
  @keyframes zen-glow {
    0%, 100% { box-shadow: 0 0 0 0 rgba(239,68,68,0), 0 8px 28px -14px rgba(239,68,68,.15); }
    50%      { box-shadow: 0 0 0 1px var(--vscode-editorError-highlight, rgba(239,68,68,.12)), 0 8px 28px -10px rgba(239,68,68,.35); }
  }
  .zen-install-banner::after {
    content: ""; position: absolute; top: 0; bottom: 0; left: -40%; width: 30%;
    background: linear-gradient(100deg, transparent, var(--vscode-editorError-shimmer, rgba(239,68,68,.08)), transparent);
    animation: zen-sweep 5s ease-in-out infinite;
    pointer-events: none;
  }
  @keyframes zen-sweep {
    0%, 55% { left: -40%; }
    100%    { left: 130%; }
  }

  .zen-install-icon {
    flex: none; width: 40px; height: 40px; border-radius: 10px;
    display: grid; place-items: center;
    background: var(--vscode-editorError-bgSoft, rgba(239,68,68,.14));
    color: var(--vscode-editorError-foreground, #ef4444);
    position: relative;
  }
  .zen-install-icon svg { width: 20px; height: 20px; }
  .zen-install-icon::after {
    content: ""; position: absolute; inset: 0; border-radius: inherit;
    border: 1px solid var(--vscode-editorError-foreground, #ef4444);
    animation: zen-ping 2.2s ease-out infinite;
    opacity: 0;
  }
  @keyframes zen-ping {
    0%   { opacity: .7; transform: scale(1); }
    100% { opacity: 0;  transform: scale(1.6); }
  }
  .zen-install-icon::before {
    content: ""; position: absolute; inset: -5px; border-radius: 14px;
    border: 1px dashed var(--vscode-editorError-border, rgba(239,68,68,.55));
    animation: zen-orbit 8s linear infinite;
  }
  @keyframes zen-orbit { to { transform: rotate(360deg); } }
  
  .zen-install-icon svg { animation: zen-jolt 3s linear infinite; }
  @keyframes zen-jolt {
    0%, 70%, 80%, 100% { transform: translateX(0); }
    72% { transform: translateX(-1.5px); }
    74% { transform: translateX(1.5px); }
    76% { transform: translateX(-1px); }
    78% { transform: translateX(1px); }
  }
  .zen-install-icon .gap { animation: zen-flicker 3s steps(1) infinite; }
  @keyframes zen-flicker {
    0%, 70%, 78%, 100% { opacity: 1; }
    72%, 76% { opacity: .2; }
  }

  .zen-install-body { flex: 1; min-width: 0; position: relative; z-index: 1; }
  .zen-install-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .zen-install-title { 
    font-size: 14px; font-weight: 600; letter-spacing: .01em; 
    color: var(--vscode-foreground, #e8ecf4);
  }
  .zen-install-status {
    display: inline-flex; align-items: center; gap: 6px; line-height: 1;
    font-size: 11px; font-weight: 500; 
    color: var(--vscode-editorError-foreground, #f87171);
    padding: 2px 8px; border-radius: 4px;
    background: var(--vscode-editorError-bgSoft, rgba(239,68,68,.12));
    border: 1px dashed var(--vscode-editorError-border, rgba(239,68,68,.45));
  }
  .zen-install-dot { 
    flex: none; display: block; width: 6px; height: 6px; margin-top: 0; 
    border-radius: 50%; background: currentColor; 
    animation: zen-blink 1.4s ease-in-out infinite; 
  }
  @keyframes zen-blink { 50% { opacity: .25; } }

  .zen-install-text { 
    margin-top: 6px; font-size: 13px; line-height: 1.55; 
    color: var(--vscode-descriptionForeground, #8b95a8);
    text-align: left;
  }
  .zen-install-link {
    font-weight: 700; text-decoration: none;
    background: linear-gradient(90deg, #ff4d4d, #ff9f1c, #ffe14d, #3ddc84, #3b9bff, #8b5cf6, #ff4dc4, #ff4d4d);
    background-size: 200% 100%;
    -webkit-background-clip: text; background-clip: text;
    -webkit-text-fill-color: transparent; color: transparent;
    animation: zen-rainbow 4s linear infinite;
    position: relative;
  }
  .zen-install-link::after {
    content: ""; position: absolute; left: 0; right: 0; bottom: -1px; height: 1px;
    background: inherit; background-size: 200% 100%;
    opacity: .6;
  }
  .zen-install-link:hover::after { opacity: 1; }
  @keyframes zen-rainbow { to { background-position: 200% 0; } }
  .zen-install-link:focus-visible { outline: 2px solid var(--vscode-focusBorder, #3b82f6); outline-offset: 2px; border-radius: 2px; }

  @media (prefers-reduced-motion: reduce) {
    .zen-install-banner, .zen-install-banner::after, .zen-install-icon::before, .zen-install-icon::after, .zen-install-icon svg, .zen-install-icon .gap, .zen-install-dot, .zen-install-link { animation: none; }
  }
`;

// ─── Component ──────────────────────────────────────────────────────────
const InstallationBanner: React.FC<InstallationBannerProps> = ({ isConnected }) => {
  if (isConnected) return null;

  return (
    <>
      <style>{styles}</style>
      <div className="zen-install-banner" role="alert">
        <div className="zen-install-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 7V3M15 7V3M7 7h10v3a5 5 0 01-2 4"/>
            <path d="M9 14a5 5 0 01-2-4"/>
            <path className="gap" d="M12 17v4M4 4l16 16"/>
          </svg>
        </div>

        <div className="zen-install-body">
          <div className="zen-install-head">
            <span className="zen-install-title">Installation required</span>
            <span className="zen-install-status"><span className="zen-install-dot"></span>Not connected to AIWeb2API</span>
          </div>

          <p className="zen-install-text">
            Zen requires{" "}
            <a 
              href="https://github.com/KhanhRomVN/AIWeb2API" 
              target="_blank" 
              rel="noopener noreferrer"
              className="zen-install-link"
            >
              AIWeb2API
            </a>{" "}
            backend running. Make sure AIWeb2API is installed and running before using Zen.
          </p>
        </div>
      </div>
    </>
  );
};

export default InstallationBanner;