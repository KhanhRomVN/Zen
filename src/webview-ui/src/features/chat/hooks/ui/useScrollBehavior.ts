import { useState, useEffect, useRef, RefObject, useCallback } from "react";

export const useScrollBehavior = (
  messagesEndRef: RefObject<HTMLDivElement>,
  scrollContainerRef: RefObject<HTMLDivElement>,
  dependencies: any[],
) => {
  const renderCountRef = useRef(0);
  const scrollCallCountRef = useRef(0);
  const userScrollCountRef = useRef(0);

  renderCountRef.current += 1;

  const [isAtBottom, setIsAtBottom] = useState(true);
  const [autoScrollPaused, setAutoScrollPaused] = useState(false);
  const isProgrammaticScrollRef = useRef(false);
  const autoScrollRafRef = useRef<number | null>(null);

  // Auto-scroll to bottom when dependencies change (only if not paused).
  // Use "instant" (not "smooth") during streaming to avoid the jitter/seizure
  // effect caused by rapid successive smooth-scroll calls conflicting with
  // continuously-growing DOM height.
  useEffect(() => {
    if (autoScrollPaused) {
      return;
    }

    // Throttle scroll updates using RAF - only one scroll per animation frame
    if (autoScrollRafRef.current !== null) {
      return; // Already scheduled, skip
    }

    scrollCallCountRef.current += 1;

    autoScrollRafRef.current = requestAnimationFrame(() => {
      autoScrollRafRef.current = null;
      isProgrammaticScrollRef.current = true;
      messagesEndRef.current?.scrollIntoView({ behavior: "instant" });

      // Reset flag after a short delay so user-scroll detection still works
      setTimeout(() => {
        isProgrammaticScrollRef.current = false;
      }, 100);
    });

    // Cleanup: cancel pending scroll on unmount
    return () => {
      if (autoScrollRafRef.current !== null) {
        cancelAnimationFrame(autoScrollRafRef.current);
        autoScrollRafRef.current = null;
      }
    };
  }, dependencies);

  // Detect scroll direction
  useEffect(() => {
    const container = scrollContainerRef.current;

    if (!container) {
      return;
    }

    let lastScrollTop = container.scrollTop;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const atBottom = scrollHeight - scrollTop - clientHeight < 100;
      setIsAtBottom(atBottom);

      // If user scrolled UP (not programmatic), pause auto-scroll
      if (!isProgrammaticScrollRef.current && scrollTop < lastScrollTop) {
        userScrollCountRef.current += 1;
        setAutoScrollPaused(true);
      }

      // If user manually scrolled DOWN back to bottom, resume
      if (atBottom && !isProgrammaticScrollRef.current && scrollTop > lastScrollTop) {
        setAutoScrollPaused(false);
      }

      lastScrollTop = scrollTop;
    };

    container.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      container.removeEventListener("scroll", handleScroll);
    };
  }, [scrollContainerRef]);

  const scrollToBottom = useCallback(() => {
    setAutoScrollPaused(false);
    isProgrammaticScrollRef.current = true;
    // Manual scroll-to-bottom uses smooth for nice UX
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });

    setTimeout(() => {
      isProgrammaticScrollRef.current = false;
    }, 600);
  }, [messagesEndRef]);

  return {
    isAtBottom,
    autoScrollPaused,
    scrollToBottom,
  };
};
