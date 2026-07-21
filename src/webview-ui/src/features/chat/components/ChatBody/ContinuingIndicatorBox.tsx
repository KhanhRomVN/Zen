import React from "react";

/**
 * ContinuingIndicatorBox displays a pulsing indicator when the AI response
 * is being continued after an interruption. This is a standalone component
 * used in ChatBody to show that content is being fetched.
 */
export const ContinuingIndicatorBox: React.FC = () => {
  const warningColor = "var(--vscode-editorWarning-foreground, #cca700)";

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "6px",
        paddingBottom: "4px",
        marginBottom: "2px",
      }}
    >
      {/* Header with pulsing status indicator */}
      <div
        style={{
          paddingTop: "4px",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          width: "100%",
        }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "8px",
              flexWrap: "nowrap",
            }}
          >
            {/* Pulsing status indicator */}
            <div
              style={{
                position: "relative",
                width: "16px",
                height: "16px",
                flexShrink: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                marginTop: "2px",
              }}
              title="CONTINUING RESPONSE"
            >
              {/* Spinning ring */}
              <div
                style={{
                  position: "absolute",
                  width: "16px",
                  height: "16px",
                  borderRadius: "50%",
                  borderWidth: "2px",
                  borderStyle: "solid",
                  borderRightColor: warningColor,
                  borderBottomColor: warningColor,
                  borderLeftColor: warningColor,
                  borderTopColor: "transparent",
                  animation: "continuing-indicator-spin 1s linear infinite",
                  opacity: 0.8,
                }}
              />
              {/* Center dot */}
              <div
                style={{
                  width: "8px",
                  height: "8px",
                  borderRadius: "50%",
                  backgroundColor: warningColor,
                }}
              />
            </div>

            {/* Label */}
            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                gap: "2px",
                marginTop: "2px",
              }}
            >
              <span
                style={{
                  fontSize: "11px",
                  fontWeight: 600,
                  letterSpacing: "0.5px",
                  textTransform: "uppercase",
                  color: warningColor,
                }}
              >
                CONTINUING RESPONSE
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Message block */}
      <div
        style={{
          padding: "12px 16px",
          borderRadius: "6px",
          marginLeft: "24px",
          border: `1px solid color-mix(in srgb, ${warningColor} 30%, transparent)`,
          background: `color-mix(in srgb, ${warningColor} 5%, transparent)`,
        }}
      >
        <span
          style={{
            fontSize: "11px",
            lineHeight: 1.5,
            display: "block",
            color: warningColor,
          }}
        >
          AI response was interrupted. Fetching the remaining content…
        </span>
      </div>

      {/* Inline keyframe animation */}
      <style>{`
        @keyframes continuing-indicator-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default ContinuingIndicatorBox;
