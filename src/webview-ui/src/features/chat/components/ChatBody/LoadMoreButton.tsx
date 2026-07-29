/**
 * LoadMoreButton
 * 
 * Displays a button to load more hidden messages.
 * Shows count of hidden message pairs and provides two actions:
 * - Load More: Load next 10 message pairs
 * - Load All: Load all hidden messages
 */

import React from "react";

interface LoadMoreButtonProps {
  hiddenCount: number;
  onLoadMore: () => void;
  onLoadAll: () => void;
}

export const LoadMoreButton: React.FC<LoadMoreButtonProps> = ({
  hiddenCount,
  onLoadMore,
  onLoadAll,
}) => {
  if (hiddenCount === 0) {
    return null;
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "12px",
        padding: "20px 0",
        borderBottom: "1px solid var(--vscode-panel-border)",
        marginBottom: "16px",
      }}
    >
      {/* Info text */}
      <div
        style={{
          fontSize: "12px",
          color: "var(--vscode-descriptionForeground)",
          textAlign: "center",
        }}
      >
        {hiddenCount} earlier message{hiddenCount > 1 ? "s" : ""} hidden
      </div>

      {/* Buttons */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          alignItems: "center",
        }}
      >
        {/* Load More Button */}
        <button
          onClick={onLoadMore}
          style={{
            backgroundColor: "var(--vscode-button-background)",
            color: "var(--vscode-button-foreground)",
            border: "none",
            padding: "6px 14px",
            borderRadius: "4px",
            cursor: "pointer",
            fontSize: "12px",
            fontWeight: 500,
            display: "flex",
            alignItems: "center",
            gap: "6px",
            transition: "all 0.2s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor =
              "var(--vscode-button-hoverBackground)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor =
              "var(--vscode-button-background)";
          }}
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 16 16"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <path
              d="M8 3L8 13M8 3L4 7M8 3L12 7"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          Load More (10)
        </button>

        {/* Load All Button */}
        {hiddenCount > 10 && (
          <button
            onClick={onLoadAll}
            style={{
              backgroundColor: "transparent",
              color: "var(--vscode-button-background)",
              border: "1px solid var(--vscode-button-background)",
              padding: "6px 14px",
              borderRadius: "4px",
              cursor: "pointer",
              fontSize: "12px",
              fontWeight: 500,
              display: "flex",
              alignItems: "center",
              gap: "6px",
              transition: "all 0.2s ease",
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor =
                "color-mix(in srgb, var(--vscode-button-background) 10%, transparent)";
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = "transparent";
            }}
          >
            <svg
              width="12"
              height="12"
              viewBox="0 0 16 16"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M8 2L8 14M8 2L4 6M8 2L12 6M4 10L8 14M12 10L8 14"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Load All ({hiddenCount})
          </button>
        )}
      </div>
    </div>
  );
};
