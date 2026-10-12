/**
 * ------------------------------------------------------------------
 * ZenUpdateBanner
 * ------------------------------------------------------------------
 * Banner thông báo có bản release mới của chính Zen trên GitHub.
 * Dữ liệu lấy từ hook useZenUpdate (version hiện tại đọc từ
 * package.json qua window.__zenVersion).
 *
 * Style: dùng lại updateBannerStyles của AIWeb2APIUpdateBanner để
 * hai banner luôn đồng bộ giao diện.
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
import React from "react";
import { UpdateInfo } from "@/context/BackendConnectionContext";
import { updateBannerStyles } from "./AIWeb2APIUpdateBanner";

// ─── Types ──────────────────────────────────────────────────────────────
interface ZenUpdateBannerProps {
  updateInfo: UpdateInfo | null;
}

// ─── Component ──────────────────────────────────────────────────────────
const ZenUpdateBanner: React.FC<ZenUpdateBannerProps> = ({ updateInfo }) => {
  if (!updateInfo) return null;

  const { currentVersion, latestVersion } = updateInfo;

  return (
    <>
      <style>{updateBannerStyles}</style>
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
              href="https://github.com/KhanhRomVN/Zen/releases/latest"
              target="_blank"
              rel="noopener noreferrer"
              className="zen-update-link"
            >
              Zen
            </a>{" "}
            is available. Download the latest release to get the newest features and fixes.
          </p>
        </div>
      </div>
    </>
  );
};

export default ZenUpdateBanner;