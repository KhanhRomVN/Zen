import React from "react";
import { Download, ExternalLink, Eye, Plus, Trash2 } from "lucide-react";
import type { SkillDetail as SkillDetailData } from "../../../types/skill.types";
import { formatNumber } from "../../../utils/formatNumber";

interface SkillDetailHeroProps {
  skill: SkillDetailData;
  installed: boolean;
  onToggleInstall: (skill: SkillDetailData) => void;
}

/** Hero section — title, 2 button action (install/homepage), author + badges. */
export function SkillDetailHero({
  skill,
  installed,
  onToggleInstall,
}: SkillDetailHeroProps) {
  const handleOpenHomepage = () => {
    if (skill.sourceUrl) {
      window.open(skill.sourceUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div style={{ position: "relative", marginBottom: "16px" }}>
      <div
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          display: "flex",
          gap: "6px",
        }}
      >
        {skill.slug && (
          <button
            type="button"
            onClick={() => onToggleInstall(skill)}
            title={installed ? "Uninstall skill" : "Install skill"}
            style={{
              width: "30px",
              height: "30px",
              borderRadius: "8px",
              border: "none",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              backgroundColor: installed
                ? "color-mix(in srgb, var(--vscode-errorForeground, #ef4444) 15%, transparent)"
                : "color-mix(in srgb, var(--vscode-button-background) 18%, transparent)",
              color: installed
                ? "var(--vscode-errorForeground, #ef4444)"
                : "var(--vscode-button-background)",
              transition: "all 0.15s ease",
            }}
          >
            {installed ? <Trash2 size={14} /> : <Plus size={14} />}
          </button>
        )}

        {skill.sourceUrl && (
          <button
            type="button"
            onClick={handleOpenHomepage}
            title="Open homepage"
            style={{
              width: "30px",
              height: "30px",
              borderRadius: "8px",
              border: "none",
              backgroundColor: "var(--input-bg)",
              color: "var(--secondary-text)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <ExternalLink size={14} />
          </button>
        )}
      </div>

      <h3
        style={{
          fontSize: "18px",
          fontWeight: 700,
          color: "var(--primary-text)",
          margin: "0 0 6px",
          lineHeight: 1.3,
          paddingRight: "76px",
        }}
      >
        {skill.name}
      </h3>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "10px",
          flexWrap: "wrap",
          fontSize: "12px",
        }}
      >
        {skill.author && (
          <span style={{ color: "var(--secondary-text)", opacity: 0.8 }}>
            by {skill.author}
          </span>
        )}
        {skill.installs !== undefined && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              color: "var(--secondary-text)",
            }}
          >
            <Download
              size={12}
              style={{ color: "var(--vscode-charts-green, #22c55e)" }}
            />
            {formatNumber(skill.installs)} installs
          </span>
        )}
        {skill.views !== undefined && (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              color: "var(--secondary-text)",
            }}
          >
            <Eye
              size={12}
              style={{ color: "var(--vscode-charts-blue, #3b82f6)" }}
            />
            {formatNumber(skill.views)} views
          </span>
        )}
      </div>
    </div>
  );
}