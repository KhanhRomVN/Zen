import React, { useState } from "react";
import { List, Package } from "lucide-react";
import { useSkillMarketplace } from "../../hooks/useSkillMarketplace";
import { SkillSearchBar } from "./SkillSearchBar";
import { SkillList } from "./SkillList";
import { SkillDetail } from "./SkillDetail";
import { ManagerSkillView } from "./ManagerSkillView";
import {
  ErrorState,
  SkillDetailSkeleton,
  SkillListSkeleton,
} from "./SkillStates";

type SkillViewMode = "list" | "manager";

/**
 * Entry của SKILL tab — quản lý view switch giữa list-skill-view (Browse)
 * và manager-skill-view (Installed), cùng state từ useSkillMarketplace.
 */
export function SkillPanel() {
  const {
    skills,
    loading,
    error,
    searchQuery,
    setSearchQuery,
    searchLoading,
    selectedSkill,
    detailLoading,
    detailError,
    installedSkills,
    installedSlugs,
    installedLoading,
    loadLeaderboard,
    handleSkillClick,
    handleBack,
    handleClearSearch,
    handleToggleInstall,
  } = useSkillMarketplace();

  const [viewMode, setViewMode] = useState<SkillViewMode>("list");

  if (detailLoading) {
    return <SkillDetailSkeleton />;
  }

  if (detailError) {
    return (
      <ErrorState
        message={detailError}
        onRetry={handleBack}
        retryLabel="Back to skills"
      />
    );
  }

  if (selectedSkill) {
    return (
      <SkillDetail
        skill={selectedSkill}
        installed={
          !!selectedSkill.slug && installedSlugs.has(selectedSkill.slug)
        }
        onBack={handleBack}
        onToggleInstall={handleToggleInstall}
      />
    );
  }

  const isManager = viewMode === "manager";

  const viewToggleButton = (
    <button
      type="button"
      onClick={() => setViewMode(isManager ? "list" : "manager")}
      title={isManager ? "Switch to Browse" : "Switch to Installed"}
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
      {isManager ? <List size={16} /> : <Package size={16} />}
    </button>
  );

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <SkillSearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        onClear={handleClearSearch}
        rightSlot={viewToggleButton}
      />
      {isManager ? (
        installedLoading ? (
          <SkillListSkeleton count={4} />
        ) : (
          <ManagerSkillView
            installedSkills={installedSkills}
            searchQuery={searchQuery}
            onSkillClick={handleSkillClick}
            onToggleInstall={handleToggleInstall}
          />
        )
      ) : (
        <SkillList
          skills={skills}
          loading={loading}
          searchLoading={searchLoading}
          error={error}
          searchQuery={searchQuery}
          installedSlugs={installedSlugs}
          onRetry={loadLeaderboard}
          onSkillClick={handleSkillClick}
          onToggleInstall={handleToggleInstall}
        />
      )}
    </div>
  );
}