import React, { useRef, useEffect, useState } from "react";
import "./ThinkingBlock.css";

interface ThinkingBlockProps {
  content: string;
  maxHeight?: number | string;
  isStreaming?: boolean;
  isClosed?: boolean;
  /** Elapsed thinking time in seconds (shown in header when done) */
  elapsedSeconds?: number;
  blockKey?: string;
}

// Small brain icon matching Zen style
const BrainIcon: React.FC = () => (
  <svg
    className="thinking-icon"
    xmlns="http://www.w3.org/2000/svg"
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="1.75"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 5a3 3 0 1 0-5.997.125 4 4 0 0 0-2.526 5.77 4 4 0 0 0 .556 6.588A4 4 0 1 0 12 18Z" />
    <path d="M12 5a3 3 0 1 1 5.997.125 4 4 0 0 1 2.526 5.77 4 4 0 0 1-.556 6.588A4 4 0 1 1 12 18Z" />
    <path d="M15 13a4.5 4.5 0 0 1-3-4 4.5 4.5 0 0 1-3 4" />
    <path d="M17.599 6.5a3 3 0 0 0 .399-1.375" />
    <path d="M6.003 5.125A3 3 0 0 0 6.401 6.5" />
    <path d="M3.477 10.896a4 4 0 0 1 .585-.396" />
    <path d="M19.938 10.5a4 4 0 0 1 .585.396" />
    <path d="M6 18a4 4 0 0 1-1.967-.516" />
    <path d="M19.967 17.484A4 4 0 0 1 18 18" />
  </svg>
);

const ChevronIcon: React.FC = () => (
  <svg
    className="thinking-chevron"
    xmlns="http://www.w3.org/2000/svg"
    width="12"
    height="12"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9 18l6-6-6-6" />
  </svg>
);

// Module-level cache to persist recorded durations across re-renders/collapses
const durationCache = new Map<string, number>();

/**
 * ThinkingBlock — Collapsible block for AI reasoning/thinking content.
 *
 * Behaviour (mirrors UI_demo.html):
 *  - While actively streaming thinking (isStreaming=true && !isClosed):
 *      header shows "Thinking" + blinking dots + live elapsed timer
 *      block auto-opens; content auto-scrolls to bottom
 *  - After thinking done (isClosed=true || isStreaming=false):
 *      header shows "Thought for Xs" (never 0s; live recorded or realistic estimate)
 *      block auto-collapses after 800 ms
 *  - User can always click header to manually expand/collapse
 */
export const ThinkingBlock: React.FC<ThinkingBlockProps> = ({
  content,
  maxHeight,
  isStreaming = false,
  isClosed = true,
  elapsedSeconds,
  blockKey,
}) => {
  const contentRef = useRef<HTMLDivElement>(null);

  // Active streaming occurs while the message is being generated AND this thinking tag has not closed yet
  const isActivelyThinking = isStreaming && !isClosed;

  // Key to store and retrieve recorded thinking duration
  const effectiveKey =
    blockKey ||
    (content ? `content-${content.slice(0, 40).replace(/\s+/g, "_")}` : undefined);

  // Calculate elapsed time (ensures never 0s for finished thoughts)
  const getInitialElapsed = (): number => {
    if (elapsedSeconds !== undefined && elapsedSeconds > 0) return elapsedSeconds;
    if (effectiveKey && durationCache.has(effectiveKey)) {
      return durationCache.get(effectiveKey)!;
    }
    // Realistic fallback based on content length (~150 characters per second)
    if (content && content.length > 0) {
      return Math.max(1, Math.round(content.length / 150));
    }
    return 1;
  };

  const [isOpen, setIsOpen] = useState(isActivelyThinking);
  const [elapsedSecs, setElapsedSecs] = useState<number>(getInitialElapsed);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const collapseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasAutoCollapsedRef = useRef(false);

  // ── Live timer while actively thinking ─────────────────────────────────────
  useEffect(() => {
    if (isActivelyThinking) {
      hasAutoCollapsedRef.current = false;
      setIsOpen(true); // auto-open when thinking begins

      if (!startTimeRef.current) {
        startTimeRef.current = Date.now();
      }

      // Live interval timer updates every second
      timerRef.current = setInterval(() => {
        if (startTimeRef.current) {
          const currentSecs = Math.max(
            1,
            Math.floor((Date.now() - startTimeRef.current) / 1000),
          );
          setElapsedSecs(currentSecs);
          if (effectiveKey) {
            durationCache.set(effectiveKey, currentSecs);
          }
        }
      }, 1000);
    } else {
      // Done streaming thinking
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }

      if (startTimeRef.current) {
        // Just transitioned from active thinking to finished
        const finalSecs = Math.max(
          1,
          Math.floor((Date.now() - startTimeRef.current) / 1000),
        );
        setElapsedSecs(finalSecs);
        if (effectiveKey) {
          durationCache.set(effectiveKey, finalSecs);
        }
        startTimeRef.current = null;

        // Auto-collapse after 800ms per UI_demo.html
        if (!hasAutoCollapsedRef.current) {
          collapseTimeoutRef.current = setTimeout(() => {
            setIsOpen(false);
            hasAutoCollapsedRef.current = true;
          }, 800);
        }
      } else {
        // Mounted as finished (historical message or reloaded)
        const cachedOrEstimated = getInitialElapsed();
        setElapsedSecs(cachedOrEstimated);
        if (effectiveKey && !durationCache.has(effectiveKey)) {
          durationCache.set(effectiveKey, cachedOrEstimated);
        }
      }
    }

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (collapseTimeoutRef.current) clearTimeout(collapseTimeoutRef.current);
    };
  }, [isActivelyThinking, effectiveKey]);

  // ── Auto-scroll content to bottom while streaming ─────────────────────────
  useEffect(() => {
    if (isActivelyThinking && contentRef.current && isOpen) {
      requestAnimationFrame(() => {
        if (contentRef.current) {
          contentRef.current.scrollTop = contentRef.current.scrollHeight;
        }
      });
    }
  }, [content, isActivelyThinking, isOpen]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (collapseTimeoutRef.current) clearTimeout(collapseTimeoutRef.current);
    };
  }, []);

  // ── Header label ──────────────────────────────────────────────────────────
  const displayElapsed =
    elapsedSeconds !== undefined && elapsedSeconds > 0
      ? elapsedSeconds
      : elapsedSecs > 0
        ? elapsedSecs
        : getInitialElapsed();

  const headerLabel = isActivelyThinking
    ? "Thinking"
    : `Thought for ${displayElapsed}s`;

  return (
    <div className={`thinking-block ${isOpen ? "thinking-open" : ""}`}>
      {/* ── Clickable header ── */}
      <div
        className="thinking-header"
        onClick={() => {
          // Cancel pending auto-collapse when user manually acts
          if (collapseTimeoutRef.current) {
            clearTimeout(collapseTimeoutRef.current);
            collapseTimeoutRef.current = null;
          }
          setIsOpen((prev) => !prev);
        }}
      >
        <BrainIcon />

        <span>{headerLabel}</span>

        {/* Blinking dots — only while actively streaming */}
        {isActivelyThinking && (
          <span className="thinking-dots">
            <span />
            <span />
            <span />
          </span>
        )}

        {/* Live timer — only while actively streaming */}
        {isActivelyThinking && elapsedSecs > 0 && (
          <span className="thinking-timer">{elapsedSecs}s</span>
        )}

        <ChevronIcon />
      </div>

      {/* ── Collapsible body (CSS grid trick: 0fr → 1fr) ── */}
      <div className="thinking-body">
        <div className="thinking-inner">
          <div
            ref={contentRef}
            className="thinking-content"
            style={maxHeight ? { maxHeight } : undefined}
          >
            {content}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ThinkingBlock;
