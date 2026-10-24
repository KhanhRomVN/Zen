import React, { useState, useMemo } from "react";
import {
  Loader2,
  X,
  AlertCircle,
  Search,
  Key,
  ChevronLeft,
  CircleUserRound,
  Hexagon,
  Diamond,
  Star,
  Zap,
  Flame,
  Leaf,
  Mountain,
  Heart,
  Rocket,
} from "lucide-react";
import { getFaviconUrl } from "@/utils/favicon";
import {
  AuthGlyph,
  MergedAuthNotice,
  ProviderFavicon,
  sharedBackdrop,
  sharedSheet,
} from "./AddAccountShared";
import { type ProfileEntry, type Provider } from "./addAccount.utils";

const MethodCard: React.FC<{
  icon: React.ReactNode;
  label: string;
  desc: string;
  onClick: () => void;
  disabled?: boolean;
}> = ({ icon, label, desc, onClick, disabled }) => {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onClick={() => {
        if (!disabled) onClick();
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "14px",
        padding: "12px 14px",
        borderRadius: "10px",
        backgroundColor:
          hovered && !disabled
            ? "var(--hover-bg, rgba(128,128,128,0.07))"
            : "var(--input-bg)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        transition: "all 0.13s ease",
        border: "none",
      }}
    >
      <div
        style={{
          minWidth: "36px",
          width: "fit-content",
          height: "36px",
          padding: "0 8px",
          boxSizing: "border-box",
          borderRadius: "9px",
          backgroundColor: "rgba(128,128,128,0.1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "4px",
          flexShrink: 0,
          color: "var(--primary-text)",
        }}
      >
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: "13px",
            fontWeight: 600,
            color: "var(--primary-text)",
          }}
        >
          {label}
        </div>
        <div
          style={{
            fontSize: "11px",
            color: "var(--secondary-text)",
            marginTop: "2px",
            opacity: 0.7,
          }}
        >
          {desc}
        </div>
      </div>
      <ChevronLeft
        size={15}
        style={{
          color: "var(--secondary-text)",
          transform: "rotate(180deg)",
          opacity: 0.5,
          flexShrink: 0,
        }}
      />
    </div>
  );
};

// ─── Avatar helpers (Lucide icon mapping + hash-based selection) ──────────
/* eslint-disable @typescript-eslint/no-explicit-any */
/** Danh sách 10 Lucide component dùng cho fallback avatar – ít nét, dễ phân biệt. */
const AVATAR_ICONS: React.ComponentType<any>[] = [
  CircleUserRound,
  Hexagon,
  Diamond,
  Star,
  Zap,
  Flame,
  Leaf,
  Mountain,
  Heart,
  Rocket,
];

/** Hash chuỗi → index ổn định trong mảng icon. */
const hashToIndex = (str: string, len: number): number => {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return Math.abs(h) % len;
};

/** Chọn Lucide icon cố định theo email/folder name. */
const pickAvatarIcon = (seed: string) => {
  const idx = hashToIndex(seed || "?", AVATAR_ICONS.length);
  return AVATAR_ICONS[idx];
};

/** Màu nền soft theo seed (giữ nguyên logic hue cũ nhưng đồng nhất hơn). */
const getToneFromSeed = (seed: string) => {
  const first = (seed.trim().charAt(0) || "?").toUpperCase();
  const hue = ((first.charCodeAt(0) || 0) * 47) % 360;
  return {
    bg: `hsla(${hue}, 70%, 55%, 0.15)`,
    color: `hsl(${hue}, 70%, 55%)`,
  };
};

/** Card 1 hoặc 2 dòng: avatar (ảnh thật hoặc Lucide icon) bên trái, label (+ desc). */
const ProfileCard: React.FC<{
  avatarUrl?: string;
  avatarFallbackSeed: string;
  badgeBg: string;
  badgeColor: string;
  label: string;
  desc?: string;
  onClick: () => void;
  disabled?: boolean;
}> = ({
  avatarUrl,
  avatarFallbackSeed,
  badgeBg,
  badgeColor,
  label,
  desc,
  onClick,
  disabled,
}) => {
  const [hovered, setHovered] = useState(false);
  const [imgError, setImgError] = useState(false);
  const IconComp = useMemo(
    () => pickAvatarIcon(avatarFallbackSeed),
    [avatarFallbackSeed],
  );
  const showImage = !!avatarUrl && !imgError;

  return (
    <div
      onClick={() => {
        if (!disabled) onClick();
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "12px",
        padding: "10px 12px",
        borderRadius: "10px",
        backgroundColor:
          hovered && !disabled
            ? "var(--hover-bg, rgba(128,128,128,0.07))"
            : "var(--input-bg)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.45 : 1,
        transition: "all 0.13s ease",
        border: "none",
        flexShrink: 0,
      }}
    >
      {/* Avatar container – ~32px (≈90% của 36px cũ) */}
      <div
        style={{
          width: "32px",
          height: "32px",
          borderRadius: "8px",
          backgroundColor: showImage ? "transparent" : badgeBg,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          flexShrink: 0,
          color: badgeColor,
          overflow: "hidden",
        }}
      >
        {showImage ? (
          <img
            src={avatarUrl}
            alt=""
            onError={() => setImgError(true)}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              borderRadius: "8px",
              display: "block",
            }}
          />
        ) : (
          <IconComp size={18} strokeWidth={1.75} />
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: "13px",
            fontWeight: 600,
            color: "var(--primary-text)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {label}
        </div>
        {desc && (
          <div
            style={{
              fontSize: "11px",
              color: "var(--secondary-text)",
              marginTop: "2px",
              opacity: 0.7,
            }}
          >
            {desc}
          </div>
        )}
      </div>
      <ChevronLeft
        size={14}
        style={{
          color: "var(--secondary-text)",
          transform: "rotate(180deg)",
          opacity: 0.5,
          flexShrink: 0,
        }}
      />
    </div>
  );
};

// ─── ProfilePicker ──────────────────────────────────────────────────────
/**
 * Searchbar + danh sách Chromium profile (card "No profile" luôn hiện đầu).
 * State search nằm trong component → tự reset mỗi lần mở lại bước chọn profile.
 */

const ProfilePicker: React.FC<{
  entries: ProfileEntry[];
  loading: boolean;
  error: string;
  disabled: boolean;
  /** Đường dẫn thư mục chứa các profile (chromiumProfileDir). */
  baseDir?: string;
  onSelect: (folder?: string) => void;
}> = ({ entries, loading, error, disabled, baseDir, onSelect }) => {
  const [query, setQuery] = useState("");

  // Rút gọn đường dẫn: …/<thư mục cha>/<folder> (hỗ trợ cả "/" và "\")
  const shortPath = (folder: string) => {
    const parent = (baseDir || "")
      .split(/[\\/]+/)
      .filter(Boolean)
      .pop();
    return parent ? `…/${parent}/${folder}` : `…/${folder}`;
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(
      (e) =>
        e.folder.toLowerCase().includes(q) ||
        (e.label && e.label.toLowerCase().includes(q)),
    );
  }, [entries, query]);

  return (
    <>
      {/* Searchbar */}
      <div style={{ padding: "10px 16px", flexShrink: 0 }}>
        <div style={{ position: "relative" }}>
          <Search
            size={14}
            style={{
              position: "absolute",
              left: "10px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--secondary-text)",
              pointerEvents: "none",
            }}
          />
          <input
            autoFocus
            type="text"
            placeholder="Search profiles..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px 8px 32px",
              fontSize: "13px",
              backgroundColor: "var(--input-bg)",
              border: "none",
              borderRadius: "8px",
              color: "var(--primary-text)",
              outline: "none",
              boxSizing: "border-box",
              height: "34px",
            }}
          />
        </div>
      </div>

      {/* Profile cards */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: "0 16px 12px",
          display: "flex",
          flexDirection: "column",
          gap: "8px",
        }}
      >
        <ProfileCard
          avatarFallbackSeed="__no_profile__"
          badgeBg="rgba(59,130,246,0.12)"
          badgeColor="#3b82f6"
          label="No profile"
          desc="Login as default with a fresh browser window"
          onClick={() => onSelect()}
          disabled={disabled}
        />

        {loading && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              padding: "12px",
              color: "var(--secondary-text)",
              fontSize: "12px",
            }}
          >
            <Loader2
              size={14}
              style={{ animation: "aaSpin 1s linear infinite" }}
            />
            Loading profiles…
          </div>
        )}

        {!loading && error && (
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

        {!loading &&
          !error &&
          filtered.map((entry) => {
            const displayName = entry.label || entry.folder;
            const tone = getToneFromSeed(displayName);
            return (
              <ProfileCard
                key={entry.folder}
                avatarUrl={entry.avatar}
                avatarFallbackSeed={displayName}
                badgeBg={tone.bg}
                badgeColor={tone.color}
                label={displayName}
                desc={entry.label ? shortPath(entry.folder) : undefined}
                onClick={() => onSelect(entry.folder)}
                disabled={disabled}
              />
            );
          })}

        {!loading && !error && filtered.length === 0 && (
          <div
            style={{
              textAlign: "center",
              color: "var(--secondary-text)",
              padding: "12px",
              fontSize: "12px",
            }}
          >
            {query.trim() ? "No matching profiles" : "No available profiles"}
          </div>
        )}
      </div>
    </>
  );
};

export const MethodPickerDrawer: React.FC<{
  provider: Provider;
  loading: boolean;
  error: string;
  onClose: () => void;
  onPickMethod: (method: string) => void;
}> = ({ provider, loading, error, onClose, onPickMethod }) => {
  const raw =
    (provider as any).auth_method ??
    (provider as any).auth_methods;
  const methods: string[] = (() => {
    if (!raw) return [];
    if (Array.isArray(raw))
      return raw.filter((m: any) => typeof m === "string" && m.length > 0);
    if (typeof raw === "string" && raw.trim()) {
      try {
        const p = JSON.parse(raw.trim());
        return Array.isArray(p) ? p.filter((m: any) => m) : [];
      } catch {
        return raw
          .trim()
          .split(/[,;|\s]+/)
          .filter((m: string) => m.length > 0);
      }
    }
    return [];
  })();

  const methodMeta: Record<
    string,
    { label: string; desc: string; icon: React.ReactNode }
  > = {
    google: {
      label: "Google",
      desc: "Sign in with your Google account via OAuth",
      icon: (() => {
        const baseUri = (window as any).__zenImagesUri as string | undefined;
        return baseUri ? (
          <img
            src={`${baseUri}/auth_icons/google.svg`}
            alt="Google"
            style={{ width: "20px", height: "20px", objectFit: "contain" }}
          />
        ) : (
          <Key size={18} />
        );
      })(),
    },
    github: {
      label: "GitHub",
      desc: "Sign in with your GitHub account via OAuth",
      icon: (() => {
        const baseUri = (window as any).__zenImagesUri as string | undefined;
        return baseUri ? (
          <img
            src={`${baseUri}/auth_icons/github.svg`}
            alt="GitHub"
            style={{ width: "20px", height: "20px", objectFit: "contain" }}
          />
        ) : (
          <Key size={18} />
        );
      })(),
    },
    x: {
      label: "X / xAI",
      desc: "Sign in via device code — browser will open automatically",
      icon: (() => {
        const baseUri = (window as any).__zenImagesUri as string | undefined;
        return baseUri ? (
          <img
            src={`${baseUri}/auth_icons/x.svg`}
            alt="X"
            style={{ width: "20px", height: "20px", objectFit: "contain" }}
          />
        ) : (
          <Key size={18} />
        );
      })(),
    },
    basic: {
      label: "Basic",
      desc: "Enter your email and password directly — no OAuth required",
      icon: <Key size={18} />,
    },
    microsoft: {
      label: "Microsoft",
      desc: "Sign in with your Microsoft account via OAuth",
      icon: <AuthGlyph method="microsoft" size={20} />,
    },
    apple: {
      label: "Apple",
      desc: "Sign in with your Apple account via OAuth",
      icon: <AuthGlyph method="apple" size={20} />,
    },
    google_github: {
      label: "Google / GitHub",
      desc: "Either provider works — same email counts as one account",
      icon: (
        <span style={{ display: "inline-flex", gap: "3px" }}>
          <AuthGlyph method="google" size={18} />
          <AuthGlyph method="github" size={18} />
        </span>
      ),
    },
    google_github_microsoft: {
      label: "Google / GitHub / Microsoft",
      desc: "Any of the three works — same email counts as one account",
      icon: (
        <span
          style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}
        >
          <AuthGlyph method="google" size={18} />
          <AuthGlyph method="github" size={18} />
          <AuthGlyph method="microsoft" size={18} />
        </span>
      ),
    },
  };

  const iconUrl = getFaviconUrl(
    provider.website_url || provider.website,
  );

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
              gap: "10px",
              flexShrink: 0,
            }}
          >
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
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor =
                  "rgba(128,128,128,0.1)";
                e.currentTarget.style.color = "var(--primary-text)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
                e.currentTarget.style.color = "var(--secondary-text)";
              }}
            >
              <ChevronLeft size={16} />
            </button>
            {iconUrl && (
              <img
                src={iconUrl}
                alt={provider.provider_name}
                style={{
                  width: "20px",
                  height: "20px",
                  borderRadius: "4px",
                  objectFit: "contain",
                }}
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            )}
            <div>
              <div
                style={{
                  fontSize: "16px",
                  fontWeight: 700,
                  color: "var(--primary-text)",
                }}
              >
                {provider.provider_name}
              </div>
              <div
                style={{
                  fontSize: "11px",
                  color: "var(--secondary-text)",
                  opacity: 0.7,
                }}
              >
                Select a login method
              </div>
            </div>
          </div>

          {/* Method cards */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "12px 16px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            <MergedAuthNotice methods={methods} />
            {methods.map((method) => {
              const meta = methodMeta[method] ?? {
                label: method,
                desc: `Sign in with ${method}`,
                icon: <Key size={18} />,
              };
              return (
                <MethodCard
                  key={method}
                  icon={meta.icon}
                  label={meta.label}
                  desc={meta.desc}
                  onClick={() => onPickMethod(method)}
                  disabled={loading}
                />
              );
            })}
          </div>

          {error && (
            <div
              style={{
                margin: "0 16px 12px",
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
        </>,
        "50%",
      )}
      <style>{`
        @keyframes aaSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes aaFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes aaSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
};

export const ProfilePickerDrawer: React.FC<{
  provider: Provider;
  entries: ProfileEntry[];
  isDefaultChrome: boolean;
  existingEmails: Set<string>;
  profilesLoading: boolean;
  profilesError: string;
  loading: boolean;
  baseDir?: string;
  onClose: () => void;
  onBack: () => void;
  onStart: (folder?: string) => void;
}> = ({
  provider,
  entries,
  isDefaultChrome,
  existingEmails,
  profilesLoading,
  profilesError,
  loading,
  baseDir,
  onClose,
  onBack,
  onStart,
}) => {
  // Custom profile folder: KHÔNG ẩn theo email; chỉ fallback Chrome mới áp dụng filter.
  // Fallback Chrome mặc định: backend đã lọc sẵn profiles không có email, nên ở đây
  // chỉ cần ẩn những profile trùng email với accounts hiện có.
  const visibleEntries = isDefaultChrome
    ? entries.filter(
        (p) => !(p.label && existingEmails.has(p.label.trim().toLowerCase())),
      )
    : entries;

  const hiddenEntries = isDefaultChrome
    ? entries.filter(
        (p) => p.label && existingEmails.has(p.label.trim().toLowerCase()),
      )
    : [];

  if (hiddenEntries.length > 0) {
    console.warn(
      "[AddAccountDrawer] Profiles bị ẩn (trùng với existingEmails):",
      hiddenEntries.map((p) => ({ folder: p.folder, label: p.label })),
    );
  }
  // ─────────────────────────────────────────────────────────────────────
  const backToMethods = onBack;
  const startLogin = onStart;

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
              gap: "10px",
              flexShrink: 0,
            }}
          >
            <button
              onClick={backToMethods}
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
            >
              <ChevronLeft size={16} />
            </button>
            <div>
              <div
                style={{
                  fontSize: "16px",
                  fontWeight: 700,
                  color: "var(--primary-text)",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <ProviderFavicon provider={provider} />
                <span>{provider.provider_name}</span>
              </div>
              <div
                style={{
                  fontSize: "11px",
                  color: "var(--secondary-text)",
                  opacity: 0.7,
                }}
              >
                Select a Chromium profile
              </div>
            </div>
          </div>

          {/* Searchbar + Profile cards */}
          <ProfilePicker
            entries={visibleEntries}
            loading={profilesLoading}
            error={profilesError}
            disabled={loading}
            baseDir={baseDir}
            onSelect={startLogin}
          />
        </>,
        "70%",
      )}
      <style>{`
        @keyframes aaSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes aaFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes aaSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
};

export const EmailInputDrawer: React.FC<{
  emailInput: string;
  error: string;
  emailSubmitting: boolean;
  onEmailChange: (value: string) => void;
  onSubmit: () => void;
  onClose: () => void;
}> = ({
  emailInput,
  error,
  emailSubmitting,
  onEmailChange,
  onSubmit,
  onClose,
}) => {
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
              padding: "4px 16px 12px",
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
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "9px",
                  backgroundColor: "rgba(251,146,60,0.12)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <AlertCircle
                  size={16}
                  color="var(--vscode-editorWarning-foreground, #f97316)"
                />
              </div>
              <div>
                <div
                  style={{
                    fontSize: "16px",
                    fontWeight: 700,
                    color: "var(--primary-text)",
                  }}
                >
                  Enter Email
                </div>
                <div
                  style={{
                    fontSize: "12px",
                    color: "var(--secondary-text)",
                    opacity: 0.7,
                  }}
                >
                  Browser closed. Please enter your email to continue.
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
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor =
                  "rgba(244, 67, 54, 0.15)";
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

          {/* Email input */}
          <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
            <div>
              <label
                style={{
                  fontSize: "11px",
                  fontWeight: 500,
                  color: "var(--secondary-text)",
                  display: "block",
                  marginBottom: "5px",
                }}
              >
                Email Address
              </label>
              <input
                type="email"
                value={emailInput}
                onChange={(e) => onEmailChange(e.target.value)}
                placeholder="your@email.com"
                style={{
                  width: "100%",
                  padding: "9px 11px",
                  borderRadius: "9px",
                  backgroundColor: "var(--input-bg)",
                  border: "1px solid var(--border-color)",
                  color: "var(--primary-text)",
                  fontSize: "13px",
                  outline: "none",
                  boxSizing: "border-box",
                }}
                autoFocus
              />
            </div>
            {error && (
              <div
                style={{
                  marginTop: "12px",
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

          {/* Actions */}
          <div
            style={{
              padding: "12px 16px 20px",
              borderTop: "1px solid var(--border-color)",
              display: "flex",
              gap: "8px",
              flexShrink: 0,
            }}
          >
            <button
              onClick={() => {
                onClose();
              }}
              style={{
                flex: 1,
                padding: "9px",
                borderRadius: "9px",
                backgroundColor: "rgba(128,128,128,0.1)",
                border: "none",
                color: "var(--secondary-text)",
                fontSize: "12px",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              onClick={onSubmit}
              disabled={emailSubmitting || !emailInput.trim()}
              style={{
                flex: 2,
                padding: "9px",
                borderRadius: "9px",
                backgroundColor: "var(--vscode-button-background)",
                border: "none",
                color: "var(--vscode-button-foreground)",
                fontSize: "12px",
                fontWeight: 600,
                cursor: emailSubmitting ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                opacity: !emailInput.trim() ? 0.5 : 1,
              }}
            >
              {emailSubmitting && (
                <Loader2
                  size={13}
                  style={{ animation: "aaSpin 1s linear infinite" }}
                />
              )}
              {emailSubmitting ? "Saving…" : "Save Account"}
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
