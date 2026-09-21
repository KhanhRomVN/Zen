import React from "react";
import type { SkillDetail as SkillDetailData } from "../../../types/skill.types";
import { SkeletonLine } from "../../shared/StateViews";
import { SkillDetailBreadcrumb } from "./SkillDetailBreadcrumb";
import { SkillDetailHero } from "./SkillDetailHero";
import { SkillDetailDescription } from "./SkillDetailDescription";
import { SkillDetailAbout } from "./SkillDetailAbout";

interface SkillDetailProps {
  skill: SkillDetailData;
  installed: boolean;
  onBack: () => void;
  onToggleInstall: (skill: SkillDetailData) => void;
}

/**
 * View chi tiết skill — compose từ 4 section: breadcrumb, hero,
 * description, about.
 */
export function SkillDetail({
  skill,
  installed,
  onBack,
  onToggleInstall,
}: SkillDetailProps) {
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <SkillDetailBreadcrumb name={skill.name} onBack={onBack} />
      <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px" }}>
        <SkillDetailHero
          skill={skill}
          installed={installed}
          onToggleInstall={onToggleInstall}
        />
        <SkillDetailDescription description={skill.description} />
        <SkillDetailAbout content={skill.content} />
      </div>
    </div>
  );
}

/** Skeleton cho SkillDetail — breadcrumb, title, badges, description, markdown. */
export function SkillDetailSkeleton() {
  return (
    <div style={{ padding: "16px 20px" }}>
      <SkeletonLine width="40%" height={10} style={{ marginBottom: "16px" }} />
      <SkeletonLine width="60%" height={20} style={{ marginBottom: "10px" }} />
      <SkeletonLine width="30%" height={11} style={{ marginBottom: "16px" }} />
      <div style={{ display: "flex", gap: "10px", marginBottom: "20px" }}>
        <SkeletonLine width={70} height={18} radius={6} />
        <SkeletonLine width={70} height={18} radius={6} />
      </div>
      <SkeletonLine width="25%" height={11} style={{ marginBottom: "8px" }} />
      <SkeletonLine width="100%" height={9} style={{ marginBottom: "5px" }} />
      <SkeletonLine width="95%" height={9} style={{ marginBottom: "5px" }} />
      <SkeletonLine width="85%" height={9} style={{ marginBottom: "20px" }} />
      <SkeletonLine width="30%" height={11} style={{ marginBottom: "8px" }} />
      {Array.from({ length: 6 }).map((_, i) => (
        <SkeletonLine
          key={i}
          width={`${90 - i * 5}%`}
          height={9}
          style={{ marginBottom: "6px" }}
        />
      ))}
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