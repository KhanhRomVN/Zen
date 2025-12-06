import React, { useState } from "react";

interface ContextPanelProps {
  onBack: () => void;
}

const ContextPanel: React.FC<ContextPanelProps> = ({ onBack }) => {
  const [contextWindowSize, setContextWindowSize] = useState(128);

  return (
    <div
      style={{
        position: "absolute",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: "100%",
        height: "100%",
        backgroundColor: "var(--secondary-bg)",
        zIndex: 1001,
        display: "flex",
        flexDirection: "column",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "var(--spacing-lg)",
          borderBottom: "1px solid var(--border-color)",
          display: "flex",
          alignItems: "center",
          gap: "var(--spacing-md)",
          backgroundColor: "var(--secondary-bg)",
        }}
      >
        <div
          style={{
            cursor: "pointer",
            padding: "var(--spacing-xs)",
            borderRadius: "var(--border-radius)",
            transition: "background-color 0.2s",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
          onClick={onBack}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = "var(--hover-bg)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = "transparent";
          }}
        >
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </div>
        <h2
          style={{
            fontSize: "var(--font-size-xl)",
            fontWeight: 600,
            color: "var(--primary-text)",
            margin: 0,
          }}
        >
          Context Window
        </h2>
      </div>

      {/* Content */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "var(--spacing-lg)",
        }}
      >
        <div
          style={{
            padding: "var(--spacing-lg)",
            backgroundColor: "var(--primary-bg)",
            border: "1px solid var(--border-color)",
            borderRadius: "var(--border-radius-lg)",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "var(--spacing-md)",
            }}
          >
            <span
              style={{
                fontSize: "var(--font-size-md)",
                color: "var(--primary-text)",
                fontWeight: 500,
              }}
            >
              Current Size:
            </span>
            <span
              style={{
                fontSize: "var(--font-size-lg)",
                fontWeight: 600,
                color: "var(--accent-text)",
              }}
            >
              {contextWindowSize}K
            </span>
          </div>
          <input
            type="range"
            min="8"
            max="256"
            step="8"
            value={contextWindowSize}
            onChange={(e) => setContextWindowSize(parseInt(e.target.value))}
            style={{
              width: "100%",
              marginBottom: "var(--spacing-sm)",
            }}
          />
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: "var(--font-size-xs)",
              color: "var(--secondary-text)",
            }}
          >
            <span>8K</span>
            <span>128K (Default)</span>
            <span>256K</span>
          </div>
          <div
            style={{
              marginTop: "var(--spacing-lg)",
              padding: "var(--spacing-md)",
              backgroundColor: "var(--secondary-bg)",
              borderRadius: "var(--border-radius)",
              fontSize: "var(--font-size-xs)",
              color: "var(--secondary-text)",
              lineHeight: 1.6,
            }}
          >
            <strong style={{ color: "var(--primary-text)" }}>Lưu ý:</strong>{" "}
            Context window lớn hơn cho phép AI xử lý nhiều thông tin hơn nhưng
            có thể tốn thời gian và tài nguyên. Khuyến nghị sử dụng 128K cho hầu
            hết các tác vụ.
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContextPanel;
