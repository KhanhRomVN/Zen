import { useState, useEffect, useRef, RefObject } from "react";

export const useScrollBehavior = (
  messagesEndRef: RefObject<HTMLDivElement>,
  dependencies: any[]
) => {
  const [isAtBottom, setIsAtBottom] = useState(true);
  const [autoScrollPaused, setAutoScrollPaused] = useState(false);
  const isProgrammaticScrollRef = useRef(false);

  // Auto-scroll to bottom when dependencies change (only if not paused)
  useEffect(() => {
    if (autoScrollPaused) return;
    isProgrammaticScrollRef.current = true;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setTimeout(() => { isProgrammaticScrollRef.current = false; }, 600);
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

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [messagesEndRef]);

  const scrollToBottom = () => {
    setAutoScrollPaused(false);
    isProgrammaticScrollRef.current = true;
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    setTimeout(() => { isProgrammaticScrollRef.current = false; }, 600);
  };

  return {
    isAtBottom,
    autoScrollPaused,
    scrollToBottom,
  };
};
