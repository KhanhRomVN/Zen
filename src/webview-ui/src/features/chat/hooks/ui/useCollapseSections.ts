import { useState, useCallback, useRef } from "react";

export const useCollapseSections = () => {
  const renderCountRef = useRef(0);
  const toggleCountRef = useRef(0);

  renderCountRef.current += 1;

  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    new Set(),
  );

  const toggleCollapse = useCallback((sectionId: string) => {
    toggleCountRef.current += 1;

    setCollapsedSections((prev) => {
      const newSet = new Set(prev);
      const wasCollapsed = newSet.has(sectionId);

      if (wasCollapsed) {
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
