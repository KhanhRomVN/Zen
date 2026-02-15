import React from "react";

const ProcessingIndicator: React.FC = () => {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--spacing-xs)",
        padding: "var(--spacing-sm)",
        color: "var(--secondary-text)",
        fontSize: "var(--font-size-sm)",
        marginBottom: "var(--spacing-md)",
      }}
    >
      <div className="loading-dots">
        <span>.</span>
        <span>.</span>
        <span>.</span>
      </div>
      <span>AI is thinking</span>
      <style>
        {`
        .loading-dots span {
          animation: dot-pulse 1.4s infinite;
          opacity: 0;
        }
        .loading-dots span:nth-child(1) { animation-delay: 0s; }
        .loading-dots span:nth-child(2) { animation-delay: 0.2s; }
        .loading-dots span:nth-child(3) { animation-delay: 0.4s; }
        @keyframes dot-pulse {
          0% { opacity: 0; }
          50% { opacity: 1; }
          100% { opacity: 0; }
        }
      `}
      </style>
    </div>
  );
};

export default ProcessingIndicator;
