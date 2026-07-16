import React from "react";
import { CompressButtonProps } from "./types";
import { SummaryIcon } from "./icons";

export const CompressButton: React.FC<CompressButtonProps> = ({
  onClick,
  title,
  currentModel,
  currentAccount,
  providers,
  apiUrl,
  onModelAccountSelect,
  onSwitchModelRequest,
  disabled = false,
}) => {
  const [isHovered, setIsHovered] = React.useState(false);
  const [showTooltip, setShowTooltip] = React.useState(false);
  const [isTooltipHovered, setIsTooltipHovered] = React.useState(false);
  const tooltipRef = React.useRef<HTMLDivElement>(null);

  // Close tooltip when clicking outside or when disabled
  React.useEffect(() => {
    if (!showTooltip) return;
    if (disabled) {
      setShowTooltip(false);
      return;
    }
    const handler = (e: MouseEvent) => {
      if (
        tooltipRef.current &&
        !tooltipRef.current.contains(e.target as Node)
      ) {
        setShowTooltip(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showTooltip, disabled]);

  return (
    <div style={{ position: "relative" }}>
      <div
        onClick={() => setShowTooltip((v) => !v)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "22px",
          width: "22px",
          boxSizing: "border-box",
          borderRadius: "4px",
          cursor: "pointer",
          transition: "all 0.2s ease-in-out",
          border: "1px solid rgba(128, 128, 128, 0.2)",
          background: isHovered
            ? "rgba(128, 128, 128, 0.2)"
            : "rgba(128, 128, 128, 0.12)",
          color: "var(--vscode-foreground)",
          opacity: isHovered ? 0.9 : 0.7,
        }}
        title={title}
      >
        <SummaryIcon />
      </div>

      {showTooltip && (
        <div
          ref={tooltipRef}
          onMouseEnter={() => setIsTooltipHovered(true)}
          onMouseLeave={() => setIsTooltipHovered(false)}
          style={{
            position: "absolute",
            bottom: "calc(100% + 8px)",
            left: "0",
            zIndex: 10000,
            backgroundColor:
              "color-mix(in srgb, var(--input-bg) 100%, black 15%)",
            border: isTooltipHovered
              ? "1px solid var(--vscode-focusBorder, #007acc)"
              : "1px solid var(--vscode-widget-border)",
            borderRadius: "6px",
            overflow: "hidden",
            minWidth: "220px",
            transition: "border-color 0.15s ease",
          }}
        >
          <button
            disabled
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              width: "100%",
              padding: "10px 12px",
              fontSize: "11.5px",
              fontWeight: 500,
              textAlign: "left",
              border: "none",
              cursor: "not-allowed",
              background: "transparent",
              color: "var(--vscode-foreground)",
              borderBottom: "1px solid var(--vscode-widget-border)",
              opacity: 0.4,
              pointerEvents: "none",
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: "2px" }}>
              Continue with current model
            </div>
            <div style={{ fontSize: "10px", opacity: 0.7 }}>
              {currentModel?.providerId}/{currentModel?.id}
              {currentAccount?.email && ` • ${currentAccount.email}`}
            </div>
          </button>

          <button
            onClick={() => {
              setShowTooltip(false);
              if (onSwitchModelRequest) {
                onSwitchModelRequest();
              }
            }}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-start",
              width: "100%",
              padding: "10px 12px",
              fontSize: "11.5px",
              fontWeight: 500,
              textAlign: "left",
              border: "none",
              cursor: "pointer",
              background: "transparent",
              color: "var(--vscode-foreground)",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background =
                "var(--vscode-list-hoverBackground)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = "transparent";
            }}
          >
            <div style={{ fontWeight: 600, marginBottom: "2px" }}>
              Switch to different model
            </div>
            <div style={{ fontSize: "10px", opacity: 0.7 }}>
              Continue conversation with new model
            </div>
          </button>
        </div>
      )}
    </div>
  );
};
