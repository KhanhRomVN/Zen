import { useState, useCallback, useMemo } from "react";
import { Message } from "../../types/message";
import { parseGitStatusOutput } from "../../utils/gitUtils";
import { getCommitMessagePrompt } from "../../prompts/commit-message";

interface UseGitOperationsProps {
  currentModel: any;
  currentAccount: any;
  providers: any[];
  commitMessageLanguage: "en" | "vi";
  currentConversationId: string;
  wrappedSendMessage: (
    content: string,
    files?: any[],
    model?: any,
    account?: any,
    skipFirstRequestLogic?: boolean,
    actionIds?: string[],
    uiHidden?: boolean,
  ) => Promise<void>;
  setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
  setToolOutputs: React.Dispatch<
    React.SetStateAction<
      Record<string, { output: string; isError: boolean; terminalId?: string }>
    >
  >;
}

export const useGitOperations = ({
  currentModel,
  currentAccount,
  providers,
  commitMessageLanguage,
  currentConversationId,
  wrappedSendMessage,
  setMessages,
  setToolOutputs,
}: UseGitOperationsProps) => {
  const [gitStatus, setGitStatus] = useState<{
    items: {
      status: string;
      path: string;
      staged: boolean;
      added?: number;
      deleted?: number;
      isUnpushedCommit?: boolean;
    }[];
    raw: string;
    diffStats?: Record<string, { added: number; deleted: number }>;
    branch?: string;
  } | null>(null);
  const [gitLoading, setGitLoading] = useState(false);
  const [gitError, setGitError] = useState<string | null>(null);
  const [showGitStatusBlock, setShowGitStatusBlock] = useState(false);
  const [gitCommitMessage, setGitCommitMessage] = useState<string | null>(null);
  const [gitCommitLoading, setGitCommitLoading] = useState(false);
  const [gitCommitInput, setGitCommitInput] = useState<string>("");

  const enrichedModel = useMemo(() => {
    if (!currentModel) return null;
    if (!Array.isArray(providers)) return currentModel;
    const providerData = providers.find(
      (p: any) => p.provider_id === currentModel.providerId,
    );
    const modelData = providerData?.models?.find(
      (m: any) => m.id === currentModel.id,
    );
    if (!modelData) return currentModel;
    return { ...currentModel, ...modelData };
  }, [currentModel, providers]);

  const handleGitPullRequest = useCallback(async () => {
    if (gitLoading) {
      return;
    }
    setGitLoading(true);
    setGitError(null);
    setShowGitStatusBlock(false);
    setGitCommitMessage(null);
    try {
      const vscodeApi = (window as any).vscodeApi;
      if (!vscodeApi) {
        console.error("[Git] vscodeApi not available");
        setGitError("Không thể kết nối với VSCode API");
        setGitLoading(false);
        return;
      }

      const requestId = `git-status-${Date.now()}`;
      let timeoutId: ReturnType<typeof setTimeout> | null = null;
      const promise = new Promise<{
        output: string;
        error?: string;
        diffStats?: Record<string, { added: number; deleted: number }>;
        unpushedCommits?: string[];
        branch?: string;
      }>((resolve) => {
        const handler = (event: MessageEvent) => {
          const msg = event.data;
          if (
            msg.command === "gitStatusResult" &&
            msg.requestId === requestId
          ) {
            if (timeoutId) {
              clearTimeout(timeoutId);
              timeoutId = null;
            }
            window.removeEventListener("message", handler);
            resolve({
              output: msg.output,
              error: msg.error,
              diffStats: msg.diffStats,
              unpushedCommits: msg.unpushedCommits,
              branch: msg.branch,
            });
          }
        };
        window.addEventListener("message", handler);
        timeoutId = setTimeout(() => {
          window.removeEventListener("message", handler);
          resolve({ output: "", error: "Timeout" });
        }, 10000);
      });

      vscodeApi.postMessage({
        command: "runGitStatus",
        requestId,
      });

      const result = await promise;
      if (result.error && result.error !== "Timeout") {
        console.error("[Git] Error from git status:", result.error);
        setGitError(result.error);
        setGitLoading(false);
        return;
      }

      if (result.error === "Timeout") {
        console.error("[Git] Timeout waiting for git status");
        setGitError("Git status timeout. Vui lòng thử lại.");
        setGitLoading(false);
        return;
      }

      const output = result.output || "";
      const diffStats = result.diffStats || {};
      const unpushedCommits: string[] = result.unpushedCommits || [];
      const branch: string = (result as any).branch || "";
      const lines = output.split("\n").filter((l: string) => l.trim());

      // Parse porcelain output for working-directory changes
      const items = lines.length > 0 ? parseGitStatusOutput(output) : [];

      // Add unpushed commits as virtual items
      for (const commitLine of unpushedCommits) {
        const trimmed = commitLine.trim();
        if (!trimmed) continue;
        // Format: "hash message"
        const spaceIdx = trimmed.indexOf(" ");
        const shortHash =
          spaceIdx > 0
            ? trimmed.substring(0, spaceIdx)
            : trimmed.substring(0, 7);
        const message = spaceIdx > 0 ? trimmed.substring(spaceIdx + 1) : "";
        items.push({
          status: "U", // Unpushed
          path: `${shortHash} ${message}`,
          staged: true,
          added: 0,
          deleted: 0,
          isUnpushedCommit: true,
        });
      }

      // Build items with stats (or keep empty for clean state)
      const itemsWithStats =
        items.length > 0
          ? items.map((item) => {
              const stats = diffStats[item.path];
              if (stats) {
                return { ...item, added: stats.added, deleted: stats.deleted };
              }
              return item;
            })
          : [];

      setGitStatus({ items: itemsWithStats, raw: output, diffStats, branch });
      setShowGitStatusBlock(true);

      const changeCount = itemsWithStats.length;
      const statusMessage =
        changeCount > 0
          ? `Đã kiểm tra git status. Tìm thấy ${changeCount} thay đổi.`
          : "Đã kiểm tra git status. Không có thay đổi nào.";

      const toolContent = `<git_status>
<items>${JSON.stringify(itemsWithStats)}</items>
<raw>${JSON.stringify(output)}</raw>
${statusMessage}
</git_status>`;

      const messageId = `msg-git-${Date.now()}`;
      const assistantMessage: Message = {
        id: messageId,
        role: "assistant",
        content: toolContent,
        timestamp: Date.now(),
      };

      setMessages((prev) => {
        const filtered = prev.filter((msg) => !msg.id.startsWith("msg-git-"));
        return [...filtered, assistantMessage];
      });

      const actionId = `${messageId}-action-0`;
      setToolOutputs((prev) => ({
        ...prev,
        [actionId]: {
          output: output,
          isError: false,
        },
      }));
      setGitLoading(false);
    } catch (err) {
      console.error("[Git] Exception in handleGitPullRequest:", err);
      setGitError(err instanceof Error ? err.message : "Unknown error");
      setGitLoading(false);
    }
  }, [gitLoading, setMessages, setToolOutputs]);

  const handleGitConfirm = useCallback(
    async (items?: any[]) => {
      const statusItems = items || gitStatus?.items || [];
      if (statusItems.length === 0) {
        const vscodeApi = (window as any).vscodeApi;
        if (vscodeApi) {
          vscodeApi.postMessage({
            command: "showInformation",
            message:
              "Chưa có thay đổi nào để commit. Hãy thêm file với 'git add' trước.",
          });
        }
        setShowGitStatusBlock(false);
        return;
      }

      setGitCommitLoading(true);
      const gitStatusText = statusItems
        .map(
          (item) =>
            `${item.staged ? "[staged]" : "[unstaged]"} ${item.status} ${item.path}`,
        )
        .join("\n");

      const modelToUse = enrichedModel ?? currentModel;
      const accountToUse = currentAccount;

      if (!modelToUse || !accountToUse) {
        setGitCommitLoading(false);
        setGitError(
          "Vui lòng chọn model và account trước khi tạo commit message.",
        );
        return;
      }

      const commitLang = commitMessageLanguage || "vi";
      const formattedPrompt = getCommitMessagePrompt(commitLang, gitStatusText);
      const prompt = `[COMMIT_MESSAGE_REQUEST]\n${formattedPrompt}`;

      try {
        await wrappedSendMessage(
          prompt,
          undefined,
          modelToUse,
          accountToUse,
          true,
          undefined,
          true,
        );

        setGitCommitLoading(false);
        setShowGitStatusBlock(false);
      } catch (err) {
        setGitCommitLoading(false);
        setGitError(
          err instanceof Error
            ? err.message
            : "Failed to generate commit message",
        );
      }
    },
    [
      gitStatus,
      enrichedModel,
      currentModel,
      currentAccount,
      commitMessageLanguage,
      currentConversationId,
      wrappedSendMessage,
    ],
  );

  const handleGitCancel = useCallback(() => {
    setShowGitStatusBlock(false);
    setGitCommitMessage(null);
    setGitError(null);
    setGitCommitInput("");
    // Remove the git status message from the conversation
    setMessages((prev) => prev.filter((msg) => !msg.id.startsWith("msg-git-")));
  }, [setMessages]);

  const handleGitRetry = useCallback(async () => {
    if (!gitCommitInput?.trim() || !gitStatus) return;

    setGitCommitLoading(true);
    const gitStatusText = gitStatus.items
      .map(
        (item) =>
          `${item.staged ? "[staged]" : "[unstaged]"} ${item.status} ${item.path}`,
      )
      .join("\n");

    const modelToUse = enrichedModel ?? currentModel;
    const accountToUse = currentAccount;

    if (!modelToUse || !accountToUse) {
      setGitCommitLoading(false);
      setGitError(
        "Vui lòng chọn model và account trước khi tạo commit message.",
      );
      return;
    }

    const prompt = `Hãy tạo một commit message dựa trên danh sách file thay đổi sau:

\`\`\`
${gitStatusText}
\`\`\`

Yêu cầu bổ sung: ${gitCommitInput.trim()}

Yêu cầu:
- Sử dụng cấu trúc: <emoji> <type>(<scope>): <subject>
- Liệt kê các thay đổi chi tiết với dấu "-" ở đầu dòng
- Viết bằng tiếng Việt
- Commit message ngắn gọn, rõ ràng, có ý nghĩa`;

    try {
      await wrappedSendMessage(
        prompt,
        undefined,
        modelToUse,
        accountToUse,
        false,
        undefined,
        undefined,
      );
      setGitCommitLoading(false);
      setGitCommitInput("");
      setShowGitStatusBlock(false);
    } catch (err) {
      setGitCommitLoading(false);
      setGitError(
        err instanceof Error
          ? err.message
          : "Failed to generate commit message",
      );
    }
  }, [
    gitCommitInput,
    gitStatus,
    enrichedModel,
    currentModel,
    currentAccount,
    wrappedSendMessage,
  ]);

  const handleGitCommit = useCallback(async (message: string) => {
    if (!message.trim()) return;
    const vscodeApi = (window as any).vscodeApi;
    if (!vscodeApi) {
      setGitError("Không thể kết nối với VSCode API");
      return;
    }

    setGitCommitLoading(true);
    try {
      const requestId = `git-commit-${Date.now()}`;
      const promise = new Promise<{ success: boolean; error?: string }>(
        (resolve) => {
          const handler = (event: MessageEvent) => {
            const msg = event.data;
            if (
              msg.command === "gitCommitResult" &&
              msg.requestId === requestId
            ) {
              window.removeEventListener("message", handler);
              resolve({ success: msg.success, error: msg.error });
            }
          };
          window.addEventListener("message", handler);
          setTimeout(() => {
            window.removeEventListener("message", handler);
            resolve({ success: false, error: "Timeout" });
          }, 15000);
        },
      );

      vscodeApi.postMessage({
        command: "gitCommitAndPush",
        requestId,
        message: message.trim(),
      });

      const result = await promise;
      setGitCommitLoading(false);
      if (result.success) {
        setGitCommitMessage(null);
        setShowGitStatusBlock(false);
        vscodeApi.postMessage({
          command: "showInformation",
          message: "✅ Commit và push thành công!",
        });
      } else {
        setGitError(result.error || "Commit failed");
      }
    } catch (err) {
      setGitCommitLoading(false);
      setGitError(err instanceof Error ? err.message : "Commit failed");
    }
  }, []);

  // Listen for AI response containing commit message
  const handleGitCommitMessageDetected = useCallback((messages: Message[]) => {
    const lastMessage = messages[messages.length - 1];
    if (lastMessage?.role === "assistant" && !lastMessage.isCancelled) {
      const content = lastMessage.content;
      if (content && content.includes(":") && content.includes("-")) {
        const lines = content.split("\n").filter((l) => l.trim());
        const hasCommitFormat = lines.some(
          (l) => /^[\u{1F300}-\u{1F9FF}]/u.test(l) || /^[a-z]+\(/.test(l),
        );
        if (hasCommitFormat) {
          setGitCommitMessage(content);
        }
      }
    }
  }, []);

  return {
    gitStatus,
    gitLoading,
    gitError,
    showGitStatusBlock,
    gitCommitMessage,
    gitCommitLoading,
    gitCommitInput,
    setGitCommitInput,
    setShowGitStatusBlock,
    setGitError,
    setGitCommitMessage,
    enrichedModel,
    handleGitPullRequest,
    handleGitConfirm,
    handleGitCancel,
    handleGitRetry,
    handleGitCommit,
    handleGitCommitMessageDetected,
  };
};
