import React from "react";
import { MarkdownBlock } from "../../../../../components/MarkdownBlock/MarkdownBlock";

interface SkillDetailAboutProps {
  content?: string;
}

/** Section "About this skill" — render markdown với label và divider phía trên. */
export function SkillDetailAbout({ content }: SkillDetailAboutProps) {
  if (!content) return null;

  return (
    <div
      style={{
        borderTop: "1px solid var(--border-color)",
        paddingTop: "14px",
      }}
    >
      <div
        style={{
          fontSize: "11px",
          fontWeight: 600,
          color: "var(--secondary-text)",
          textTransform: "uppercase",
          letterSpacing: "0.05em",
          marginBottom: "10px",
        }}
      >
        About this skill
      </div>
      <MarkdownBlock
        content={content}
        style={{ fontSize: "13px", lineHeight: 1.6 }}
      />
    </div>
  );
}