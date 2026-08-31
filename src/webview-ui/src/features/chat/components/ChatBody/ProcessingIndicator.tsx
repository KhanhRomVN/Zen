import React, { useEffect, useRef, useState } from "react";

interface ProcessingIndicatorProps {
  /** true = dang cho response hoac dang streaming */
  isResponding?: boolean;
}

const AUTO_SWITCH_DELAY_MS = 500;

const ProcessingIndicator: React.FC<ProcessingIndicatorProps> = ({
  isResponding,
}) => {
  const startTimeRef = useRef<number | null>(null);
  const timerDisplayRef = useRef<HTMLSpanElement>(null);
  const animationFrameRef = useRef<number | null>(null);
  const switchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Tu dong chuyen sang "Generating" sau 500ms
  const [isGenerating, setIsGenerating] = useState(false);

  useEffect(() => {
    if (isResponding) {
      // Ghi nhan start time (chi lan dau)
      if (!startTimeRef.current) {
        startTimeRef.current = Date.now();
      }

      // Sau 500ms, tu dong chuyen sang trang thai "Generating response"
      if (!switchTimerRef.current) {
        switchTimerRef.current = setTimeout(() => {
          setIsGenerating(true);
        }, AUTO_SWITCH_DELAY_MS);
      }

      const updateDisplay = () => {
        if (timerDisplayRef.current && startTimeRef.current) {
          const elapsed = Math.floor(
            (Date.now() - startTimeRef.current) / 1000,
          );
          if (isGenerating) {
            timerDisplayRef.current.textContent = "Generating response (" + elapsed + "s)...";
          } else {
            timerDisplayRef.current.textContent = "Processing (" + elapsed + "s)";
          }
        }
        animationFrameRef.current = requestAnimationFrame(updateDisplay);
      };

      animationFrameRef.current = requestAnimationFrame(updateDisplay);
    } else {
      // Reset everything
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
        animationFrameRef.current = null;
      }
      if (switchTimerRef.current) {
        clearTimeout(switchTimerRef.current);
        switchTimerRef.current = null;
      }
      startTimeRef.current = null;
      setIsGenerating(false);
    }

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      if (switchTimerRef.current) {
        clearTimeout(switchTimerRef.current);
      }
    };
  }, [isResponding, isGenerating]);

  if (!isResponding) {
    return null;
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--spacing-xs)",
        padding: "0 var(--spacing-sm)",
        marginTop: "-var(--spacing-sm)",
        color: "var(--secondary-text)",
        fontSize: "var(--font-size-md)",
        marginBottom: "var(--spacing-md)",
      }}
    >
      <span ref={timerDisplayRef} className="processing-text">
        Processing (0s)
      </span>
      <style>
        {`
        .processing-text {
          background: linear-gradient(
            to right,
            var(--secondary-text) 0%,
            var(--secondary-text) 30%,
            var(--vscode-editor-foreground, #ffffff) 50%,
            var(--secondary-text) 70%,
            var(--secondary-text) 100%
          );
          background-size: 200% auto;
          color: transparent;
          background-clip: text;
          -webkit-background-clip: text;
          animation: sweep 2s linear infinite;
          display: inline-block;
          font-weight: 500;
        }

        @keyframes sweep {
          0% { background-position: 200% center; }
          100% { background-position: -200% center; }
        }
      `}
      </style>
    </div>
  );
};

export default ProcessingIndicator;
