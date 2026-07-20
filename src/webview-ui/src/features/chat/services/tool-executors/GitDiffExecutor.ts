import {
  extensionService,
  messageDispatcher,
} from "@/services/ExtensionService";
import { getToolTimeout } from "../../constants/constants";

const GIT_DIFF_TIMEOUT_MS = TOOL_TIMEOUT;
/**
 * Execute git_diff tool
 * Requests git diff for a specific file from the extension
 */
export async function executeGitDiff(
  filePath: string,
  requestId: string,
): Promise<string | null> {
  return new Promise((resolve) => {
    extensionService.postMessage({
      command: "gitDiff",
      file_path: filePath,
      requestId,
    });

    messageDispatcher.register(
      requestId,
      (msg) => {
        if (msg.error) {
          resolve(`[git_diff for '${filePath}'] Result: Error - ${msg.error}`);
        } else {
          let diffContent = msg.diff || "";
          // Clean diff content: remove metadata lines that are not useful for AI
          const cleanLines = diffContent.split("\n").filter((line: string) => {
            const trimmed = line.trim();
            if (trimmed.startsWith("diff")) return false;
            if (trimmed.startsWith("index ")) return false;
            if (trimmed.startsWith("new file mode")) return false;
            if (trimmed.startsWith("deleted file mode")) return false;
            if (trimmed.includes("No newline at end of file")) return false;
            return true;
          });
          diffContent = cleanLines.join("\n");
          resolve(
            `[git_diff for '${filePath}'] Result:\n\`\`\`diff\n${diffContent}\n\`\`\``,
          );
        }
      },
      GIT_DIFF_TIMEOUT_MS,
      () => {
        resolve(null);
      },
    );
  });
}
