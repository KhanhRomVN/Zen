import React from "react";

// CONSTANTS
import {
  TOOL_ACTION_TYPES,
  getToolLabel,
} from "@/features/chat/constants/constants";

// TYPES
import { ToolAction } from "@/features/chat/services/ResponseParser";

// UTILS
import { getActiveGitRepo } from "../../../../utils/active-git-repo";

// COMPONENTS
import { TagHeader } from "../TagHeader";
import { RepoBranchLine } from "./RepoBranchLine";

interface CommitMessageRendererProps {
  action: ToolAction;
  actionIndex: number;
  messageId: string;
  isActionClicked?: boolean;
  isRejected?: boolean;
  toolOutputs?: Record<string, { output: string; isError: boolean }>;
  isLastItemInList?: boolean;
  onToolClick: (
    action: ToolAction,
    messageId: string,
    actionIndex: number,
    type: (typeof TOOL_ACTION_TYPES)[keyof typeof TOOL_ACTION_TYPES],
  ) => void;
  branch?: string;
  hintPaths?: string[];
}

const ADDED = "var(--vscode-gitDecoration-addedResourceForeground, #3fb950)";
const ACCENT = "var(--vscode-editorBracketHighlight-foreground2, #4ec9b0)";
const DANGER = "var(--vscode-errorForeground, #ff4d4d)";

const MUTED = "var(--vscode-descriptionForeground, #9d9d9d)";
const MONO = "var(--vscode-editor-font-family, monospace)";

interface CommitRecord {
  pushRequested: boolean;
  pushed: boolean;
  pushFailed: boolean;
}

const parseCommitRecord = (output?: string): CommitRecord | null => {
  if (!output) return null;
  try {
    const parsed = JSON.parse(output);
    return {
      pushRequested: !!parsed.pushRequested,
      pushed: !!parsed.pushed,
      pushFailed: !!parsed.pushFailed,
    };
  } catch {
    return null;
  }
};

const persistCommitState = (actionId: string, record: CommitRecord) => {
  window.postMessage({ command: "markActionClicked", actionId }, "*");
  window.postMessage(
    {
      command: "setToolOutput",
      actionId,
      output: JSON.stringify(record),
      isError: false,
    },
    "*",
  );
};

const tint = (color: string, pct: number) =>
  `color-mix(in srgb, ${color} ${pct}%, transparent)`;

const badgeStyle = (color: string): React.CSSProperties => ({
  fontSize: "10px",
  fontWeight: 600,
  color,
  background: tint(color, 15),
  padding: "2px 8px",
  borderRadius: "4px",
  marginLeft: "4px",
});

const buttonStyle = (color: string): React.CSSProperties => ({
  background: tint(color, 15),
  color,
  border: "none",
  outline: "none",
  padding: "4px 10px",
  borderRadius: "6px",
  fontSize: "11px",
  fontWeight: 600,
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: "6px",
  height: "24px",
});

const repoName = (repoPath?: string) => {
  if (!repoPath || repoPath === ".") return "workspace";
  return repoPath.split(/[\\/]/).filter(Boolean).pop() || repoPath;
};

/**
 * Renderer for commit_message tool type
 * Shows commit message with Accept/Reject buttons
 */
export const CommitMessageRenderer: React.FC<CommitMessageRendererProps> = ({
  action,
  actionIndex,
  messageId,
  isActionClicked = false,
  isRejected = false,
  toolOutputs,
  isLastItemInList = true,
  onToolClick,
  branch,
  hintPaths,
}) => {
  const messageContent = action.params?.message || action.params?.content || "";
  const actionKey = `${messageId}-${actionIndex}`;
  const [isCommitting, setIsCommitting] = React.useState(false);
  const actionId = `${messageId}-action-${actionIndex}`;
  const savedOutput = toolOutputs?.[actionId]?.output;
  const savedCommit = parseCommitRecord(savedOutput);
  const [isCommitted, setIsCommitted] = React.useState(isActionClicked);
  const [repo] = React.useState(() => getActiveGitRepo());
  const [autoPush, setAutoPush] = React.useState<boolean>(() => {
    try {
      return localStorage.getItem("zen_auto_git_push") === "true";
    } catch {
      return false;
    }
  });
  const [pushOnCommit, setPushOnCommit] = React.useState(
    () => !!savedCommit?.pushRequested,
  );
  const [isPushed, setIsPushed] = React.useState(() => !!savedCommit?.pushed);
  const [pushFailed, setPushFailed] = React.useState(
    () => !!savedCommit?.pushFailed,
  );
  const [repoInfo, setRepoInfo] = React.useState({
    folderName: "",
    branch: "",
    repoPath: "",
  });
  const hintKey = (hintPaths || []).join("|");

  React.useEffect(() => {
    if (isActionClicked) setIsCommitted(true);
  }, [isActionClicked]);

  React.useEffect(() => {
    if (!savedCommit) return;
    setPushOnCommit(savedCommit.pushRequested);
    setIsPushed(savedCommit.pushed);
    setPushFailed(savedCommit.pushFailed);
  }, [savedOutput]);

  React.useEffect(() => {
    const requestId = `git-repo-info-${actionKey}`;
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (
        data?.command === "gitRepoInfoResult" &&
        data.requestId === requestId
      ) {
        setRepoInfo({
          folderName: data.folderName || "",
          branch: data.branch || "",
          repoPath: data.repoPath || "",
        });
      }
    };
    window.addEventListener("message", onMessage);
    (window as any).vscodeApi?.postMessage({
      command: "gitRepoInfo",
      requestId,
      repoPath: repo?.path || undefined,
      hintPaths: hintPaths || [],
    });
    return () => window.removeEventListener("message", onMessage);
  }, [actionKey, repo?.path, hintKey]);

  React.useEffect(() => {
    if (!isCommitting) return;
    const onMessage = (event: MessageEvent) => {
      const data = event.data;
      if (data?.command === "gitCommitDone") {
        persistCommitState(actionId, {
          pushRequested: pushOnCommit,
          pushed: !!data.pushed,
          pushFailed: false,
        });
        setIsCommitting(false);
        setIsCommitted(true);
        if (data.pushed) setIsPushed(true);
      } else if (data?.command === "commitError") {
        setIsCommitting(false);
        if (String(data.error || "").startsWith("Push failed")) {
          persistCommitState(actionId, {
            pushRequested: true,
            pushed: false,
            pushFailed: true,
          });
          setIsCommitted(true);
          setPushFailed(true);
        }
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [isCommitting, actionKey]);

  const toggleAutoPush = () => {
    const next = !autoPush;
    setAutoPush(next);
    try {
      localStorage.setItem("zen_auto_git_push", String(next));
    } catch {}
  };

  const repoLabel =
    repoInfo.folderName ||
    (repo?.path && repo.path !== "." ? repoName(repo.path) : "") ||
    "…";
  const branchLabel = repoInfo.branch || repo?.branch || branch || "…";

  const [subject, ...bodyLines] = messageContent.split("\n");
  const body = bodyLines.join("\n").trim();

  const statusColor = isRejected ? DANGER : isCommitted ? ADDED : ACCENT;
  const toggleColor = autoPush ? ACCENT : MUTED;

  const handleAccept = () => {
    const vscodeApi = (window as any).vscodeApi;
    if (!vscodeApi) return;
    setIsCommitting(true);
    setPushOnCommit(autoPush);
    setPushFailed(false);
    setIsPushed(false);
    vscodeApi.postMessage({
      command: "gitCommit",
      message: messageContent,
      repoPath: repo?.path || repoInfo.repoPath || undefined,
      push: autoPush,
    });
  };

  const handleReject = () => {
    onToolClick(action, messageId, actionIndex, "reject");
    (window as any).vscodeApi?.postMessage({ command: "rejectCommitMessage" });
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        paddingBottom: "4px",
        marginBottom: isLastItemInList ? "0" : "2px",
      }}
    >
      <TagHeader
        title={
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "12px",
              color: "var(--vscode-editor-foreground)",
            }}
          >
            <span style={{ fontWeight: 600, opacity: 0.8 }}>
              {getToolLabel("commit_message")}
            </span>
            <span
              className="codicon codicon-git-commit"
              style={{ fontSize: "14px" }}
            />
            {isRejected && <span style={badgeStyle(DANGER)}>REJECTED</span>}
          </div>
        }
        statusColor={statusColor}
        isPartial={false}
      />

      <RepoBranchLine
        repoLabel={repoLabel}
        branchLabel={branchLabel}
        title={repo?.path}
      />

      <div style={{ padding: "0 12px 0 16px" }}>
        <div
          style={{
            padding: "10px 14px",
            background: "var(--vscode-editor-background, #1e1e1e)",
            borderRadius: "6px",
            border: `1px solid ${
              isCommitted
                ? tint(ADDED, 30)
                : "var(--vscode-widget-border, #454545)"
            }`,
            fontFamily: MONO,
            fontSize: "12.5px",
            lineHeight: 1.55,
            whiteSpace: "pre-wrap",
            wordBreak: "break-word",
            color: "var(--vscode-foreground, #cccccc)",
            opacity: isRejected ? 0.6 : 1,
          }}
        >
          <div style={{ fontWeight: 600 }}>{subject}</div>
          {body && <div style={{ marginTop: "8px", opacity: 0.8 }}>{body}</div>}
        </div>

        {isCommitting && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 2px 0",
              fontSize: "11px",
              color: MUTED,
            }}
          >
            <span
              className="codicon codicon-loading codicon-modifier-spin"
              style={{ fontSize: "14px" }}
            />
            {pushOnCommit ? "Committing and pushing..." : "Committing..."}
          </div>
        )}

        {isCommitted && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 2px 0",
              fontSize: "11px",
              color: MUTED,
            }}
          >
            <span
              className="codicon codicon-check"
              style={{ color: ADDED, fontSize: "14px" }}
            />
            <span style={{ color: ADDED, fontWeight: 600 }}>
              Committed successfully
            </span>
            <span style={{ opacity: 0.5 }}>·</span>
            {pushOnCommit ? (
              <span style={{ color: pushFailed ? DANGER : undefined }}>
                {pushFailed
                  ? "Push failed, see the error below"
                  : isPushed
                    ? "Pushed to the remote"
                    : "Pushing to the remote..."}
              </span>
            ) : (
              <span>
                Run{" "}
                <code
                  style={{
                    background: "var(--vscode-textCodeBlock-background)",
                    padding: "1px 6px",
                    borderRadius: "4px",
                    fontFamily: MONO,
                    fontSize: "11px",
                    color: "var(--vscode-foreground)",
                  }}
                >
                  git push
                </code>{" "}
                to publish it to the remote
              </span>
            )}
          </div>
        )}

        {!isCommitted && !isCommitting && !isRejected && (
          <div
            style={{
              display: "flex",
              gap: "6px",
              padding: "8px 0 0",
              justifyContent: "flex-end",
            }}
          >
            <button
              type="button"
              role="switch"
              aria-checked={autoPush}
              onClick={toggleAutoPush}
              title="Run git push right after the commit"
              style={{
                ...buttonStyle(MUTED),
                background: "transparent",
                color: "var(--vscode-foreground)",
                fontWeight: 500,
                marginRight: "auto",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = tint(MUTED, 15);
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = "transparent";
              }}
            >
              <span
                style={{
                  position: "relative",
                  width: "22px",
                  height: "12px",
                  borderRadius: "6px",
                  flexShrink: 0,
                  background: tint(toggleColor, autoPush ? 45 : 25),
                  transition: "background .15s ease",
                }}
              >
                <span
                  style={{
                    position: "absolute",
                    top: "2px",
                    left: autoPush ? "12px" : "2px",
                    width: "8px",
                    height: "8px",
                    borderRadius: "50%",
                    background: toggleColor,
                    transition: "left .15s ease",
                  }}
                />
              </span>
              Auto push
            </button>
            <button
              onClick={handleAccept}
              style={buttonStyle(ACCENT)}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = tint(ACCENT, 25);
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = tint(ACCENT, 15);
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 6 9 17l-5-5" />
              </svg>
              Accept
            </button>
            <button
              onClick={handleReject}
              style={buttonStyle(DANGER)}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = tint(DANGER, 25);
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = tint(DANGER, 15);
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 6 6 18" />
                <path d="m6 6 12 12" />
              </svg>
              Reject
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
