import React, { useEffect, useRef, useState } from "react";
import { OK_COLOR } from "./quizzes/shared";

type Phase = "working" | "justDone" | "idle";

const AiStatus: React.FC<{ isProcessing: boolean }> = ({ isProcessing }) => {
  const [phase, setPhase] = useState<Phase>(isProcessing ? "working" : "idle");
  const prev = useRef(isProcessing);

  useEffect(() => {
    if (isProcessing) {
      setPhase("working");
    } else if (prev.current) {
      setPhase("justDone");
      const t = setTimeout(() => setPhase("idle"), 6000);
      prev.current = isProcessing;
      return () => clearTimeout(t);
    } else {
      setPhase("idle");
    }
    prev.current = isProcessing;
  }, [isProcessing]);

  const color =
    phase === "working"
      ? "var(--vscode-focusBorder, #007fd4)"
      : phase === "justDone"
        ? OK_COLOR
        : "var(--secondary-text)";
  const label =
    phase === "working"
      ? "AI is working"
      : phase === "justDone"
        ? "AI just finished"
        : "AI is idle";

  return (
    <div
      title={label}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        padding: "3px 10px",
        borderRadius: "999px",
        background: "rgba(128, 128, 128, 0.16)",
        fontSize: "11px",
        color: "var(--vscode-foreground)",
      }}
    >
      <style>{`@keyframes zenGamePulse{0%,100%{opacity:1}50%{opacity:.25}}`}</style>
      <span
        style={{
          width: "8px",
          height: "8px",
          borderRadius: "50%",
          background: color,
          animation:
            phase === "working" ? "zenGamePulse 1.2s ease-in-out infinite" : "none",
        }}
      />
      <span>{label}</span>
    </div>
  );
};

export default AiStatus;