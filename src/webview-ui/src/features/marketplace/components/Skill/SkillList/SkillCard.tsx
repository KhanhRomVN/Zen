import React from "react";
import {
  Eye,
  Download,
  Plus,
  Info,
  Trash2,
  ExternalLink,
} from "lucide-react";
import type { SkillSummary } from "../../../types/skill.types";
import { formatNumber } from "../../../utils/formatNumber";
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
} from "../../../../../components/ui/Dropdown";

interface SkillCardProps {
  skill: SkillSummary;
  installed: boolean;
  onClick: (skill: SkillSummary) => void;
  /** Mở drawer chọn group trước khi install (không install trực tiếp). */
  onInstallClick: (skill: SkillSummary) => void;
  /** Uninstall trực tiếp (không qua drawer). */
  onUninstall: (skill: SkillSummary) => void;
}

/**
 * Thẻ hiển thị tóm tắt 1 skill: name, author, description (2 dòng),
 * views và installs. Button ở góc phải trên có 3 state:
 * - "Install"    : chưa cài, soft-style (bg button 18% + text primary)
 * - "Installed"  : đã cài, solid (bg button + text trắng)
 * - "Uninstall"  : hover vào "Installed", soft-style error
 */
export function SkillCard({
  skill,
  installed,
  onClick,
  onInstallClick,
  onUninstall,
}: SkillCardProps) {
  const [hovered, setHovered] = React.useState(false);
  const [btnHovered, setBtnHovered] = React.useState(false);

  const handlePrimaryClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (installed) {
      onUninstall(skill);
    } else {
      onInstallClick(skill);
    }
  };

  const handleOpenHomepage = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (skill.sourceUrl) {
      window.open(skill.sourceUrl, "_blank", "noopener,noreferrer");
    }
  };

  const buttonStyle: React.CSSProperties = !installed
    ? {
        backgroundColor:
          "color-mix(in srgb, var(--vscode-button-background) 18%, transparent)",
        color: "var(--primary-text)",
      }
    : btnHovered
      ? {
          backgroundColor:
            "color-mix(in srgb, var(--vscode-errorForeground, #ef4444) 18%, transparent)",
          color: "var(--vscode-errorForeground, #ef4444)",
        }
      : {
          backgroundColor: "var(--vscode-button-background)",
          color: "#fff",
        };

  const buttonLabel = installed
    ? btnHovered
      ? "Uninstall"
      : "Installed"
    : "Install";

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
            backgroundColor: hovered ? "var(--hover-bg)" : "var(--input-bg)",
            cursor: "pointer",
            transition: "background-color 0.15s ease",
            position: "relative",
            height: "100%",
          }}
        >
          {/* Install / Installed / Uninstall — góc phải trên */}
          <button
            type="button"
            onClick={handlePrimaryClick}
            onMouseEnter={() => setBtnHovered(true)}
            onMouseLeave={() => setBtnHovered(false)}
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
              transition: "all 0.15s ease",
              zIndex: 1,
              ...buttonStyle,
            }}
          >
            {buttonLabel}
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

          {/* Author */}
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
        {installed ? (
          <DropdownItem
            icon={<Trash2 size={14} />}
            variant="error"
            onClick={() => onUninstall(skill)}
          >
            Uninstall skill
          </DropdownItem>
        ) : (
          <DropdownItem
            icon={<Plus size={14} />}
            onClick={() => onInstallClick(skill)}
          >
            Install skill
          </DropdownItem>
        )}
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