import React from "react";

interface TaskDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  taskProgress:
    | {
        current: {
          taskName: string;
          tasks: { text: string; status: "todo" | "done" }[];
          files: string[];
          taskIndex?: number;
          totalTasks?: number;
        } | null;
        history: any[];
      }
    | undefined;
}

const TaskDrawer: React.FC<TaskDrawerProps> = ({
  isOpen,
  onClose,
  taskProgress,
}) => {
  if (!isOpen) return null;

  const currentTask = taskProgress?.current;

  return (
    <div
      style={{
        position: "absolute",
        bottom: 0,
        left: 0,
        right: 0,
        height: "65%", // Changed to fixed percentage for consistency
        maxHeight: "65vh",
        backgroundColor: "var(--primary-bg)",
        borderTop: "1px solid var(--border-color)",
        boxShadow: "0 -8px 24px rgba(0, 0, 0, 0.2)",
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        animation: "slideUp 0.25s ease-out",
        color: "var(--primary-text)",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "10px 16px",
          borderBottom: "1px solid var(--border-color)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: "var(--secondary-bg)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {/* Menu / History Icon */}
          <button
            title="Sesssion History"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "4px",
              color: "var(--secondary-text)",
              display: "flex",
              alignItems: "center",
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>

          <span
            style={{
              fontSize: "11px",
              fontWeight: 600,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              opacity: 0.8,
            }}
          >
            {currentTask ? "Task Details" : "No Active Task"}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {/* Back to Current Icon */}
          <button
            title="Back to current task"
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "4px",
              color: "var(--secondary-text)",
              display: "flex",
              alignItems: "center",
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          </button>

          {/* Close Icon */}
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "4px",
              color: "var(--secondary-text)",
              display: "flex",
              alignItems: "center",
            }}
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content: Flush Design */}
      <div style={{ flex: 1, overflowY: "auto" }}>
        {currentTask ? (
          <div style={{ display: "flex", flexDirection: "column" }}>
            {/* Task Title Section */}
            <div
              style={{
                padding: "20px 20px 12px 20px",
                borderBottom: "1px solid var(--border-color)",
              }}
            >
              <div
                style={{
                  fontSize: "10px",
                  color: "var(--vscode-textLink-foreground)",
                  fontWeight: 600,
                  marginBottom: "4px",
                }}
              >
                {currentTask.taskIndex
                  ? `TASK ${currentTask.taskIndex} OF ${currentTask.totalTasks || "?"}`
                  : "CURRENT TASK"}
              </div>
              <h2
                style={{
                  fontSize: "16px",
                  fontWeight: 600,
                  margin: 0,
                  lineHeight: 1.4,
                }}
              >
                {currentTask.taskName}
              </h2>
            </div>

            {/* Steps List */}
            <div style={{ display: "flex", flexDirection: "column" }}>
              {currentTask.tasks.map((task, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "12px",
                    padding: "12px 20px",
                    borderBottom:
                      "1px solid var(--border-color-low, var(--border-color))",
                    backgroundColor:
                      task.status === "done"
                        ? "rgba(0,0,0,0.02)"
                        : "transparent",
                    opacity: task.status === "done" ? 0.6 : 1,
                  }}
                >
                  <div style={{ marginTop: "3px", flexShrink: 0 }}>
                    {task.status === "done" ? (
                      <div
                        style={{
                          width: "14px",
                          height: "14px",
                          borderRadius: "4px",
                          backgroundColor: "#3fb950",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="white"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M20 6 9 17l-5-5" />
                        </svg>
                      </div>
                    ) : (
                      <div
                        style={{
                          width: "14px",
                          height: "14px",
                          borderRadius: "4px",
                          border:
                            "1.5px solid var(--vscode-textLink-foreground)",
                          backgroundColor: "transparent",
                        }}
                      />
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: "13px",
                      lineHeight: 1.5,
                      textDecoration:
                        task.status === "done" ? "line-through" : "none",
                    }}
                  >
                    {task.text}
                  </span>
                </div>
              ))}
            </div>

            {/* Related Files Section */}
            {currentTask.files && currentTask.files.length > 0 && (
              <div
                style={{
                  padding: "16px 20px",
                  backgroundColor: "rgba(0,0,0,0.01)",
                }}
              >
                <div
                  style={{
                    fontSize: "10px",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.05em",
                    color: "var(--secondary-text)",
                    marginBottom: "12px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  Related Files
                  <div
                    style={{
                      height: "1px",
                      backgroundColor: "var(--border-color)",
                      flex: 1,
                      opacity: 0.5,
                    }}
                  />
                </div>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}
                >
                  {currentTask.files.map((file, idx) => (
                    <div
                      key={idx}
                      style={{
                        fontSize: "12px",
                        fontFamily: "monospace",
                        color: "var(--primary-text)",
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        opacity: 0.8,
                      }}
                    >
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        style={{ opacity: 0.5 }}
                      >
                        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                        <polyline points="14.5 2 14.5 7.5 20 7.5" />
                      </svg>
                      {file}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div
            style={{
              textAlign: "center",
              padding: "48px 20px",
              color: "var(--secondary-text)",
              fontSize: "13px",
              opacity: 0.6,
            }}
          >
            No active task progress available.
          </div>
        )}
      </div>

      <style>{`
        @keyframes slideUp {
          from { transform: translateY(100%); }
          to { transform: translateY(0); }
        }
      `}</style>
    </div>
  );
};

export default TaskDrawer;
