import React from "react";
import { Info, Trash2, FolderOpen, Power, PowerOff, FolderInput } from "lucide-react";
import type { SkillSummary } from "../../../types/skill.types";
import { DEFAULT_GROUP_NAME } from "../../../hooks/useSkillWorkspaceState";
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
} from "../../../../../components/ui/Dropdown";
import { Toggle } from "../../../../../components/ui/Toggle";

interface SkillCardProps {
  skill: SkillSummary;
  enabled: boolean;
  /** Danh sách group hiện có (không gồm "Other"). */
  groups: string[];
  onToggleEnabled: (skill: SkillSummary) => void;
  onOpenDetail: (skill: SkillSummary) => void;
  onDelete: (skill: SkillSummary) => void;
  onOpenFolder: (skill: SkillSummary) => void;
  onMoveToGroup: (skill: SkillSummary, groupName: string) => void;
  onDragStart: (skill: SkillSummary) => void;
}

/**
 * Card skill trong ManagerSkill view — dòng 1 title, dòng 2 author,
 * bên phải là toggle bật/tắt cho workspace hiện tại. Chuột phải mở
 * context menu. Kéo thả để gán vào group.
 */
export function SkillCard({
  skill,
  enabled,
  groups,
  onToggleEnabled,
  onOpenDetail,
  onDelete,
  onOpenFolder,
  onMoveToGroup,
  onDragStart,
}: SkillCardProps) {
  const [hovered, setHovered] = React.useState(false);
  const [moveSubOpen, setMoveSubOpen] = React.useState(false);

  return (
    <Dropdown trigger="contextmenu" align="end" side="right">
      <DropdownTrigger asChild>
        <div
          draggable
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", skill.slug);
            onDragStart(skill);
          }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            padding: "10px 12px",
            borderRadius: "8px",
            backgroundColor: hovered ? "var(--hover-bg)" : "var(--input-bg)",
            cursor: "grab",
            transition: "background-color 0.15s ease",
          }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: "13px",
                fontWeight: 600,
                color: "var(--primary-text)",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {skill.name}
            </div>
            {skill.author && (
              <div
                style={{
                  fontSize: "11px",
                  color: "var(--secondary-text)",
                  opacity: 0.75,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                  marginTop: "2px",
                }}
              >
                by {skill.author}
              </div>
            )}
          </div>

          <div
            onClick={(e) => e.stopPropagation()}
            style={{ flexShrink: 0 }}
          >
            <Toggle
              checked={enabled}
              onChange={() => onToggleEnabled(skill)}
              title={enabled ? "Disable for this workspace" : "Enable for this workspace"}
            />
          </div>
        </div>
      </DropdownTrigger>
      <DropdownContent>
        <DropdownItem
          icon={enabled ? <PowerOff size={14} /> : <Power size={14} />}
          onClick={() => onToggleEnabled(skill)}
        >
          {enabled ? "Turn off" : "Turn on"}
        </DropdownItem>
        <DropdownItem
          icon={<Info size={14} />}
          onClick={() => onOpenDetail(skill)}
        >
          View skill details
        </DropdownItem>
        <DropdownItem
          icon={<FolderOpen size={14} />}
          onClick={() => onOpenFolder(skill)}
        >
          Open in file explorer
        </DropdownItem>
        <DropdownItem
          icon={<FolderInput size={14} />}
          onClick={() => setMoveSubOpen((v) => !v)}
        >
          Move to group...
        </DropdownItem>
        {moveSubOpen && (
          <>
            <DropdownItem
              noPadding
              onClick={() => onMoveToGroup(skill, DEFAULT_GROUP_NAME)}
            >
              <div style={{ padding: "6px 12px 6px 32px", width: "100%" }}>
                {DEFAULT_GROUP_NAME}
              </div>
            </DropdownItem>
            {groups.map((g) => (
              <DropdownItem
                key={g}
                noPadding
                onClick={() => onMoveToGroup(skill, g)}
              >
                <div style={{ padding: "6px 12px 6px 32px", width: "100%" }}>
                  {g}
                </div>
              </DropdownItem>
            ))}
          </>
        )}
        <DropdownItem
          icon={<Trash2 size={14} />}
          variant="error"
          onClick={() => onDelete(skill)}
        >
          Delete skill (all workspaces)
        </DropdownItem>
      </DropdownContent>
    </Dropdown>
  );
}