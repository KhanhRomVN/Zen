import React, { useState, useMemo, useEffect, useRef } from "react";
import ReactDOM from "react-dom";
import { Search, ChevronRight, X, ChevronLeft, ChevronDown, Brain, Circle, Video, Image, Activity, Coins } from "lucide-react";
import { getFaviconUrl } from "@/utils/favicon";

interface Provider {
  provider_id: string;
  provider_name: string;
  website: string;
  is_enabled: boolean;
  total_accounts?: number;
  models: any[];
}

interface Account {
  id: string;
  name?: string;
  email?: string;
  provider_id: string;
  is_enabled: boolean;
  usage?: string;
  reset_period?: string;
  period_requests?: number;
  period_tokens?: number;
}

interface ModelAccountDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  providers: Provider[];
  apiUrl: string;
  onSelect: (model: {
    providerId: string;
    modelId: string;
    accountId?: string;
    email?: string;
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
  const hasImageUpload =
    model.is_image_upload === true || model.is_upload === true;
  const hasVideoUpload = model.is_video_upload === true;

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

// ─── Main Component ───────────────────────────────────────────────────────────
const ModelAccountDrawer: React.FC<ModelAccountDrawerProps> = ({
  isOpen,
  onClose,
  providers,
  apiUrl,
  onSelect,
}) => {
  const [step, setStep] = useState<"model" | "account">("model");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedModel, setSelectedModel] = useState<any | null>(null);
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
      setProviderAccounts([]);
      setTooltipModel(null);

      // Fetch all accounts once to build count map
      setIsLoadingAccountMap(true);
      fetch(`${apiUrl}/v1/accounts?page=1&limit=200`)
        .then((r) => r.json())
        .then((result) => {
          if (result.success && result.data?.accounts) {
            const map: Record<string, number> = {};
            for (const acc of result.data.accounts as any[]) {
              map[acc.provider_id] = (map[acc.provider_id] || 0) + 1;
            }
            setAccountCountMap(map);
          } else {
            console.warn(
              "[QuickSwitchDrawer] Accounts fetch failed or empty:",
              result,
            );
          }
        })
        .catch((err) =>
          console.error("[QuickSwitchDrawer] Accounts fetch error:", err),
        )
        .finally(() => setIsLoadingAccountMap(false));
    }
  }, [isOpen, apiUrl]);

  // Fetch accounts when moving to account step
  useEffect(() => {
    if (step === "account" && selectedModel) {
      let isMounted = true;
      setIsLoadingAccounts(true);
      const url = `${apiUrl}/v1/accounts?page=1&limit=50&provider_id=${selectedModel.provider_id}`;
      fetch(url)
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
          if (isMounted) setIsLoadingAccounts(false);
        });
      return () => {
        isMounted = false;
      };
    }
  }, [step, selectedModel, apiUrl]);

  // getFavicon moved to @/utils/favicon

  const filteredProviders = useMemo(() => {
    const mapped = providers
      .filter((p) => p.is_enabled !== false)
      .map((provider) => {
        const filteredModels = (provider.models || []).filter(
          (m) =>
            (m.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
            (m.id || "").toLowerCase().includes(searchQuery.toLowerCase()),
        );
        return { ...provider, models: filteredModels };
      })
      .filter(
        (p) =>
          p.models.length > 0 ||
          (p.provider_name || "")
            .toLowerCase()
            .includes(searchQuery.toLowerCase()),
      );

    // Sort priority:
    //   0 = has models + has accounts  (top)
    //   1 = has models, no accounts
    //   2 = has accounts, no models
    //   3 = neither                    (bottom)
    const priority = (p: (typeof mapped)[0]) => {
      const hasModels = p.models.length > 0;
      const hasAccounts = (accountCountMap[p.provider_id] ?? 0) > 0;
      if (hasModels && hasAccounts) return 0;
      if (hasModels && !hasAccounts) return 1;
      if (!hasModels && hasAccounts) return 2;
      return 3;
    };

    const sorted = [...mapped].sort((a, b) => priority(a) - priority(b));
    return sorted;
  }, [providers, searchQuery, accountCountMap]);

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
                  setStep("model");
                  setAccountSearchQuery("");
                }}
                style={{
                  background: "rgba(128,128,128,0.1)",
                  border: "none",
                  cursor: "pointer",
                  padding: "6px",
                  borderRadius: "6px",
                  color: "var(--secondary-text)",
                  display: "flex",
                  alignItems: "center",
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
                }}
              >
                {step === "model" ? "Quick Switch" : "Select Account"}
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
                background: "rgba(128,128,128,0.1)",
                border: "none",
                cursor: "pointer",
                padding: "6px",
                borderRadius: "6px",
                color: "var(--secondary-text)",
                display: "flex",
                alignItems: "center",
              }}
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {step === "model" ? (
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
              {filteredProviders.map((provider) => {
                const accountCount = accountCountMap[provider.provider_id] ?? 0;
                const hasModels = provider.models.length > 0;
                const hasAccounts = accountCount > 0;
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
                      {!isLoadingAccountMap && (
                        <span
                          style={{
                            marginLeft: "auto",
                            fontSize: "13px",
                            fontWeight: 400,
                            opacity: 0.55,
                            display: "flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          {accountCount} account{accountCount !== 1 ? "s" : ""}
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
                        {/* No accounts warning */}
                        {!isLoadingAccountMap && !hasAccounts && (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                              padding: "7px 10px",
                              marginBottom: "6px",
                              borderRadius: "4px",
                              backgroundColor: "rgba(234, 179, 8, 0.08)",
                              border: "1px solid rgba(234, 179, 8, 0.3)",
                              fontSize: "11.5px",
                              color: "#eab308",
                            }}
                          >
                            <span>⚠</span>
                            <span>No accounts added for this provider</span>
                          </div>
                        )}

                        {/* No models warning */}
                        {!hasModels && (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                              padding: "7px 10px",
                              borderRadius: "4px",
                              backgroundColor: "rgba(239, 68, 68, 0.08)",
                              border: "1px solid rgba(239, 68, 68, 0.3)",
                              fontSize: "11.5px",
                              color: "#ef4444",
                            }}
                          >
                            <span>✕</span>
                            <span>No models available for this provider</span>
                          </div>
                        )}

                        {/* Model rows */}
                        {hasModels &&
                          provider.models.map((model) => {
                            const isDisabled = !hasAccounts;
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
                                  setSelectedModel({
                                    ...model,
                                    provider_id: provider.provider_id,
                                  });
                                  setStep("account");
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
                                    {model.name}
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
                                      style={{ color: "var(--secondary-text)" }}
                                    />
                                  )}
                                  {model.is_image_upload && (
                                    <Image
                                      size={12}
                                      style={{ color: "var(--secondary-text)" }}
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
                          })}
                      </>
                    )}
                  </div>
                );
              })}

              {filteredProviders.length === 0 && (
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
        ) : (
          /* Account step */
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              height: "100%",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "relative",
                padding: "12px 12px 0 12px",
                flexShrink: 0,
              }}
            >
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
                <div
                  style={{
                    textAlign: "center",
                    color: "var(--secondary-text)",
                    padding: "20px",
                    fontSize: "12px",
                  }}
                >
                  Loading accounts...
                </div>
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
                            display: "block",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {acc.email || acc.name || acc.id}
                        </span>
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            marginTop: "2px",
                          }}
                        >
                          <span
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "4px",
                              fontSize: "10px",
                              color: "var(--secondary-text)",
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
                            }}
                          >
                            <Coins size={11} style={{ color: "#f97316" }} />
                            {formatTokens(acc.period_tokens ?? 0)} tokens
                          </span>
                        </div>
                      </div>
                      {acc.usage && (
                        <span
                          style={{
                            fontSize: "11px",
                            padding: "2px 6px",
                            borderRadius: "4px",
                            backgroundColor:
                              acc.usage.includes("5/5") ||
                              acc.usage.toLowerCase().includes("limit") ||
                              acc.usage.toLowerCase().includes("unknown")
                                ? "rgba(239, 68, 68, 0.12)"
                                : "rgba(34, 197, 94, 0.12)",
                            color:
                              acc.usage.includes("5/5") ||
                              acc.usage.toLowerCase().includes("limit") ||
                              acc.usage.toLowerCase().includes("unknown")
                                ? "#f87171"
                                : "#4ade80",
                            fontWeight: 500,
                            border:
                              acc.usage.includes("5/5") ||
                              acc.usage.toLowerCase().includes("limit") ||
                              acc.usage.toLowerCase().includes("unknown")
                                ? "1px solid rgba(239, 68, 68, 0.2)"
                                : "1px solid rgba(34, 197, 94, 0.2)",
                            flexShrink: 0,
                          }}
                        >
                          {acc.usage}
                        </span>
                      )}
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

export default ModelAccountDrawer;
