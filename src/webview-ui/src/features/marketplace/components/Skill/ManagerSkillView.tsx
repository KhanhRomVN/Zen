import React, { useMemo } from "react";
import type { InstalledSkill } from "../../services/skillInstall.service";
import type { SkillSummary } from "../../types/skill.types";
import { SkillCard } from "./SkillCard";
import { EmptyInstalledState, NoResultsState } from "./SkillStates";

interface ManagerSkillViewProps {
  installedSkills: InstalledSkill[];
  searchQuery: string;
  onSkillClick: (skill: SkillSummary) => void;
  onToggleInstall: (skill: SkillSummary) => void;
}

/**
 * View "Manager" — liệt kê các skill đã cài, filter theo searchQuery.
 * Dùng lại SkillCard với installed=true (mọi skill trong list đều đã cài).
 */
export function ManagerSkillView({
  installedSkills,
  searchQuery,
  onSkillClick,
  onToggleInstall,
}: ManagerSkillViewProps) {
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return installedSkills;
    return installedSkills.filter(
      (s) =>
        (s.name || "").toLowerCase().includes(q) ||
        (s.description || "").toLowerCase().includes(q) ||
        (s.author || "").toLowerCase().includes(q),
    );
  }, [installedSkills, searchQuery]);

  if (installedSkills.length === 0) {
    return <EmptyInstalledState />;
  }

  if (filtered.length === 0) {
    return <NoResultsState query={searchQuery} />;
  }

  return (
    <div style={{ flex: 1, overflowY: "auto" }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
          gap: "14px",
          padding: "0 16px 16px",
        }}
      >
        {filtered.map((skill) => (
          <SkillCard
            key={skill.slug}
            skill={skill as SkillSummary}
            installed
            onClick={onSkillClick}
            onToggleInstall={onToggleInstall}
          />
        ))}
      </div>
    </div>
  );
}