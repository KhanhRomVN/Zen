import React, { useState, useEffect } from "react";

interface ProcessingIndicatorProps {
  isResponding?: boolean;
}

const ProcessingIndicator: React.FC<ProcessingIndicatorProps> = ({
  isResponding,
}) => {
  const [seconds, setSeconds] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  if (isResponding) {
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
        fontSize: "var(--font-size-md)", // 13px
        marginBottom: "var(--spacing-md)",
      }}
    >
      <span className="thinking-text">Thinking...({seconds}s)</span>
      <style>
        {`
        .thinking-text {
          background: linear-gradient(
            to right,
            var(--secondary-text) 0%,
            var(--secondary-text) 40%,
            #ffffff 50%,
            var(--secondary-text) 60%,
            var(--secondary-text) 100%
          );
          background-size: 200% auto;
          color: transparent;
          background-clip: text;
          -webkit-background-clip: text;
          animation: gradient-move 2.5s linear infinite;
          display: inline-block;
          font-weight: 500;
        }

        @keyframes gradient-move {
          0% { background-position: -100% center; }
          100% { background-position: 100% center; }
        }
      `}
      </style>
    </div>
  );
};

export default ProcessingIndicator;
