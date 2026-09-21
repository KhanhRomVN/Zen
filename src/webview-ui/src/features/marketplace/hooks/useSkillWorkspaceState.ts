import { useCallback, useEffect, useRef, useState } from "react";
import {
  loadSkillWorkspaceState,
  saveSkillWorkspaceState,
  DEFAULT_SKILL_WORKSPACE_STATE,
  type SkillWorkspaceState,
} from "../services/skillWorkspaceState.service";

/** Tên group mặc định cho skill không thuộc group nào. */
export const DEFAULT_GROUP_NAME = "Others";

export interface UseSkillWorkspaceStateResult {
  state: SkillWorkspaceState;
  loading: boolean;
  setSkillEnabled: (slug: string, enabled: boolean) => void;
  toggleSkillEnabled: (slug: string) => void;
  addGroup: (name: string, icon?: string) => void;
  renameGroup: (oldName: string, newName: string) => void;
  removeGroup: (
    name: string,
    options?: { deleteSlugs?: string[]; moveTo?: string },
  ) => void;
  assignSkillToGroup: (slug: string, groupName: string) => void;
  toggleGroupCollapsed: (name: string) => void;
}

/** Chuẩn hoá tên để so sánh group (case-insensitive, trim). */
export function normalizeGroupName(name: string): string {
  return name.trim().toLowerCase();
}

/** Kiểm tra tên group có bị cấm (trùng "Other"). */
export function isReservedGroupName(name: string): boolean {
  return normalizeGroupName(name) === normalizeGroupName(DEFAULT_GROUP_NAME);
}

export function useSkillWorkspaceState(): UseSkillWorkspaceStateResult {
  const [state, setState] = useState<SkillWorkspaceState>(
    DEFAULT_SKILL_WORKSPACE_STATE,
  );
  const [loading, setLoading] = useState(true);
  const initialLoadDone = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const loaded = await loadSkillWorkspaceState();
        if (!cancelled) setState(loaded);
      } catch (err: any) {
        console.error("[useSkillWorkspaceState] load error:", err.message);
      } finally {
        if (!cancelled) {
          setLoading(false);
          initialLoadDone.current = true;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!initialLoadDone.current) return;
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      saveSkillWorkspaceState(state).catch((err: any) =>
        console.error("[useSkillWorkspaceState] save error:", err.message),
      );
    }, 300);
    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state]);

  const setSkillEnabled = useCallback((slug: string, enabled: boolean) => {
    setState((prev) => ({
      ...prev,
      toggles: { ...prev.toggles, [slug]: enabled },
    }));
  }, []);

  const toggleSkillEnabled = useCallback((slug: string) => {
    setState((prev) => ({
      ...prev,
      toggles: { ...prev.toggles, [slug]: !prev.toggles[slug] },
    }));
  }, []);

  const addGroup = useCallback((name: string, icon?: string) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setState((prev) => {
      const exists = prev.groups.some(
        (g) => normalizeGroupName(g.name) === normalizeGroupName(trimmed),
      );
      if (exists) return prev;
      return {
        ...prev,
        groups: [...prev.groups, { name: trimmed, slugs: [], icon }],
      };
    });
  }, []);

  const renameGroup = useCallback((oldName: string, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setState((prev) => {
      const oldKey = normalizeGroupName(oldName);
      const newKey = normalizeGroupName(trimmed);
      const dup = prev.groups.some(
        (g) => normalizeGroupName(g.name) === newKey && oldKey !== newKey,
      );
      if (dup) return prev;

      const groups = prev.groups.map((g) =>
        normalizeGroupName(g.name) === oldKey ? { ...g, name: trimmed } : g,
      );

      const collapsedGroups: Record<string, boolean> = {};
      for (const [k, v] of Object.entries(prev.collapsedGroups)) {
        collapsedGroups[normalizeGroupName(k) === oldKey ? newKey : k] = v;
      }

      return { ...prev, groups, collapsedGroups };
    });
  }, []);

  const removeGroup = useCallback(
    (name: string, options?: { deleteSlugs?: string[]; moveTo?: string }) => {
      setState((prev) => {
        const key = normalizeGroupName(name);
        const target = prev.groups.find(
          (g) => normalizeGroupName(g.name) === key,
        );
        if (!target) return prev;

        const deleteSet = new Set(options?.deleteSlugs ?? []);
        const remainingSlugs = target.slugs.filter((s) => !deleteSet.has(s));
        const moveTo = options?.moveTo;

        const groups = prev.groups
          .map((g) => {
            if (normalizeGroupName(g.name) === key) return null;
            if (
              moveTo &&
              normalizeGroupName(g.name) === normalizeGroupName(moveTo)
            ) {
              return { ...g, slugs: [...g.slugs, ...remainingSlugs] };
            }
            return g;
          })
          .filter((g): g is { name: string; slugs: string[] } => g !== null);

        const collapsedGroups = { ...prev.collapsedGroups };
        delete collapsedGroups[key];

        return { ...prev, groups, collapsedGroups };
      });
    },
    [],
  );

  const assignSkillToGroup = useCallback((slug: string, groupName: string) => {
    setState((prev) => {
      const targetKey = normalizeGroupName(groupName);
      const isOther = targetKey === normalizeGroupName(DEFAULT_GROUP_NAME);

      let groups = prev.groups.map((g) => ({
        ...g,
        slugs: g.slugs.filter((s) => s !== slug),
      }));

      if (!isOther) {
        const idx = groups.findIndex(
          (g) => normalizeGroupName(g.name) === targetKey,
        );
        if (idx >= 0) {
          groups = groups.map((g, i) =>
            i === idx ? { ...g, slugs: [...g.slugs, slug] } : g,
          );
        } else {
          groups = [...groups, { name: groupName, slugs: [slug] }];
        }
      }

      return { ...prev, groups };
    });
  }, []);

  const toggleGroupCollapsed = useCallback((name: string) => {
    setState((prev) => {
      const key = normalizeGroupName(name);
      return {
        ...prev,
        collapsedGroups: {
          ...prev.collapsedGroups,
          [key]: !prev.collapsedGroups[key],
        },
      };
    });
  }, []);

  return {
    state,
    loading,
    setSkillEnabled,
    toggleSkillEnabled,
    addGroup,
    renameGroup,
    removeGroup,
    assignSkillToGroup,
    toggleGroupCollapsed,
  };
}