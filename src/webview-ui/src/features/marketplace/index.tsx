/**
 * ------------------------------------------------------------------
 * MarketplacePanel
 * ------------------------------------------------------------------
 * Marketplace với 2 tab: SKILL, MCP. Bao gồm luôn SkillPanel
 * (SKILL tab), SkillSearchBar và SkillGroupDrawer để tránh vòng import.
 * Shared state UIs nằm ở ./components/shared/StateViews.
 * ------------------------------------------------------------------
 */

import React, { useState } from "react";
import { List, Package, Search, FolderPlus } from "lucide-react";
import { useSkillMarketplace } from "./hooks/useSkillMarketplace";
import {
  useSkillWorkspaceState,
  DEFAULT_GROUP_NAME,
} from "./hooks/useSkillWorkspaceState";
import { SkillList, SkillListSkeleton } from "./components/Skill/SkillList";
import {
  SkillDetail,
  SkillDetailSkeleton,
} from "./components/Skill/SkillDetail";
import { ManagerSkillView } from "./components/Skill/ManagerSkill";
import { MCPPanel } from "./components/MCPPanel";
import { ErrorState } from "./components/shared/StateViews";
import {
  SkillGroupDrawer,
  type DrawerGroup,
} from "./components/shared/SkillGroupDrawer";
import type { SkillSummary } from "./types/skill.types";

/* ==================================================================
 * SkillSearchBar — thanh tìm kiếm skill (style đồng bộ với searchbar
 * trong account panel).
 * ================================================================== */

interface SkillSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onClear: () => void;
  /** Nội dung bên phải searchbar — thường là các button action. */
  rightSlot?: React.ReactNode;
}

/**
 * Thanh tìm kiếm skill — style đồng bộ với searchbar trong account panel
 * (background var(--input-bg), height 34px, border-radius 8px, icon trái).
 */
function SkillSearchBar({
  value,
  onChange,
  onClear,
  rightSlot,
}: SkillSearchBarProps) {
  return (
    <div style={{ padding: "12px 16px 12px", flexShrink: 0 }}>
      <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
        <div style={{ position: "relative", flex: 1 }}>
          <input
            type="text"
            placeholder="Search skills..."
            value={value}
            onChange={(e) => onChange(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 32px 8px 32px",
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
          <Search
            style={{
              width: "14px",
              height: "14px",
              position: "absolute",
              left: "10px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "var(--secondary-text)",
              pointerEvents: "none",
            }}
          />
          {value && (
            <button
              type="button"
              onClick={onClear}
              title="Clear search"
              style={{
                position: "absolute",
                right: "8px",
                top: "50%",
                transform: "translateY(-50%)",
                padding: "2px",
                border: "none",
                backgroundColor: "transparent",
                color: "var(--secondary-text)",
                cursor: "pointer",
                fontSize: "14px",
                display: "flex",
                alignItems: "center",
                lineHeight: 1,
              }}
            >
              ×
            </button>
          )}
        </div>
        {rightSlot}
      </div>
    </div>
  );
}

/* ==================================================================
 * SkillPanel — entry của SKILL tab. Workspace state (groups/toggles)
 * được lift lên đây để chia sẻ giữa ManagerSkillView và SkillGroupDrawer.
 * ================================================================== */

type SkillViewMode = "list" | "manager";

const iconButtonStyle: React.CSSProperties = {
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
};

/**
 * Entry của SKILL tab — quản lý view switch giữa list-skill-view (Browse)
 * và manager-skill-view (Installed), cùng state từ useSkillMarketplace
 * và useSkillWorkspaceState.
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
    handleInstall,
    handleUninstall,
    handleToggleInstall,
  } = useSkillMarketplace();

  const workspaceState = useSkillWorkspaceState();

  const [viewMode, setViewMode] = useState<SkillViewMode>("list");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pendingInstallSkill, setPendingInstallSkill] =
    useState<SkillSummary | null>(null);

  const openInstallDrawer = (skill: SkillSummary) => {
    setPendingInstallSkill(skill);
    setDrawerOpen(true);
  };

  const openGroupManagerDrawer = () => {
    setPendingInstallSkill(null);
    setDrawerOpen(true);
  };

  const handleConfirmInstall = async (groupName: string) => {
    if (!pendingInstallSkill) return;
    await handleInstall(pendingInstallSkill);
    if (groupName !== DEFAULT_GROUP_NAME && pendingInstallSkill.slug) {
      workspaceState.assignSkillToGroup(pendingInstallSkill.slug, groupName);
    }
    setDrawerOpen(false);
    setPendingInstallSkill(null);
  };

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

  // Drawer group list — "Others" ở đầu (group mặc định), kèm count + tên skill.
  const installedSlugSet = new Set(installedSkills.map((s) => s.slug));
  const slugToName = new Map<string, string>();
  for (const s of installedSkills) {
    if (s.slug) slugToName.set(s.slug, s.name || s.slug);
  }
  const assignedSlugs = new Set(
    workspaceState.state.groups.flatMap((g) => g.slugs),
  );
  const drawerGroups: DrawerGroup[] = [
    {
      name: DEFAULT_GROUP_NAME,
      count: installedSkills.filter((s) => !s.slug || !assignedSlugs.has(s.slug))
        .length,
      skillNames: installedSkills
        .filter((s) => !s.slug || !assignedSlugs.has(s.slug))
        .map((s) => s.name || s.slug || "")
        .filter(Boolean),
    },
    ...workspaceState.state.groups.map((g) => {
      const names = g.slugs
        .filter((slug) => installedSlugSet.has(slug))
        .map((slug) => slugToName.get(slug) || slug);
      return {
        name: g.name,
        count: names.length,
        skillNames: names,
        icon: g.icon,
      };
    }),
  ];

  const rightSlot = (
    <>
      {isManager && (
        <button
          type="button"
          onClick={openGroupManagerDrawer}
          title="Manage groups"
          style={iconButtonStyle}
        >
          <FolderPlus size={16} />
        </button>
      )}
      <button
        type="button"
        onClick={() => setViewMode(isManager ? "list" : "manager")}
        title={isManager ? "Switch to Browse" : "Switch to Installed"}
        style={iconButtonStyle}
      >
        {isManager ? <List size={16} /> : <Package size={16} />}
      </button>
    </>
  );

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <SkillSearchBar
        value={searchQuery}
        onChange={setSearchQuery}
        onClear={handleClearSearch}
        rightSlot={rightSlot}
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
            workspaceState={workspaceState}
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
          onInstallClick={openInstallDrawer}
          onUninstall={(skill) => handleUninstall(skill.slug)}
        />
      )}

      <SkillGroupDrawer
        isOpen={drawerOpen}
        skill={pendingInstallSkill}
        groups={drawerGroups}
        onClose={() => {
          setDrawerOpen(false);
          setPendingInstallSkill(null);
        }}
        onConfirmInstall={handleConfirmInstall}
        onCreateGroup={workspaceState.addGroup}
        onRenameGroup={workspaceState.renameGroup}
        onDeleteGroup={(name) => workspaceState.removeGroup(name)}
      />
    </div>
  );
}

/* ==================================================================
 * MarketplacePanel — panel chính với 2 tab SKILL / MCP.
 * ================================================================== */

interface MarketplacePanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const MarketplacePanel: React.FC<MarketplacePanelProps> = ({
  isOpen,
  onClose,
}) => {
  const [closeHover, setCloseHover] = useState(false);
  const [activeTab, setActiveTab] = useState("SKILL");

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "var(--secondary-bg)",
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "16px 16px 7px",
          borderTop: "1px solid var(--border-color)",
          flexShrink: 0,
          backgroundColor: "var(--tertiary-bg)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div>
              <div style={{ marginBottom: "3px" }}>
                <span
                  style={{
                    fontWeight: 700,
                    fontSize: "16px",
                    color: "var(--primary-text)",
                    letterSpacing: "0.01em",
                  }}
                >
                  Marketplace
                </span>
              </div>
              <p
                style={{
                  margin: 0,
                  fontSize: "13px",
                  color: "var(--secondary-text)",
                  opacity: 0.7,
                  lineHeight: 1.4,
                }}
              >
                Install skills and MCP servers
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            onMouseEnter={() => setCloseHover(true)}
            onMouseLeave={() => setCloseHover(false)}
            style={{
              padding: "5px",
              borderRadius: "6px",
              flexShrink: 0,
              backgroundColor: closeHover
                ? "var(--vscode-inputValidation-errorBackground, rgba(239,68,68,0.12))"
                : "rgba(128,128,128,0.1)",
              border: "none",
              color: closeHover
                ? "var(--vscode-errorForeground)"
                : "var(--secondary-text)",
              cursor: "pointer",
              transition: "all 0.15s ease",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
            title="Close Marketplace"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Tabbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "4px",
          padding: "0 16px",
          borderBottom: "1px solid var(--border-color)",
          backgroundColor: "var(--tertiary-bg)",
          flexShrink: 0,
        }}
      >
        {["SKILL", "MCP"].map((tab) => (
          <span
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "10px 12px",
              fontSize: "13px",
              fontWeight: activeTab === tab ? 600 : 400,
              color:
                activeTab === tab
                  ? "var(--primary-text)"
                  : "var(--secondary-text)",
              cursor: "pointer",
              borderBottom:
                activeTab === tab
                  ? "2px solid var(--vscode-focusBorder, #007acc)"
                  : "2px solid transparent",
              transition: "all 0.15s ease",
              userSelect: "none",
            }}
          >
            {tab}
          </span>
        ))}
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {activeTab === "SKILL" && <SkillPanel />}
        {activeTab === "MCP" && <MCPPanel />}
      </div>
    </div>
  );
};

export default MarketplacePanel;

/* Re-export state UIs để code cũ import từ "./index" vẫn hoạt động. */
export {
  SkeletonLine,
  ErrorState,
  EmptyState,
  EmptyInstalledState,
  NoResultsState,
} from "./components/shared/StateViews";