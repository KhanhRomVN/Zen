import React from "react";
import {
  Eye,
  Download,
  Plus,
  Info,
  Trash2,
  ExternalLink,
} from "lucide-react";
import type { SkillSummary } from "../../types/skill.types";
import { formatNumber } from "../../utils/formatNumber";
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
} from "../../../../components/ui/Dropdown";

interface SkillCardProps {
  skill: SkillSummary;
  installed: boolean;
  onClick: (skill: SkillSummary) => void;
  onToggleInstall: (skill: SkillSummary) => void;
}

/**
 * Thẻ hiển thị tóm tắt 1 skill: name, author, description (2 dòng),
 * views và installs. Có nút Install/Installed ở góc phải trên và
 * context menu chuột phải (View detail, Install/Uninstall, Homepage).
 */
export function SkillCard({
  skill,
  installed,
  onClick,
  onToggleInstall,
}: SkillCardProps) {
  const [hovered, setHovered] = React.useState(false);

  const handleInstallClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleInstall(skill);
  };

  const handleOpenHomepage = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (skill.sourceUrl) {
      window.open(skill.sourceUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <Dropdown trigger="contextmenu" align="end" side="right">
      <DropdownTrigger asChild>
        <div
          onClick={() => onClick(skill)}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            padding: "12px 14px",
            borderRadius: "10px",
            backgroundColor: hovered
              ? "var(--hover-bg)"
              : "var(--input-bg)",
            cursor: "pointer",
            transition: "background-color 0.15s ease",
            position: "relative",
            height: "100%",
          }}
        >
          {/* Install / Installed button — góc phải trên */}
          <button
            type="button"
            onClick={handleInstallClick}
            title={installed ? "Uninstall skill" : "Install skill"}
            style={{
              position: "absolute",
              top: "10px",
              right: "10px",
              display: "inline-flex",
              alignItems: "center",
              padding: "5px 14px",
              borderRadius: "4px",
              border: "none",
              fontSize: "12px",
              fontWeight: 500,
              cursor: "pointer",
              backgroundColor:
                "color-mix(in srgb, var(--vscode-button-background) 18%, transparent)",
              color: "var(--vscode-button-background)",
              transition: "all 0.15s ease",
              zIndex: 1,
            }}
          >
            {installed ? "Installed" : "Install"}
          </button>

          {/* Title */}
          <div
            style={{
              fontSize: "13px",
              fontWeight: 600,
              color: "var(--primary-text)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              paddingRight: "72px",
              marginBottom: "4px",
            }}
          >
            {skill.name}
          </div>

          {/* Author — giữa title và description */}
          {skill.author && (
            <div
              style={{
                fontSize: "11px",
                color: "var(--secondary-text)",
                opacity: 0.75,
                marginBottom: "6px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              by {skill.author}
            </div>
          )}

          {/* Description */}
          <p
            style={{
              fontSize: "12px",
              color: "var(--secondary-text)",
              lineHeight: 1.5,
              margin: "0 0 10px",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical" as any,
              overflow: "hidden",
            }}
          >
            {skill.description || "No description available"}
          </p>

          {/* Stats */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              fontSize: "10px",
              color: "var(--secondary-text)",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <Eye size={12} />
              {formatNumber(skill.views)}
            </span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <Download size={12} />
              {formatNumber(skill.installs)}
            </span>
          </div>
        </div>
      </DropdownTrigger>
      <DropdownContent>
        <DropdownItem
          icon={<Info size={14} />}
          onClick={() => onClick(skill)}
        >
          View skill details
        </DropdownItem>
        <DropdownItem
          icon={installed ? <Trash2 size={14} /> : <Plus size={14} />}
          variant={installed ? "error" : undefined}
          onClick={() => onToggleInstall(skill)}
        >
          {installed ? "Uninstall skill" : "Install skill"}
        </DropdownItem>
        {skill.sourceUrl && (
          <DropdownItem
            icon={<ExternalLink size={14} />}
            onClick={() => handleOpenHomepage()}
          >
            View homepage
          </DropdownItem>
        )}
      </DropdownContent>
    </Dropdown>
  );
}