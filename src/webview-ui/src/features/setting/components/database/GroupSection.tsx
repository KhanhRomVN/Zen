/**
 * ------------------------------------------------------------------
 * GroupSection
 * ------------------------------------------------------------------
 * Nhóm các field trong Settings thành một section có header gồm badge
 * icon (soft-style: nền nhạt + icon màu đậm), title và description.
 * Hỗ trợ slot `action` hiển thị ở góc phải header (VD: nút thêm).
 * ------------------------------------------------------------------
 */

import React from "react";

interface GroupSectionProps {
  /** Icon hiển thị trong badge (thường là lucide-react icon) */
  icon: React.ReactNode;
  /** Màu chủ đạo của badge (hex hoặc CSS color) */
  color: string;
  /** Tiêu đề nhóm */
  title: string;
  /** Mô tả ngắn dưới tiêu đề */
  description?: string;
  /** Slot tuỳ chọn hiển thị ở góc phải header (VD: nút thêm) */
  action?: React.ReactNode;
  /** Nội dung các field bên trong nhóm */
  children: React.ReactNode;
}

/**
 * Chuyển hex color sang rgba với alpha cho trước. Dùng để tạo nền
 * badge soft-style (nền nhạt) từ màu chủ đạo.
 */
const toSoftBg = (hex: string, alpha = 0.15): string => {
  const raw = hex.replace("#", "");
  if (raw.length !== 6) return `rgba(128,128,128,${alpha})`;
  const r = parseInt(raw.slice(0, 2), 16);
  const g = parseInt(raw.slice(2, 4), 16);
  const b = parseInt(raw.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
};

const GroupSection: React.FC<GroupSectionProps> = ({
  icon,
  color,
  title,
  description,
  action,
  children,
}) => {
  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "14px",
      }}
    >
      {/* Header */}
      <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
        <div
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "8px",
            backgroundColor: toSoftBg(color),
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: color,
            flexShrink: 0,
          }}
        >
          {icon}
        </div>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "2px",
            flex: 1,
            minWidth: 0,
          }}
        >
          <span
            style={{
              fontSize: "14px",
              fontWeight: 600,
              color: "var(--primary-text)",
              letterSpacing: "0.01em",
            }}
          >
            {title}
          </span>
          {description && (
            <span
              style={{
                fontSize: "12px",
                color: "var(--secondary-text)",
                opacity: 0.75,
                lineHeight: 1.4,
              }}
            >
              {description}
            </span>
          )}
        </div>
        {action && <div style={{ flexShrink: 0 }}>{action}</div>}
      </div>

      {/* Body */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        {children}
      </div>
    </section>
  );
};

export default GroupSection;