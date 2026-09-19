import React from "react";
import type { SkillSummary } from "../../types/skill.types";
import { SkillCard } from "./SkillCard";
import {
  ErrorState,
  EmptyState,
  NoResultsState,
  SkillListSkeleton,
} from "./SkillStates";

interface SkillListProps {
  skills: SkillSummary[];
  loading: boolean;
  searchLoading: boolean;
  error: string | null;
  searchQuery: string;
  installedSlugs: Set<string>;
  onRetry: () => void;
  onSkillClick: (skill: SkillSummary) => void;
  onToggleInstall: (skill: SkillSummary) => void;
}

/**
 * Vùng danh sách skill — quyết định hiển thị state nào dựa trên props:
 * loading > error > empty > no-results > grid. Grid không padding
 * ngang và không gap để các SkillCard dính liền nhau.
 */
export function SkillList({
  skills,
  loading,
  searchLoading,
  error,
  searchQuery,
  installedSlugs,
  onRetry,
  onSkillClick,
  onToggleInstall,
}: SkillListProps) {
  if (loading) {
    return (
      <div style={{ flex: 1, overflowY: "auto" }}>
        <SkillListSkeleton count={6} />
      </div>
    );
  }

  return (
    <div style={{ flex: 1, overflowY: "auto" }}>
      {error && <ErrorState message={error} onRetry={onRetry} />}

      {!error && skills.length === 0 && !searchQuery.trim() && <EmptyState />}

      {!error &&
        skills.length === 0 &&
        searchQuery.trim() &&
        !searchLoading && <NoResultsState query={searchQuery} />}

      {!error && skills.length > 0 && (
        <div
          className="skill-grid"
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
            gap: "14px",
            padding: "0 16px 16px",
          }}
        >
          {skills.map((skill) => (
            <SkillCard
              key={skill.id}
              skill={skill}
              installed={installedSlugs.has(skill.slug)}
              onClick={onSkillClick}
              onToggleInstall={onToggleInstall}
            />
          ))}
        </div>
      )}
    </div>
  );
}