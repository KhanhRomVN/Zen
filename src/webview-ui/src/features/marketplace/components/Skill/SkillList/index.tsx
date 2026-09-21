import React from "react";
import type { SkillSummary } from "../../../types/skill.types";
import {
  SkeletonLine,
  ErrorState,
  EmptyState,
  NoResultsState,
} from "../../shared/StateViews";
import { SkillCard } from "./SkillCard";

interface SkillListProps {
  skills: SkillSummary[];
  loading: boolean;
  searchLoading: boolean;
  error: string | null;
  searchQuery: string;
  installedSlugs: Set<string>;
  onRetry: () => void;
  onSkillClick: (skill: SkillSummary) => void;
  onInstallClick: (skill: SkillSummary) => void;
  onUninstall: (skill: SkillSummary) => void;
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
  onInstallClick,
  onUninstall,
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
              onInstallClick={onInstallClick}
              onUninstall={onUninstall}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Skeleton cho 1 SkillCard — mô phỏng layout: title, author, 2 dòng desc, stats, button. */
function SkillCardSkeleton() {
  return (
    <div
      style={{
        padding: "12px 14px",
        borderRadius: "10px",
        backgroundColor: "var(--input-bg)",
        position: "relative",
      }}
    >
      <div style={{ position: "absolute", top: "10px", right: "10px" }}>
        <SkeletonLine width={72} height={26} radius={4} />
      </div>
      <SkeletonLine width="55%" height={12} style={{ marginBottom: "6px" }} />
      <SkeletonLine width="35%" height={9} style={{ marginBottom: "10px" }} />
      <SkeletonLine width="100%" height={9} style={{ marginBottom: "5px" }} />
      <SkeletonLine width="80%" height={9} style={{ marginBottom: "12px" }} />
      <div style={{ display: "flex", gap: "12px" }}>
        <SkeletonLine width={38} height={8} />
        <SkeletonLine width={38} height={8} />
      </div>
    </div>
  );
}

/** Skeleton danh sách skill — lưới card (khớp padding/gap của SkillList). */
export function SkillListSkeleton({ count = 6 }: { count?: number }) {
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
        {Array.from({ length: count }).map((_, i) => (
          <SkillCardSkeleton key={i} />
        ))}
      </div>
      <style>{`
        @keyframes skillShimmer {
          0% { opacity: 0.55; }
          50% { opacity: 1; }
          100% { opacity: 0.55; }
        }
        .skill-skeleton-shimmer {
          animation: skillShimmer 1.4s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}