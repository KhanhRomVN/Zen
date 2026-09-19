import React from "react";
import {
  ChevronRight,
  Eye,
  Download,
  ExternalLink,
  Plus,
  Trash2,
} from "lucide-react";
import type { SkillDetail as SkillDetailData } from "../../types/skill.types";
import { formatNumber } from "../../utils/formatNumber";
import { MarkdownBlock } from "../../../../components/MarkdownBlock/MarkdownBlock";

interface SkillDetailProps {
  skill: SkillDetailData;
  installed: boolean;
  onBack: () => void;
  onToggleInstall: (skill: SkillDetailData) => void;
}

/**
 * View chi tiết skill — breadcrumb (Browse > title), title, author kèm
 * 2 badge lượt cài / lượt xem, description, và markdown content.
 * Góc phải trên có 2 button icon: install/uninstall và mở homepage.
 */
export function SkillDetail({
  skill,
  installed,
  onBack,
  onToggleInstall,
}: SkillDetailProps) {
  const sectionLabelStyle: React.CSSProperties = {
    fontSize: "11px",
    fontWeight: 600,
    color: "var(--secondary-text)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: "6px",
  };

  const handleOpenHomepage = () => {
    if (skill.sourceUrl) {
      window.open(skill.sourceUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <div
      style={{ height: "100%", display: "flex", flexDirection: "column" }}
    >
      {/* Breadcrumb bar */}
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
          {skill.name}
        </span>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
        {/* Hero section */}
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

          {/* Author + 2 badge */}
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

        {/* Description — bỏ label, tăng fontSize */}
        {skill.description && (
          <p
            style={{
              fontSize: "14px",
              color: "var(--primary-text)",
              margin: "0 0 18px",
              lineHeight: 1.6,
            }}
          >
            {skill.description}
          </p>
        )}

        {/* About this skill — markdown */}
        {skill.content && (
          <div
            style={{
              borderTop: "1px solid var(--border-color)",
              paddingTop: "14px",
            }}
          >
            <div style={{ ...sectionLabelStyle, marginBottom: "10px" }}>
              About this skill
            </div>
            <MarkdownBlock
              content={skill.content}
              style={{ fontSize: "13px", lineHeight: 1.6 }}
            />
          </div>
        )}
      </div>
    </div>
  );
}