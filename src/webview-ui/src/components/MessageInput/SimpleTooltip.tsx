import * as React from "react";

export const TOOLTIP_BG =
  "color-mix(in srgb, var(--vscode-editor-background, #1e1e1e) 86%, #000)";

const MUTED = "var(--vscode-descriptionForeground, #8b8b8b)";

const KEYFRAMES = `@keyframes zenTooltipIn{from{opacity:0;transform:translate(-50%,-92%)}to{opacity:1;transform:translate(-50%,-100%)}}`;

export const SimpleTooltip: React.FC<{
  content: React.ReactNode;
  children: React.ReactElement;
  disabled?: boolean;
}> = ({ content, children, disabled }) => {
  const [pos, setPos] = React.useState<{ x: number; y: number } | null>(null);

  const show = (e: React.MouseEvent) => {
    if (disabled) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setPos({ x: rect.left + rect.width / 2, y: rect.top - 8 });
  };
  const hide = () => setPos(null);

  return (
    <>
      {React.cloneElement(children, {
        onMouseEnter: (e: React.MouseEvent) => {
          children.props.onMouseEnter?.(e);
          show(e);
        },
        onMouseLeave: (e: React.MouseEvent) => {
          children.props.onMouseLeave?.(e);
          hide();
        },
        onMouseDown: (e: React.MouseEvent) => {
          children.props.onMouseDown?.(e);
          hide();
        },
      })}
      {pos && !disabled && (
        <div
          style={{
            position: "fixed",
            left: pos.x,
            top: pos.y,
            transform: "translate(-50%, -100%)",
            animation: "zenTooltipIn 0.14s ease-out",
            zIndex: 99999,
            backgroundColor: TOOLTIP_BG,
            borderRadius: "10px",
            padding: "10px 12px",
            fontSize: "12px",
            lineHeight: 1.4,
            color: "var(--vscode-foreground)",
            whiteSpace: "nowrap",
            pointerEvents: "none",
            boxShadow: "0 6px 20px rgba(0,0,0,0.45)",
          }}
        >
          <style>{KEYFRAMES}</style>
          {content}
        </div>
      )}
    </>
  );
};

/** Tiêu đề tooltip: chip icon màu + tên */
export const TooltipHeader: React.FC<{
  icon?: React.ReactNode;
  title: string;
  color: string;
}> = ({ icon, title, color }) => (
  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
    {icon && (
      <span
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          width: "22px",
          height: "22px",
          borderRadius: "6px",
          color,
          background: `color-mix(in srgb, ${color} 18%, transparent)`,
        }}
      >
        {icon}
      </span>
    )}
    <span style={{ fontWeight: 600, fontSize: "12.5px" }}>{title}</span>
  </div>
);

/** Một dòng trạng thái: [icon] label ...... [pill value] */
export const TooltipRow: React.FC<{
  icon?: React.ReactNode;
  label: string;
  value: string;
  color: string;
  active?: boolean;
}> = ({ icon, label, value, color, active = true }) => {
  const c = active ? color : MUTED;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "20px",
        minWidth: "150px",
      }}
    >
      <span
        style={{
          display: "flex",
          alignItems: "center",
          gap: "7px",
          color: active ? "var(--vscode-foreground)" : MUTED,
        }}
      >
        {icon && (
          <span style={{ display: "flex", color: c, opacity: active ? 1 : 0.7 }}>
            {icon}
          </span>
        )}
        {label}
      </span>
      <span
        style={{
          padding: "1px 8px",
          borderRadius: "999px",
          fontSize: "10.5px",
          fontWeight: 700,
          letterSpacing: "0.3px",
          color: c,
          background: `color-mix(in srgb, ${c} ${active ? 16 : 12}%, transparent)`,
        }}
      >
        {value}
      </span>
    </div>
  );
};

/** Khung chứa nhiều dòng */
export const TooltipCard: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => (
  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
    {children}
  </div>
);