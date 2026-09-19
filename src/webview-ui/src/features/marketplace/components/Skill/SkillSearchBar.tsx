import React from "react";
import { Search } from "lucide-react";

interface SkillSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  /** Nội dung bên phải searchbar — thường là button toggle view. */
  rightSlot?: React.ReactNode;
}

/**
 * Thanh tìm kiếm skill — style đồng bộ với searchbar trong account panel
 * (background var(--input-bg), height 34px, border-radius 8px, icon trái).
 */
export function SkillSearchBar({
  value,
  onChange,
  onClear,
  rightSlot,
}: SkillSearchBarProps) {
  return (
    <div style={{ padding: "8px 16px 12px", flexShrink: 0 }}>
      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1 }}>
          <input
            type="text"
            placeholder="Search skills..."
            value={value}
            onChange={(e) => onChange(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 32px 8px 32px",
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
          <Search
            style={{
              width: "14px",
              height: "14px",
              position: "absolute",
              left: "10px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--secondary-text)",
              pointerEvents: "none",
            }}
          />
          {value && (
            <button
              type="button"
              onClick={onClear}
              title="Clear search"
              style={{
                position: "absolute",
                right: "8px",
                top: "50%",
                transform: "translateY(-50%)",
                padding: "2px",
                border: "none",
                backgroundColor: "transparent",
                color: "var(--secondary-text)",
                cursor: "pointer",
                fontSize: "14px",
                display: "flex",
                alignItems: "center",
                lineHeight: 1,
              }}
            >
              ×
            </button>
          )}
        </div>
        {rightSlot}
      </div>
    </div>
  );
}