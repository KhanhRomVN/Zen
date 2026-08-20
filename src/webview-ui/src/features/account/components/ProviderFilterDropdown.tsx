import React, { useState, useRef, useEffect } from "react";
import { ChevronDown, Search, X } from "lucide-react";

interface ProviderFilterDropdownProps {
  providerConfigs: any[];
  selectedProvider: string;
  onSelectProvider: (providerId: string) => void;
  getFaviconUrl: (website: string) => string;
}

const ProviderFilterDropdown: React.FC<ProviderFilterDropdownProps> = ({
  providerConfigs,
  selectedProvider,
  onSelectProvider,
  getFaviconUrl,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedProviderObj = providerConfigs.find((p) => p.provider_id === selectedProvider);

  const filteredProviders = providerConfigs.filter(
    (p) =>
      p.provider_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.provider_id.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const handleSelect = (providerId: string) => {
    onSelectProvider(providerId);
    setIsOpen(false);
    setSearchQuery("");
  };

  const handleClear = () => {
    onSelectProvider("");
    setIsOpen(false);
  };

  const isActive = (id: string) => selectedProvider === id;

  return (
    <div ref={dropdownRef} style={{ position: "relative" }}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "8px",
          height: "34px",
          padding: "0 10px",
          borderRadius: "8px",
          backgroundColor: "var(--input-bg)",
          border: "1px solid var(--border-color)",
          color: "var(--primary-text)",
          cursor: "pointer",
          fontSize: "13px",
          fontWeight: 500,
          whiteSpace: "nowrap",
        }}
      >
        {selectedProvider && selectedProviderObj ? (
          <>
            <img
              src={getFaviconUrl(selectedProviderObj.website)}
              alt={selectedProviderObj.provider_name}
              style={{ width: "16px", height: "16px", borderRadius: "3px" }}
              onError={(e) => ((e.target as HTMLImageElement).style.display = "none")}
            />
            <span>{selectedProviderObj.provider_name}</span>
          </>
        ) : (
          <span>All Providers</span>
        )}
        <ChevronDown size={13} />
      </button>

      {isOpen && (
        <div
          style={{
            position: "absolute",
            top: "100%",
            right: 0,
            marginTop: "6px",
            width: "240px",
            maxHeight: "300px",
            backgroundColor: "var(--tertiary-bg)",
            border: "1px solid var(--border-color)",
            borderRadius: "10px",
            boxShadow: "0 8px 24px rgba(0,0,0,0.2)",
            zIndex: 1000,
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
          }}
        >
          {/* Search */}
          <div style={{ padding: "8px", borderBottom: "1px solid var(--border-color)" }}>
            <div style={{ position: "relative" }}>
              <Search
                size={13}
                style={{
                  position: "absolute",
                  left: "9px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--secondary-text)",
                }}
              />
              <input
                type="text"
                placeholder="Search provider..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  padding: "7px 28px",
                  fontSize: "12px",
                  backgroundColor: "var(--input-bg)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "7px",
                  color: "var(--primary-text)",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  style={{
                    position: "absolute",
                    right: "7px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                    display: "flex",
                    alignItems: "center",
                    color: "var(--secondary-text)",
                  }}
                >
                  <X size={11} />
                </button>
              )}
            </div>
          </div>

          {/* List */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {/* All Providers option */}
            <button
              onClick={handleClear}
              style={{
                width: "100%",
                padding: "9px 12px",
                display: "flex",
                alignItems: "center",
                gap: "10px",
                border: "none",
                backgroundColor: isActive("") ? "var(--vscode-list-activeSelectionBackground)" : "transparent",
                color: "var(--primary-text)",
                fontSize: "12px",
                cursor: "pointer",
                textAlign: "left",
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--hover-bg)")}
              onMouseLeave={(e) =>
                (e.currentTarget.style.backgroundColor = isActive("")
                  ? "var(--vscode-list-activeSelectionBackground)"
                  : "transparent")
              }
            >
              <div
                style={{
                  width: "20px",
                  height: "20px",
                  borderRadius: "4px",
                  backgroundColor: "rgba(128,128,128,0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <span style={{ fontSize: "9px", fontWeight: "bold", color: "var(--secondary-text)" }}>All</span>
              </div>
              <span>All Providers</span>
            </button>

            {filteredProviders.map((provider) => (
              <button
                key={provider.provider_id}
                onClick={() => handleSelect(provider.provider_id)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  border: "none",
                  backgroundColor: isActive(provider.provider_id)
                    ? "var(--vscode-list-activeSelectionBackground)"
                    : "transparent",
                  color: "var(--primary-text)",
                  fontSize: "12px",
                  cursor: "pointer",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--hover-bg)")}
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = isActive(provider.provider_id)
                    ? "var(--vscode-list-activeSelectionBackground)"
                    : "transparent")
                }
              >
                <div
                  style={{
                    width: "20px",
                    height: "20px",
                    borderRadius: "4px",
                    backgroundColor: "rgba(128,128,128,0.1)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    overflow: "hidden",
                  }}
                >
                  <img
                    src={getFaviconUrl(provider.website)}
                    alt={provider.provider_name}
                    style={{ width: "16px", height: "16px", objectFit: "contain" }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                      const parent = (e.target as HTMLImageElement).parentElement;
                      if (parent) {
                        const fb = document.createElement("span");
                        fb.style.cssText = "font-size:9px;font-weight:bold;";
                        fb.textContent = provider.provider_name.slice(0, 2).toUpperCase();
                        (e.target as HTMLImageElement).replaceWith(fb);
                      }
                    }}
                  />
                </div>
                <span>{provider.provider_name}</span>
              </button>
            ))}

            {filteredProviders.length === 0 && (
              <div
                style={{
                  padding: "16px",
                  textAlign: "center",
                  color: "var(--secondary-text)",
                  fontSize: "12px",
                  opacity: 0.7,
                }}
              >
                No providers found
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default ProviderFilterDropdown;
