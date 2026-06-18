import { useState, useCallback } from "react";

export const useCollapseSections = () => {
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    new Set()
  );

  const toggleCollapse = useCallback((sectionId: string) => {
    setCollapsedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(sectionId)) {
        newSet.delete(sectionId);
      } else {
        newSet.add(sectionId);
      }
      return newSet;
    });
  }, []);

  const setInitiallyCollapsed = useCallback((sections: string[]) => {
    setCollapsedSections((prev) => {
      const newSet = new Set(prev);
      sections.forEach((section) => newSet.add(section));
      return newSet;
    });
  }, []);

  return {
    collapsedSections,
    setCollapsedSections,
    toggleCollapse,
    setInitiallyCollapsed,
  };
};
