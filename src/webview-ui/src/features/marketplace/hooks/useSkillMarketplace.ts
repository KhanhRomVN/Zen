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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  fetchLeaderboard,
  searchSkills,
  fetchSkillDetail,
  getCachedLeaderboard,
  getCachedSearch,
  getCachedSkillDetail,
  isCacheFresh,
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
  const [skills, setSkills] = useState<SkillSummary[]>(
    () => getCachedLeaderboard()?.data ?? [],
  );
  const [loading, setLoading] = useState(() => !getCachedLeaderboard());
  const activeSlugRef = useRef<string | null>(null);
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
    const cached = getCachedLeaderboard();
    setError(null);
    if (cached) {
      setSkills(cached.data);
      setLoading(false);
      if (isCacheFresh(cached)) return;
    } else {
      setLoading(true);
    }
    try {
      const data = await fetchLeaderboard();
      setSkills(data);
    } catch (err: any) {
      if (!cached) setError(err.message || "Failed to load skills");
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
    const query = searchQuery.trim();
    if (!query) return;
    const cached = getCachedSearch(query);
    if (cached) {
      setSkills(cached.data.skills);
      setError(null);
      if (isCacheFresh(cached)) return;
    }
    const timer = setTimeout(
      async () => {
        if (!cached) setSearchLoading(true);
        setError(null);
        try {
          const result = await searchSkills(query);
          setSkills(result.skills);
        } catch (err: any) {
          if (!cached) setError(err.message || "Search failed");
        } finally {
          setSearchLoading(false);
        }
      },
      cached ? 0 : SEARCH_DEBOUNCE_MS,
    );
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleBack = useCallback(() => {
    activeSlugRef.current = null;
    setSelectedSkill(null);
    setDetailError(null);
    setDetailLoading(false);
  }, []);

  const handleSkillClick = useCallback(async (skill: SkillSummary) => {
    activeSlugRef.current = skill.slug;
    const cached = getCachedSkillDetail(skill.slug);
    setDetailError(null);
    if (cached) {
      setSelectedSkill(cached.data);
      setDetailLoading(false);
      if (isCacheFresh(cached)) return;
    } else {
      setSelectedSkill(null);
      setDetailLoading(true);
    }
    try {
      const detail = await fetchSkillDetail(skill.slug);
      if (activeSlugRef.current === skill.slug) setSelectedSkill(detail);
    } catch (err: any) {
      if (!cached && activeSlugRef.current === skill.slug) {
        setDetailError(err.message || "Failed to load skill detail");
      }
    } finally {
      if (activeSlugRef.current === skill.slug) setDetailLoading(false);
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