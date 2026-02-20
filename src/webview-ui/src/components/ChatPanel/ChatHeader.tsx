import React from "react";
import { TabInfo } from "../../types";

import { Message } from "./ChatBody/types";

interface ChatHeaderProps {
  selectedTab: TabInfo;
  onBack: () => void;
  onClearChat: () => void;
  isLoadingConversation?: boolean;
  firstRequestMessage?: Message;
  contextUsage?: {
    prompt: number;
    completion: number;
    total: number;
  };
  taskName?: string | null;
  conversationId?: string;
  onToggleTaskDrawer?: () => void;
  taskProgress?: {
    current: {
      taskName: string;
      tasks: { text: string; status: "todo" | "done" }[];
      files: string[];
      taskIndex?: number;
      totalTasks?: number;
    } | null;
    history: any[];
  };
}

const ChatHeader: React.FC<ChatHeaderProps> = ({
  selectedTab,
  contextUsage,
  taskName,
  conversationId,
  taskProgress,
  onToggleTaskDrawer,
}) => {
  // Helper to format large numbers to K
  const formatTokens = (num: number) => {
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + "K";
    }
    return num.toString();
  };

  const handleCopyId = (e: React.MouseEvent) => {
    e.stopPropagation();
    const id = conversationId || selectedTab.conversationId;
    if (id) {
      navigator.clipboard.writeText(id);
      // Optional: Show a brief tooltip or toast if needed, but keeping it simple for now
    }
  };

  const modelName = "DeepSeek Chat";
  const providerId = selectedTab.provider || "deepseek";
  const faviconUrl =
    "https://www.google.com/s2/favicons?domain=deepseek.com&sz=64";

  return (
    <div
      style={{
        borderBottom: "1px solid var(--border-color)",
        backgroundColor: "var(--primary-bg)",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          padding: "8px 12px",
          display: "flex",
          flexDirection: "column",
          gap: "4px",
        }}
      >
        {/* Row 1: Model Info, Conv ID & Token Usage */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            height: "22px",
          }}
        >
          {/* Left: Model Info & Conv ID */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--primary-text)",
              overflow: "hidden",
            }}
          >
            <img
              src={faviconUrl}
              alt="provider"
              style={{ width: "14px", height: "14px", borderRadius: "2px" }}
            />
            <span style={{ whiteSpace: "nowrap" }}>
              {providerId.charAt(0).toUpperCase() + providerId.slice(1)}
            </span>
            <span style={{ opacity: 0.3 }}>|</span>
            <span
              style={{
                opacity: 0.9,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {modelName}
            </span>
            <span style={{ opacity: 0.3 }}>|</span>
            <span
              onClick={handleCopyId}
              title="Click to copy Conversation ID"
              style={{
                fontSize: "10px",
                color: "var(--secondary-text)",
                fontFamily: "monospace",
                opacity: 0.7,
                cursor: "pointer",
                backgroundColor: "var(--vscode-badge-background)",
                padding: "1px 4px",
                borderRadius: "2px",
                whiteSpace: "nowrap",
              }}
            >
              #
              {(conversationId || selectedTab.conversationId || "NEW").slice(
                -5,
              )}
            </span>
          </div>

          {/* Right: Token Usage */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <div
              style={{
                fontSize: "11px",
                color: "var(--secondary-text)",
                opacity: 0.8,
              }}
            >
              {contextUsage ? formatTokens(contextUsage.total) : "0"}
            </div>
          </div>
        </div>

        {/* Row 2: Task Name & Current Step */}
        <div
          onClick={onToggleTaskDrawer}
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "8px", // Increased gap from 4px to 8px
            marginTop: "6px",
            cursor: onToggleTaskDrawer ? "pointer" : "default",
          }}
        >
          {taskProgress?.current ? (
            <>
              {/* Line 1: Task Index / Total & Name */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  fontSize: "12px",
                  color: "var(--vscode-textLink-foreground)",
                  fontWeight: 500,
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    backgroundColor: "currentColor",
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    whiteSpace: "nowrap",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                  }}
                >
                  {taskProgress.current.taskIndex &&
                  taskProgress.current.totalTasks
                    ? `Task ${taskProgress.current.taskIndex}/${taskProgress.current.totalTasks}: `
                    : taskProgress.current.taskIndex
                      ? `Task ${taskProgress.current.taskIndex}: `
                      : ""}
                  {taskProgress.current.taskName}
                </span>
              </div>

              {/* Line 2: Current Step */}
              {(() => {
                const currentTask = taskProgress.current.tasks.find(
                  (t) =>
                    (t as any).completed === false ||
                    (t as any).status === "todo",
                );
                if (currentTask) {
                  const stepIndex =
                    taskProgress.current.tasks.indexOf(currentTask) + 1;
                  const totalSteps = taskProgress.current.tasks.length;
                  return (
                    <span
                      style={{
                        fontSize: "10px",
                        color: "var(--secondary-text)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        paddingLeft: "16px", // Slightly more padding
                        opacity: 0.7,
                      }}
                    >
                      → Step {stepIndex}/{totalSteps}: {currentTask.text}
                    </span>
                  );
                }
                return null;
              })()}
            </>
          ) : taskName ? (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "12px",
                color: "var(--vscode-textLink-foreground)",
                fontWeight: 500,
              }}
            >
              <div
                style={{
                  width: "6px",
                  height: "6px",
                  borderRadius: "50%",
                  backgroundColor: "currentColor",
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                }}
              >
                {taskName}
              </span>
            </div>
          ) : (
            <span
              style={{
                opacity: 0.5,
                fontStyle: "italic",
                fontSize: "11px",
                paddingLeft: "12px",
              }}
            >
              No active task
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatHeader;
