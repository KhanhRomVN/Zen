import React, { useMemo, useState } from "react";
import type { InstalledSkill } from "../../../services/skillInstall.service";
import type { SkillSummary } from "../../../types/skill.types";
import { SkillCard } from "./SkillCard";
import { GroupHeader } from "./GroupHeader";
import { DeleteGroupModal } from "./DeleteGroupModal";
import { EmptyInstalledState, NoResultsState } from "../../shared/StateViews";
import {
  DEFAULT_GROUP_NAME,
  normalizeGroupName,
  isReservedGroupName,
  type UseSkillWorkspaceStateResult,
} from "../../../hooks/useSkillWorkspaceState";
import { extensionService } from "../../../../../services/ExtensionService";

export { SkillCard } from "./SkillCard";

interface ManagerSkillViewProps {
  installedSkills: InstalledSkill[];
  searchQuery: string;
  onSkillClick: (skill: SkillSummary) => void;
  onToggleInstall: (skill: SkillSummary) => void;
  /** Workspace state (groups/toggles) được lift lên SkillPanel. */
  workspaceState: UseSkillWorkspaceStateResult;
}

interface GroupedData {
  groupName: string;
  skills: SkillSummary[];
  isOther: boolean;
}

/**
 * View "Manager" — liệt kê skill đã cài, chia theo group. Có search
 * filter, tạo/xóa/đổi tên group, toggle bật/tắt skill theo workspace
 * (state lưu qua workspaceState của VSCode).
 */
export function ManagerSkillView({
  installedSkills,
  searchQuery,
  onSkillClick,
  onToggleInstall,
  workspaceState,
}: ManagerSkillViewProps) {
  const {
    state,
    toggleSkillEnabled,
    renameGroup,
    removeGroup,
    assignSkillToGroup,
    toggleGroupCollapsed,
  } = workspaceState;

  const [draggedSlug, setDraggedSlug] = useState<string | null>(null);
  const [deleteGroupTarget, setDeleteGroupTarget] = useState<string | null>(
    null,
  );

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = installedSkills as SkillSummary[];
    if (!q) return list;
    return list.filter(
      (s) =>
        (s.name || "").toLowerCase().includes(q) ||
        (s.description || "").toLowerCase().includes(q) ||
        (s.author || "").toLowerCase().includes(q),
    );
  }, [installedSkills, searchQuery]);

  // Map slug → group name (lookup nhanh)
  const slugToGroup = useMemo(() => {
    const map = new Map<string, string>();
    for (const g of state.groups) {
      for (const slug of g.slugs) map.set(slug, g.name);
    }
    return map;
  }, [state.groups]);

  // Chia skill theo group + "Other"
  const grouped: GroupedData[] = useMemo(() => {
    const result: GroupedData[] = [];
    const usedSlugs = new Set<string>();

    for (const g of state.groups) {
      const skills = filtered.filter((s) => g.slugs.includes(s.slug));
      skills.forEach((s) => usedSlugs.add(s.slug));
      result.push({ groupName: g.name, skills, isOther: false });
    }

    const others = filtered.filter((s) => !usedSlugs.has(s.slug));
    result.push({
      groupName: DEFAULT_GROUP_NAME,
      skills: others,
      isOther: true,
    });

    return result;
  }, [filtered, state.groups]);

  const groupNames = state.groups.map((g) => g.name);

  const handleDropOnGroup = (groupName: string) => (e: React.DragEvent) => {
    e.preventDefault();
    const slug = e.dataTransfer.getData("text/plain") || draggedSlug;
    if (!slug) return;
    assignSkillToGroup(slug, groupName);
    setDraggedSlug(null);
  };

  const handleDeleteSkill = (skill: SkillSummary) => {
    onToggleInstall(skill); // "xóa skill" = uninstall (toggle khi đang installed)
  };

  const handleOpenFolder = () => {
    extensionService.postMessage({ command: "openSkillsFolder" });
  };

  const handleMoveToGroup = (skill: SkillSummary, groupName: string) => {
    assignSkillToGroup(skill.slug, groupName);
  };

  if (installedSkills.length === 0) {
    return <EmptyInstalledState />;
  }

  const deleteGroupSkills = deleteGroupTarget
    ? filtered.filter((s) =>
        state.groups
          .find((g) => g.name === deleteGroupTarget)
          ?.slugs.includes(s.slug),
      )
    : [];

  return (
    <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
      {filtered.length === 0 && searchQuery.trim() ? (
        <NoResultsState query={searchQuery} />
      ) : (
        <div style={{ paddingTop: "4px", paddingBottom: "16px" }}>
          {grouped.map(({ groupName, skills, isOther }) => {
            const key = normalizeGroupName(groupName);
            const collapsed = !!state.collapsedGroups[key];
            const editable = !isOther && !isReservedGroupName(groupName);

            return (
              <div key={groupName} style={{ marginBottom: "4px" }}>
                <GroupHeader
                  name={groupName}
                  count={skills.length}
                  collapsed={collapsed}
                  editable={editable}
                  onToggleCollapse={() => toggleGroupCollapsed(groupName)}
                  onRename={(newName) => renameGroup(groupName, newName)}
                  onDelete={() => setDeleteGroupTarget(groupName)}
                  onDragOver={() => {}}
                  onDrop={handleDropOnGroup(groupName)}
                />
                {!collapsed && skills.length > 0 && (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
                      gap: "8px",
                      padding: "4px 16px 8px",
                    }}
                  >
                    {skills.map((skill) => (
                      <SkillCard
                        key={skill.slug}
                        skill={skill}
                        enabled={!!state.toggles[skill.slug]}
                        groups={groupNames.filter(
                          (g) => g !== slugToGroup.get(skill.slug),
                        )}
                        onToggleEnabled={(s) => toggleSkillEnabled(s.slug)}
                        onOpenDetail={onSkillClick}
                        onDelete={handleDeleteSkill}
                        onOpenFolder={handleOpenFolder}
                        onMoveToGroup={handleMoveToGroup}
                        onDragStart={(s) => setDraggedSlug(s.slug)}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {deleteGroupTarget && (
        <DeleteGroupModal
          groupName={deleteGroupTarget}
          groupSkills={deleteGroupSkills}
          otherGroups={state.groups
            .map((g) => g.name)
            .filter((n) => n !== deleteGroupTarget)}
          onCancel={() => setDeleteGroupTarget(null)}
          onConfirm={({ deleteSlugs, moveTo }) => {
            // Xóa hẳn các skill được chọn khỏi đĩa (mọi workspace)
            for (const slug of deleteSlugs) {
              const skill = installedSkills.find((s) => s.slug === slug);
              if (skill) onToggleInstall(skill as SkillSummary);
            }
            removeGroup(deleteGroupTarget, {
              deleteSlugs,
              moveTo,
            });
            setDeleteGroupTarget(null);
          }}
        />
      )}
    </div>
  );
}