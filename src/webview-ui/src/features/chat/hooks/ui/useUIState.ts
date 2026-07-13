import { useState, useRef } from "react";
import { createLogger } from "../../utils/performanceLogger";

const log = createLogger('useUIState');

/**
 * Hook to manage all UI-related state (modals, dropdowns, search)
 */
export const useUIState = () => {
  const renderCountRef = useRef(0);
  renderCountRef.current += 1;

  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [autoScrollPaused, setAutoScrollPaused] = useState(false);
  const [showProjectStructureDrawer, setShowProjectStructureDrawer] =
    useState(false);
  const [showChangesDropdown, setShowChangesDropdown] = useState(false);
  const [showProjectContextModal, setShowProjectContextModal] = useState(false);
  const [projectContext, setProjectContext] = useState<any>(null);

  log.render('useUIState', {
    renderCount: renderCountRef.current,
    isSearchOpen,
    searchQueryLength: searchQuery.length,
    autoScrollPaused,
    showProjectStructureDrawer,
    showChangesDropdown,
    showProjectContextModal,
    hasProjectContext: !!projectContext
  });

  return {
    // Search
    isSearchOpen,
    setIsSearchOpen,
    searchQuery,
    setSearchQuery,

    // Scroll
    autoScrollPaused,
    setAutoScrollPaused,

    // Modals & Dropdowns
    showProjectStructureDrawer,
    setShowProjectStructureDrawer,
    showChangesDropdown,
    setShowChangesDropdown,
    showProjectContextModal,
    setShowProjectContextModal,

    // Project context
    projectContext,
    setProjectContext,
  };
};
