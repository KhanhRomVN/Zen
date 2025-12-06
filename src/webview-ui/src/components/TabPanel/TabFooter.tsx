import React, { useState, useEffect } from "react";
import { useModels } from "../../hooks/useModels";

interface TabFooterProps {
  port: number;
  wsConnected: boolean;
  onModelChange?: (modelId: string) => void; // 🆕 Callback khi model thay đổi
}

const TabFooter: React.FC<TabFooterProps> = ({
  port,
  wsConnected,
  onModelChange,
}) => {
  const {
    models: availableModels,
    selectedModel,
    setSelectedModel,
  } = useModels();
  const [showModelDrawer, setShowModelDrawer] = useState(false);

  const RefreshIcon = () => (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 2v6h-6" />
      <path d="M3 12a9 9 0 0 1 15-6.7L21 8" />
      <path d="M3 22v-6h6" />
      <path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
    </svg>
  );

  const Icon = () => (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );

  const ChevronDownIcon = () => (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );

  const PortToClipboard = () => {
    const text = "localhost:" + port;
    navigator.clipboard.writeText(text).then(
      () => {},
      (err) => {
        console.error(`[TabFooter] ❌ Failed to copy:`, err);
      }
    );
  };

  const handleModelSelect = (modelId: string) => {
    setSelectedModel(modelId);
    setShowModelDrawer(false);
    onModelChange?.(modelId);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!showModelDrawer) return;
      const target = event.target as HTMLElement;
      const drawer = document.querySelector('[data-model-drawer="true"]');
      if (drawer && !drawer.contains(target)) {
        setShowModelDrawer(false);
      }
    };

    if (showModelDrawer) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showModelDrawer]);

  return (
    <div
      style={{
        position: "fixed",
        bottom: 0,
        left: 0,
        right: 0,
        display: "flex",
        flexDirection: "column",
        width: "100%",
        backgroundColor: "var(--secondary-bg)",
        zIndex: 100,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "var(--spacing-sm) var(--spacing-lg)",
          backgroundColor: "var(--secondary-bg)",
          borderTop: "1px solid var(--border-color)",
          fontSize: "var(--font-size-xs)",
          color: "var(--secondary-text)",
          position: "relative",
          minHeight: "36px",
        }}
      >
        <div style={{ position: "relative", zIndex: 1001 }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--spacing-xs)",
              cursor: "pointer",
              padding: "var(--spacing-xs) var(--spacing-sm)",
              borderRadius: "var(--border-radius)",
              transition: "background-color 0.2s",
              userSelect: "none",
              color: wsConnected ? "#4ade80" : "var(--secondary-text)",
            }}
            onClick={() => setShowModelDrawer(!showModelDrawer)}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--hover-bg)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <span>
              Model:{" "}
              {availableModels.find((m) => m.id === selectedModel)?.name ||
                selectedModel}
            </span>
            <ChevronDownIcon />
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--spacing-md)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--spacing-xs)",
              cursor: "pointer",
              padding: "var(--spacing-xs) var(--spacing-sm)",
              borderRadius: "var(--border-radius)",
              transition: "background-color 0.2s",
              userSelect: "none",
            }}
            onClick={PortToClipboard}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "var(--hover-bg)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <Icon />
            <span
              style={{
                color: wsConnected ? "#4ade80" : "inherit",
                fontWeight: wsConnected ? 600 : 400,
              }}
            >
              localhost:{port || 3000} {/* Display 3000 nếu chưa có port */}
            </span>
            {wsConnected && (
              <span
                style={{
                  fontSize: "10px",
                  color: "#4ade80",
                  marginLeft: "4px",
                }}
              >
                (Shared)
              </span>
            )}
          </div>
        </div>
      </div>

      {showModelDrawer && (
        <div
          data-model-drawer="true"
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            backgroundColor: "var(--primary-bg)",
            borderTop: "1px solid var(--border-color)",
            borderTopLeftRadius: "12px",
            borderTopRightRadius: "12px",
            padding: "var(--spacing-lg)",
            zIndex: 999,
            boxShadow: "0 -4px 20px rgba(0, 0, 0, 0.15)",
            transform: "translateY(0)",
            animation: "slideUp 0.3s ease-out",
            maxHeight: "70vh",
            overflowY: "auto",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "var(--spacing-lg)",
              paddingBottom: "var(--spacing-sm)",
              borderBottom: "1px solid var(--border-color)",
            }}
          >
            <div
              style={{
                fontSize: "var(--font-size-lg)",
                fontWeight: 600,
                color: "var(--primary-text)",
              }}
            >
              Select Model
            </div>
            <div
              style={{
                cursor: "pointer",
                padding: "var(--spacing-xs)",
                borderRadius: "var(--border-radius)",
                transition: "background-color 0.2s",
              }}
              onClick={() => setShowModelDrawer(false)}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "var(--hover-bg)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "transparent";
              }}
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </div>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "var(--spacing-sm)",
            }}
          >
            {availableModels.map((model) => (
              <div
                key={model.id}
                style={{
                  padding: "var(--spacing-md) var(--spacing-lg)",
                  borderRadius: "var(--border-radius)",
                  cursor: "pointer",
                  transition: "all 0.2s",
                  backgroundColor:
                    selectedModel === model.id
                      ? "var(--accent-bg)"
                      : "var(--secondary-bg)",
                  color:
                    selectedModel === model.id
                      ? "var(--accent-text)"
                      : "var(--primary-text)",
                  border:
                    selectedModel === model.id
                      ? "1px solid var(--accent-text)"
                      : "1px solid transparent",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
                onClick={() => handleModelSelect(model.id)}
                onMouseEnter={(e) => {
                  if (selectedModel !== model.id) {
                    e.currentTarget.style.backgroundColor = "var(--hover-bg)";
                  }
                }}
                onMouseLeave={(e) => {
                  if (selectedModel !== model.id) {
                    e.currentTarget.style.backgroundColor =
                      "var(--secondary-bg)";
                  }
                }}
              >
                <span
                  style={{ fontWeight: selectedModel === model.id ? 600 : 400 }}
                >
                  {model.name}
                </span>
                {selectedModel === model.id && (
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: "var(--spacing-lg)",
              paddingTop: "var(--spacing-md)",
              borderTop: "1px solid var(--border-color)",
              fontSize: "var(--font-size-xs)",
              color: "var(--secondary-text)",
              textAlign: "center",
            }}
          >
            Model determines the AI behavior and capabilities
          </div>
        </div>
      )}

      {showModelDrawer && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0, 0, 0, 0.5)",
            zIndex: 998,
          }}
          onClick={() => setShowModelDrawer(false)}
        />
      )}

      <style>
        {`@keyframes slideUp {
 from {
 transform: translateY(100%);
 }
 to {
 transform: translateY(0);
 }
 }`}
      </style>
    </div>
  );
};

export default TabFooter;
