import { useState, useEffect, useRef, RefObject, useCallback } from "react";

export const useScrollBehavior = (
  messagesEndRef: RefObject<HTMLDivElement>,
  dependencies: any[]
) => {
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [autoScrollPaused, setAutoScrollPaused] = useState(false);
  const isProgrammaticScrollRef = useRef(false);
  const autoScrollRafRef = useRef<number | null>(null);

  // Auto-scroll to bottom when dependencies change (only if not paused).
  // Use "instant" (not "smooth") during streaming to avoid the jitter/seizure
  // effect caused by rapid successive smooth-scroll calls conflicting with
  // continuously-growing DOM height.
  useEffect(() => {
    console.log('[Zen][useScrollBehavior] Scroll effect triggered, autoScrollPaused:', autoScrollPaused);
    if (autoScrollPaused) return;

    // Cancel any pending frame to throttle to one scroll per render cycle
    if (autoScrollRafRef.current !== null) {
      cancelAnimationFrame(autoScrollRafRef.current);
    }

    autoScrollRafRef.current = requestAnimationFrame(() => {
      console.log('[Zen][useScrollBehavior] Executing scroll to bottom');
      autoScrollRafRef.current = null;
      isProgrammaticScrollRef.current = true;
      messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
      // Reset flag after a short delay so user-scroll detection still works
      setTimeout(() => { isProgrammaticScrollRef.current = false; }, 100);
    });
  }, dependencies);

  // Detect scroll direction
  useEffect(() => {
    const container = messagesEndRef.current?.parentElement;
    if (!container) return;

    let lastScrollTop = container.scrollTop;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const atBottom = scrollHeight - scrollTop - clientHeight < 100;
      setIsAtBottom(atBottom);

      // If user scrolled UP (not programmatic), pause auto-scroll
      if (!isProgrammaticScrollRef.current && scrollTop < lastScrollTop) {
        setAutoScrollPaused(true);
      }

      // If user manually scrolled back to bottom, resume
      if (atBottom) {
        setAutoScrollPaused(false);
      }

      lastScrollTop = scrollTop;
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [messagesEndRef]);

  const scrollToBottom = useCallback(() => {
    setAutoScrollPaused(false);
    isProgrammaticScrollRef.current = true;
    // Manual scroll-to-bottom uses smooth for nice UX
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setTimeout(() => { isProgrammaticScrollRef.current = false; }, 600);
  }, [messagesEndRef]);

  return {
    isAtBottom,
    autoScrollPaused,
    scrollToBottom,
  };
};
