import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { createPortal } from "react-dom";
import { X, Plus, FolderPlus, Search, Trash2 } from "lucide-react";
import type { SkillSummary } from "../../types/skill.types";
import { isReservedGroupName } from "../../hooks/useSkillWorkspaceState";
import { IconPicker } from "../shared/IconPicker";
import { DEFAULT_GROUP_ICON } from "../shared/iconLibrary";
import {
  GroupTree,
  GROUP_ACCENT_COLORS,
  resolveGroupColor,
  type DrawerGroup,
  type SkillPreviewState,
} from "../shared/GroupTree";

export type { DrawerGroup, DrawerSkill } from "../shared/GroupTree";

export interface GroupMeta {
  icon?: string;
  color?: string;
  description?: string;
}

export interface GroupUpdate extends GroupMeta {
  name: string;
}

interface SkillGroupDrawerProps {
  isOpen: boolean;
  /** Skill cần cài — null nghĩa là chỉ mở để quản lý group. */
  skill: SkillSummary | null;
  /** Danh sách group (đã bao gồm "Others" ở đầu). */
  groups: DrawerGroup[];
  onClose: () => void;
  onConfirmInstall: (groupName: string) => void;
  onCreateGroup: (name: string, meta?: GroupMeta) => void;
  onUpdateGroup: (oldName: string, next: GroupUpdate) => void;
  /** Xóa group — skill trong group sẽ chuyển về "Others". */
  onDeleteGroup: (name: string) => void;
  /** Kéo-thả skill sang group khác ("Others" = bỏ khỏi mọi group). */
  onMoveSkill: (slug: string, groupName: string) => void;
  /** Gỡ cài đặt skill. */
  onDeleteSkill: (slug: string) => void;
  /** Mở skill trong OS file manager. */
  onOpenSkillFolder: (slug: string) => void;
  /** Mở SkillDetail của skill đã cài (chỉ khi đang view, không phải cài skill). */
  onOpenSkill: (slug: string) => void;
}

type PendingDelete =
  | { kind: "group"; name: string; count: number }
  | { kind: "skill"; slug: string; name: string };

interface FormState {
  mode: "create" | "edit";
  original?: string;
  name: string;
  description: string;
  icon: string;
  /** undefined = tự động theo hash tên group. */
  color?: string;
  error: string | null;
}

const NEW_FORM: FormState = {
  mode: "create",
  name: "",
  description: "",
  icon: DEFAULT_GROUP_ICON,
  error: null,
};

const DASHED_BOX: CSSProperties = {
  backgroundImage: `
    repeating-linear-gradient(90deg, var(--border-color) 0 8px, transparent 8px 14px),
    repeating-linear-gradient(90deg, var(--border-color) 0 8px, transparent 8px 14px),
    repeating-linear-gradient(0deg, var(--border-color) 0 8px, transparent 8px 14px),
    repeating-linear-gradient(0deg, var(--border-color) 0 8px, transparent 8px 14px)
  `,
  backgroundSize: "100% 1px, 100% 1px, 1px 100%, 1px 100%",
  backgroundPosition: "0 0, 0 100%, 0 0, 100% 0",
  backgroundRepeat: "no-repeat",
};

const fieldStyle: CSSProperties = {
  fontSize: "13px",
  padding: "8px 10px",
  borderRadius: "8px",
  border: "none",
  backgroundColor: "var(--input-bg)",
  color: "var(--primary-text)",
  outline: "none",
  boxSizing: "border-box",
};

const swatchStyle = (
  color: string | undefined,
  active: boolean,
): CSSProperties => ({
  width: "18px",
  height: "18px",
  padding: 0,
  borderRadius: "50%",
  border: color ? "none" : "1px dashed var(--secondary-text)",
  backgroundColor: color ?? "transparent",
  outline: active ? `2px solid ${color ?? "var(--secondary-text)"}` : "none",
  outlineOffset: "2px",
  cursor: "pointer",
  flexShrink: 0,
});

const textButtonStyle: CSSProperties = {
  padding: "6px 12px",
  borderRadius: "6px",
  border: "none",
  backgroundColor: "transparent",
  color: "var(--secondary-text)",
  fontSize: "12px",
  cursor: "pointer",
};

const TOOLTIP_OFFSET = 14;
const TOOLTIP_MAX_WIDTH = 340;
const TOOLTIP_MAX_HEIGHT = 320;

/** Đặt lệch phải-dưới con trỏ, tự lật lên trên / sang trái khi thiếu chỗ trong viewport. */
const getTooltipStyle = (p: { x: number; y: number }): CSSProperties => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const width = Math.min(TOOLTIP_MAX_WIDTH, vw - 16);
  const left = Math.max(8, Math.min(p.x + TOOLTIP_OFFSET, vw - width - 8));
  const spaceBelow = vh - p.y - TOOLTIP_OFFSET - 8;
  const spaceAbove = p.y - TOOLTIP_OFFSET - 8;
  const below = spaceBelow >= 200 || spaceBelow >= spaceAbove;
  return below
    ? {
        left,
        width,
        top: p.y + TOOLTIP_OFFSET,
        maxHeight: Math.min(TOOLTIP_MAX_HEIGHT, spaceBelow),
      }
    : {
        left,
        width,
        bottom: vh - p.y + TOOLTIP_OFFSET,
        maxHeight: Math.min(TOOLTIP_MAX_HEIGHT, spaceAbove),
      };
};

/** Tooltip xem trước nội dung skill — bám theo con chuột, không delay. */
function SkillPreviewTooltip({ skill, x, y }: SkillPreviewState) {
  return (
    <div className="sk-tip" role="tooltip" style={getTooltipStyle({ x, y })}>
      <div className="sk-tip-title">{skill.name}</div>
      {skill.author && (
        <div className="sk-tip-chips">
          <span className="sk-tip-chip">by {skill.author}</span>
        </div>
      )}
      <div className="sk-tip-label">Content</div>
      {skill.preview ? (
        <div className="sk-tip-preview">{skill.preview}</div>
      ) : (
        <div className="sk-tip-muted">No preview available</div>
      )}
    </div>
  );
}

/**
 * Drawer chọn group để cài skill + quản lý group (tạo / sửa tên, icon, màu, mô tả,
 * xóa group, kéo-thả và xóa skill). Tooltip xem trước skill được vẽ ngay tại đây.
 * Render qua portal, slide từ dưới lên, cao cố định 75%.
 * Khi `skill` = null thì chỉ hiển thị phần quản lý group (không có nút Install).
 */
export function SkillGroupDrawer({
  isOpen,
  skill,
  groups,
  onClose,
  onConfirmInstall,
  onCreateGroup,
  onUpdateGroup,
  onDeleteGroup,
  onMoveSkill,
  onDeleteSkill,
  onOpenSkillFolder,
  onOpenSkill,
}: SkillGroupDrawerProps) {
  const [selected, setSelected] = useState("Others");
  const [form, setForm] = useState<FormState | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [pendingDelete, setPendingDelete] = useState<PendingDelete | null>(
    null,
  );
  const [preview, setPreview] = useState<SkillPreviewState | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSelected(groups[0]?.name ?? "Others");
      setForm(null);
      setSearchQuery("");
      setPendingDelete(null);
      setPreview(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (pendingDelete) setPendingDelete(null);
      else onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, onClose, pendingDelete]);

  useEffect(() => {
    if (!preview) return;
    const hide = () => setPreview(null);
    window.addEventListener("scroll", hide, true);
    return () => window.removeEventListener("scroll", hide, true);
  }, [!!preview]);

  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter(
      (g) =>
        g.name.toLowerCase().includes(q) ||
        (g.description ?? "").toLowerCase().includes(q) ||
        g.skills.some((s) => s.name.toLowerCase().includes(q)),
    );
  }, [groups, searchQuery]);

  if (!isOpen) return null;

  const patchForm = (patch: Partial<FormState>) =>
    setForm((prev) => (prev ? { ...prev, ...patch, error: null } : prev));

  const requestDeleteGroup = (name: string) => {
    const group = groups.find((g) => g.name === name);
    setPendingDelete({ kind: "group", name, count: group?.skills.length ?? 0 });
  };

  const confirmDelete = () => {
    if (!pendingDelete) return;
    if (pendingDelete.kind === "group") {
      onDeleteGroup(pendingDelete.name);
      if (selected === pendingDelete.name) setSelected("Others");
    } else {
      onDeleteSkill(pendingDelete.slug);
    }
    setPendingDelete(null);
  };

  const openEdit = (group: DrawerGroup) =>
    setForm({
      mode: "edit",
      original: group.name,
      name: group.name,
      description: group.description ?? "",
      icon: group.icon ?? DEFAULT_GROUP_ICON,
      color: group.color,
      error: null,
    });

  const submitForm = () => {
    if (!form) return;
    const name = form.name.trim();
    let error: string | null = null;
    if (!name) {
      error = "Group name cannot be empty";
    } else if (isReservedGroupName(name)) {
      error = `"${name}" is reserved`;
    } else if (
      groups.some(
        (g) =>
          g.name.toLowerCase() === name.toLowerCase() &&
          g.name !== form.original,
      )
    ) {
      error = "Group already exists";
    }
    if (error) {
      setForm({ ...form, error });
      return;
    }
    const meta: GroupMeta = {
      icon: form.icon,
      color: form.color,
      description: form.description.trim() || undefined,
    };
    if (form.mode === "edit" && form.original) {
      onUpdateGroup(form.original, { name, ...meta });
    } else {
      onCreateGroup(name, meta);
    }
    setForm(null);
  };

  const content = (
    <>
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
      <div
        style={{
          position: "fixed",
          bottom: 0,
          left: 0,
          right: 0,
          height: "75%",
          backgroundColor: "var(--tertiary-bg)",
          borderTop: "1px solid var(--border-color)",
          boxShadow: "0 -8px 32px rgba(0,0,0,0.25)",
          zIndex: 10001,
          display: "flex",
          flexDirection: "column",
          animation: "skDrawerSlideUp 0.22s ease",
        }}
      >
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
              placeholder="Search groups or skills..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                ...fieldStyle,
                width: "100%",
                padding: "8px 12px 8px 32px",
                height: "34px",
              }}
            />
          </div>
          <button
            type="button"
            onClick={() => setForm(NEW_FORM)}
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

        <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 10px" }}>
          {form && (
            <div style={{ marginBottom: "12px" }}>
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
                {form.mode === "create" ? "New Group" : "Edit Group"}
              </div>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  padding: "12px",
                  borderRadius: "10px",
                  ...DASHED_BOX,
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <IconPicker
                    value={form.icon}
                    color={resolveGroupColor({
                      name: form.name.trim() || form.original || "",
                      color: form.color,
                    })}
                    onChange={(icon) => patchForm({ icon })}
                  />
                  <input
                    autoFocus
                    type="text"
                    placeholder="Group name..."
                    value={form.name}
                    onChange={(e) => patchForm({ name: e.target.value })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") submitForm();
                      else if (e.key === "Escape") {
                        e.stopPropagation();
                        setForm(null);
                      }
                    }}
                    style={{ ...fieldStyle, flex: 1 }}
                  />
                </div>
                <input
                  type="text"
                  placeholder="Description (optional)..."
                  value={form.description}
                  onChange={(e) => patchForm({ description: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") submitForm();
                  }}
                  style={fieldStyle}
                />
                <div
                  style={{ display: "flex", alignItems: "center", gap: "8px" }}
                >
                  <span
                    style={{
                      fontSize: "11px",
                      color: "var(--secondary-text)",
                      marginRight: "4px",
                    }}
                  >
                    Color
                  </span>
                  <button
                    type="button"
                    title="Auto"
                    onClick={() => patchForm({ color: undefined })}
                    style={swatchStyle(undefined, form.color === undefined)}
                  />
                  {GROUP_ACCENT_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      title={c}
                      onClick={() => patchForm({ color: c })}
                      style={swatchStyle(c, form.color === c)}
                    />
                  ))}
                </div>
                {form.error && (
                  <div
                    style={{
                      fontSize: "11px",
                      color: "var(--vscode-errorForeground, #f87171)",
                    }}
                  >
                    {form.error}
                  </div>
                )}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    justifyContent: "flex-end",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setForm(null)}
                    style={textButtonStyle}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={submitForm}
                    style={{
                      ...textButtonStyle,
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      backgroundColor:
                        "color-mix(in srgb, var(--vscode-button-background) 18%, transparent)",
                      color: "var(--vscode-button-background)",
                      fontWeight: 500,
                    }}
                  >
                    <Plus size={13} />
                    {form.mode === "create" ? "Create" : "Save"}
                  </button>
                </div>
              </div>
            </div>
          )}

          {pendingDelete && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "8px 10px",
                marginBottom: "10px",
                borderRadius: "8px",
                backgroundColor: "rgba(244,67,54,0.10)",
                border: "1px solid rgba(244,67,54,0.35)",
              }}
            >
              <Trash2 size={14} style={{ color: "#f44336", flexShrink: 0 }} />
              <div
                style={{
                  flex: 1,
                  minWidth: 0,
                  fontSize: "12px",
                  color: "var(--primary-text)",
                }}
              >
                {pendingDelete.kind === "group"
                  ? pendingDelete.count > 0
                    ? `Delete group "${pendingDelete.name}"? ${pendingDelete.count} skill(s) will move to Others.`
                    : `Delete group "${pendingDelete.name}"?`
                  : `Uninstall skill "${pendingDelete.name}"?`}
              </div>
              <button
                type="button"
                onClick={() => setPendingDelete(null)}
                style={textButtonStyle}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                style={{
                  ...textButtonStyle,
                  backgroundColor: "rgba(244,67,54,0.18)",
                  color: "#f44336",
                  fontWeight: 500,
                }}
              >
                Delete
              </button>
            </div>
          )}

          <GroupTree
            groups={filteredGroups}
            selectable={!!skill}
            selected={selected}
            onSelect={setSelected}
            onEdit={openEdit}
            onDelete={requestDeleteGroup}
            onMoveSkill={onMoveSkill}
            onDeleteSkill={(s) =>
              setPendingDelete({ kind: "skill", slug: s.slug, name: s.name })
            }
            onOpenSkillFolder={(s) => onOpenSkillFolder(s.slug)}
            onOpenSkill={(s) => onOpenSkill(s.slug)}
            onPreviewChange={setPreview}
          />
        </div>

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
                color: "var(--vscode-button-background)",
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

      {preview && <SkillPreviewTooltip {...preview} />}

      <style>{`
        @keyframes skDrawerSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes skDrawerFadeIn { from { opacity: 0; } to { opacity: 1; } }
        .sk-tip { position: fixed; z-index: 10010; box-sizing: border-box; display: flex; flex-direction: column; gap: 8px; padding: 12px; overflow: hidden; pointer-events: none; border-radius: 12px; background: var(--tertiary-bg, #2d2d30); border: 1px solid var(--border-color, #3e3e42); box-shadow: 0 12px 32px rgba(0,0,0,.35); }
        .sk-tip-title { font-size: 13px; font-weight: 600; line-height: 1.35; color: var(--primary-text); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; word-break: break-word; }
        .sk-tip-chips { display: flex; flex-wrap: wrap; gap: 5px; }
        .sk-tip-chip { display: inline-flex; align-items: center; padding: 2px 7px; border-radius: 5px; font-size: 10px; font-weight: 500; color: var(--secondary-text, #858585); background: color-mix(in srgb, var(--primary-text, #ccc) 7%, transparent); }
        .sk-tip-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: var(--secondary-text, #858585); opacity: .8; }
        .sk-tip-preview { font-size: 12px; line-height: 1.5; color: var(--primary-text); white-space: pre-wrap; word-break: break-word; padding: 8px 10px; border-radius: 4px; background: color-mix(in srgb, var(--primary-text, #ccc) 5%, transparent); display: -webkit-box; -webkit-line-clamp: 9; -webkit-box-orient: vertical; overflow: hidden; }
        .sk-tip-muted { font-size: 12px; color: var(--secondary-text, #858585); font-style: italic; }
      `}</style>
    </>
  );

  return createPortal(content, document.body);
}
