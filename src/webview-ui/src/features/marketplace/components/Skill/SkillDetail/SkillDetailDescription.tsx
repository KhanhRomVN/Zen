import React from "react";

interface SkillDetailDescriptionProps {
  description?: string;
}

/** Section mô tả ngắn — paragraph với fontSize lớn hơn phần markdown. */
export function SkillDetailDescription({
  description,
}: SkillDetailDescriptionProps) {
  if (!description) return null;

  return (
    <p
      style={{
        fontSize: "14px",
        color: "var(--primary-text)",
        margin: "0 0 18px",
        lineHeight: 1.6,
      }}
    >
      {description}
    </p>
  );
}