/**
 * ------------------------------------------------------------------
 * Favicon Utilities
 * ------------------------------------------------------------------
 * Tập hợp các tiện ích và React component dùng để tải, kiểm tra
 * và hiển thị favicon cho URL. Hỗ trợ nhiều nguồn dự phòng
 * (Google S2, DuckDuckGo, Yandex) và tự động fallback về icon mặc định.
 *
 * Main functions & features:
 * - getFaviconUrl()      : Tạo URL favicon từ domain (Google S2)
 * - getFaviconSources()  : Liệt kê nhiều nguồn favicon dự phòng
 * - validateImageUrl()   : Kiểm tra URL ảnh có tải được không
 * - useFavicon()         : Hook tải favicon với cơ chế fallback
 * - Favicon              : Component hiển thị favicon kèm trạng thái loading/error
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── React ──
import React, { useState, useEffect } from "react";
import { logger } from "./logger";

// ── Utils ──

// ─── Interfaces ─────────────────────────────────────────────────────────
export interface FaviconProps {
  url?: string;
  size?: number;
  className?: string;
  alt?: string;
  fallbackIcon?: React.ReactNode;
  onError?: () => void;
  onLoad?: () => void;
}

// ─── Functions ──────────────────────────────────────────────────────────
export const getFaviconUrl = (url?: string, size: number = 32): string => {
  if (!url) return "/favicon-fallback.png";

  try {
    const domain = new URL(url).hostname;
    // Google's favicon service - most reliable
    return `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`;
  } catch {
    return "/favicon-fallback.png";
  }
};

export const getFaviconSources = (
  url?: string,
  size: number = 32,
): string[] => {
  if (!url) return ["/favicon-fallback.png"];

  try {
    const domain = new URL(url).hostname;
    return [
      `https://www.google.com/s2/favicons?domain=${domain}&sz=${size}`,
      `https://icons.duckduckgo.com/ip3/${domain}.ico`,
      `https://favicon.yandex.net/favicon/${domain}`,
      `https://${domain}/favicon.ico`,
      `https://${domain}/favicon.png`,
      `https://${domain}/apple-touch-icon.png`,
      "/favicon-fallback.png",
    ];
  } catch {
    return ["/favicon-fallback.png"];
  }
};

export const validateImageUrl = (url: string): Promise<boolean> => {
  return new Promise((resolve) => {
    const img = new Image();
    // Note: Do NOT set crossOrigin here — many favicon services (like Google S2)
    // don't return Access-Control-Allow-Origin headers, which causes CORS errors
    // and false negatives. Simple <img> display doesn't need CORS.

    const timeout = setTimeout(() => {
      img.onload = null;
      img.onerror = null;
      resolve(false);
    }, 5000); // 5 second timeout

    img.onload = () => {
      clearTimeout(timeout);
      resolve(true);
    };

    img.onerror = () => {
      clearTimeout(timeout);
      resolve(false);
    };

    img.src = url;
  });
};

// ─── Hook ───────────────────────────────────────────────────────────────
export const useFavicon = (url?: string, size: number = 32) => {
  // ── State ──
  const [faviconUrl, setFaviconUrl] = useState<string>("/favicon-fallback.png");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Effects ──
  useEffect(() => {
    if (!url) {
      setIsLoading(false);
      setError("No URL provided");
      return;
    }

    const loadFavicon = async () => {
      setIsLoading(true);
      setError(null);

      try {
        const sources = getFaviconSources(url, size);

        for (const src of sources) {
          try {
            const isValid = await validateImageUrl(src);
            if (isValid) {
              setFaviconUrl(src);
              setIsLoading(false);
              return;
            }
          } catch (err) {
            logger.error(`Failed to load favicon from ${src}:`, err);
            continue;
          }
        }

        // If we get here, all sources failed
        setFaviconUrl("/favicon-fallback.png");
        setError("All favicon sources failed");
      } catch (err) {
        setFaviconUrl("/favicon-fallback.png");
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsLoading(false);
      }
    };

    loadFavicon();
  }, [url, size]);

  return { faviconUrl, isLoading, error };
};
