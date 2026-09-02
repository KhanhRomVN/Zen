import React from "react";
import { DropdownItemProps, DropdownSeparatorProps } from "./type";
import { useDropdownContext } from "./Dropdown";

function extractText(node: React.ReactNode): string {
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (!node) return "";
  if (Array.isArray(node)) return node.map(extractText).join(" ");
  if (React.isValidElement(node)) {
    const props = node.props as { children?: React.ReactNode };
    return extractText(props.children);
  }
  return "";
}

export function DropdownItem({
  children,
  onClick,
  className,
  disabled,
  icon,
  closeOnSelect,
  variant = "default",
  noPadding = false,
  ...props
}: DropdownItemProps) {
  const {
    close,
    searchText,
    closeOnSelect: contextCloseOnSelect,
  } = useDropdownContext();

  // Use prop if provided, otherwise use context value
  const shouldClose =
    closeOnSelect !== undefined ? closeOnSelect : contextCloseOnSelect;

  // Filter by search text
  if (searchText) {
    const itemText = extractText(children);
    if (!itemText.toLowerCase().includes(searchText.toLowerCase())) {
      return null;
    }
  }

  const handleClick = () => {
    if (disabled) return;
    onClick?.();
    if (shouldClose) {
      close();
    }
  };

  return (
    <div
      onClick={handleClick}
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      style={{
        width: "100%",
        display: "flex",
        alignItems: "center",
        gap: "8px",
        fontSize: "13px",
        cursor: disabled ? "not-allowed" : "pointer",
        whiteSpace: "nowrap",
        padding: noPadding ? "0" : "6px 12px",
        color:
          variant === "error"
            ? "var(--vscode-errorForeground, #f87171)"
            : "var(--primary-text)",
        opacity: disabled ? 0.5 : 1,
        transition: "background-color 0.15s ease",
      }}
      className={className}
      onMouseEnter={(e) => {
        if (!disabled) {
          e.currentTarget.style.backgroundColor = "var(--hover-bg)";
        }
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.backgroundColor = "transparent";
      }}
      {...props}
    >
      {icon && <span style={{ flexShrink: 0 }}>{icon}</span>}
      {children}
    </div>
  );
}

DropdownItem.displayName = "DropdownItem";

export function DropdownSeparator({ className }: DropdownSeparatorProps) {
  return (
    <div
      className={className}
      style={{
        height: "1px",
        backgroundColor: "var(--border-color)",
        opacity: 0.6,
        margin: "4px 8px",
      }}
    />
  );
}

DropdownSeparator.displayName = "DropdownSeparator";

export default DropdownItem;
