import React from "react";

const EmptyState: React.FC = () => {
  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "var(--spacing-xl)",
      }}
    >
      <div
        style={{
          textAlign: "center",
          maxWidth: "400px",
          width: "100%",
        }}
      >
        <div
          style={{
            fontSize: "64px",
            marginBottom: "var(--spacing-lg)",
            animation: "float 3s ease-in-out infinite",
          }}
        >
          💬
        </div>
        <h3
          style={{
            margin: 0,
            fontSize: "var(--font-size-xl)",
            fontWeight: 600,
            color: "var(--primary-text)",
            marginBottom: "var(--spacing-sm)",
          }}
        >
          Start a Conversation
        </h3>
        <p
          style={{
            margin: 0,
            fontSize: "var(--font-size-md)",
            color: "var(--secondary-text)",
            lineHeight: 1.6,
            marginBottom: "var(--spacing-lg)",
          }}
        >
          Ask anything, get instant responses from your AI assistant
        </p>
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "var(--spacing-sm)",
            padding: "var(--spacing-md)",
            backgroundColor: "var(--secondary-bg)",
            borderRadius: "var(--border-radius-lg)",
            border: "1px solid var(--border-color)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--spacing-xs)",
              fontSize: "var(--font-size-sm)",
              color: "var(--primary-text)",
            }}
          >
            <span style={{ fontSize: "16px" }}>💡</span>
            <span>Get code suggestions and explanations</span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--spacing-xs)",
              fontSize: "var(--font-size-sm)",
              color: "var(--primary-text)",
            }}
          >
            <span style={{ fontSize: "16px" }}>🔍</span>
            <span>Debug and troubleshoot issues</span>
          </div>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--spacing-xs)",
              fontSize: "var(--font-size-sm)",
              color: "var(--primary-text)",
            }}
          >
            <span style={{ fontSize: "16px" }}>📝</span>
            <span>Generate documentation and tests</span>
          </div>
        </div>
        <style>
          {`
            @keyframes float {
              0%, 100% {
                transform: translateY(0px);
              }
              50% {
                transform: translateY(-10px);
              }
            }
          `}
        </style>
      </div>
    </div>
  );
};

export default EmptyState;
