import React, { useState, useMemo, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import { Search, ChevronRight, X, ChevronLeft, ChevronDown, Brain, Circle, Video, Image, Activity, Coins, Volume2, ImagePlus, Film, SearchCheck, BarChart3, Clock, Zap, Feather, Gauge, Flame, Sparkles, Cpu } from "lucide-react";
import { getFaviconUrl } from "@/utils/favicon";
import { getClientId } from "@/utils/clientId";
import { formatRelativeTime } from "@/utils/relativeTime";
import { useActiveDatabaseManagerName } from "@/hooks/useActiveDatabaseManagerName";
import { useDbFetch } from "@/services/useDbFetch";

// ─── Effort helpers ───────────────────────────────────────────────────────────

/** Thứ tự mức effort — khớp với EFFORT_LEVELS bên AIWeb2API. */
const EFFORT_LEVELS = ["low", "medium", "high", "xhigh", "max"] as const;
type EffortLevel = (typeof EFFORT_LEVELS)[number];

/** Màu tương ứng 5 mốc effort. */
const EFFORT_COLOR: Record<EffortLevel, string> = {
  low: "#6b7280",     // gray
  medium: "#3b82f6",  // blue
  high: "#10b981",    // green
  xhigh: "#f59e0b",   // amber
  max: "#ef4444",     // red
};

/** Label hiển thị thân thiện. */
const EFFORT_LABEL: Record<EffortLevel, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
  xhigh: "Extra",
  max: "Max",
};

/** Metadata đầy đủ cho từng mức effort — icon, description. */
const EFFORT_META: Record<EffortLevel, { icon: React.ElementType; description: string }> = {
  low: {
    icon: Feather,
    description: "Minimal thinking — fastest responses, best for simple or factual tasks.",
  },
  medium: {
    icon: Gauge,
    description: "Balanced thinking — good reasoning without heavy compute overhead.",
  },
  high: {
    icon: Flame,
    description: "Deep reasoning — handles complex logic, multi-step problems well.",
  },
  xhigh: {
    icon: Sparkles,
    description: "Extra intense thinking — for difficult research and nuanced analysis.",
  },
  max: {
    icon: Cpu,
    description: "Maximum effort — full cognitive power, slowest but most thorough.",
  },
};

/**
 * Tách `effort` suffix khỏi model id dạng `<base>-<effort>`.
 * Nếu không khớp → trả `{ base: modelId, effort: null }`.
 */
function splitModelAndEffort(modelId: string): { base: string; effort: EffortLevel | null } {
  for (const lvl of EFFORT_LEVELS) {
    if (modelId.endsWith(`-${lvl}`)) {
      return { base: modelId.slice(0, -(lvl.length + 1)), effort: lvl };
    }
  }
  return { base: modelId, effort: null };
}

interface Provider {
  provider_id: string;
  provider_name: string;
  website: string;
  is_enabled: boolean;
  total_accounts?: number;
  models: any[];
  /** Error message khi getModels() thất bại */
  models_error?: string;
}

interface Account {
  id: string;
  name?: string;
  email?: string;
  provider_id: string;
  is_enabled: boolean;
  usage?: number;
  reset_usage_at?: string;
  period_requests?: number;
  period_tokens?: number;
  /** Timestamp (ms) lần gửi tin nhắn gần nhất của account này */
  last_used_at?: number | null;
  /** Số cửa sổ VSCode KHÁC đang active account này */
  used_by_windows?: number;
}

interface ProviderModelDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  providers: Provider[];
  apiUrl: string;
  onSelect: (model: {
    providerId: string;
    modelId: string;
    accountId?: string;
    email?: string;
    accountProviderId?: string;
  }) => void;
}

// ─── Model Tooltip ────────────────────────────────────────────────────────────
interface ModelTooltipProps {
  model: any;
  x: number;
  y: number;
}

const BoolBadge: React.FC<{ value: boolean }> = ({ value }) => (
  <span style={{ color: value ? "#4ade80" : "#ef4444", fontWeight: 600 }}>
    {value ? "✓" : "✗"}
  </span>
);

const formatContextLength = (n: number) => {
  if (n >= 1_000_000) {
    return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  }
  if (n >= 1_000) {
    return `${Math.round(n / 1000)}K`;
  }
  return n.toLocaleString();
};

const formatTokens = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return `${n}`;
};

const ModelTooltip: React.FC<ModelTooltipProps> = ({ model, x, y }) => {
  const hasImageUpload = model.is_image_upload === true;
  const hasVideoUpload = model.is_video_upload === true;
  const hasAudioUpload = model.is_audio_upload === true;
  const hasImageGenerator = model.is_image_generator === true;
  const hasVideoGenerator = model.is_video_generator === true;
  const hasDeepResearch = model.is_deep_research === true;

  const rows: { label: string; value: React.ReactNode }[] = [
    {
      label: "Max Context",
      value:
        model.max_context_length != null || model.context_length != null ? (
          `${Number(model.max_context_length ?? model.context_length).toLocaleString()} tokens`
        ) : (
          <span style={{ opacity: 0.4 }}>—</span>
        ),
    },
    { label: "Thinking", value: <BoolBadge value={!!model.is_thinking} /> },
    ...(model.is_search !== undefined
      ? [{ label: "Search", value: <BoolBadge value={!!model.is_search} /> }]
      : []),
    ...(model.is_memory !== undefined
      ? [{ label: "Memory", value: <BoolBadge value={!!model.is_memory} /> }]
      : []),
    ...(hasImageUpload
      ? [{ label: "Image upload", value: <BoolBadge value={true} /> }]
      : []),
    ...(hasVideoUpload
      ? [{ label: "Video upload", value: <BoolBadge value={true} /> }]
      : []),
    ...(hasAudioUpload
      ? [{ label: "Audio upload", value: <BoolBadge value={true} /> }]
      : []),
    ...(hasImageGenerator
      ? [{ label: "Image generator", value: <BoolBadge value={true} /> }]
      : []),
    ...(hasVideoGenerator
      ? [{ label: "Video generator", value: <BoolBadge value={true} /> }]
      : []),
    ...(hasDeepResearch
      ? [{ label: "Deep research", value: <BoolBadge value={true} /> }]
      : []),
  ];

  const TOOLTIP_W = 210;
  const TOOLTIP_H = 160; // increased for description
  const OFFSET_X = 14;
  const OFFSET_Y = 10;
  const viewW = window.innerWidth;
  const viewH = window.innerHeight;

  // Default: below-right of cursor
  let left = x + OFFSET_X;
  let top = y + OFFSET_Y;
  // Flip left if near right edge
  if (left + TOOLTIP_W > viewW - 8) left = x - TOOLTIP_W - OFFSET_X;
  // Flip up if near bottom edge
  if (top + TOOLTIP_H > viewH - 8) top = y - TOOLTIP_H - OFFSET_Y;

  return (
    <div
      style={{
        position: "fixed",
        left,
        top,
        width: TOOLTIP_W,
        backgroundColor: "var(--vscode-editorHoverWidget-background, #1e1e1e)",
        border: "1px solid var(--vscode-editorHoverWidget-border, #454545)",
        borderRadius: "6px",
        padding: "8px 10px",
        fontSize: "11px",
        color: "var(--vscode-foreground)",
        lineHeight: 1.7,
        pointerEvents: "none",
        zIndex: 99999,
        boxShadow: "0 4px 16px rgba(0,0,0,0.35)",
      }}
    >
      <div
        style={{
          fontWeight: 700,
          marginBottom: "6px",
          fontSize: "12px",
          borderBottom: "1px solid rgba(128,128,128,0.2)",
          paddingBottom: "5px",
        }}
      >
        {model.name}
      </div>
      {model.description && (
        <div
          style={{
            marginBottom: "8px",
            paddingBottom: "6px",
            borderBottom: "1px solid rgba(128,128,128,0.15)",
            fontSize: "10.5px",
            opacity: 0.85,
            fontStyle: "italic",
            lineHeight: 1.4,
            maxHeight: "60px",
            overflow: "hidden",
            display: "-webkit-box",
            WebkitLineClamp: 3,
            WebkitBoxOrient: "vertical",
          }}
        >
          {model.description}
        </div>
      )}
      {rows.map((r) => (
        <div
          key={r.label}
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <span style={{ opacity: 0.55 }}>{r.label}</span>
          <span>{r.value}</span>
        </div>
      ))}
    </div>
  );
};

// ─── Skeleton blocks ──────────────────────────────────────────────────────────
function DrawerSkeletonLine({
  width,
  height = 10,
  radius = 4,
  style,
}: {
  width: string | number;
  height?: number;
  radius?: number;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className="drawer-skeleton-shimmer"
      style={{
        width,
        height,
        borderRadius: radius,
        backgroundColor: "rgba(128,128,128,0.15)",
        ...style,
      }}
    />
  );
}

/** Skeleton cho danh sách model — mỗi provider 1 header + vài model row. */
function ModelListSkeleton() {
  return (
    <div>
      {[0, 1, 2].map((pi) => (
        <div key={pi} style={{ marginBottom: "16px" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              marginBottom: "10px",
            }}
          >
            <DrawerSkeletonLine width={16} height={16} radius={3} />
            <DrawerSkeletonLine width={120} height={13} />
          </div>
          {[0, 1].map((mi) => (
            <div
              key={mi}
              style={{
                padding: "8px 12px",
                display: "flex",
                flexDirection: "column",
                gap: "6px",
              }}
            >
              <DrawerSkeletonLine width="45%" height={12} />
              <DrawerSkeletonLine width="70%" height={9} />
            </div>
          ))}
        </div>
      ))}
      <style>{`
        @keyframes drawerShimmer {
          0% { opacity: 0.55; }
          50% { opacity: 1; }
          100% { opacity: 0.55; }
        }
        .drawer-skeleton-shimmer {
          animation: drawerShimmer 1.4s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

/** Skeleton cho danh sách account — avatar + email + stats. */
function AccountListSkeleton() {
  return (
    <div>
      {[0, 1, 2, 3].map((i) => (
        <div
          key={i}
          style={{
            padding: "8px 12px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <DrawerSkeletonLine width={28} height={28} radius={7} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <DrawerSkeletonLine
              width="60%"
              height={11}
              style={{ marginBottom: "6px" }}
            />
            <div style={{ display: "flex", gap: "10px" }}>
              <DrawerSkeletonLine width={52} height={9} />
              <DrawerSkeletonLine width={52} height={9} />
            </div>
          </div>
        </div>
      ))}
      <style>{`
        @keyframes drawerShimmer {
          0% { opacity: 0.55; }
          50% { opacity: 1; }
          100% { opacity: 0.55; }
        }
        .drawer-skeleton-shimmer {
          animation: drawerShimmer 1.4s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
const ProviderModelDrawer: React.FC<ProviderModelDrawerProps> = ({
  isOpen,
  onClose,
  providers,
  apiUrl,
  onSelect,
}) => {
  const activeDbName = useActiveDatabaseManagerName();
  const dbFetch = useDbFetch();
  const [step, setStep] = useState<"model" | "effort" | "account">("model");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedModel, setSelectedModel] = useState<any | null>(null);
  /** Các effort option của model đang chọn (chỉ set khi model có effort) */
  const [effortOptions, setEffortOptions] = useState<EffortLevel[]>([]);
  const [providerAccounts, setProviderAccounts] = useState<Account[]>([]);
  const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
  const [accountSearchQuery, setAccountSearchQuery] = useState("");
  const [collapsedProviders, setCollapsedProviders] = useState<Set<string>>(
    new Set(),
  );

  // accounts count per provider_id
  const [accountCountMap, setAccountCountMap] = useState<
    Record<string, number>
  >({});
  /** Số account đang được dùng (used_by_windows > 0) theo provider_id */
  const [inUseCountMap, setInUseCountMap] = useState<Record<string, number>>(
    {},
  );
  /** Tổng period_requests của tất cả account theo provider_id (tiêu chí sort #1) */
  const [providerUsageMap, setProviderUsageMap] = useState<
    Record<string, number>
  >({});
  /** last_used_at lớn nhất trong các account theo provider_id (tiêu chí sort #2) */
  const [providerLastUsedMap, setProviderLastUsedMap] = useState<
    Record<string, number>
  >({});
  const [isLoadingAccountMap, setIsLoadingAccountMap] = useState(false);

  // tooltip state — follow mouse cursor directly
  const [tooltipModel, setTooltipModel] = useState<{
    model: any;
    x: number;
    y: number;
  } | null>(null);
  const tooltipTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mousePos = useRef({ x: 0, y: 0 });
  const activeRowRect = useRef<DOMRect | null>(null);

  // Track global mouse position — hide tooltip when cursor leaves the active row bounds
  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      mousePos.current = { x: e.clientX, y: e.clientY };

      if (tooltipModel && activeRowRect.current) {
        const r = activeRowRect.current;
        const PADDING = 4;
        const outside =
          e.clientX < r.left - PADDING ||
          e.clientX > r.right + PADDING ||
          e.clientY < r.top - PADDING ||
          e.clientY > r.bottom + PADDING;
        if (outside) {
          setTooltipModel(null);
          activeRowRect.current = null;
        } else {
          // Update tooltip follow position
          setTooltipModel((prev) =>
            prev ? { ...prev, x: e.clientX, y: e.clientY } : null,
          );
        }
      }
    };
    window.addEventListener("mousemove", onMouseMove);
    return () => window.removeEventListener("mousemove", onMouseMove);
  }, [tooltipModel]);

  // Reset state when drawer opens + fetch account counts
  useEffect(() => {
    if (isOpen) {
      setStep("model");
      setSearchQuery("");
      setAccountSearchQuery("");
      setSelectedModel(null);
      setEffortOptions([]);
      setProviderAccounts([]);
      setTooltipModel(null);

      // Fetch all accounts (paginated) to build count map.
      // Không dùng limit cứng vì có thể có >200 accounts → bỏ sót provider.
      setIsLoadingAccountMap(true);
      const PAGE_SIZE = 200;
      const clientId = encodeURIComponent(getClientId());

      const fetchAllAccounts = async (): Promise<any[]> => {
        const all: any[] = [];
        let page = 1;
        // hard cap 50 trang (10k accounts) để tránh vòng lặp vô hạn nếu API lỗi.
        while (page <= 50) {
          const res = await dbFetch(
            `/v1/accounts?page=${page}&limit=${PAGE_SIZE}&clientId=${clientId}`,
          );
          const result = await res.json();
          if (!result?.success || !result.data?.accounts?.length) break;
          all.push(...result.data.accounts);
          const totalPages = result.data.pagination?.total_pages ?? 1;
          if (page >= totalPages) break;
          page++;
        }
        return all;
      };

      fetchAllAccounts()
        .then((accounts) => {
          if (accounts.length === 0) {
            console.warn("[QuickSwitchDrawer] Accounts fetch returned empty");
            return;
          }
          const map: Record<string, number> = {};
          const inUseMap: Record<string, number> = {};
          const usageMap: Record<string, number> = {};
          const lastUsedMap: Record<string, number> = {};
          for (const acc of accounts) {
            map[acc.provider_id] = (map[acc.provider_id] || 0) + 1;
            if ((acc.used_by_windows ?? 0) > 0) {
              inUseMap[acc.provider_id] =
                (inUseMap[acc.provider_id] || 0) + 1;
            }
            usageMap[acc.provider_id] =
              (usageMap[acc.provider_id] || 0) +
              (Number(acc.period_requests) || 0);
            const lastUsed = Number(acc.last_used_at) || 0;
            if (lastUsed > (lastUsedMap[acc.provider_id] || 0)) {
              lastUsedMap[acc.provider_id] = lastUsed;
            }
          }
          setAccountCountMap(map);
          setInUseCountMap(inUseMap);
          setProviderUsageMap(usageMap);
          setProviderLastUsedMap(lastUsedMap);
        })
        .catch((err) =>
          console.error("[QuickSwitchDrawer] Accounts fetch error:", err),
        )
        .finally(() => setIsLoadingAccountMap(false));
    }
    // dbFetch tự đổi identity khi apiUrl hoặc activeDatabaseManagerId đổi →
    // đảm bảo refetch đúng database khi user chuyển database.
  }, [isOpen, dbFetch]);

  // Fetch accounts when moving to account step (poll mỗi 15s để cập nhật badge)
  useEffect(() => {
    if (step === "account" && selectedModel) {
      let isMounted = true;
      const url = `/v1/accounts?page=1&limit=50&provider_id=${selectedModel.provider_id}&clientId=${encodeURIComponent(getClientId())}`;

      const load = (showLoading: boolean) => {
        if (showLoading) setIsLoadingAccounts(true);
        dbFetch(url)
          .then((res) => res.json())
          .then((result) => {
            if (isMounted && result.success && result.data?.accounts) {
              setProviderAccounts(result.data.accounts);
            } else if (isMounted) {
              console.warn(
                "[QuickSwitchDrawer] No accounts in response:",
                result,
              );
            }
          })
          .catch((err) =>
            console.error(
              "[QuickSwitchDrawer] Provider accounts fetch error:",
              err,
            ),
          )
          .finally(() => {
            if (isMounted && showLoading) setIsLoadingAccounts(false);
          });
      };

      load(true);
      const intervalId = setInterval(() => load(false), 15000);
      return () => {
        isMounted = false;
        clearInterval(intervalId);
      };
    }
    // dbFetch tự đổi identity khi activeDatabaseManagerId đổi → refetch đúng
    // database, tránh danh sách account của database cũ bị treo lại.
  }, [step, selectedModel, dbFetch]);

  // getFavicon moved to @/utils/favicon

  // Helper: kiểm tra provider có yêu cầu auth không
  const providerNeedsAuth = (provider: Provider): boolean => {
    const raw = (provider as any).auth_method ?? (provider as any).auth_methods;
    if (!raw) return false;
    if (Array.isArray(raw)) return raw.filter((m: any) => typeof m === 'string' && m.length > 0).length > 0;
    if (typeof raw === 'string' && raw.trim()) {
      try {
        const parsed = JSON.parse(raw.trim());
        return Array.isArray(parsed) ? parsed.filter((m: any) => m).length > 0 : false;
      } catch {
        return raw.trim().split(/[,;|\s]+/).filter((m: string) => m.length > 0).length > 0;
      }
    }
    return false;
  };

  const filteredProviders = useMemo(() => {
    const mapped = providers
      .filter((p) => p.is_enabled !== false)
      .map((provider) => {
        const providerNameMatch = (provider.provider_name || "")
          .toLowerCase()
          .includes(searchQuery.toLowerCase());

        // Nếu tên provider match → hiển thị toàn bộ models của provider đó
        // Nếu không → filter models theo query
        const filteredModels = providerNameMatch
          ? (provider.models || [])
          : (provider.models || []).filter(
              (m) =>
                (m.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
                (m.id || "").toLowerCase().includes(searchQuery.toLowerCase()),
            );

        return { ...provider, models: filteredModels };
      })
      .filter((p) => p.models.length > 0 || !!(p as any).models_error);

    // Sort priority:
    //   0 = has models + (has accounts OR no auth needed)  (top)
    //   1 = has models, needs auth but no accounts
    //   2 = has accounts, no models
    //   3 = neither                                         (bottom)
    const priority = (p: (typeof mapped)[0]) => {
      const hasModels = p.models.length > 0;
      const hasAccounts = (accountCountMap[p.provider_id] ?? 0) > 0;
      const noAuthNeeded = !providerNeedsAuth(p as any);
      if (hasModels && (hasAccounts || noAuthNeeded)) return 0;
      if (hasModels && !hasAccounts) return 1;
      if (!hasModels && hasAccounts) return 2;
      return 3;
    };

    // Sort 2 tầng:
    //   Tầng 1: provider dùng nhiều nhất (tổng period_requests) giảm dần
    //   Tầng 2: provider dùng gần nhất (last_used_at lớn nhất) giảm dần
    //   Tie-break: priority cũ (đẩy provider chết/không model xuống dưới)
    const sorted = [...mapped].sort((a, b) => {
      const usageDiff =
        (providerUsageMap[b.provider_id] ?? 0) -
        (providerUsageMap[a.provider_id] ?? 0);
      if (usageDiff !== 0) return usageDiff;

      const lastUsedDiff =
        (providerLastUsedMap[b.provider_id] ?? 0) -
        (providerLastUsedMap[a.provider_id] ?? 0);
      if (lastUsedDiff !== 0) return lastUsedDiff;

      return priority(a) - priority(b);
    });
    return sorted;
  }, [
    providers,
    searchQuery,
    accountCountMap,
    providerUsageMap,
    providerLastUsedMap,
  ]);

  const handleModelMouseEnter = (
    model: any,
    e: React.MouseEvent<HTMLDivElement>,
  ) => {
    activeRowRect.current = e.currentTarget.getBoundingClientRect();
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
    tooltipTimer.current = setTimeout(() => {
      const { x, y } = mousePos.current;
      setTooltipModel({ model, x, y });
    }, 100);
  };

  // mouseleave is unreliable in VSCode webview — hide is handled by mousemove bounds check above
  const handleModelMouseLeave = () => {
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
    setTooltipModel((prev) => {
      if (prev === null) return null;
      return prev;
    });
  };

  const toggleProvider = (providerId: string) => {
    setCollapsedProviders((prev) => {
      const next = new Set(prev);
      if (next.has(providerId)) {
        next.delete(providerId);
      } else {
        next.add(providerId);
      }
      return next;
    });
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          height: "50vh",
          maxHeight: "50vh",
          backgroundColor: "var(--tertiary-bg)",
          borderTop: "1px solid var(--border-color)",
          boxShadow: "0 -8px 24px rgba(0, 0, 0, 0.2)",
          zIndex: 1000,
          display: "flex",
          flexDirection: "column",
          animation: "slideUpDrawer 0.25s ease-out",
          color: "var(--primary-text)",
          overflow: "hidden",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "12px 16px 12px",
            borderBottom: "1px solid var(--border-color)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            {step === "account" && (
              <button
                onClick={() => {
                  // Nếu model có effort → quay lại bước effort, không phải model
                  if (effortOptions.length > 0) {
                    // Bỏ effort suffix khỏi selectedModel.id để về lại base id
                    const { base } = splitModelAndEffort(selectedModel?.id ?? "");
                    setSelectedModel((prev: any) => prev ? { ...prev, id: base } : prev);
                    setStep("effort");
                  } else {
                    setStep("model");
                  }
                  setAccountSearchQuery("");
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: "6px",
                  borderRadius: "4px",
                  color: "var(--secondary-text)",
                  display: "flex",
                  alignItems: "center",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "rgba(128,128,128,0.1)";
                  e.currentTarget.style.color = "var(--primary-text)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = "var(--secondary-text)";
                }}
              >
                <ChevronLeft size={16} />
              </button>
            )}
            {step === "effort" && (
              <button
                onClick={() => {
                  setStep("model");
                  setEffortOptions([]);
                }}
                style={{
                  background: "transparent",
                  border: "none",
                  cursor: "pointer",
                  padding: "6px",
                  borderRadius: "4px",
                  color: "var(--secondary-text)",
                  display: "flex",
                  alignItems: "center",
                  transition: "all 0.2s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "rgba(128,128,128,0.1)";
                  e.currentTarget.style.color = "var(--primary-text)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                  e.currentTarget.style.color = "var(--secondary-text)";
                }}
              >
                <ChevronLeft size={16} />
              </button>
            )}
            <div
              style={{ display: "flex", flexDirection: "column", gap: "2px" }}
            >
              <span
                style={{
                  fontSize: "17px",
                  fontWeight: 700,
                  color: "var(--primary-text)",
                  letterSpacing: "0.01em",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                {step === "model" ? "Quick Switch" : step === "effort" ? "Select Effort" : "Select Account"}
                {activeDbName && (
                  <span
                    style={{
                      fontSize: "10px",
                      fontWeight: 500,
                      padding: "2px 7px",
                      borderRadius: "4px",
                      backgroundColor: "rgba(59, 130, 246, 0.12)",
                      color: "#3b82f6",
                      letterSpacing: "0.01em",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {activeDbName}
                  </span>
                )}
              </span>
              <span
                style={{
                  fontSize: "11px",
                  color: "var(--secondary-text)",
                  opacity: 0.7,
                }}
              >
                {step === "model"
                  ? "Choose a model to continue"
                  : selectedModel
                    ? `${selectedModel.provider_id}/${selectedModel.id}`
                    : ""}
              </span>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button
              onClick={onClose}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "6px",
                borderRadius: "4px",
                color: "var(--secondary-text)",
                display: "flex",
                alignItems: "center",
                transition: "all 0.2s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "rgba(244, 67, 54, 0.15)";
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
        </div>

        {step === "model" && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              height: "100%",
              overflow: "hidden",
            }}
          >
            {/* Search */}
            <div
              style={{
                position: "relative",
                padding: "12px 12px 0 12px",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: "22px",
                  top: "12px",
                  height: "34px",
                  display: "flex",
                  alignItems: "center",
                  pointerEvents: "none",
                }}
              >
                <Search
                  size={14}
                  style={{
                    color: "var(--vscode-input-placeholderForeground, var(--secondary-text))",
                  }}
                />
              </div>
              <input
                autoFocus
                type="text"
                placeholder="Search models..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
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

            <div
              className="custom-scrollbar"
              style={{ flex: 1, overflowY: "auto", padding: "12px" }}
            >
              {isLoadingAccountMap && providers.length === 0 ? (
                <ModelListSkeleton />
              ) : (
                filteredProviders.map((provider) => {
                const accountCount = accountCountMap[provider.provider_id] ?? 0;
                const hasModels = provider.models.length > 0;
                const hasAccounts = accountCount > 0;
                const needsAuth = providerNeedsAuth(provider);
                const isCollapsed = collapsedProviders.has(
                  provider.provider_id,
                );

                return (
                  <div
                    key={provider.provider_id}
                    style={{ marginBottom: "16px" }}
                  >
                    {/* Provider header — now larger & primary text */}
                    <div
                      onClick={() => toggleProvider(provider.provider_id)}
                      style={{
                        fontSize: "14px",
                        fontWeight: 700,
                        color: "var(--primary-text)",
                        paddingBottom: "5px",
                        marginBottom: "8px",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                        cursor: "pointer",
                        userSelect: "none",
                      }}
                    >
                      {getFaviconUrl(provider.website) && (
                        <img
                          src={getFaviconUrl(provider.website)}
                          alt="favicon"
                          style={{
                            width: "16px",
                            height: "16px",
                            borderRadius: "3px",
                          }}
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display =
                              "none";
                          }}
                        />
                      )}
                      {provider.provider_name || provider.provider_id}
                      {/* Models error badge — getModels() thất bại */}
                      {provider.models_error && (() => {
                        const isNoAccountError = provider.models_error.startsWith("No accounts configured");
                        return (
                          <span
                            title={provider.models_error}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "3px",
                              fontSize: "10px",
                              fontWeight: 500,
                              padding: "1px 6px",
                              borderRadius: "4px",
                              backgroundColor: isNoAccountError
                                ? "rgba(234, 179, 8, 0.1)"
                                : "rgba(239, 68, 68, 0.1)",
                              color: isNoAccountError ? "#eab308" : "#ef4444",
                              maxWidth: "200px",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            <span style={{ fontSize: "9px", flexShrink: 0 }}>
                              {isNoAccountError ? "⚠" : "✕"}
                            </span>
                            {isNoAccountError ? "No accounts" : "Error fetching models"}
                          </span>
                        );
                      })()}
                      {/* No models badge — provider enabled nhưng không có model nào (và không có lỗi) */}
                      {!hasModels && !provider.models_error && (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "3px",
                            fontSize: "10px",
                            fontWeight: 500,
                            padding: "1px 6px",
                            borderRadius: "4px",
                            backgroundColor: "rgba(239, 68, 68, 0.1)",
                            color: "#ef4444",
                          }}
                        >
                          <span style={{ fontSize: "9px" }}>✕</span>
                          No models
                        </span>
                      )}
                      {/* No accounts badge — only for providers that require auth */}
                      {needsAuth && !isLoadingAccountMap && !hasAccounts && !provider.models_error && (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "3px",
                            fontSize: "10px",
                            fontWeight: 500,
                            padding: "1px 6px",
                            borderRadius: "4px",
                            backgroundColor: "rgba(234, 179, 8, 0.1)",
                            color: "#eab308",
                          }}
                        >
                          <span style={{ fontSize: "10px" }}>⚠</span>
                          No accounts
                        </span>
                      )}
                      {needsAuth && !isLoadingAccountMap && (
                        <span
                          style={{
                            marginLeft: "auto",
                            fontSize: "13px",
                            fontWeight: 400,
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          {(() => {
                            const inUseAcc =
                              inUseCountMap[provider.provider_id] ?? 0;
                            if (inUseAcc > 0) {
                              return (
                                <span
                                  style={{ color: "var(--primary-text)" }}
                                >
                                  {inUseAcc}/{accountCount} accounts in use
                                </span>
                              );
                            }
                            return (
                              <span style={{ opacity: 0.55 }}>
                                {accountCount} account
                                {accountCount !== 1 ? "s" : ""}
                              </span>
                            );
                          })()}
                          {isCollapsed ? (
                            <ChevronRight size={15} />
                          ) : (
                            <ChevronDown size={15} />
                          )}
                        </span>
                      )}
                    </div>

                    {!isCollapsed && (
                      <>
                        {/* Error message khi getModels() thất bại */}
                        {provider.models_error && (() => {
                          const isNoAccountError = provider.models_error.startsWith("No accounts configured");
                          return (
                            <div
                              style={{
                                padding: "8px 12px",
                                borderRadius: "6px",
                                backgroundColor: isNoAccountError
                                  ? "rgba(234, 179, 8, 0.07)"
                                  : "rgba(239, 68, 68, 0.07)",
                                border: isNoAccountError
                                  ? "1px solid rgba(234, 179, 8, 0.2)"
                                  : "1px solid rgba(239, 68, 68, 0.2)",
                                fontSize: "11px",
                                color: isNoAccountError ? "#eab308" : "#ef4444",
                                lineHeight: 1.5,
                                wordBreak: "break-word",
                              }}
                            >
                              <span style={{ opacity: 0.85 }}>{provider.models_error}</span>
                            </div>
                          );
                        })()}
                        {/* Model rows */}
                        {hasModels &&
                          (() => {
                            // Dedup: gom các entry cùng base model (khác effort) thành 1 row.
                            // Giữ entry đầu tiên tìm thấy cho mỗi base id.
                            const seen = new Set<string>();
                            const dedupedModels = provider.models.filter((m: any) => {
                              const { base } = splitModelAndEffort(m.id);
                              if (seen.has(base)) return false;
                              seen.add(base);
                              return true;
                            });
                            return dedupedModels.map((model: any) => {
                            // Provider không cần auth → luôn enabled; có auth → cần có account
                            const isDisabled = needsAuth && !hasAccounts;
                            const successColor =
                              model.success_rate >= 80
                                ? "#4ade80"
                                : model.success_rate >= 50
                                  ? "#facc15"
                                  : "#f87171";
                            return (
                              <div
                                key={model.id}
                                onClick={() => {
                                  if (isDisabled) return;
                                  // Tách base model id và các effort options từ provider models
                                  // Provider trả về nhiều entry dạng <base>-<effort> cho mỗi effort level.
                                  // Ta gom lại các effort option của cùng base model.
                                  const { base: baseId } = splitModelAndEffort(model.id);
                                  const allEfforts = (provider.models as any[])
                                    .map((m: any) => splitModelAndEffort(m.id))
                                    .filter((parsed) => parsed.base === baseId && parsed.effort !== null)
                                    .map((parsed) => parsed.effort as EffortLevel);
                                  // Unique + preserve order theo EFFORT_LEVELS
                                  const uniqueEfforts = EFFORT_LEVELS.filter((lvl) =>
                                    allEfforts.includes(lvl),
                                  );

                                  // Model base (không có effort suffix)
                                  const baseModel = { ...model, id: baseId, provider_id: provider.provider_id };

                                  if (uniqueEfforts.length > 1) {
                                    // Model có nhiều effort → đi qua step chọn effort
                                    setSelectedModel(baseModel);
                                    setEffortOptions(uniqueEfforts);
                                    setStep("effort");
                                  } else if (uniqueEfforts.length === 1) {
                                    // Model chỉ có 1 effort duy nhất → auto-apply effort,
                                    // bỏ qua effortCard (không cần user chọn khi chỉ có 1 option).
                                    const autoEffort = uniqueEfforts[0];
                                    const autoModelId = `${baseId}-${autoEffort}`;
                                    if (needsAuth) {
                                      setSelectedModel({
                                        ...model,
                                        id: autoModelId,
                                        provider_id: provider.provider_id,
                                      });
                                      setEffortOptions([]);
                                      setStep("account");
                                    } else {
                                      onSelect({
                                        providerId: provider.provider_id,
                                        modelId: autoModelId,
                                      });
                                      onClose();
                                    }
                                  } else if (needsAuth) {
                                    // Không có effort, cần auth → chọn account
                                    setSelectedModel({ ...model, provider_id: provider.provider_id });
                                    setEffortOptions([]);
                                    setStep("account");
                                  } else {
                                    // Không có effort, không cần auth → select ngay
                                    onSelect({
                                      providerId: provider.provider_id,
                                      modelId: model.id,
                                    });
                                    onClose();
                                  }
                                }}
                                onMouseEnter={(e) => {
                                  if (!isDisabled)
                                    e.currentTarget.style.backgroundColor =
                                      "var(--hover-bg)";
                                  handleModelMouseEnter(model, e);
                                }}
                                onMouseLeave={(e) => {
                                  e.currentTarget.style.backgroundColor =
                                    "transparent";
                                  handleModelMouseLeave();
                                }}
                                style={{
                                  padding: "8px 12px",
                                  cursor: isDisabled
                                    ? "not-allowed"
                                    : "pointer",
                                  borderRadius: "6px",
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "4px",
                                  opacity: isDisabled ? 0.45 : 1,
                                }}
                              >
                                {/* Dòng 1: model.name + Thinking badge + capabilities + success rate */}
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    flexWrap: "wrap",
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize: "13px",
                                      fontWeight: 600,
                                      color: "var(--primary-text)",
                                    }}
                                  >
                                    {splitModelAndEffort(model.id).base === model.id
                                      ? model.name
                                      : (() => {
                                          // Model name có thể chứa " Medium", " High",... suffix từ getModels()
                                          // Lấy base name (bỏ effort suffix trong tên nếu có)
                                          const effortSuffixes = ["Low", "Medium", "High", "Extra", "Max"];
                                          let baseName = model.name;
                                          for (const s of effortSuffixes) {
                                            if (baseName.endsWith(` ${s}`)) {
                                              baseName = baseName.slice(0, -(s.length + 1));
                                              break;
                                            }
                                          }
                                          return baseName;
                                        })()
                                    }
                                  </span>
                                  {model.is_thinking && (
                                    <span
                                      style={{
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "4px",
                                        fontSize: "10px",
                                        fontWeight: 500,
                                        padding: "1px 6px",
                                        borderRadius: "4px",
                                        backgroundColor:
                                          "rgba(167,139,250,0.12)",
                                        color: "#a78bfa",
                                      }}
                                    >
                                      <Brain size={11} />
                                      Thinking
                                    </span>
                                  )}
                                  {model.is_search && (
                                    <Search
                                      size={12}
                                      style={{ color: "var(--secondary-text)" }}
                                    />
                                  )}
                                  {model.max_context_length != null && (
                                    <span
                                      style={{
                                        fontSize: "10.5px",
                                        color: "var(--secondary-text)",
                                        opacity: 0.7,
                                      }}
                                    >
                                      {formatContextLength(
                                        model.max_context_length,
                                      )}
                                    </span>
                                  )}
                                  {model.is_video_upload && (
                                    <Video
                                      size={12}
                                      style={{ color: "#8b5cf6" }}
                                    />
                                  )}
                                  {model.is_audio_upload && (
                                    <Volume2
                                      size={12}
                                      style={{ color: "#f59e0b" }}
                                    />
                                  )}
                                  {model.is_image_upload && (
                                    <Image
                                      size={12}
                                      style={{ color: "#10b981" }}
                                    />
                                  )}
                                  {model.is_image_generator && (
                                    <ImagePlus
                                      size={12}
                                      style={{ color: "#ec4899" }}
                                    />
                                  )}
                                  {model.is_video_generator && (
                                    <Film
                                      size={12}
                                      style={{ color: "#a855f7" }}
                                    />
                                  )}
                                  {model.is_deep_research && (
                                    <SearchCheck
                                      size={12}
                                      style={{ color: "#06b6d4" }}
                                    />
                                  )}
                                  {model.success_rate != null && (
                                    <span
                                      style={{
                                        marginLeft: "auto",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "4px",
                                        fontSize: "11px",
                                        color: successColor,
                                        flexShrink: 0,
                                      }}
                                    >
                                      <Circle
                                        size={10}
                                        fill={successColor}
                                        color={successColor}
                                      />
                                      {model.success_rate.toFixed(1)}%
                                    </span>
                                  )}
                                </div>

                                {/* Dòng 2: description */}
                                {model.description && (
                                  <div
                                    style={{
                                      fontSize: "11px",
                                      color: "var(--secondary-text)",
                                      opacity: 0.7,
                                      lineHeight: 1.4,
                                      display: "-webkit-box",
                                      WebkitLineClamp: 1,
                                      WebkitBoxOrient: "vertical",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                    }}
                                  >
                                    {model.description}
                                  </div>
                                )}
                              </div>
                            );
                          });
                          })()}
                      </>
                    )}
                  </div>
                );
              })
              )}

              {!isLoadingAccountMap && filteredProviders.length === 0 && (
                <div
                  style={{
                    textAlign: "center",
                    color: "var(--secondary-text)",
                    padding: "20px",
                    fontSize: "12px",
                  }}
                >
                  No models found
                </div>
              )}
            </div>
          </div>
        )}

        {step === "effort" && (
          /* Effort step */
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              height: "100%",
              overflow: "hidden",
              backgroundColor: "var(--tertiary-bg)",
            }}
          >
            <div
              className="custom-scrollbar"
              style={{ flex: 1, overflowY: "auto", padding: "12px" }}
            >
              {effortOptions.map((lvl) => {
                const color = EFFORT_COLOR[lvl];
                const meta = EFFORT_META[lvl];
                const Icon = meta.icon;
                return (
                  <div
                    key={lvl}
                    onClick={() => {
                      const finalModelId = `${selectedModel.id}-${lvl}`;
                      const prov = providers.find(
                        (p: any) => p.provider_id === selectedModel.provider_id,
                      );
                      const raw = prov ? ((prov as any).auth_method ?? (prov as any).auth_methods) : null;
                      let providerNeedsAuthForModel = false;
                      if (Array.isArray(raw)) providerNeedsAuthForModel = raw.filter((m: any) => typeof m === "string" && m.length > 0).length > 0;
                      else if (typeof raw === "string" && raw.trim()) {
                        try {
                          const parsed = JSON.parse(raw.trim());
                          providerNeedsAuthForModel = Array.isArray(parsed) ? parsed.filter((m: any) => m).length > 0 : false;
                        } catch {
                          providerNeedsAuthForModel = raw.trim().split(/[,;|\s]+/).filter((m: string) => m.length > 0).length > 0;
                        }
                      }
                      setSelectedModel((prev: any) => ({ ...prev, id: finalModelId }));
                      if (providerNeedsAuthForModel) {
                        setStep("account");
                      } else {
                        onSelect({ providerId: selectedModel.provider_id, modelId: finalModelId });
                        onClose();
                      }
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "var(--hover-bg, rgba(128,128,128,0.07))";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "var(--input-bg)";
                    }}
                    style={{
                      padding: "12px 14px",
                      cursor: "pointer",
                      borderRadius: "10px",
                      display: "flex",
                      alignItems: "center",
                      gap: "14px",
                      marginBottom: "8px",
                      border: "none",
                      backgroundColor: "var(--input-bg)",
                      transition: "background-color 0.15s",
                    }}
                  >
                    {/* Icon box */}
                    <div
                      style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "8px",
                        backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <Icon size={17} style={{ color }} />
                    </div>
                    {/* Text */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: "13px",
                          fontWeight: 700,
                          color,
                          marginBottom: "3px",
                          letterSpacing: "0.01em",
                        }}
                      >
                        {EFFORT_LABEL[lvl]}
                      </div>
                      <div
                        style={{
                          fontSize: "11px",
                          color: "var(--secondary-text)",
                          opacity: 0.75,
                          lineHeight: 1.45,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {meta.description}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {step === "account" && (
          /* Account step */
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              height: "100%",
              overflow: "hidden",
              backgroundColor: "var(--tertiary-bg)",
            }}
          >
            <div
              style={{
                position: "relative",
                padding: "12px 12px 0 12px",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  position: "absolute",
                  left: "22px",
                  top: "12px",
                  height: "34px",
                  display: "flex",
                  alignItems: "center",
                  pointerEvents: "none",
                }}
              >
                <Search
                  size={14}
                  style={{
                    color: "var(--vscode-input-placeholderForeground, var(--secondary-text))",
                  }}
                />
              </div>
              <input
                autoFocus
                type="text"
                placeholder="Search accounts..."
                value={accountSearchQuery}
                onChange={(e) => setAccountSearchQuery(e.target.value)}
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

            <div
              className="custom-scrollbar"
              style={{ flex: 1, overflowY: "auto", padding: "12px" }}
            >
              {isLoadingAccounts ? (
                <AccountListSkeleton />
              ) : providerAccounts.length > 0 ? (
                (() => {
                  const filtered = providerAccounts.filter((acc) =>
                    (acc.email || "")
                      .toLowerCase()
                      .includes(accountSearchQuery.toLowerCase()),
                  );
                  if (filtered.length === 0) {
                    return (
                      <div
                        style={{
                          textAlign: "center",
                          color: "var(--secondary-text)",
                          padding: "20px",
                          fontSize: "12px",
                        }}
                      >
                        No accounts match your search.
                      </div>
                    );
                  }
                  return filtered.map((acc) => (
                    <div
                      key={acc.id}
                      onClick={() => {
                        onSelect({
                          providerId: selectedModel.provider_id,
                          modelId: selectedModel.id,
                          accountId: acc.id,
                          email: acc.email,
                          accountProviderId: acc.provider_id,
                        });
                        onClose();
                      }}
                      style={{
                        padding: "8px 12px",
                        cursor: "pointer",
                        borderRadius: "8px",
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        transition: "background-color 0.2s",
                      }}
                      onMouseEnter={(e) =>
                        (e.currentTarget.style.backgroundColor =
                          "var(--hover-bg)")
                      }
                      onMouseLeave={(e) =>
                        (e.currentTarget.style.backgroundColor = "transparent")
                      }
                    >
                      <div
                        style={{
                          width: "28px",
                          height: "28px",
                          borderRadius: "7px",
                          backgroundColor: "rgba(128,128,128,0.1)",
                          color: "var(--secondary-text)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: "13px",
                          fontWeight: 600,
                          flexShrink: 0,
                        }}
                      >
                        {(acc.email?.[0] || acc.name?.[0] || "?").toUpperCase()}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <span
                          style={{
                            fontSize: "13px",
                            fontWeight: 500,
                            color: "var(--primary-text)",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            minWidth: 0,
                          }}
                        >
                          <span
                            style={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {acc.email || acc.name || acc.id}
                          </span>
                          {(acc.used_by_windows ?? 0) > 0 && (
                            <span
                              title={`Đang được dùng bởi ${acc.used_by_windows} cửa sổ VSCode khác`}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                fontSize: "9px",
                                fontWeight: 600,
                                padding: "1px 6px",
                                borderRadius: "4px",
                                backgroundColor: "rgba(234, 179, 8, 0.16)",
                                color: "#eab308",
                                flexShrink: 0,
                                textTransform: "uppercase",
                                letterSpacing: "0.02em",
                              }}
                            >
                              In use
                            </span>
                          )}
                        </span>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            marginTop: "2px",
                            overflow: "hidden",
                            minWidth: 0,
                          }}
                        >
                          <span
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "4px",
                              fontSize: "10px",
                              color: "var(--secondary-text)",
                              flexShrink: 0,
                            }}
                          >
                            <Activity size={11} style={{ color: "#22c55e" }} />
                            {(acc.period_requests ?? 0).toLocaleString()} req
                          </span>
                          <span
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "4px",
                              fontSize: "10px",
                              color: "var(--secondary-text)",
                              flexShrink: 0,
                            }}
                          >
                            <Coins size={11} style={{ color: "#f97316" }} />
                            {formatTokens(acc.period_tokens ?? 0)} tokens
                          </span>
                          {acc.usage != null && (() => {
                            const usageNum = Number(acc.usage);
                            return (
                              <span
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "3px",
                                  fontSize: "10px",
                                  color: usageNum >= 90
                                    ? "var(--vscode-editorError-foreground, #ef4444)"
                                    : usageNum >= 70
                                      ? "var(--vscode-editorWarning-foreground, #f97316)"
                                      : "var(--secondary-text)",
                                  flexShrink: 0,
                                }}
                              >
                                <BarChart3 size={10} style={{
                                  color: usageNum >= 90
                                    ? "var(--vscode-editorError-foreground, #ef4444)"
                                    : usageNum >= 70
                                      ? "var(--vscode-editorWarning-foreground, #f97316)"
                                      : "var(--vscode-charts-purple, #a855f7)",
                                }} />
                                {usageNum.toFixed(1)}%
                              </span>
                            );
                          })()}
                          {acc.reset_usage_at != null && (() => {
                            const resetDate = new Date(acc.reset_usage_at);
                            if (isNaN(resetDate.getTime())) return null;
                            const now = new Date();
                            const diffMs = resetDate.getTime() - now.getTime();
                            const isPast = diffMs <= 0;
                            const diffHours = Math.ceil(diffMs / (1000 * 60 * 60));
                            const label = isPast
                              ? "Reset done"
                              : diffHours < 1
                                ? "Resets <1h"
                                : diffHours < 24
                                  ? `Resets ${diffHours}h`
                                  : `Resets ${Math.ceil(diffHours / 24)}d`;
                            const resetFormatted = resetDate.toLocaleString();
                            return (
                              <span
                                title={`Usage resets at: ${resetFormatted}`}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "3px",
                                  fontSize: "10px",
                                  color: isPast
                                    ? "#22c55e"
                                    : "#f97316",
                                  flexShrink: 0,
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                <Clock size={10} style={{
                                  flexShrink: 0,
                                  color: isPast ? "#22c55e" : "#f97316",
                                }} />
                                {label}
                              </span>
                            );
                          })()}
                          {(() => {
                            const rel = formatRelativeTime(
                              acc.last_used_at ?? null,
                            );
                            if (!rel) return null;
                            return (
                              <span
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  fontSize: "10px",
                                  color: "var(--secondary-text)",
                                  flexShrink: 1,
                                  overflow: "hidden",
                                  minWidth: 0,
                                }}
                              >
                                <Clock
                                  size={11}
                                  style={{ flexShrink: 0, color: "#3b82f6" }}
                                />
                                <span
                                  style={{
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {rel}
                                </span>
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                    </div>
                  ));
                })()
              ) : (
                <div
                  style={{
                    textAlign: "center",
                    color: "var(--secondary-text)",
                    padding: "20px",
                    fontSize: "12px",
                  }}
                >
                  No accounts available for this provider.
                </div>
              )}
            </div>
          </div>
        )}

        <style>{`
          @keyframes slideUpDrawer {
            from { transform: translateY(100%); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
        `}</style>
      </div>

      {/* Tooltip via portal → escapes all overflow:hidden ancestors */}
      {tooltipModel &&
        ReactDOM.createPortal(
          <ModelTooltip
            model={tooltipModel.model}
            x={tooltipModel.x}
            y={tooltipModel.y}
          />,
          document.body,
        )}
    </>
  );
};

export default ProviderModelDrawer;
