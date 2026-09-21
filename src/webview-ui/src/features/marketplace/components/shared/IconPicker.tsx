import React, { useMemo, useRef, useState } from "react";
import { Search } from "lucide-react";
import {
  GROUP_ICONS,
  GROUP_ICON_NAMES,
  getGroupIcon,
} from "./iconLibrary";

interface IconPickerProps {
  value?: string;
  onChange: (iconName: string) => void;
}

/**
 * Nút chọn icon — chỉ hiển thị icon hiện tại (không text). Khi mở,
 * dropdown có searchbar lọc và grid ~8 cột, mỗi icon hover hiện tooltip
 * tên icon ngay lập tức (không có delay như title attribute).
 */
export function IconPicker({ value, onChange }: IconPickerProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hoveredIcon, setHoveredIcon] = useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });
  const gridRef = useRef<HTMLDivElement>(null);

  const CurrentIcon = getGroupIcon(value);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return GROUP_ICON_NAMES;
    return GROUP_ICON_NAMES.filter((n) => n.toLowerCase().includes(q));
  }, [query]);

  const handleIconEnter = (
    e: React.MouseEvent<HTMLButtonElement>,
    name: string,
  ) => {
    const btnRect = e.currentTarget.getBoundingClientRect();
    const gridRect = gridRef.current?.getBoundingClientRect();
    if (!gridRect) return;
    setTooltipPos({
      x: btnRect.left + btnRect.width / 2 - gridRect.left,
      y: btnRect.top - gridRect.top - 6,
    });
    setHoveredIcon(name);
  };

  return (
    <div style={{ position: "relative" }}>
      {/* Trigger — chỉ icon */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title="Choose icon"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "8px 10px",
          borderRadius: "8px",
          border: "none",
          backgroundColor: "var(--input-bg)",
          color: "var(--primary-text)",
          cursor: "pointer",
          height: "34px",
        }}
      >
        <CurrentIcon size={16} />
      </button>

      {/* Dropdown */}
      {open && (
        <>
          <div
            onClick={() => setOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 10002 }}
          />
          <div
            style={{
              position: "absolute",
              top: "calc(100% + 4px)",
              left: 0,
              width: "260px",
              zIndex: 10003,
              backgroundColor: "var(--tertiary-bg)",
              border: "1px solid var(--border-color)",
              borderRadius: "8px",
              boxShadow: "0 8px 24px rgba(0,0,0,0.3)",
              display: "flex",
              flexDirection: "column",
            }}
          >
            {/* Search */}
            <div
              style={{
                position: "relative",
                padding: "8px",
                borderBottom: "1px solid var(--border-color)",
                flexShrink: 0,
              }}
            >
              <Search
                size={13}
                style={{
                  position: "absolute",
                  left: "18px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  color: "var(--secondary-text)",
                  pointerEvents: "none",
                }}
              />
              <input
                autoFocus
                type="text"
                placeholder="Search icons..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{
                  width: "100%",
                  padding: "6px 8px 6px 26px",
                  fontSize: "12px",
                  backgroundColor: "var(--input-bg)",
                  border: "none",
                  borderRadius: "6px",
                  color: "var(--primary-text)",
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Grid + fast tooltip */}
            <div style={{ position: "relative" }}>
              <div
                ref={gridRef}
                style={{
                  position: "relative",
                  display: "grid",
                  gridTemplateColumns: "repeat(8, 1fr)",
                  gap: "2px",
                  padding: "8px",
                  maxHeight: "200px",
                  overflowY: "auto",
                }}
              >
                {filtered.map((name) => {
                  const Icon = GROUP_ICONS[name];
                  const selected = name === value;
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => {
                        onChange(name);
                        setOpen(false);
                      }}
                      onMouseEnter={(e) => handleIconEnter(e, name)}
                      onMouseLeave={() => setHoveredIcon(null)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "6px",
                        borderRadius: "6px",
                        border: "none",
                        cursor: "pointer",
                        backgroundColor: selected
                          ? "color-mix(in srgb, var(--vscode-button-background) 25%, transparent)"
                          : "transparent",
                        color: selected
                          ? "var(--vscode-button-background)"
                          : "var(--primary-text)",
                      }}
                    >
                      <Icon size={16} />
                    </button>
                  );
                })}
                {filtered.length === 0 && (
                  <div
                    style={{
                      gridColumn: "1 / -1",
                      textAlign: "center",
                      padding: "12px",
                      fontSize: "11px",
                      color: "var(--secondary-text)",
                    }}
                  >
                    No icons found
                  </div>
                )}
              </div>

              {/* Fast tooltip — hover hiện ngay, không delay như title */}
              {hoveredIcon && (
                <div
                  style={{
                    position: "absolute",
                    left: tooltipPos.x,
                    top: tooltipPos.y,
                    transform: "translate(-50%, -100%)",
                    padding: "3px 8px",
                    borderRadius: "4px",
                    backgroundColor: "var(--vscode-editorHoverWidget-background, #252526)",
                    border: "1px solid var(--vscode-editorHoverWidget-border, var(--border-color))",
                    color: "var(--primary-text)",
                    fontSize: "11px",
                    whiteSpace: "nowrap",
                    pointerEvents: "none",
                    zIndex: 10,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.3)",
                  }}
                >
                  {hoveredIcon}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}