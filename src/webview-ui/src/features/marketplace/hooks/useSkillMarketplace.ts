/**
 * ------------------------------------------------------------------
 * useSkillMarketplace
 * ------------------------------------------------------------------
 * Hook quản lý state cho Skill marketplace: leaderboard, search, detail,
 * và danh sách skill đã cài (installed).
 *
 * Trách nhiệm:
 * - Load leaderboard + danh sách installed khi mount
 * - Debounce search khi searchQuery thay đổi
 * - Load detail khi user click vào 1 skill
 * - Install / uninstall skill (cập nhật state local + đĩa)
 * ------------------------------------------------------------------
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  fetchLeaderboard,
  searchSkills,
  fetchSkillDetail,
} from "../services/skill.service";
import {
  listInstalledSkills,
  installSkill,
  uninstallSkill,
  type InstalledSkill,
} from "../services/skillInstall.service";
import type { SkillSummary, SkillDetail } from "../types/skill.types";

const SEARCH_DEBOUNCE_MS = 400;

export interface UseSkillMarketplaceResult {
  skills: SkillSummary[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  searchLoading: boolean;
  selectedSkill: SkillDetail | null;
  detailLoading: boolean;
  detailError: string | null;
  /** Danh sách skill đã cài (từ ~/.khanhromvn-zen/skills) */
  installedSkills: InstalledSkill[];
  /** Set slug đã cài — tiện check nhanh `installedSlugs.has(slug)` */
  installedSlugs: Set<string>;
  /** Đang tải danh sách installed lần đầu */
  installedLoading: boolean;
  loadLeaderboard: () => Promise<void>;
  reloadInstalled: () => Promise<void>;
  handleSkillClick: (skill: SkillSummary) => Promise<void>;
  handleBack: () => void;
  handleClearSearch: () => void;
  handleInstall: (skill: SkillSummary | SkillDetail) => Promise<void>;
  handleUninstall: (slug: string) => Promise<void>;
  handleToggleInstall: (skill: SkillSummary | SkillDetail) => Promise<void>;
}

export function useSkillMarketplace(): UseSkillMarketplaceResult {
  const [skills, setSkills] = useState<SkillSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedSkill, setSelectedSkill] = useState<SkillDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [installedSkills, setInstalledSkills] = useState<InstalledSkill[]>([]);
  const [installedLoading, setInstalledLoading] = useState(true);

  const installedSlugs = useMemo(
    () =>
      new Set(
        installedSkills
          .map((s) => s.slug)
          .filter((s): s is string => typeof s === "string"),
      ),
    [installedSkills],
  );

  const loadLeaderboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchLeaderboard();
      setSkills(data);
    } catch (err: any) {
      setError(err.message || "Failed to load skills");
    } finally {
      setLoading(false);
    }
  }, []);

  const reloadInstalled = useCallback(async () => {
    setInstalledLoading(true);
    try {
      const list = await listInstalledSkills();
      setInstalledSkills(list);
    } catch (err: any) {
      console.error("[useSkillMarketplace] load installed error:", err.message);
    } finally {
      setInstalledLoading(false);
    }
  }, []);

  useEffect(() => {
    loadLeaderboard();
    reloadInstalled();
  }, [loadLeaderboard, reloadInstalled]);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!searchQuery.trim()) return;
      setSearchLoading(true);
      setError(null);
      try {
        const result = await searchSkills(searchQuery.trim());
        setSkills(result.skills);
      } catch (err: any) {
        setError(err.message || "Search failed");
      } finally {
        setSearchLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleBack = useCallback(() => {
    setSelectedSkill(null);
    setDetailError(null);
  }, []);

  const handleSkillClick = useCallback(async (skill: SkillSummary) => {
    setDetailLoading(true);
    setDetailError(null);
    setSelectedSkill(null);
    try {
      const detail = await fetchSkillDetail(skill.slug);
      setSelectedSkill(detail);
    } catch (err: any) {
      setDetailError(err.message || "Failed to load skill detail");
    } finally {
      setDetailLoading(false);
    }
  }, []);

  const handleClearSearch = useCallback(() => {
    setSearchQuery("");
    loadLeaderboard();
  }, [loadLeaderboard]);

  const handleInstall = useCallback(
    async (skill: SkillSummary | SkillDetail) => {
      try {
        await installSkill(skill);
        await reloadInstalled();
      } catch (err: any) {
        console.error("[useSkillMarketplace] install error:", err.message);
      }
    },
    [reloadInstalled],
  );

  const handleUninstall = useCallback(
    async (slug: string) => {
      try {
        await uninstallSkill(slug);
        await reloadInstalled();
      } catch (err: any) {
        console.error("[useSkillMarketplace] uninstall error:", err.message);
      }
    },
    [reloadInstalled],
  );

  const handleToggleInstall = useCallback(
    async (skill: SkillSummary | SkillDetail) => {
      const slug = skill.slug;
      if (!slug) return;
      if (installedSlugs.has(slug)) {
        await handleUninstall(slug);
      } else {
        await handleInstall(skill);
      }
    },
    [installedSlugs, handleInstall, handleUninstall],
  );

  return {
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
    reloadInstalled,
    handleSkillClick,
    handleBack,
    handleClearSearch,
    handleInstall,
    handleUninstall,
    handleToggleInstall,
  };
}