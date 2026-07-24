import {
  ExecutorContext,
  ExecutorOptions,
  ToolExecutor,
} from "../../types/executor-types";
import { formatGrepResultCompact } from "../../utils/grepFormatter";

export class GrepExecutor implements ToolExecutor {
  async execute(
    action: any,
    context: ExecutorContext,
    options: ExecutorOptions = {},
  ): Promise<string | null> {
    const { getToolTimeout, extensionService, messageDispatcher } = context;

    return new Promise((resolve) => {
      const searchTerm = action.params.search_term;
      const filePath = action.params.file_path;
      const folderPath = action.params.folder_path;
      const targetDesc = filePath || folderPath || "unknown";

      // Check for validation error from parser
      if (action.params._validationError) {
        const errMsg = action.params._validationError;
        console.warn(
          `[Zen][grep] Validation error | pattern="${searchTerm}" | error="${errMsg}"`,
        );
        resolve(
          `[grep for '${searchTerm}' in '${targetDesc}'] Result: Error - ${errMsg}`,
        );
        return;
      }

      const requestId = `grep-${Date.now()}-${Math.random()}`;

      extensionService.postMessage({
        command: "executeGrep",
        action: {
          type: "grep",
          search_term: searchTerm,
          file_path: filePath,
          folder_path: folderPath,
          requestId,
          timestamp: Date.now(),
        },
      });

      messageDispatcher.register(
        requestId,
        (msg) => {
          if (msg.result?.success) {
            const data = msg.result.data;
            // Format as compact XML-like text to minimize token usage
            const resultText = formatGrepResultCompact(data);
            resolve(
              `[grep for '${searchTerm}' in '${targetDesc}'] Result:\n${resultText}`,
            );
          } else {
            const errMsg = msg.result?.error || "Unknown error";
            console.warn(
              `[Zen][grep] Error | requestId=${requestId} | error="${errMsg}"`,
            );
            resolve(
              `[grep for '${searchTerm}' in '${targetDesc}'] Result: Error - ${errMsg}`,
            );
          }
        },
        getToolTimeout(action.type),
        () => {
          console.warn(
            `[Zen][grep] Timeout | requestId=${requestId} | search_term="${searchTerm}" | target="${targetDesc}"`,
          );
          const timeoutError = `Operation timed out after ${
            getToolTimeout(action.type) / 1000
          }s. Search took too long to complete.`;
          resolve(
            `[grep for '${searchTerm}' in '${targetDesc}'] Result: Error - ${timeoutError}`,
          );
        },
      );
    });
  }
}
