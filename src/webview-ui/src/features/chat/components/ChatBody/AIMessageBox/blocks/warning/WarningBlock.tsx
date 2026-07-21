import React from "react";
import "./WarningBlock.css";

interface WarningBlockProps {
  label: string;
  message: string;
  warningColor?: string;
  isPulsing?: boolean;
}

/**
 * WarningBlock component with custom header layout.
 * Used for displaying warning messages like response continuation, partial tool assembly, etc.
 */
const WarningBlock: React.FC<WarningBlockProps> = ({
  label,
  message,
  warningColor = "var(--vscode-editorWarning-foreground, #cca700)",
  isPulsing = true,
}) => {
  return (
    <div className="warning-block-wrapper">
      <div
        className="terminal-block-header"
        style={{
          paddingTop: "4px",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          width: "100%",
        }}
      >
        <div className="terminal-info" style={{ flex: 1, minWidth: 0 }}>
          <div className="terminal-header-top">
            <div
              style={{
                marginTop: "1px",
                display: "flex",
                flexDirection: "column",
                gap: "2px",
                flex: 1,
                minWidth: 0,
                width: "100%",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "8px",
                  flexWrap: "nowrap",
                }}
              >
                {/* Status dot with optional pulsing */}
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
                  title={label}
                >
                  {/* Ring */}
                  <div
                    style={{
                      position: "absolute",
                      width: "16px",
                      height: "16px",
                      borderRadius: "50%",
                      ...(!isPulsing && {
                        border: `2px solid ${warningColor}`,
                        opacity: 0.4,
                      }),
                      ...(isPulsing && {
                        borderWidth: "2px",
                        borderStyle: "solid",
                        borderRightColor: warningColor,
                        borderBottomColor: warningColor,
                        borderLeftColor: warningColor,
                        borderTopColor: "transparent",
                        animation: "circle-ring-spin 1s linear infinite",
                        opacity: 0.8,
                      }),
                    }}
                  />
                  {/* Dot */}
                  <div
                    style={{
                      width: "8px",
                      height: "8px",
                      borderRadius: "50%",
                      backgroundColor: warningColor,
                    }}
                  />
                </div>

                {/* Content */}
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
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      flexWrap: "wrap",
                    }}
                  >
                    <span className="terminal-name">{label}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Warning Message Block */}
      {message && (
        <div
          className="warning-message-block"
          style={{
            border: `1px solid color-mix(in srgb, ${warningColor} 30%, transparent)`,
            background: `color-mix(in srgb, ${warningColor} 5%, transparent)`,
          }}
        >
          <span
            className="warning-message-text"
            style={{ color: warningColor }}
          >
            {message}
          </span>
        </div>
      )}
    </div>
  );
};

export default WarningBlock;
