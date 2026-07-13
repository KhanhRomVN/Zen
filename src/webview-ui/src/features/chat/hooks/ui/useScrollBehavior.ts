import { useState, useEffect, useRef, RefObject, useCallback } from "react";
import { createLogger } from "../../utils/performanceLogger";

const log = createLogger('useScrollBehavior');

export const useScrollBehavior = (
  messagesEndRef: RefObject<HTMLDivElement>,
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

  log.render('useScrollBehavior', {
    renderCount: renderCountRef.current,
    isAtBottom,
    autoScrollPaused,
    depsLength: dependencies.length
  });

  // Auto-scroll to bottom when dependencies change (only if not paused).
  // Use "instant" (not "smooth") during streaming to avoid the jitter/seizure
  // effect caused by rapid successive smooth-scroll calls conflicting with
  // continuously-growing DOM height.
  useEffect(() => {
    if (autoScrollPaused) {
      log.state('autoScroll_skip', { reason: 'paused' });
      return;
    }

    // Throttle scroll updates using RAF - only one scroll per animation frame
    if (autoScrollRafRef.current !== null) {
      log.state('autoScroll_skip', { reason: 'already_scheduled' });
      return; // Already scheduled, skip
    }

    scrollCallCountRef.current += 1;

    autoScrollRafRef.current = requestAnimationFrame(() => {
      const scrollStartTime = performance.now();
      
      log.state('autoScroll_execute', { scrollCount: scrollCallCountRef.current });
      
      autoScrollRafRef.current = null;
      isProgrammaticScrollRef.current = true;
      messagesEndRef.current?.scrollIntoView({ behavior: "instant" });
      
      log.perf('scrollIntoView', scrollStartTime, { behavior: 'instant' });
      
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
        log.state('autoScroll_cleanup', {});
      }
    };
  }, dependencies);

  // Detect scroll direction
  useEffect(() => {
    const setupStartTime = performance.now();
    const container = messagesEndRef.current?.parentElement;
    
    if (!container) {
      log.state('scrollDetection_skip', { reason: 'no_container' });
      return;
    }

    let lastScrollTop = container.scrollTop;
    let scrollEventCount = 0;

    const handleScroll = () => {
      const eventStartTime = performance.now();
      scrollEventCount += 1;
      
      const { scrollTop, scrollHeight, clientHeight } = container;
      const atBottom = scrollHeight - scrollTop - clientHeight < 100;
      setIsAtBottom(atBottom);

      // If user scrolled UP (not programmatic), pause auto-scroll
      if (!isProgrammaticScrollRef.current && scrollTop < lastScrollTop) {
        userScrollCountRef.current += 1;
        log.state('user_scroll_up', {
          userScrollCount: userScrollCountRef.current,
          scrollTop,
          lastScrollTop
        });
        setAutoScrollPaused(true);
      }

      // If user manually scrolled back to bottom, resume
      if (atBottom) {
        log.state('scroll_at_bottom', { autoScrollPaused });
        setAutoScrollPaused(false);
      }

      lastScrollTop = scrollTop;
      
      log.perf('handleScroll_event', eventStartTime, {
        scrollEventCount,
        atBottom,
        autoScrollPaused
      });
    };

    container.addEventListener("scroll", handleScroll, { passive: true });
    
    log.perf('scrollDetection_setup', setupStartTime, {});
    
    return () => {
      log.state('scrollDetection_cleanup', { scrollEventCount });
      container.removeEventListener("scroll", handleScroll);
    };
  }, [messagesEndRef]);

  const scrollToBottom = useCallback(() => {
    const callStartTime = performance.now();
    
    log.state('scrollToBottom_manual', {});
    
    setAutoScrollPaused(false);
    isProgrammaticScrollRef.current = true;
    // Manual scroll-to-bottom uses smooth for nice UX
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    
    log.perf('scrollToBottom_complete', callStartTime, { behavior: 'smooth' });
    
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
