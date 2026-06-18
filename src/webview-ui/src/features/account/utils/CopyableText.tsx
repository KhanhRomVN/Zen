import React, { useState } from "react";
import { useTruncatedText } from "./truncateText";

interface CopyableTextProps {
  value: string;
  monospace?: boolean;
}

export const CopyableText: React.FC<CopyableTextProps> = ({ value, monospace }) => {
  const [copied, setCopied] = useState(false);
  const [hovered, setHovered] = useState(false);
  const fontSize = "11px";
  const fontFamily = monospace ? "monospace" : "sans-serif";
  const { containerRef, displayText } = useTruncatedText(value || "", `${fontSize} ${fontFamily}`);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!value) return;
    navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div
      ref={containerRef}
      onClick={handleClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={copied ? "Copied!" : value ? `Click to copy: ${value}` : "N/A"}
      style={{
        fontSize,
        fontFamily,
        color: copied
          ? "var(--vscode-testing-iconPassed, #22c55e)"
          : hovered
            ? "var(--vscode-textLink-foreground)"
            : "var(--primary-text)",
        cursor: value ? "pointer" : "default",
        transition: "color 0.15s ease",
        overflow: "hidden",
        whiteSpace: "nowrap",
        width: "100%",
      }}
    >
      {copied ? "✓ copied" : displayText || "N/A"}
    </div>
  );
};