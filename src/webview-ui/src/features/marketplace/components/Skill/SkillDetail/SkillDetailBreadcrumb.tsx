import React from "react";
import { ChevronRight } from "lucide-react";

interface SkillDetailBreadcrumbProps {
  name: string;
  onBack: () => void;
}

/** Breadcrumb bar — "Browse > <tên skill>" với nút quay lại. */
export function SkillDetailBreadcrumb({
  name,
  onBack,
}: SkillDetailBreadcrumbProps) {
  return (
    <div
      style={{
        padding: "12px 20px",
        borderBottom: "1px solid var(--border-color)",
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        gap: "4px",
        fontSize: "12px",
        color: "var(--secondary-text)",
      }}
    >
      <button
        type="button"
        onClick={onBack}
        style={{
          background: "transparent",
          border: "none",
          padding: 0,
          color: "var(--vscode-textLink-foreground, #3794ff)",
          cursor: "pointer",
          fontSize: "12px",
        }}
      >
        Browse
      </button>
      <ChevronRight size={12} style={{ opacity: 0.6 }} />
      <span
        style={{
          color: "var(--primary-text)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {name}
      </span>
    </div>
  );
}