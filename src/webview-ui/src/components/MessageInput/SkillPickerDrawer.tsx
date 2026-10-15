import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X, Search, Sparkles } from "lucide-react";
import { listInstalledSkills } from "@/features/marketplace/services/skillInstall.service";
import {
  loadSkillWorkspaceState,
  DEFAULT_SKILL_WORKSPACE_STATE,
  type SkillWorkspaceState,
} from "@/features/marketplace/services/skillWorkspaceState.service";
import { DEFAULT_GROUP_NAME } from "@/features/marketplace/hooks/useSkillWorkspaceState";
import { getGroupIcon } from "@/features/marketplace/components/shared/iconLibrary";
import {
  resolveGroupColor,
  GROUP_ACCENT_COLORS,
} from "@/features/marketplace/components/shared/GroupTree";
import { buildSkillPreview } from "@/features/marketplace/utils/skillPreview";

export interface PickedSkill {
  slug: string;
  name: string;
}

interface SkillPickerDrawerProps {
  isOpen: boolean;
  /** Slug các skill đang được gắn vào input. */
  selectedSlugs: string[];
  onClose: () => void;
  onConfirm: (skills: PickedSkill[]) => void;
}

interface PickerSkill extends PickedSkill {
  author?: string;
  description?: string;
  /** Phần đầu nội dung skill — hiển thị trong tooltip khi hover. */
  preview: string;
}

interface PickerGroup {
  name: string;
  icon?: string;
  color?: string;
  description?: string;
  skills: PickerSkill[];
}

const ellipsis: React.CSSProperties = {
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
};

const textButtonStyle: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: "9px",
  backgroundColor: "rgba(128,128,128,0.08)",
  border: "none",
  color: "var(--secondary-text)",
  fontSize: "12px",
  fontWeight: 500,
  cursor: "pointer",
};

/**
 * Drawer chọn skill đã cài để gắn vào input. Slide từ dưới lên, cao 75%,
 * skill gom theo group (giống SkillGroupDrawer), chọn nhiều skill bằng checkbox.
 */
export default function SkillPickerDrawer({
  isOpen,
  selectedSlugs,
  onClose,
  onConfirm,
}: SkillPickerDrawerProps) {
  const [skills, setSkills] = useState<PickerSkill[]>([]);
  const [workspace, setWorkspace] = useState<SkillWorkspaceState>(
    DEFAULT_SKILL_WORKSPACE_STATE,
  );
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<PreviewState | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setQuery("");
    setChecked(new Set(selectedSlugs));
    setLoading(true);
    Promise.all([listInstalledSkills(), loadSkillWorkspaceState()])
      .then(([list, ws]) => {
        if (cancelled) return;
        setSkills(
          list
            .filter((s) => !!s.slug)
            .map((s) => ({
              slug: s.slug as string,
              name: s.name || (s.slug as string),
              author: s.author,
              description: s.description,
              preview: buildSkillPreview({
                content: "content" in s ? s.content : undefined,
                description: s.description,
              }),
            })),
        );
        setWorkspace(ws);
      })
      .catch(() => {
        if (cancelled) return;
        setSkills([]);
        setWorkspace(DEFAULT_SKILL_WORKSPACE_STATE);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
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

  const groups = useMemo<PickerGroup[]>(() => {
    const bySlug = new Map(skills.map((s) => [s.slug, s]));
    const assigned = new Set(workspace.groups.flatMap((g) => g.slugs));
    const all: PickerGroup[] = [
      {
        name: DEFAULT_GROUP_NAME,
        skills: skills.filter((s) => !assigned.has(s.slug)),
      },
      ...workspace.groups.map((g) => ({
        name: g.name,
        icon: g.icon,
        color: g.color,
        description: g.description,
        skills: g.slugs.flatMap((slug) => {
          const s = bySlug.get(slug);
          return s ? [s] : [];
        }),
      })),
    ];
    const q = query.trim().toLowerCase();
    return all
      .map((g) => ({
        ...g,
        skills: q
          ? g.skills.filter(
              (s) =>
                s.name.toLowerCase().includes(q) ||
                (s.author ?? "").toLowerCase().includes(q) ||
                (s.description ?? "").toLowerCase().includes(q),
            )
          : g.skills,
      }))
      .filter((g) => g.skills.length > 0);
  }, [skills, workspace, query]);

  if (!isOpen) return null;

  const toggle = (slug: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });

  const confirm = () => {
    onConfirm(
      skills
        .filter((s) => checked.has(s.slug))
        .map((s) => ({ slug: s.slug, name: s.name })),
    );
    onClose();
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
          animation: "skPickFadeIn 0.15s ease",
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
          animation: "skPickSlideUp 0.22s ease",
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
              Select Skills
            </div>
            <div
              style={{
                fontSize: "12px",
                color: "var(--secondary-text)",
                opacity: 0.7,
                marginTop: "3px",
              }}
            >
              Choose installed skills for the agent to use
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
            }}
          >
            <X size={16} />
          </button>
        </div>

        <div style={{ padding: "10px 16px", flexShrink: 0 }}>
          <div style={{ position: "relative" }}>
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
              autoFocus
              placeholder="Search skills..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              style={{
                width: "100%",
                height: "34px",
                fontSize: "13px",
                padding: "8px 12px 8px 32px",
                borderRadius: "8px",
                border: "none",
                backgroundColor: "var(--input-bg)",
                color: "var(--primary-text)",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "0 16px 10px" }}>
          {loading ? (
            <div style={emptyStyle}>Loading skills...</div>
          ) : groups.length === 0 ? (
            <div style={emptyStyle}>
              {skills.length === 0
                ? "No installed skills yet"
                : "No skills found"}
            </div>
          ) : (
            groups.map((group) => {
              const color = resolveGroupColor(group);
              const GroupIcon = getGroupIcon(group.icon);
              return (
                <div key={group.name} style={{ marginBottom: "10px" }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      padding: "6px 4px",
                    }}
                  >
                    <div
                      style={{
                        width: "24px",
                        height: "24px",
                        borderRadius: "7px",
                        backgroundColor: `color-mix(in srgb, ${color} 16%, transparent)`,
                        color,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <GroupIcon size={13} />
                    </div>
                    <span
                      style={{
                        fontSize: "12px",
                        fontWeight: 600,
                        color: "var(--primary-text)",
                        ...ellipsis,
                      }}
                    >
                      {group.name}
                    </span>
                    <span
                      style={{
                        fontSize: "11px",
                        color: "var(--secondary-text)",
                        opacity: 0.7,
                      }}
                    >
                      {group.skills.length}
                    </span>
                  </div>
                  <div
                    style={{
                      marginLeft: "4px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "1px",
                    }}
                  >
                    {group.skills.map((s) => {
                      const on = checked.has(s.slug);
                      return (
                        <div
                          key={s.slug}
                          className="sk-pick-row"
                          onClick={() => {
                            setPreview(null);
                            toggle(s.slug);
                          }}
                          onMouseEnter={(e) =>
                            setPreview({ skill: s, x: e.clientX, y: e.clientY })
                          }
                          onMouseMove={(e) =>
                            setPreview({ skill: s, x: e.clientX, y: e.clientY })
                          }
                          onMouseLeave={() => setPreview(null)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "10px",
                            padding: "7px 8px",
                            borderRadius: "2px 6px 6px 2px",
                            borderLeft: `3px solid ${on ? skillColor(s.slug) : "transparent"}`,
                            backgroundColor: on
                              ? `color-mix(in srgb, ${skillColor(s.slug)} 10%, transparent)`
                              : undefined,
                            cursor: "pointer",
                            minWidth: 0,
                          }}
                        >
                          <span
                            style={{
                              flex: 1,
                              minWidth: 0,
                              fontSize: "12.5px",
                              color: "var(--primary-text)",
                              ...ellipsis,
                            }}
                          >
                            {s.name}
                          </span>
                          {s.author && (
                            <span
                              style={{
                                fontSize: "11px",
                                color: "var(--secondary-text)",
                                opacity: 0.65,
                                flexShrink: 0,
                                maxWidth: "40%",
                                ...ellipsis,
                              }}
                            >
                              {s.author}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

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
          <button type="button" onClick={onClose} style={textButtonStyle}>
            Cancel
          </button>
          <button
            type="button"
            onClick={confirm}
            style={{
              ...textButtonStyle,
              backgroundColor:
                "color-mix(in srgb, var(--vscode-button-background) 18%, transparent)",
              color: "var(--vscode-button-background)",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Sparkles size={13} />
            Apply{checked.size > 0 ? ` (${checked.size})` : ""}
          </button>
        </div>
      </div>

      {preview && <SkillPreviewTooltip {...preview} />}

      <style>{`
        @keyframes skPickSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes skPickFadeIn { from { opacity: 0; } to { opacity: 1; } }
        .sk-pick-row:hover { background-color: var(--hover-bg); }
      `}</style>
    </>
  );

  return createPortal(content, document.body);
}

interface PreviewState {
  skill: PickerSkill;
  x: number;
  y: number;
}

/** Màu border-left của skill đã chọn — ổn định theo slug. */
function skillColor(slug: string): string {
  let h = 0;
  for (let i = 0; i < slug.length; i++) h = (h * 31 + slug.charCodeAt(i)) | 0;
  return GROUP_ACCENT_COLORS[Math.abs(h) % GROUP_ACCENT_COLORS.length];
}

const TOOLTIP_OFFSET = 14;
const TOOLTIP_MAX_WIDTH = 340;
const TOOLTIP_MAX_HEIGHT = 320;

/** Đặt lệch phải-dưới con trỏ, tự lật lên trên / sang trái khi thiếu chỗ trong viewport. */
const getTooltipStyle = (p: { x: number; y: number }): React.CSSProperties => {
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
function SkillPreviewTooltip({ skill, x, y }: PreviewState) {
  return (
    <>
      <div
        className="sk-pick-tip"
        role="tooltip"
        style={getTooltipStyle({ x, y })}
      >
        <div className="sk-pick-tip-title">{skill.name}</div>
        {skill.author && (
          <div className="sk-pick-tip-chips">
            <span className="sk-pick-tip-chip">by {skill.author}</span>
          </div>
        )}
        <div className="sk-pick-tip-label">Content</div>
        {skill.preview ? (
          <div className="sk-pick-tip-preview">{skill.preview}</div>
        ) : (
          <div className="sk-pick-tip-muted">No preview available</div>
        )}
      </div>
      <style>{`
        .sk-pick-tip { position: fixed; z-index: 10010; box-sizing: border-box; display: flex; flex-direction: column; gap: 8px; padding: 12px; overflow: hidden; pointer-events: none; border-radius: 12px; background: var(--tertiary-bg, #2d2d30); border: 1px solid var(--border-color, #3e3e42); box-shadow: 0 12px 32px rgba(0,0,0,.35); }
        .sk-pick-tip-title { font-size: 13px; font-weight: 600; line-height: 1.35; color: var(--primary-text); display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; word-break: break-word; }
        .sk-pick-tip-chips { display: flex; flex-wrap: wrap; gap: 5px; }
        .sk-pick-tip-chip { display: inline-flex; align-items: center; padding: 2px 7px; border-radius: 5px; font-size: 10px; font-weight: 500; color: var(--secondary-text, #858585); background: color-mix(in srgb, var(--primary-text, #ccc) 7%, transparent); }
        .sk-pick-tip-label { font-size: 9px; font-weight: 700; text-transform: uppercase; letter-spacing: .08em; color: var(--secondary-text, #858585); opacity: .8; }
        .sk-pick-tip-preview { font-size: 12px; line-height: 1.5; color: var(--primary-text); white-space: pre-wrap; word-break: break-word; padding: 8px 10px; border-radius: 4px; background: color-mix(in srgb, var(--primary-text, #ccc) 5%, transparent); display: -webkit-box; -webkit-line-clamp: 9; -webkit-box-orient: vertical; overflow: hidden; }
        .sk-pick-tip-muted { font-size: 12px; color: var(--secondary-text, #858585); font-style: italic; }
      `}</style>
    </>
  );
}

const emptyStyle: React.CSSProperties = {
  padding: "24px 0",
  textAlign: "center",
  fontSize: "12px",
  color: "var(--secondary-text)",
  opacity: 0.7,
};