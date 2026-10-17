/**
 * Hook build prompt commit message từ 1 repo (gọi gitStatus qua extension
 * rồi build prompt từ commit-message.ts). KHÔNG tự gửi — trả về string
 * để caller tự setMessage vào MessageInput.
 */

import { useCallback } from "react";
import { setActiveGitRepo } from "../features/chat/utils/active-git-repo";
import { getCommitMessagePrompt } from "../features/chat/prompts/commit-message";
import { extensionService, messageDispatcher } from "../services/ExtensionService";

export interface UseCommitPromptBuilderOptions {
  commitMessageLanguage: string;
  toolFormat: "xml" | "json";
}

export const useCommitPromptBuilder = ({
  commitMessageLanguage,
  toolFormat,
}: UseCommitPromptBuilderOptions) => {
  const build = useCallback(
    async (repoPath: string): Promise<string | null> => {
      const requestId = `git-status-${Date.now()}`;
      const result = await new Promise<{
        output: string;
        error?: string;
        branch?: string;
      }>(
        (resolve) => {
          messageDispatcher.register(
            requestId,
            (msg: any) =>
              resolve({
                output: msg.output,
                error: msg.error,
                branch: msg.branch,
              }),
            10000,
            () => resolve({ output: "", error: "Timeout" }),
          );
          extensionService.postMessage({
            command: "gitStatus",
            requestId,
            repoPath,
            prefixPaths: true,
          });
        },
      );

      if (result.error) {
        (window as any).vscodeApi?.postMessage({
          command: "showError",
          message: `Git status failed: ${result.error}`,
        });
        return null;
      }

      const output = (result.output || "").trim();
      if (!output) {
        (window as any).vscodeApi?.postMessage({
          command: "showInformation",
          message: `Repo "${repoPath}" không có thay đổi nào để tạo commit message.`,
        });
        return null;
      }

      setActiveGitRepo({ path: repoPath, branch: result.branch || "" });

      const commitLang = commitMessageLanguage || "vi";
      const formattedPrompt = getCommitMessagePrompt(
        commitLang,
        output,
        undefined,
        toolFormat,
      );
      return `[COMMIT_MESSAGE_REQUEST]\n${formattedPrompt}`;
    },
    [commitMessageLanguage, toolFormat],
  );

  return { build };
};