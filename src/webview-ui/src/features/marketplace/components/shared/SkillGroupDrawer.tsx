import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import {
  X,
  Plus,
  Check,
  Pencil,
  Trash2,
  FolderPlus,
  Search,
  ChevronRight,
  ChevronDown,
} from "lucide-react";
import type { SkillSummary } from "../../types/skill.types";
import { isReservedGroupName } from "../../hooks/useSkillWorkspaceState";
import {
  Dropdown,
  DropdownTrigger,
  DropdownContent,
  DropdownItem,
} from "../../../../components/ui/Dropdown";
import { IconPicker } from "./IconPicker";
import { getGroupIcon, DEFAULT_GROUP_ICON } from "./iconLibrary";

/** Palette màu accent soft-style cho badge icon của groupCard. */
const GROUP_ACCENT_COLORS = [
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

/** Hash chuỗi thành số nguyên dương — dùng để chọn màu ổn định. */
function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/**
 * Chọn index màu accent cho group, đảm bảo không trùng với group liền trước.
 * Deterministic theo tên group nên màu không đổi mỗi lần render.
 */
function pickAccentIndex(name: string, prevIdx: number | null): number {
  const base = hashString(name) % GROUP_ACCENT_COLORS.length;
  if (prevIdx === null || base !== prevIdx) return base;
  return (base + 1) % GROUP_ACCENT_COLORS.length;
}

export interface DrawerGroup {
  name: string;
  /** Số skill hiện có trong group. */
  count: number;
  /** Tên các skill trong group — dùng để expand hiển thị. */
  skillNames: string[];
  /** Tên icon lucide; fallback về DEFAULT_GROUP_ICON nếu chưa có. */
  icon?: string;
}

interface SkillGroupDrawerProps {
  isOpen: boolean;
  /** Skill cần cài — null nghĩa là chỉ mở để quản lý group. */
  skill: SkillSummary | null;
  /** Danh sách group (đã bao gồm "Others" ở đầu). */
  groups: DrawerGroup[];
  onClose: () => void;
  /** Xác nhận cài skill vào group được chọn (chỉ gọi khi skill != null). */
  onConfirmInstall: (groupName: string) => void;
  onCreateGroup: (name: string, icon?: string) => void;
  onRenameGroup: (oldName: string, newName: string) => void;
  /** Xóa group — skill trong group sẽ chuyển về "Others". */
  onDeleteGroup: (name: string) => void;
}

/**
 * Drawer chọn group để cài skill + quản lý group (tạo mới / đổi tên / đổi icon).
 * Render qua portal, slide từ dưới lên, cao cố định 50%.
 * Khi `skill` = null thì chỉ hiển thị phần quản lý group (không có nút Install).
 */
export function SkillGroupDrawer({
  isOpen,
  skill,
  groups,
  onClose,
  onConfirmInstall,
  onCreateGroup,
  onRenameGroup,
  onDeleteGroup,
}: SkillGroupDrawerProps) {
  const [selected, setSelected] = useState("Others");
  const [showForm, setShowForm] = useState(false);
  const [newName, setNewName] = useState("");
  const [newIcon, setNewIcon] = useState<string>(DEFAULT_GROUP_ICON);
  const [newNameError, setNewNameError] = useState<string | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (isOpen) {
      setSelected(groups[0]?.name ?? "Others");
      setShowForm(false);
      setNewName("");
      setNewIcon(DEFAULT_GROUP_ICON);
      setNewNameError(null);
      setEditing(null);
      setSearchQuery("");
      setExpandedGroups(new Set());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose]);

  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter((g) => g.name.toLowerCase().includes(q));
  }, [groups, searchQuery]);

  // Accent color cho badge icon — ổn định theo tên, không trùng 2 group liền kề.
  const accentByName = useMemo(() => {
    const map = new Map<string, string>();
    let prevIdx: number | null = null;
    for (const g of filteredGroups) {
      const idx = pickAccentIndex(g.name, prevIdx);
      map.set(g.name, GROUP_ACCENT_COLORS[idx]);
      prevIdx = idx;
    }
    return map;
  }, [filteredGroups]);

  if (!isOpen) return null;

  const handleCreate = () => {
    const trimmed = newName.trim();
    if (!trimmed) {
      setNewNameError("Group name cannot be empty");
      return;
    }
    if (isReservedGroupName(trimmed)) {
      setNewNameError(`"${groups[0]?.name}" is reserved`);
      return;
    }
    if (groups.some((g) => g.name.toLowerCase() === trimmed.toLowerCase())) {
      setNewNameError("Group already exists");
      return;
    }
    onCreateGroup(trimmed, newIcon);
    setNewName("");
    setNewIcon(DEFAULT_GROUP_ICON);
    setNewNameError(null);
    setShowForm(false);
  };

  const commitRename = (oldName: string) => {
    const trimmed = draft.trim();
    if (!trimmed || isReservedGroupName(trimmed)) {
      setEditing(null);
      return;
    }
    onRenameGroup(oldName, trimmed);
    setEditing(null);
  };

  const toggleExpand = (name: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(name)) next.delete(name);
      else next.add(name);
      return next;
    });
  };

  const content = (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(0,0,0,0.55)",
          zIndex: 10000,
          animation: "skDrawerFadeIn 0.15s ease",
        }}
      />
      {/* Sheet */}
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          height: "50%",
          backgroundColor: "var(--tertiary-bg)",
          borderTop: "1px solid var(--border-color)",
          boxShadow: "0 -8px 32px rgba(0,0,0,0.25)",
          zIndex: 10001,
          display: "flex",
          flexDirection: "column",
          animation: "skDrawerSlideUp 0.22s ease",
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: "12px 16px",
            borderBottom: "1px solid var(--border-color)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          <div>
            <div
              style={{
                fontSize: "16px",
                fontWeight: 700,
                color: "var(--primary-text)",
              }}
            >
              {skill ? "Install Skill" : "Manage Groups"}
            </div>
            <div
              style={{
                fontSize: "12px",
                color: "var(--secondary-text)",
                opacity: 0.7,
                marginTop: "3px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                maxWidth: "240px",
              }}
            >
              {skill ? skill.name : "Create and organize skill groups"}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              padding: "6px",
              borderRadius: "4px",
              border: "none",
              background: "transparent",
              color: "var(--secondary-text)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = "rgba(244,67,54,0.15)";
              e.currentTarget.style.color = "#f44336";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
              e.currentTarget.style.color = "var(--secondary-text)";
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Searchbar + FolderPlus button */}
        <div
          style={{
            padding: "10px 16px",
            display: "flex",
            gap: "8px",
            alignItems: "center",
            flexShrink: 0,
          }}
        >
          <div style={{ position: "relative", flex: 1 }}>
            <Search
              size={14}
              style={{
                position: "absolute",
                left: "10px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--secondary-text)",
                pointerEvents: "none",
              }}
            />
            <input
              type="text"
              placeholder="Search groups..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px 8px 32px",
                fontSize: "13px",
                backgroundColor: "var(--input-bg)",
                border: "none",
                borderRadius: "8px",
                color: "var(--primary-text)",
                outline: "none",
                boxSizing: "border-box",
                height: "34px",
              }}
            />
          </div>
          <button
            type="button"
            onClick={() => setShowForm(true)}
            title="New group"
            style={{
              width: "34px",
              height: "34px",
              borderRadius: "8px",
              backgroundColor: "var(--input-bg)",
              border: "none",
              color: "var(--secondary-text)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <FolderPlus size={16} />
          </button>
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 10px" }}>
          {/* New group form — hiện trên cùng danh sách */}
          {showForm && (
            <div style={{ marginBottom: "10px" }}>
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  color: "var(--secondary-text)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  marginBottom: "6px",
                }}
              >
                New Group
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  padding: "12px",
                  borderRadius: "10px",
                  // CSS border dashed không control được độ dài nét — dùng
                  // repeating-linear-gradient cho 4 cạnh để có dash dài, thưa.
                  backgroundImage: `
                    repeating-linear-gradient(90deg, var(--border-color) 0 8px, transparent 8px 14px),
                    repeating-linear-gradient(90deg, var(--border-color) 0 8px, transparent 8px 14px),
                    repeating-linear-gradient(0deg, var(--border-color) 0 8px, transparent 8px 14px),
                    repeating-linear-gradient(0deg, var(--border-color) 0 8px, transparent 8px 14px)
                  `,
                  backgroundSize: "100% 1px, 100% 1px, 1px 100%, 1px 100%",
                  backgroundPosition: "0 0, 0 100%, 0 0, 100% 0",
                  backgroundRepeat: "no-repeat",
                }}
              >
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <IconPicker value={newIcon} onChange={setNewIcon} />
                <input
                  autoFocus
                  type="text"
                  placeholder="Group name..."
                  value={newName}
                  onChange={(e) => {
                    setNewName(e.target.value);
                    setNewNameError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleCreate();
                    else if (e.key === "Escape") {
                      setShowForm(false);
                      setNewName("");
                      setNewIcon(DEFAULT_GROUP_ICON);
                      setNewNameError(null);
                    }
                  }}
                  style={{
                    flex: 1,
                    fontSize: "13px",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: "none",
                    backgroundColor: "var(--input-bg)",
                    color: "var(--primary-text)",
                    outline: "none",
                  }}
                />
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    setNewName("");
                    setNewIcon(DEFAULT_GROUP_ICON);
                    setNewNameError(null);
                  }}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "6px",
                    border: "none",
                    backgroundColor: "transparent",
                    color: "var(--secondary-text)",
                    fontSize: "12px",
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCreate}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "6px 12px",
                    borderRadius: "6px",
                    border: "none",
                    backgroundColor:
                      "color-mix(in srgb, var(--vscode-button-background) 18%, transparent)",
                      color: "var(--vscode-button-background)",
                      fontSize: "12px",
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    <Plus size={13} />
                    Create
                  </button>
              </div>
              {newNameError && (
                <div
                  style={{
                    fontSize: "11px",
                    color: "var(--vscode-errorForeground, #f87171)",
                  }}
                >
                  {newNameError}
                </div>
              )}
              </div>
            </div>
          )}

          {/* Group list */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            {filteredGroups.map((group) => {
              const isOther = isReservedGroupName(group.name);
              const isSelected = !!skill && selected === group.name;
              const isEditing = editing === group.name;
              const isExpanded = expandedGroups.has(group.name);
              const GroupIcon = getGroupIcon(group.icon);

              const accentColor =
                accentByName.get(group.name) ?? GROUP_ACCENT_COLORS[0];

              return (
                <Dropdown
                  key={group.name}
                  trigger="contextmenu"
                  align="start"
                  side="bottom"
                >
                  <DropdownTrigger asChild>
                    <div
                      style={{
                        borderRadius: "10px",
                        backgroundColor: isSelected
                          ? "color-mix(in srgb, var(--vscode-button-background) 12%, transparent)"
                          : "var(--input-bg)",
                        border: isSelected
                          ? "1px solid color-mix(in srgb, var(--vscode-button-background) 45%, transparent)"
                          : "1px solid transparent",
                        transition: "all 0.13s ease",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        onClick={() => {
                          if (isEditing) return;
                          if (skill) {
                            setSelected(group.name);
                          }
                          toggleExpand(group.name);
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "10px",
                          padding: "10px 12px",
                          cursor: isEditing ? "default" : "pointer",
                        }}
                      >
                        {/* Radio */}
                        {skill && !isEditing && (
                          <span
                            style={{
                              width: "14px",
                              height: "14px",
                              borderRadius: "50%",
                              border: `2px solid ${
                                isSelected
                                  ? "var(--vscode-button-background)"
                                  : "var(--border-color)"
                              }`,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                            }}
                          >
                            {isSelected && (
                              <span
                                style={{
                                  width: "6px",
                                  height: "6px",
                                  borderRadius: "50%",
                                  backgroundColor:
                                    "var(--vscode-button-background)",
                                }}
                              />
                            )}
                          </span>
                        )}

                        {/* Icon badge — accent soft-style */}
                        {!isEditing && (
                          <div
                            style={{
                              width: "26px",
                              height: "26px",
                              borderRadius: "7px",
                              backgroundColor: `color-mix(in srgb, ${accentColor} 18%, transparent)`,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              flexShrink: 0,
                              color: accentColor,
                            }}
                          >
                            <GroupIcon size={14} />
                          </div>
                        )}

                        {/* Name + count (cùng dòng) */}
                        {isEditing ? (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                              flex: 1,
                            }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              autoFocus
                              value={draft}
                              onChange={(e) => setDraft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") commitRename(group.name);
                                else if (e.key === "Escape") setEditing(null);
                              }}
                              style={{
                                flex: 1,
                                fontSize: "13px",
                                padding: "4px 6px",
                                borderRadius: "6px",
                                border: "1px solid var(--border-color)",
                                backgroundColor: "var(--input-bg)",
                                color: "var(--primary-text)",
                                outline: "none",
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => commitRename(group.name)}
                              title="Confirm"
                              style={{
                                border: "none",
                                background: "transparent",
                                color: "var(--vscode-charts-green, #22c55e)",
                                cursor: "pointer",
                                display: "flex",
                                padding: "2px",
                              }}
                            >
                              <Check size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditing(null)}
                              title="Cancel"
                              style={{
                                border: "none",
                                background: "transparent",
                                color: "var(--secondary-text)",
                                cursor: "pointer",
                                display: "flex",
                                padding: "2px",
                              }}
                            >
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <>
                            <div
                              style={{
                                flex: 1,
                                minWidth: 0,
                                display: "flex",
                                alignItems: "baseline",
                                gap: "8px",
                              }}
                            >
                              <span
                                style={{
                                  fontSize: "13px",
                                  fontWeight: 600,
                                  color: "var(--primary-text)",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {group.name}
                              </span>
                              <span
                                style={{
                                  fontSize: "11px",
                                  color: "var(--secondary-text)",
                                  opacity: 0.7,
                                  flexShrink: 0,
                                }}
                              >
                                {group.count}{" "}
                                {group.count === 1 ? "skill" : "skills"}
                              </span>
                            </div>

                            {/* Chevron expand — bên phải */}
                            <span
                              style={{
                                display: "flex",
                                color: "var(--secondary-text)",
                                opacity: 0.7,
                                flexShrink: 0,
                              }}
                            >
                              {isExpanded ? (
                                <ChevronDown size={14} />
                              ) : (
                                <ChevronRight size={14} />
                              )}
                            </span>
                          </>
                        )}
                      </div>

                    {/* Expanded: danh sách tên skill */}
                    {isExpanded && !isEditing && (
                      <div
                        style={{
                          padding: "0 12px 10px 54px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "3px",
                        }}
                      >
                        {group.skillNames.length === 0 ? (
                          <div
                            style={{
                              fontSize: "11px",
                              color: "var(--secondary-text)",
                              opacity: 0.6,
                              fontStyle: "italic",
                            }}
                          >
                            Empty
                          </div>
                        ) : (
                          group.skillNames.map((name) => (
                            <div
                              key={name}
                              style={{
                                fontSize: "12px",
                                color: "var(--secondary-text)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {name}
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
                        onClick={() => {
                          setDraft(group.name);
                          setEditing(group.name);
                        }}
                      >
                        Rename group
                      </DropdownItem>
                      <DropdownItem
                        icon={<Trash2 size={14} />}
                        variant="error"
                        onClick={() => onDeleteGroup(group.name)}
                      >
                        Delete group
                      </DropdownItem>
                    </DropdownContent>
                  )}
                </Dropdown>
              );
            })}
          </div>
        </div>

        {/* Footer — chỉ hiện khi có skill cần cài */}
        {skill && (
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "8px",
              padding: "12px 16px",
              borderTop: "1px solid var(--border-color)",
              flexShrink: 0,
            }}
          >
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "8px 14px",
                borderRadius: "9px",
                backgroundColor: "rgba(128,128,128,0.08)",
                border: "none",
                color: "var(--secondary-text)",
                fontSize: "12px",
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => onConfirmInstall(selected)}
              style={{
                padding: "8px 14px",
                borderRadius: "9px",
                backgroundColor:
                  "color-mix(in srgb, var(--vscode-button-background) 18%, transparent)",
                border: "none",
                color: "var(--primary-text)",
                fontSize: "12px",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <Plus size={13} />
              Install
            </button>
          </div>
        )}
      </div>

      <style>{`
        @keyframes skDrawerSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes skDrawerFadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </>
  );

  return createPortal(content, document.body);
}