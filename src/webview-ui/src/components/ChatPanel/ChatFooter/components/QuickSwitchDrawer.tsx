import React, { useState, useMemo } from "react";
import { Search, ChevronRight, X, User, ChevronLeft } from "lucide-react";

interface Provider {
  provider_id: string;
  provider_name: string;
  website: string;
  is_enabled: boolean;
  total_accounts: number;
  models: any[];
}

interface Account {
  id: string;
  name?: string;
  email?: string;
  provider_id: string;
  is_enabled: boolean;
}

interface QuickSwitchDrawerProps {
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

const QuickSwitchDrawer: React.FC<QuickSwitchDrawerProps> = ({
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

  // Reset state when drawer opens
  React.useEffect(() => {
    if (isOpen) {
      setStep("model");
      setSearchQuery("");
      setAccountSearchQuery("");
      setSelectedModel(null);
      setProviderAccounts([]);
    }
  }, [isOpen]);

  // Fetch accounts when moving to account step
  React.useEffect(() => {
    if (step === "account" && selectedModel) {
      let isMounted = true;
      setIsLoadingAccounts(true);
      fetch(
        `${apiUrl}/v1/accounts?page=1&limit=50&provider_id=${selectedModel.provider_id}`,
      )
        .then((res) => res.json())
        .then((result) => {
          if (isMounted && result.success && result.data?.accounts) {
            const accs = result.data.accounts;
            setProviderAccounts(accs);
          }
        })
        .catch(() => {})
        .finally(() => {
          if (isMounted) setIsLoadingAccounts(false);
        });

      return () => {
        isMounted = false;
      };
    }
  }, [step, selectedModel, apiUrl, onSelect, onClose]);

  const getFavicon = (url?: string) => {
    if (!url) return "";
    try {
      const u = new URL(url);
      return `${u.origin}/favicon.ico`;
    } catch {
      return "";
    }
  };

  const filteredProviders = useMemo(() => {
    return providers
      .filter((p) => p.is_enabled !== false)
      .map((provider) => {
        const filteredModels = (provider.models || []).filter(
          (m) =>
            m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            m.id.toLowerCase().includes(searchQuery.toLowerCase()),
        );
        return { ...provider, models: filteredModels };
      })
      .filter(
        (p) =>
          (p.models.length > 0 &&
            (p.total_accounts === undefined || p.total_accounts > 0)) ||
          p.provider_name.toLowerCase().includes(searchQuery.toLowerCase()),
      );
  }, [providers, searchQuery]);

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        height: "50vh",
        maxHeight: "50vh",
        backgroundColor: "var(--primary-bg)",
        borderTop: "1px solid var(--border-color)",
        borderLeft: "none",
        borderRight: "none",
        borderTopLeftRadius: "12px",
        borderTopRightRadius: "12px",
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
          padding: "10px 16px",
          borderBottom: "1px solid var(--border-color)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: "var(--secondary-bg)",
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
                background: "transparent",
                border: "none",
                cursor: "pointer",
                padding: "4px",
                marginLeft: "-6px",
                color: "var(--secondary-text)",
                display: "flex",
                alignItems: "center",
                transition: "color 0.2s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.color = "var(--primary-text)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.color = "var(--secondary-text)")
              }
            >
              <ChevronLeft size={16} />
            </button>
          )}
          <span
            style={{
              fontSize: "12px",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
            }}
          >
            {step === "model" ? "Select Quick Switch Model" : "Select Account"}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {step === "account" && selectedModel && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "11px",
                color: "var(--secondary-text)",
                padding: "2px 8px",
                backgroundColor: "var(--hover-bg)",
                borderRadius: "4px",
              }}
            >
              {(() => {
                const provider = providers.find(
                  (p) => p.provider_id === selectedModel.provider_id,
                );
                const faviconUrl = getFavicon(provider?.website);
                return (
                  faviconUrl && (
                    <img
                      src={faviconUrl}
                      alt=""
                      style={{
                        width: "12px",
                        height: "12px",
                        borderRadius: "2px",
                      }}
                      onError={(e) => (e.currentTarget.style.display = "none")}
                    />
                  )
                );
              })()}
              <span style={{ fontWeight: 500 }}>
                {selectedModel.provider_id}/{selectedModel.id}
              </span>
            </div>
          )}
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "4px",
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
            padding: "12px",
            display: "flex",
            flexDirection: "column",
            height: "100%",
            overflow: "hidden",
          }}
        >
          <div style={{ position: "relative", marginBottom: "12px" }}>
            <Search
              size={14}
              style={{
                position: "absolute",
                left: "10px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--secondary-text)",
              }}
            />
            <input
              autoFocus
              type="text"
              placeholder="Search models..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "6px 10px 6px 30px",
                backgroundColor: "var(--input-bg)",
                border: "1px solid var(--border-color)",
                borderRadius: "4px",
                color: "var(--primary-text)",
                fontSize: "13px",
                outline: "none",
                boxSizing: "border-box", // Ensure padding doesn't widen the input
              }}
            />
          </div>

          <div
            className="custom-scrollbar"
            style={{ flex: 1, overflowY: "auto" }}
          >
            {filteredProviders.map((provider) => (
              <div key={provider.provider_id} style={{ marginBottom: "16px" }}>
                <div
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    color: "var(--secondary-text)",
                    paddingBottom: "4px",
                    borderBottom: "1px solid var(--border-color)",
                    marginBottom: "8px",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  {getFavicon(provider.website) && (
                    <img
                      src={getFavicon(provider.website)}
                      alt="favicon"
                      style={{
                        width: "12px",
                        height: "12px",
                        borderRadius: "2px",
                      }}
                      onError={(e) => {
                        (e.target as HTMLImageElement).style.display = "none";
                      }}
                    />
                  )}
                  {provider.provider_name || provider.provider_id}
                </div>
                {provider.models.map((model) => {
                  const isDisabled = provider.total_accounts === 0;

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
                      style={{
                        padding: "8px 12px",
                        cursor: isDisabled ? "not-allowed" : "pointer",
                        borderRadius: "4px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        opacity: isDisabled ? 0.5 : 1,
                      }}
                      onMouseEnter={(e) => {
                        if (!isDisabled)
                          e.currentTarget.style.backgroundColor =
                            "var(--hover-bg)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.backgroundColor = "transparent";
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span
                          style={{
                            fontSize: "13px",
                            fontWeight: 500,
                            color: "var(--primary-text)",
                          }}
                        >
                          {model.name}
                        </span>
                      </div>
                      {!isDisabled && (
                        <ChevronRight
                          size={14}
                          style={{ color: "var(--secondary-text)" }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
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
        <div
          style={{
            padding: "12px",
            display: "flex",
            flexDirection: "column",
            height: "100%",
            overflow: "hidden",
          }}
        >
          <div style={{ position: "relative", marginBottom: "12px" }}>
            <Search
              size={14}
              style={{
                position: "absolute",
                left: "10px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--secondary-text)",
              }}
            />
            <input
              autoFocus
              type="text"
              placeholder="Search accounts..."
              value={accountSearchQuery}
              onChange={(e) => setAccountSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "6px 10px 6px 30px",
                backgroundColor: "var(--input-bg)",
                border: "1px solid var(--border-color)",
                borderRadius: "4px",
                color: "var(--primary-text)",
                fontSize: "13px",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div
            className="custom-scrollbar"
            style={{ flex: 1, overflowY: "auto" }}
          >
            {providerAccounts.length > 0 ? (
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
                      borderRadius: "4px",
                      display: "flex",
                      alignItems: "center",
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
                    <span
                      style={{
                        fontSize: "13px",
                        fontWeight: 400,
                        color: "var(--primary-text)",
                      }}
                    >
                      {acc.email || acc.name || acc.id}
                    </span>
                  </div>
                ));
              })()
            ) : isLoadingAccounts ? (
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
  );
};

export default QuickSwitchDrawer;
