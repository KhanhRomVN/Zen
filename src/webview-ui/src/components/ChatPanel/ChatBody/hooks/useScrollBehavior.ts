import { useState, useEffect, RefObject } from "react";

export const useScrollBehavior = (
  messagesEndRef: RefObject<HTMLDivElement>,
  dependencies: any[]
) => {
  const [isAtBottom, setIsAtBottom] = useState(true);

  // Auto-scroll to bottom when dependencies change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, dependencies);

  // Detect if user has scrolled up
  useEffect(() => {
    const container = messagesEndRef.current?.parentElement;
    if (!container) return;

    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const atBottom = scrollHeight - scrollTop - clientHeight < 100;
      setIsAtBottom(atBottom);
    };

    container.addEventListener("scroll", handleScroll);
    return () => container.removeEventListener("scroll", handleScroll);
  }, [messagesEndRef]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  return {
    isAtBottom,
    scrollToBottom,
  };
};
