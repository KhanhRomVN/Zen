import React from "react";

interface ScrollToBottomButtonProps {
  onClick: () => void;
}

const ScrollToBottomButton: React.FC<ScrollToBottomButtonProps> = ({
  onClick,
}) => {
  return (
    <div
      style={{
        position: "absolute",
        bottom: "100px",
        right: "var(--spacing-lg)",
        backgroundColor: "var(--primary-bg)",
        border: "1px solid var(--border-color)",
        borderRadius: "50%",
        width: "32px",
        height: "32px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        cursor: "pointer",
        boxShadow: "0 2px 6px rgba(0,0,0,0.1)",
        zIndex: 10,
      }}
      onClick={onClick}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      >
        <polyline points="6 9 12 15 18 9" />
      </svg>
    </div>
  );
};

export default ScrollToBottomButton;
