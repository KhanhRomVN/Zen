/**
 * ------------------------------------------------------------------
 * AddAccountDrawer
 * ------------------------------------------------------------------
 * Bottom-sheet drawer thêm tài khoản mới.
 * Hiển thị danh sách provider, hỗ trợ đăng nhập HTTPS (MITM) và
 * browser-based (CDP), kèm bước xác nhận và nhập email khi cần.

 * Main features:
 * - Chọn provider từ danh sách (kèm favicon, connection type badge)
 * - Đăng nhập qua MITM hoặc CDP (context menu khi click phải)
 * - Xác nhận thông tin trước khi lưu (email, credential)
 * - Nhập email khi browser login thất bại
 * ------------------------------------------------------------------
 */

// ── Imports ────────────────────────────────────────────────────────────
// ── React ──
import React, { useState, useEffect, useMemo, useRef } from "react";
import { useDbFetch } from "../../../services/useDbFetch";
import { useSettings } from "../../../context/SettingsContext";

import { listChromiumProfiles } from "../../../services/chromeProfiles";
import { DeviceCodeDrawer, ConfirmAccountDrawer } from "./VerifyAccountDrawer";
import {
  ProfilePickerDrawer,
  MethodPickerDrawer,
  EmailInputDrawer,
} from "./LoginMethodDrawer";
import { ProviderListDrawer } from "./ProviderListDrawer";
import {
  isMergedAuth,
  splitAuthMethod,
  type DeviceCodeInfo,
  resolveAccountEmail,
  type Provider,
} from "./addAccount.utils";

interface AddAccountDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

let providersCache: Provider[] | null = null;

const AddAccountDrawer: React.FC<AddAccountDrawerProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  // ── State ──
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingProviders, setLoadingProviders] = useState(true);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");

  // Method selection state
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(
    null,
  );

  // Device code flow state (Kiro, grok-build-cli, etc.)
  const [deviceCodeInfo, setDeviceCodeInfo] = useState<DeviceCodeInfo | null>(null);

  // Confirmation state
  const [showConfirm, setShowConfirm] = useState(false);
  const [pendingAccount, setPendingAccount] = useState<any>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);

  // Email drawer state for browser login failure
  const [showEmailDrawer, setShowEmailDrawer] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [pendingBrowserProvider, setPendingBrowserProvider] =
    useState<Provider | null>(null);
  const [emailSubmitting, setEmailSubmitting] = useState(false);
  const [tempSessionId, setTempSessionId] = useState<string | null>(null);

  // Profile step state (hiển thị sau khi chọn auth method)
  const [profileStepProvider, setProfileStepProvider] =
    useState<Provider | null>(null);
  const [profileStepMethod, setProfileStepMethod] = useState<string>("google");
  const [profileEntries, setProfileEntries] = useState<
    { folder: string; label?: string; avatar?: string }[]
  >([]);
  const [isDefaultChrome, setIsDefaultChrome] = useState(false);
  const [existingEmails, setExistingEmails] = useState<Set<string>>(new Set());
  const [profilesLoading, setProfilesLoading] = useState(false);
  const [profilesError, setProfilesError] = useState("");
  const profileReqRef = useRef(0);

  // ── Store ─
  const dbFetch = useDbFetch();
  const { chromiumProfileDir } = useSettings();
  // ── Handlers ──
  const fetchProviders = async () => {
    if (providersCache) {
      setProviders(providersCache);
      setLoadingProviders(false);
    } else {
      setLoadingProviders(true);
    }
    try {
      const response = await dbFetch(`/v1/providers`);
      const data = await response.json();
      if (data.success && data.data) {
        const sorted = [...data.data].sort((a: Provider, b: Provider) => {
          if (a.is_enabled === b.is_enabled) return 0;
          return a.is_enabled ? -1 : 1;
        });
        providersCache = sorted;
        setProviders(sorted);
      }
    } catch {
      if (!providersCache) setError("Failed to load providers");
    } finally {
      setLoadingProviders(false);
    }
  };

  // Chọn auth method → chưa login ngay, chuyển sang bước chọn Chromium profile
  const handlePickMethod = (provider: Provider, method: string) => {
    const reqToken = ++profileReqRef.current;
    setSelectedProvider(null);
    setProfileStepProvider(provider);
    setProfileStepMethod(method);
    setProfileEntries([]);
    setProfilesError("");

    setProfilesLoading(true);

    const profilesPromise = listChromiumProfiles(chromiumProfileDir || "").then(
      (result) => ({
        entries:
          result.profiles.length > 0
            ? result.profiles
            : result.folders.map((f: string) => ({ folder: f })),
        isDefaultChrome: result.is_default_chrome,
      }),
    );

    // Email của các account đã có cùng provider VÀ cùng auth_method → ẩn profile trùng tên
    // Nếu account dùng auth_method khác (vd: google vs github) thì vẫn hiện để cho phép add thêm
    const emailsPromise = dbFetch(
      `/v1/accounts?page=1&limit=1000&provider_id=${encodeURIComponent(provider.provider_id)}`,
    )
      .then((res) => res.json())
      .then((data) => {
        const allAccounts = data?.data?.accounts ?? [];
        const filtered = allAccounts.filter((a: any) => {
          const accountMethod = String(a.auth_method || "")
            .trim()
            .toLowerCase();
          const currentMethod = method.trim().toLowerCase();
          const sameGroup =
            isMergedAuth(currentMethod) &&
            splitAuthMethod(accountMethod).some((part) =>
              splitAuthMethod(currentMethod).includes(part),
            );
          const keep =
            !accountMethod || accountMethod === currentMethod || sameGroup;
          return keep;
        });

        const emailSet = new Set<string>(
          filtered
            .map((a: any) =>
              String(a.email || "")
                .trim()
                .toLowerCase(),
            )
            .filter(Boolean),
        );

        return emailSet;
      })
      .catch((err: any) => {
        console.error("[AddAccountDrawer] Lỗi fetch existingEmails:", err);
        return new Set<string>();
      });

    Promise.all([profilesPromise, emailsPromise])
      .then(([{ entries, isDefaultChrome: isDef }, emails]) => {
        if (profileReqRef.current !== reqToken) return;
        setProfileEntries(entries);
        setIsDefaultChrome(isDef);
        setExistingEmails(emails);
      })
      .catch((err: any) => {
        if (profileReqRef.current !== reqToken) return;
        setProfilesError(err?.message || "Không đọc được danh sách profile");
      })
      .finally(() => {
        if (profileReqRef.current === reqToken) setProfilesLoading(false);
      });
  };

  const handleLogin = async (
    provider: Provider,
    loginMethod: string = "google",
    profileFolder?: string,
    profileLabel?: string,
  ) => {
    if (!provider || provider.is_enabled === false) return;
    setLoading(true);
    setError("");
    try {
      const bodyObj: any = { method: loginMethod };
      if (profileFolder) {
        bodyObj.profile_folder = profileFolder;
      }
      const body = JSON.stringify(bodyObj);
      const response = await dbFetch(
        `/v1/accounts/login/${provider.provider_id}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
        },
      );
      const data = await response.json();
      if (data.success && data.account) {
        // ── Device code flow (Kiro, grok-build-cli, etc.) ──
        if (data.account.pending && data.account.user_code) {
          setDeviceCodeInfo({
            user_code: data.account.user_code,
            verification_url: data.account.verification_url,
            pollContext: data.account.tempSessionId,
            poll_interval: data.account.poll_interval || 5,
            provider,
            profileUserDataDir: data.account.profile_user_data_dir || undefined,
            profileDirectory: data.account.profile_directory || undefined,
            profileLabel,
          });
          setLoading(false);
          return;
        }

        // Check if this is a pending browser session (needs email)
        if (data.account.pending && data.account.tempSessionId) {
          setPendingBrowserProvider(provider);
          setTempSessionId(data.account.tempSessionId);
          setShowEmailDrawer(true);
          // Keep loading = true to maintain countdown timer
        }
        // For browser-based providers with immediate credential (should not happen in new flow)
        else if (
          provider.connection_type === "browser" &&
          data.account.credential
        ) {
          // Browser provider: account already has credential (session ID)
          // Just save it directly without showing confirm drawer
          const saveResponse = await dbFetch(`/v1/accounts`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              id: data.account.id || crypto.randomUUID(),
              provider_id: data.account.provider_id,
              email: data.account.email || "",
              credential: data.account.credential,
            }),
          });
          const saveData = await saveResponse.json();
          if (saveData.success) {
            onSuccess();
            onOpenChange(false);
          } else {
            setError(saveData.message || "Failed to save account");
          }
        } else {
          // HTTPS provider: show confirm drawer for email/credential editing
          setPendingAccount({
            ...data.account,
            email: resolveAccountEmail(data.account.email, profileLabel),
            auth_method: loginMethod,
          });
          setShowConfirm(true);
        }
      } else {
        setError(data.message || "Login failed");
      }
    } catch (err: any) {
      // For browser providers, distinguish between user-closed and timeout
      if (provider.connection_type === "browser") {
        // Check if this is a timeout error vs user closing browser
        const errorMessage = err.message || String(err);
        const isTimeout = errorMessage.toLowerCase().includes("timeout");

        if (isTimeout) {
          // Server timeout - show error and stop loading
          setError("Login timeout. Please try again.");
          setLoading(false);
        } else {
          // User closed browser - show email input drawer
          setPendingBrowserProvider(provider);
          setShowEmailDrawer(true);
          setLoading(false);
        }
      } else {
        setError(err.message || "An error occurred");
        setLoading(false);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAccount = async () => {
    if (!pendingAccount) return;
    setConfirmLoading(true);
    try {
      const response = await dbFetch(`/v1/accounts`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: pendingAccount.id || crypto.randomUUID(),
          provider_id: pendingAccount.provider_id,
          email: pendingAccount.email,
          credential: pendingAccount.credential,
          auth_method: pendingAccount.auth_method || null,
        }),
      });
      const data = await response.json();
      if (data.success) {
        onSuccess();
        onOpenChange(false);
      } else {
        setError(data.message || "Failed to save account");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setConfirmLoading(false);
    }
  };

  const handleEmailSubmit = async () => {
    if (!pendingBrowserProvider || !emailInput.trim()) return;
    setEmailSubmitting(true);
    try {
      let response;
      if (tempSessionId) {
        // Complete pending session with email
        response = await dbFetch(
          `/v1/browser-sessions/complete/${tempSessionId}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: emailInput.trim() }),
          },
        );
      } else {
        // Fallback: try to get credential from login
        const loginResponse = await dbFetch(
          `/v1/accounts/login/${pendingBrowserProvider.provider_id}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ method: "basic" }),
          },
        );
        const loginData = await loginResponse.json();

        response = await dbFetch(`/v1/accounts`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: crypto.randomUUID(),
            provider_id: pendingBrowserProvider.provider_id,
            email: emailInput.trim(),
            credential:
              loginData.success && loginData.account
                ? loginData.account.credential
                : "",
          }),
        });
      }

      const data = await response.json();
      if (data.success) {
        onSuccess();
        onOpenChange(false);
      } else {
        setError(data.message || "Failed to save account");
      }
    } catch (err: any) {
      setError(err.message || "An error occurred");
    } finally {
      setEmailSubmitting(false);
      setShowEmailDrawer(false);
      setPendingBrowserProvider(null);
      setEmailInput("");
      setTempSessionId(null);
      setLoading(false);
    }
  };

  // ── Effects ──
  useEffect(() => {
    if (!open) {
      setError("");
      setShowConfirm(false);
      setPendingAccount(null);
      setSearchQuery("");
      setSelectedProvider(null);
      setProfileStepProvider(null);
      setProfileStepMethod("google");
      setDeviceCodeInfo(null);
      return;
    }
    setSearchQuery("");
    fetchProviders();
  }, [open]);

  // Poll for device code completion (Kiro, grok-build-cli, etc.)
  const pollTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  useEffect(() => {
    if (!deviceCodeInfo) {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
      return;
    }

    const intervalMs = Math.max(deviceCodeInfo.poll_interval * 1000, 3000);
    pollTimerRef.current = setInterval(async () => {
      try {
        const res = await dbFetch(
          `/v1/accounts/login/${deviceCodeInfo.provider.provider_id}/poll`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ pollContext: deviceCodeInfo.pollContext }),
          },
        );
        const data = await res.json();

        if (data.error) {
          clearInterval(pollTimerRef.current!);
          pollTimerRef.current = null;
          setDeviceCodeInfo(null);
          setError(data.error);
          return;
        }

        if (data.done && data.account) {
          clearInterval(pollTimerRef.current!);
          pollTimerRef.current = null;
          setDeviceCodeInfo(null);
          // Show confirm drawer so user can review before saving
          const ctx = (() => {
            try {
              return JSON.parse(deviceCodeInfo.pollContext);
            } catch {
              return null;
            }
          })();
          const resolvedAuthMethod =
            data.account.auth_method || ctx?.auth_method || null;
          setPendingAccount({
            id: crypto.randomUUID(),
            provider_id: data.account.provider_id,
            email: resolveAccountEmail(
              data.account.email,
              deviceCodeInfo.profileLabel,
            ),
            credential: data.account.credential,
            auth_method: resolvedAuthMethod,
          });
          setShowConfirm(true);
        }
      } catch {
        // Network error — keep polling
      }
    }, intervalMs);

    return () => {
      if (pollTimerRef.current) {
        clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, [deviceCodeInfo, dbFetch]);

  // Filter providers theo search query (khớp provider_name hoặc provider_id)
  // Ẩn provider không có auth_method (không cần đăng nhập)
  const filteredProviders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return (providers || []).filter((p) => {
      // Ẩn provider không có auth_method
      const raw = (p as any).auth_method ?? (p as any).auth_methods;
      let methods: string[] = [];
      if (Array.isArray(raw))
        methods = raw.filter((m: any) => typeof m === "string" && m.length > 0);
      else if (typeof raw === "string" && raw.trim()) {
        try {
          const parsed = JSON.parse(raw.trim());
          methods = Array.isArray(parsed) ? parsed.filter((m: any) => m) : [];
        } catch {
          methods = raw
            .trim()
            .split(/[,;|\s]+/)
            .filter((m: string) => m.length > 0);
        }
      }
      if (methods.length === 0) return false;

      // Filter theo search query
      if (!q) return true;
      return (
        (p.provider_name || "").toLowerCase().includes(q) ||
        (p.provider_id || "").toLowerCase().includes(q)
      );
    });
  }, [providers, searchQuery]);

  if (!open) return null;

  if (deviceCodeInfo) {
    return (
      <DeviceCodeDrawer
        info={deviceCodeInfo}
        error={error}
        onClose={() => setDeviceCodeInfo(null)}
      />
    );
  }

  if (profileStepProvider && !showEmailDrawer && !showConfirm) {
    return (
      <ProfilePickerDrawer
        provider={profileStepProvider}
        entries={profileEntries}
        isDefaultChrome={isDefaultChrome}
        existingEmails={existingEmails}
        profilesLoading={profilesLoading}
        profilesError={profilesError}
        loading={loading}
        baseDir={chromiumProfileDir}
        onClose={() => setProfileStepProvider(null)}
        onBack={() => {
          setSelectedProvider(profileStepProvider);
          setProfileStepProvider(null);
        }}
        onStart={(folder) => {
          const provider = profileStepProvider;
          const method = profileStepMethod;
          const label = profileEntries.find((e) => e.folder === folder)?.label;
          setProfileStepProvider(null);
          handleLogin(provider, method as any, folder, label);
        }}
      />
    );
  }

  if (selectedProvider && !showEmailDrawer && !showConfirm) {
    return (
      <MethodPickerDrawer
        provider={selectedProvider}
        loading={loading}
        error={error}
        onClose={() => setSelectedProvider(null)}
        onPickMethod={(method) => handlePickMethod(selectedProvider, method)}
      />
    );
  }

  if (showEmailDrawer && pendingBrowserProvider) {
    return (
      <EmailInputDrawer
        emailInput={emailInput}
        error={error}
        emailSubmitting={emailSubmitting}
        onEmailChange={setEmailInput}
        onSubmit={handleEmailSubmit}
        onClose={() => {
          setShowEmailDrawer(false);
          setPendingBrowserProvider(null);
          setEmailInput("");
          setLoading(false);
        }}
      />
    );
  }

  if (showConfirm && pendingAccount) {
    return (
      <ConfirmAccountDrawer
        account={pendingAccount}
        error={error}
        confirmLoading={confirmLoading}
        onChange={setPendingAccount}
        onConfirm={handleConfirmAccount}
        onClose={() => {
          setShowConfirm(false);
          setPendingAccount(null);
        }}
      />
    );
  }

  return (
    <ProviderListDrawer
      searchQuery={searchQuery}
      onSearchChange={setSearchQuery}
      loadingProviders={loadingProviders}
      filteredProviders={filteredProviders}
      loading={loading}
      error={error}
      onSelectProvider={setSelectedProvider}
      onClose={() => onOpenChange(false)}
      onCancelLogin={() => {
        onOpenChange(false);
        setLoading(false);
      }}
    />
  );
};

export default AddAccountDrawer;
