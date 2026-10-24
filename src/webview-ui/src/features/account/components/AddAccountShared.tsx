import React, { useState } from "react";
import { Key } from "lucide-react";
import { getFaviconUrl } from "@/utils/favicon";
import {
  Banner,
  bannerStyles,
  BannerAccountIcon,
} from "../../home/components/HomeBanner";
import {
  AUTH_LABELS,
  ICON_METHODS,
  authIconFile,
  isMergedAuth,
  splitAuthMethod,
  type Provider,
} from "./addAccount.utils";

export const sharedBackdrop = (onClickBackdrop: () => void) => (
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

export const sharedSheet = (
  children: React.ReactNode,
  height: string = "70%",
) => (
  <div
    style={{
      position: "fixed",
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor: "var(--tertiary-bg)",
      borderTop: "1px solid var(--border-color)",
      boxShadow: "0 -8px 32px rgba(0,0,0,0.25)",
      zIndex: 201,
      height,
      display: "flex",
      flexDirection: "column",
      animation: "aaSlideUp 0.22s ease",
    }}
  >
    {children}
  </div>
);

export const AuthGlyph: React.FC<{ method: string; size?: number }> = ({
  method,
  size = 11,
}) => {
  const [failed, setFailed] = useState(false);
  const baseUri = (window as any).__zenImagesUri as string | undefined;
  if (!baseUri || failed || !ICON_METHODS.includes(method)) {
    return <Key size={size} />;
  }
  return (
    <img
      src={`${baseUri}/auth_icons/${authIconFile(method)}`}
      alt={method}
      style={{ width: `${size}px`, height: `${size}px`, objectFit: "contain" }}
      onError={() => setFailed(true)}
    />
  );
};

export const MergedAuthNotice: React.FC<{ methods: string[] }> = ({ methods }) => {
  const merged = methods.filter(isMergedAuth);
  if (merged.length === 0) return null;
  const labels = (m: string) =>
    splitAuthMethod(m)
      .map((part) => AUTH_LABELS[part] ?? part)
      .join(" / ");
  return (
    <>
      <style>{bannerStyles}</style>
      <Banner
        variant="info"
        icon={BannerAccountIcon}
        title="Merged login methods"
        badge={merged.map(labels).join(" | ")}
      >
        Sign in with any of these methods ({merged.map(labels).join("; ")}). If
        they resolve to the same email, they count as a single account.
      </Banner>
    </>
  );
};

export const ProviderFavicon: React.FC<{ provider: Provider; size?: number }> = ({
  provider,
  size = 20,
}) => {
  const [imgError, setImgError] = useState(false);
  const iconUrl = getFaviconUrl(provider.website_url || provider.website);
  if (!iconUrl || imgError) return null;
  return (
    <img
      src={iconUrl}
      alt={provider.provider_name}
      style={{
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: "4px",
        objectFit: "contain",
        flexShrink: 0,
      }}
      onError={() => setImgError(true)}
    />
  );
};
