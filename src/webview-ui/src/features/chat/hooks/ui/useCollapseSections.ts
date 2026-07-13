import { useState, useCallback, useRef } from "react";
import { createLogger } from "../../utils/performanceLogger";

const log = createLogger('useCollapseSections');

export const useCollapseSections = () => {
  const renderCountRef = useRef(0);
  const toggleCountRef = useRef(0);
  
  renderCountRef.current += 1;

  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(
    new Set()
  );

  log.render('useCollapseSections', {
    renderCount: renderCountRef.current,
    collapsedCount: collapsedSections.size
  });

  const toggleCollapse = useCallback((sectionId: string) => {
    toggleCountRef.current += 1;
    
    log.state('toggle_collapse', {
      toggleCount: toggleCountRef.current,
      sectionId
    });
    
    setCollapsedSections((prev) => {
      const newSet = new Set(prev);
      const wasCollapsed = newSet.has(sectionId);
      
      if (wasCollapsed) {
        newSet.delete(sectionId);
        log.state('section_expanded', { sectionId });
      } else {
        newSet.add(sectionId);
        log.state('section_collapsed', { sectionId });
      }
      
      return newSet;
    });
  }, []);

  const setInitiallyCollapsed = useCallback((sections: string[]) => {
    log.state('set_initially_collapsed', {
      sectionsCount: sections.length,
      sections
    });
    
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
