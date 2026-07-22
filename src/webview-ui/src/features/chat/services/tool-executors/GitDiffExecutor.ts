import { ToolExecutor, ExecutorContext, ExecutorOptions } from "./types";

export class GitDiffExecutor implements ToolExecutor {
  async execute(
    action: any,
    context: ExecutorContext,
    options: ExecutorOptions = {}
  ): Promise<string | null> {
    const { getToolTimeout, extensionService, messageDispatcher } = context;

    return new Promise((resolve) => {
      const requestId = `git-diff-${Date.now()}-${Math.random()}`;
      const filePath = action.params.file_path || action.params.path;

      extensionService.postMessage({
        command: "gitDiff",
        file_path: filePath,
        requestId,
      });

      messageDispatcher.register(
        requestId,
        (msg) => {
          if (msg.error) {
            resolve(
              `[git_diff for '${filePath}'] Result: Error - ${msg.error}`
            );
          } else {
            let diffContent = msg.diff || "";
            // Clean diff content: remove metadata lines that are not useful for AI
            const cleanLines = diffContent
              .split("\n")
              .filter((line: string) => {
                const trimmed = line.trim();
                if (trimmed.startsWith("diff")) return false;
                if (trimmed.startsWith("index ")) return false;
                if (trimmed.startsWith("new file mode")) return false;
                if (trimmed.startsWith("deleted file mode")) return false;
                if (trimmed.includes("No newline at end of file"))
                  return false;
                return true;
              });
            diffContent = cleanLines.join("\n");
            resolve(
              `[git_diff for '${filePath}'] Result:\n\`\`\`diff\n${diffContent}\n\`\`\``
            );
          }
        },
        getToolTimeout(action.type),
        () => {
          const timeoutError = `Operation timed out after ${
            getToolTimeout(action.type) / 1000
          }s. Failed to get git diff.`;
          resolve(
            `[git_diff for '${filePath}'] Result: Error - ${timeoutError}`
          );
        }
      );
    });
  }
}
