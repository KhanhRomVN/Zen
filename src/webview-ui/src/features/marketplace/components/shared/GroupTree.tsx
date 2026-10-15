import { useState } from "react";
import type { CSSProperties, MouseEvent } from "react";
import {
  ChevronDown,
  ChevronRight,
  FolderOpen,
  Pencil,
  Trash2,
} from "lucide-react";
import { isReservedGroupName } from "../../hooks/useSkillWorkspaceState";
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
} from "../../../../components/ui/Dropdown";
import { getGroupIcon } from "./iconLibrary";

export const GROUP_ACCENT_COLORS = [
  "#3b82f6",
  "#8b5cf6",
  "#ec4899",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#06b6d4",
  "#6366f1",
];

const OTHERS_COLOR = "#9ca3af";

export interface DrawerSkill {
  slug: string;
  name: string;
  author?: string;
  /** Phần đầu nội dung skill — hiển thị trong tooltip khi hover. */
  preview: string;
}

export interface DrawerGroup {
  name: string;
  /** Skill đã cài thuộc group — dùng để expand + preview. */
  skills: DrawerSkill[];
  /** Tên icon lucide; fallback về icon mặc định nếu chưa có. */
  icon?: string;
  /** Màu accent (hex); fallback theo hash tên group. */
  color?: string;
  description?: string;
}

/** Skill đang hover + vị trí con trỏ — drawer dùng để vẽ tooltip bám chuột. */
export interface SkillPreviewState {
  skill: DrawerSkill;
  x: number;
  y: number;
}

function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

export function resolveGroupColor(
  group: Pick<DrawerGroup, "name" | "color">,
): string {
  if (group.color) return group.color;
  if (isReservedGroupName(group.name)) return OTHERS_COLOR;
  return GROUP_ACCENT_COLORS[
    hashString(group.name) % GROUP_ACCENT_COLORS.length
  ];
}

const ellipsis: CSSProperties = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const actionBtnStyle: CSSProperties = {
  width: "22px",
  height: "22px",
  padding: 0,
  border: "none",
  borderRadius: "6px",
  background: "transparent",
  color: "var(--secondary-text)",
  cursor: "pointer",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  flexShrink: 0,
};

interface GroupTreeProps {
  groups: DrawerGroup[];
  /** true khi đang chọn group để cài skill (có radio chọn group). */
  selectable: boolean;
  selected: string;
  onSelect: (name: string) => void;
  onEdit: (group: DrawerGroup) => void;
  onDelete: (name: string) => void;
  onMoveSkill: (slug: string, groupName: string) => void;
  onDeleteSkill: (skill: DrawerSkill) => void;
  /** Mở skill trong OS file manager. */
  onOpenSkillFolder: (skill: DrawerSkill) => void;
  /** Click skill (khi đang view, không chọn group) → chuyển sang SkillDetail. */
  onOpenSkill: (skill: DrawerSkill) => void;
  /** Báo skill đang hover (null = ẩn tooltip). */
  onPreviewChange: (preview: SkillPreviewState | null) => void;
}

/**
 * Cây group → skill đã cài. Chevron chỉ expand/collapse; click hàng chỉ chọn group
 * (khi selectable). Hover hàng group/skill thay badge/author bằng icon thao tác;
 * chuột phải mở dropdown; kéo skill thả lên group để chuyển.
 */
export function GroupTree({
  groups,
  selectable,
  selected,
  onSelect,
  onEdit,
  onDelete,
  onMoveSkill,
  onDeleteSkill,
  onOpenSkillFolder,
  onOpenSkill,
  onPreviewChange,
}: GroupTreeProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [dragging, setDragging] = useState<{
    slug: string;
    from: string;
  } | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const hidePreview = () => onPreviewChange(null);

  const trackPreview = (skill: DrawerSkill, e: MouseEvent) =>
    onPreviewChange({ skill, x: e.clientX, y: e.clientY });

  const toggleExpand = (name: string) => {
    hidePreview();
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  if (groups.length === 0) {
    return (
      <div
        style={{
          padding: "24px 0",
          textAlign: "center",
          fontSize: "12px",
          color: "var(--secondary-text)",
          opacity: 0.7,
        }}
      >
        No groups found
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
      {groups.map((group) => {
        const isOther = isReservedGroupName(group.name);
        const isSelected = selectable && selected === group.name;
        const isExpanded = expanded.has(group.name);
        const color = resolveGroupColor(group);
        const GroupIcon = getGroupIcon(group.icon);
        const count = group.skills.length;
        const description =
          group.description ??
          (isOther ? "Skills not assigned to any group" : undefined);
        const accentBar = isSelected ? color : "transparent";
        const isDropTarget = !!dragging && dropTarget === group.name;

        const countBadge = (
          <span
            style={{
              fontSize: "11px",
              fontWeight: 600,
              padding: "2px 8px",
              borderRadius: "6px",
              backgroundColor: `color-mix(in srgb, ${color} 16%, transparent)`,
              color,
              flexShrink: 0,
            }}
          >
            {count} {count === 1 ? "skill" : "skills"}
          </span>
        );

        return (
          <Dropdown
            key={group.name}
            trigger="contextmenu"
            align="start"
            side="bottom"
          >
            <DropdownTrigger asChild>
              <div
                onDragOver={(e) => {
                  if (!dragging || dragging.from === group.name) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  if (dropTarget !== group.name) setDropTarget(group.name);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                    setDropTarget(null);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragging && dragging.from !== group.name) {
                    onMoveSkill(dragging.slug, group.name);
                  }
                  setDragging(null);
                  setDropTarget(null);
                }}
                style={{
                  borderRadius: "2px 10px 10px 2px",
                  backgroundColor: isDropTarget
                    ? `color-mix(in srgb, ${color} 14%, transparent)`
                    : "transparent",
                  outline: isDropTarget ? `1px dashed ${color}` : "none",
                  transition: "background-color 0.13s ease",
                }}
              >
                <div
                  className="sk-group-row"
                  onClick={() =>
                    selectable ? onSelect(group.name) : toggleExpand(group.name)
                  }
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    padding: "8px 10px",
                    borderRadius: "2px 10px 10px 2px",
                    borderLeft: `3px solid ${accentBar}`,
                    transition: "border-color 0.13s ease",
                    cursor: "pointer",
                  }}
                >
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    aria-label={isExpanded ? "Collapse group" : "Expand group"}
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleExpand(group.name);
                    }}
                    style={{
                      width: "18px",
                      height: "18px",
                      padding: 0,
                      border: "none",
                      borderRadius: "4px",
                      background: "transparent",
                      color: "var(--secondary-text)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {isExpanded ? (
                      <ChevronDown size={14} />
                    ) : (
                      <ChevronRight size={14} />
                    )}
                  </button>

                  <div
                    style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "9px",
                      backgroundColor: `color-mix(in srgb, ${color} 16%, transparent)`,
                      color,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <GroupIcon size={16} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: "13px",
                        fontWeight: 600,
                        color: "var(--primary-text)",
                        ...ellipsis,
                      }}
                    >
                      {group.name}
                    </div>
                    {description && (
                      <div
                        style={{
                          fontSize: "11px",
                          color: "var(--secondary-text)",
                          opacity: 0.75,
                          marginTop: "1px",
                          ...ellipsis,
                        }}
                      >
                        {description}
                      </div>
                    )}
                  </div>

                  {isOther ? (
                    countBadge
                  ) : (
                    <>
                      <span className="sk-swap-idle">{countBadge}</span>
                      <span className="sk-swap-actions">
                        <button
                          type="button"
                          className="sk-action"
                          title="Edit group"
                          aria-label="Edit group"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEdit(group);
                          }}
                          style={actionBtnStyle}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          className="sk-action sk-action-danger"
                          title="Delete group"
                          aria-label="Delete group"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(group.name);
                          }}
                          style={actionBtnStyle}
                        >
                          <Trash2 size={13} />
                        </button>
                      </span>
                    </>
                  )}
                </div>

                {isExpanded && (
                  <div
                    style={{
                      margin: "0 10px 8px 55px",
                      paddingLeft: "10px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "1px",
                    }}
                  >
                    {count === 0 ? (
                      <div
                        style={{
                          fontSize: "11px",
                          fontStyle: "italic",
                          color: "var(--secondary-text)",
                          opacity: 0.6,
                          padding: "4px 8px",
                        }}
                      >
                        No installed skills in this group
                      </div>
                    ) : (
                      group.skills.map((skill, index) => (
                        <div
                          key={skill.slug}
                          onContextMenu={(e) => {
                            e.stopPropagation();
                            hidePreview();
                          }}
                        >
                          <Dropdown
                            trigger="contextmenu"
                            align="start"
                            side="bottom"
                          >
                            <DropdownTrigger asChild>
                              <div
                                className="sk-skill-row"
                                draggable
                                onDragStart={(e) => {
                                  hidePreview();
                                  e.dataTransfer.effectAllowed = "move";
                                  e.dataTransfer.setData("text/plain", skill.slug);
                                  setDragging({
                                    slug: skill.slug,
                                    from: group.name,
                                  });
                                }}
                                onDragEnd={() => {
                                  setDragging(null);
                                  setDropTarget(null);
                                }}
                                onMouseEnter={(e) => trackPreview(skill, e)}
                                onMouseMove={(e) => trackPreview(skill, e)}
                                onMouseLeave={hidePreview}
                                onClick={() => {
                                  if (selectable) return;
                                  hidePreview();
                                  onOpenSkill(skill);
                                }}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "8px",
                                  padding: "5px 8px",
                                  borderRadius: "6px",
                                  cursor: "grab",
                                  minWidth: 0,
                                }}
                              >
                                <span
                                  style={{
                                    minWidth: "16px",
                                    fontSize: "11px",
                                    fontVariantNumeric: "tabular-nums",
                                    color,
                                    flexShrink: 0,
                                  }}
                                >
                                  {index + 1}.
                                </span>
                                <span
                                  style={{
                                    flex: 1,
                                    minWidth: 0,
                                    fontSize: "12px",
                                    color: "var(--primary-text)",
                                    ...ellipsis,
                                  }}
                                >
                                  {skill.name}
                                </span>
                                {skill.author && (
                                  <span
                                    className="sk-swap-idle"
                                    style={{
                                      fontSize: "11px",
                                      color: "var(--secondary-text)",
                                      opacity: 0.65,
                                      flexShrink: 0,
                                      maxWidth: "40%",
                                      ...ellipsis,
                                    }}
                                  >
                                    {skill.author}
                                  </span>
                                )}
                                <span className="sk-swap-actions">
                                  <button
                                    type="button"
                                    className="sk-action"
                                    title="Open skill folder"
                                    aria-label="Open skill folder"
                                    draggable={false}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      hidePreview();
                                      onOpenSkillFolder(skill);
                                    }}
                                    style={actionBtnStyle}
                                  >
                                    <FolderOpen size={12} />
                                  </button>
                                  <button
                                    type="button"
                                    className="sk-action sk-action-danger"
                                    title="Delete skill"
                                    aria-label="Delete skill"
                                    draggable={false}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      hidePreview();
                                      onDeleteSkill(skill);
                                    }}
                                    style={actionBtnStyle}
                                  >
                                    <Trash2 size={12} />
                                  </button>
                                </span>
                              </div>
                            </DropdownTrigger>
                            <DropdownContent>
                              <DropdownItem
                                icon={<Trash2 size={14} />}
                                variant="error"
                                onClick={() => onDeleteSkill(skill)}
                              >
                                Delete skill
                              </DropdownItem>
                            </DropdownContent>
                          </Dropdown>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            </DropdownTrigger>

            {!isOther && (
              <DropdownContent>
                <DropdownItem
                  icon={<Pencil size={14} />}
                  onClick={() => onEdit(group)}
                >
                  Edit group
                </DropdownItem>
                <DropdownItem
                  icon={<Trash2 size={14} />}
                  variant="error"
                  onClick={() => onDelete(group.name)}
                >
                  Delete group
                </DropdownItem>
              </DropdownContent>
            )}
          </Dropdown>
        );
      })}

      <style>{`
        .sk-group-row:hover { background-color: var(--hover-bg); }
        .sk-skill-row:hover { background-color: var(--hover-bg); }
        .sk-skill-row:active { cursor: grabbing; }
        .sk-swap-actions { display: none; align-items: center; gap: 2px; flex-shrink: 0; }
        .sk-group-row:hover .sk-swap-idle, .sk-skill-row:hover .sk-swap-idle { display: none; }
        .sk-group-row:hover .sk-swap-actions, .sk-skill-row:hover .sk-swap-actions { display: flex; }
        .sk-action:hover { background-color: color-mix(in srgb, var(--primary-text) 12%, transparent) !important; color: var(--primary-text) !important; }
        .sk-action-danger:hover { background-color: rgba(244,67,54,0.15) !important; color: #f44336 !important; }
      `}</style>
    </div>
  );
}