import React from "react";
import { Zap, ShieldCheck, Eye } from "lucide-react";
import { useSettings } from "../../context/SettingsContext";

const MODE_METADATA: Record<
  string,
  { label: string; desc: string; icon: React.ReactNode; color: string }
> = {
  fullAccess: {
    label: "Full Access",
    desc: "AI has unrestricted access to all project files and tools",
    icon: <Zap size={11} />,
    color: "var(--vscode-editorBracketHighlight-foreground3, #f59e0b)",
  },
  approval: {
    label: "Approval Required",
    desc: "AI must request explicit approval before accessing files or running commands",
    icon: <ShieldCheck size={11} />,
    color: "var(--vscode-symbolIcon-interfaceForeground, #3b82f6)",
  },
  readOnly: {
    label: "Read Only",
    desc: "AI can only read project files, cannot modify them or run commands",
    icon: <Eye size={11} />,
    color: "var(--vscode-symbolIcon-classForeground, #8b5cf6)",
  },
};

export const GlobalPermissionButton: React.FC = () => {
  const { permissionMode, setPermissionMode } = useSettings();
  const [open, setOpen] = React.useState(false);
  const ref = React.useRef<HTMLDivElement>(null);
  const [isHovered, setIsHovered] = React.useState(false);
  const [tooltip, setTooltip] = React.useState<{
    id: string;
    x: number;
    y: number;
  } | null>(null);
  const tooltipTimer = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  React.useEffect(() => {
    if (!open) {
      setTooltip(null);
      if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
    }
  }, [open]);

  const handleItemMouseEnter = (
    id: string,
    e: React.MouseEvent<HTMLButtonElement>,
  ) => {
    if (!e.currentTarget.parentElement) return;
    if (
      !e.currentTarget.style.backgroundColor ||
      e.currentTarget.style.backgroundColor === "transparent"
    ) {
      e.currentTarget.style.backgroundColor =
        "var(--vscode-list-hoverBackground)";
    }
    const rect = e.currentTarget.getBoundingClientRect();
    tooltipTimer.current = setTimeout(() => {
      setTooltip({ id, x: rect.right + 6, y: rect.top });
    }, 500);
  };

  const handleItemMouseLeave = (
    isSelected: boolean,
    e: React.MouseEvent<HTMLButtonElement>,
  ) => {
    if (!isSelected) e.currentTarget.style.backgroundColor = "transparent";
    if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
    setTooltip(null);
  };

  const metadata = MODE_METADATA[permissionMode] || MODE_METADATA.fullAccess;

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen((v) => !v)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
          padding: "0 8px",
          height: "22px",
          boxSizing: "border-box",
          borderRadius: "4px",
          cursor: "pointer",
          fontSize: "11px",
          fontWeight: 600,
          letterSpacing: "0.3px",
          transition: "all 0.2s ease-in-out",
          border: `1px solid ${metadata.color}40`,
          background: isHovered
            ? `color-mix(in srgb, ${metadata.color} 20%, transparent)`
            : `color-mix(in srgb, ${metadata.color} 12%, transparent)`,
          color: metadata.color,
          opacity: 1,
          lineHeight: 1,
          verticalAlign: "middle",
        }}
        title="Tool permission mode"
      >
        {metadata.icon}
        <span
          style={{ fontSize: "11px", fontWeight: 600, letterSpacing: "0.3px" }}
        >
          {metadata.label}
        </span>
      </button>
      {open && (
        <div
          style={{
            position: "absolute",
            bottom: "calc(100% + 4px)",
            left: 0,
            zIndex: 1000,
            backgroundColor:
              "color-mix(in srgb, var(--input-bg) 100%, black 15%)",
            border: "1px solid var(--vscode-widget-border)",
            borderRadius: "6px",
            overflow: "hidden",
            boxShadow: "0 -4px 12px rgba(0,0,0,0.2)",
            minWidth: "180px",
          }}
        >
          {Object.entries(MODE_METADATA).map(([modeId, meta]) => {
            const isSelected = permissionMode === modeId;
            return (
              <button
                key={modeId}
                onClick={() => {
                  setPermissionMode(modeId as any);
                  setOpen(false);
                  setTooltip(null);
                  if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  width: "100%",
                  padding: "7px 12px",
                  fontSize: "11.5px",
                  fontWeight: 500,
                  textAlign: "left",
                  border: "none",
                  cursor: "pointer",
                  background: isSelected
                    ? "var(--vscode-button-background)"
                    : "transparent",
                  color: isSelected
                    ? "var(--vscode-button-foreground)"
                    : "var(--vscode-foreground)",
                }}
                onMouseEnter={(e) => handleItemMouseEnter(modeId, e)}
                onMouseLeave={(e) => handleItemMouseLeave(isSelected, e)}
              >
                <span
                  style={{
                    color: isSelected ? "inherit" : meta.color,
                    display: "flex",
                    alignItems: "center",
                  }}
                >
                  {meta.icon}
                </span>
                {meta.label}
              </button>
            );
          })}
        </div>
      )}
      {tooltip && MODE_METADATA[tooltip.id] && (
        <div
          style={{
            position: "fixed",
            left: tooltip.x,
            top: tooltip.y,
            zIndex: 9999,
            backgroundColor:
              "var(--vscode-editorHoverWidget-background, #1e1e1e)",
            border: "1px solid var(--vscode-editorHoverWidget-border, #454545)",
            borderRadius: "6px",
            padding: "8px 10px",
            maxWidth: "220px",
            fontSize: "11px",
            color: "var(--vscode-foreground)",
            lineHeight: 1.5,
            pointerEvents: "none",
            boxShadow: "0 4px 12px rgba(0,0,0,0.3)",
          }}
        >
          <div
            style={{
              fontWeight: 600,
              marginBottom: "3px",
              color: MODE_METADATA[tooltip.id].color,
            }}
          >
            {MODE_METADATA[tooltip.id].label}
          </div>
          {MODE_METADATA[tooltip.id].desc}
        </div>
      )}
    </div>
  );
};
