/**
 * ------------------------------------------------------------------
 * useZenUpdate
 * ------------------------------------------------------------------
 * Kiểm tra bản release mới nhất của Zen trên GitHub và so với version
 * đang chạy (window.__zenVersion, đọc từ package.json lúc runtime).
 *
 * Main functions:
 * - useZenUpdate() : Trả về UpdateInfo khi có bản mới hơn, ngược lại null
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
import { useEffect, useState } from "react";
import { UpdateInfo, isOutdated } from "@/context/BackendConnectionContext";

// ─── Constants ──────────────────────────────────────────────────────────
const GITHUB_LATEST_API =
  "https://api.github.com/repos/KhanhRomVN/Zen/releases/latest";

// Cache theo session ở module-level: Home mount lại nhiều lần nhưng chỉ
// gọi GitHub 1 lần (API không xác thực giới hạn 60 request/giờ).
let latestVersionPromise: Promise<string | null> | null = null;

function fetchLatestVersion(): Promise<string | null> {
  if (!latestVersionPromise) {
    latestVersionPromise = (async () => {
      try {
        const res = await fetch(GITHUB_LATEST_API, {
          headers: { Accept: "application/vnd.github+json" },
          signal: AbortSignal.timeout(5000),
        });
        if (!res.ok) return null;
        const data = await res.json();
        return (data.tag_name as string | undefined) ?? null;
      } catch {
        // Ignore network errors — không có update info
        return null;
      }
    })();
  }
  return latestVersionPromise;
}

// ─── Hook ───────────────────────────────────────────────────────────────
/** Trả về UpdateInfo khi GitHub có bản Zen mới hơn bản đang chạy, ngược lại null. */
export function useZenUpdate(): UpdateInfo | null {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);

  useEffect(() => {
    const rawVersion = (window as any).__zenVersion as string | undefined;
    if (!rawVersion) return;
    // Chuẩn hóa dạng "v2.4.5" cho khớp tag_name của GitHub
    const currentVersion = `v${rawVersion.replace(/^v/, "")}`;

    let cancelled = false;
    fetchLatestVersion().then((latestVersion) => {
      if (cancelled) return;
      if (latestVersion && isOutdated(currentVersion, latestVersion)) {
        setUpdateInfo({ currentVersion, latestVersion });
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return updateInfo;
}