import React from "react";
import { TabInfo } from "../../types";

import { Message } from "./ChatBody/types";
import { useNetworkPing } from "../../hooks/useNetworkPing";

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
  currentModel?: any;
  currentAccount?: any;
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
  currentModel,
  currentAccount,
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

  const { ping, color } = useNetworkPing();

  const handleCopyId = (e: React.MouseEvent) => {
    e.stopPropagation();
    const id = conversationId || selectedTab.conversationId;
    if (id) {
      navigator.clipboard.writeText(id);
      // Optional: Show a brief tooltip or toast if needed, but keeping it simple for now
    }
  };

  const modelName = currentModel
    ? currentModel.name || currentModel.id
    : "DeepSeek Chat";
  const providerId =
    currentModel?.providerId || selectedTab.provider || "deepseek";

  // Basic favicon heuristic
  let faviconUrl =
    "https://www.google.com/s2/favicons?domain=deepseek.com&sz=64";
  if (providerId.toLowerCase().includes("openai")) {
    faviconUrl = "https://www.google.com/s2/favicons?domain=openai.com&sz=64";
  } else if (providerId.toLowerCase().includes("anthropic")) {
    faviconUrl =
      "https://www.google.com/s2/favicons?domain=anthropic.com&sz=64";
  } else if (providerId.toLowerCase().includes("google")) {
    faviconUrl = "https://www.google.com/s2/favicons?domain=google.com&sz=64";
  } else if (providerId.toLowerCase().includes("openrouter")) {
    faviconUrl =
      "https://www.google.com/s2/favicons?domain=openrouter.ai&sz=64";
  }

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
              {providerId}/{currentModel?.id || "chat"}
            </span>

            {currentAccount?.email && (
              <span
                style={{
                  opacity: 0.7,
                  fontStyle: "italic",
                  fontWeight: "normal",
                  fontSize: "11px",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: "150px",
                }}
                title={currentAccount.email}
              >
                &lt;{currentAccount.email}&gt;
              </span>
            )}

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
            <span
              title="Network Ping"
              style={{
                fontSize: "10px",
                color: "var(--secondary-text)",
                fontFamily: "monospace",
                opacity: 0.9,
                fontWeight: "bold",
                backgroundColor: "rgba(0,0,0,0.1)",
                padding: "1px 5px",
                borderRadius: "3px",
                whiteSpace: "nowrap",
                display: "flex",
                alignItems: "center",
                gap: "4px",
                border: `1px solid ${color}44`,
              }}
            >
              <div
                style={{
                  width: "5px",
                  height: "5px",
                  borderRadius: "50%",
                  backgroundColor: color,
                  boxShadow: `0 0 4px ${color}`,
                }}
              />
              {ping !== null ? `${ping}ms` : "OFFLINE"}
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
