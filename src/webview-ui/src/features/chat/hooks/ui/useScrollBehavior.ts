import { useState, useEffect, useRef, RefObject, useCallback } from "react";

export const useScrollBehavior = (
  messagesEndRef: RefObject<HTMLDivElement>,
  scrollContainerRef: RefObject<HTMLDivElement>,
  messages: any,
  isProcessing: boolean,
) => {
  const renderCountRef = useRef(0);
  const scrollCallCountRef = useRef(0);
  const userScrollCountRef = useRef(0);
  const prevDepsRef = useRef<{ messagesLength: number; lastMessageId: string; lastContentLength: number; isProcessing: boolean }>({
    messagesLength: 0,
    lastMessageId: '',
    lastContentLength: 0,
    isProcessing: false,
  });

  renderCountRef.current += 1;
  
  console.log('[DEBUG][useScrollBehavior] Render', {
    renderCount: renderCountRef.current,
    timestamp: new Date().toISOString(),
  });

  const [isAtBottom, setIsAtBottom] = useState(true);
  const [autoScrollPaused, setAutoScrollPaused] = useState(false);
  const isProgrammaticScrollRef = useRef(false);
  const autoScrollRafRef = useRef<number | null>(null);

  // Track real changes
  const messagesLength = Array.isArray(messages) ? messages.length : 0;
  const lastMessage = Array.isArray(messages) && messages.length > 0 ? messages[messages.length - 1] : null;
  const lastMessageId = lastMessage?.id || '';
  const lastContentLength = lastMessage?.content?.length || 0;

  const depsChanged = 
    prevDepsRef.current.messagesLength !== messagesLength ||
    prevDepsRef.current.lastMessageId !== lastMessageId ||
    prevDepsRef.current.lastContentLength !== lastContentLength ||
    prevDepsRef.current.isProcessing !== isProcessing;

  // Auto-scroll to bottom when dependencies change (only if not paused).
  // Use "instant" (not "smooth") during streaming to avoid the jitter/seizure
  // effect caused by rapid successive smooth-scroll calls conflicting with
  // continuously-growing DOM height.
  useEffect(() => {
    if (autoScrollPaused) {
      return;
    }

    if (!depsChanged) {
      return; // Skip if nothing changed
    }

    // Update tracked deps
    prevDepsRef.current = {
      messagesLength,
      lastMessageId,
      lastContentLength,
      isProcessing,
    };

    // Throttle scroll updates using RAF - only one scroll per animation frame
    if (autoScrollRafRef.current !== null) {
      return; // Already scheduled, skip
    }

    scrollCallCountRef.current += 1;
    
    console.log('[DEBUG][useScrollBehavior] Auto-scroll triggered', {
      scrollCallCount: scrollCallCountRef.current,
      autoScrollPaused,
      messagesLength,
      lastMessageId,
      isProcessing,
    });

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
  }, [messagesLength, lastMessageId, lastContentLength, isProcessing, autoScrollPaused, depsChanged, messagesEndRef]);

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

      console.log('[DEBUG][useScrollBehavior.handleScroll] Scroll event', {
        scrollTop: scrollTop.toFixed(0),
        atBottom,
        isProgrammatic: isProgrammaticScrollRef.current,
        scrollDirection: scrollTop < lastScrollTop ? 'UP' : 'DOWN'
      });

      // If user scrolled UP (not programmatic), pause auto-scroll
      if (!isProgrammaticScrollRef.current && scrollTop < lastScrollTop) {
        userScrollCountRef.current += 1;
        console.log('[DEBUG][useScrollBehavior.handleScroll] User scrolled UP, pausing auto-scroll', {
          userScrollCount: userScrollCountRef.current
        });
        setAutoScrollPaused(true);
      }

      // If user manually scrolled DOWN back to bottom, resume
      if (atBottom && !isProgrammaticScrollRef.current && scrollTop > lastScrollTop) {
        console.log('[DEBUG][useScrollBehavior.handleScroll] User scrolled to bottom, resuming auto-scroll');
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
