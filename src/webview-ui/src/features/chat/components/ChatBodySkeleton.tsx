import React from "react";

const ChatBodySkeleton: React.FC = () => {
  return (
    <div
      className="chat-body-skeleton-scroll"
      style={{
        flex: 1,
        overflowY: "hidden",
        overflowX: "hidden",
        padding: "var(--spacing-lg)",
        paddingLeft: "12px",
        backgroundColor: "var(--secondary-bg)",
        paddingBottom: "200px",
        display: "flex",
        flexDirection: "column",
        gap: "var(--spacing-md)",
        fontSize: "14px",
      }}
    >
      {/* User Message Skeleton */}
      {[1, 2, 3, 4, 5].map((i) => (
        <React.Fragment key={i}>
          {/* User Message */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              animation: "skeleton-pulse 1.5s ease-in-out infinite",
              animationDelay: `${i * 0.1}s`,
            }}
          >
            <div
              style={{
                height: "60px",
                backgroundColor:
                  "var(--vscode-input-background, rgba(255,255,255,0.05))",
                borderRadius: "8px",
                border:
                  "1px solid var(--vscode-widget-border, rgba(128,128,128,0.2))",
              }}
            />
          </div>

          {/* Assistant Message */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              animation: "skeleton-pulse 1.5s ease-in-out infinite",
              animationDelay: `${i * 0.1 + 0.15}s`,
            }}
          >
            {/* Message Header */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <div
                style={{
                  width: "80px",
                  height: "16px",
                  backgroundColor:
                    "var(--vscode-input-background, rgba(255,255,255,0.05))",
                  borderRadius: "4px",
                }}
              />
              <div
                style={{
                  width: "120px",
                  height: "16px",
                  backgroundColor:
                    "var(--vscode-input-background, rgba(255,255,255,0.05))",
                  borderRadius: "4px",
                }}
              />
            </div>

            {/* Message Content Lines */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "6px",
                padding: "12px",
                backgroundColor:
                  "var(--vscode-editor-background, rgba(0,0,0,0.2))",
                borderRadius: "8px",
                border:
                  "1px solid var(--vscode-widget-border, rgba(128,128,128,0.15))",
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: "14px",
                  backgroundColor:
                    "var(--vscode-input-background, rgba(255,255,255,0.05))",
                  borderRadius: "4px",
                }}
              />
              <div
                style={{
                  width: "95%",
                  height: "14px",
                  backgroundColor:
                    "var(--vscode-input-background, rgba(255,255,255,0.05))",
                  borderRadius: "4px",
                }}
              />
              <div
                style={{
                  width: "85%",
                  height: "14px",
                  backgroundColor:
                    "var(--vscode-input-background, rgba(255,255,255,0.05))",
                  borderRadius: "4px",
                }}
              />
              <div
                style={{
                  width: "90%",
                  height: "14px",
                  backgroundColor:
                    "var(--vscode-input-background, rgba(255,255,255,0.05))",
                  borderRadius: "4px",
                }}
              />
            </div>

            {/* Tool Action Skeleton */}
            {i === 2 && (
              <div
                style={{
                  display: "flex",
                  gap: "8px",
                  padding: "12px",
                  backgroundColor:
                    "var(--vscode-editor-background, rgba(0,0,0,0.2))",
                  borderRadius: "8px",
                  border:
                    "1px solid var(--vscode-widget-border, rgba(128,128,128,0.15))",
                }}
              >
                <div
                  style={{
                    width: "24px",
                    height: "24px",
                    backgroundColor:
                      "var(--vscode-input-background, rgba(255,255,255,0.05))",
                    borderRadius: "4px",
                  }}
                />
                <div
                  style={{
                    flex: 1,
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}
                >
                  <div
                    style={{
                      width: "150px",
                      height: "14px",
                      backgroundColor:
                        "var(--vscode-input-background, rgba(255,255,255,0.05))",
                      borderRadius: "4px",
                    }}
                  />
                  <div
                    style={{
                      width: "80%",
                      height: "12px",
                      backgroundColor:
                        "var(--vscode-input-background, rgba(255,255,255,0.05))",
                      borderRadius: "4px",
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </React.Fragment>
      ))}

      <style>{`
        @keyframes skeleton-pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }
      `}</style>
    </div>
  );
};

export default ChatBodySkeleton;
