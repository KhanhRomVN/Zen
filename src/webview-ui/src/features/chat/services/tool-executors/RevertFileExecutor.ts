import {
  extensionService,
  messageDispatcher,
} from "@/services/ExtensionService";
import { getToolTimeout } from "../../constants/constants";
import { RevertFileParams } from "../../types/tool-types";

/**
 * Execute revert_file tool
 * Reverts (undoes) the last change made to a file using VSCode's undo functionality
 */
export async function executeRevertFile(
  params: RevertFileParams,
  bypassIgnore: boolean = false,
  conversationId?: string,
  actionId?: string,
): Promise<string | null> {
  return new Promise((resolve) => {
    const requestId = `revert-${Date.now()}-${Math.random()}`;
    const filePath = params.path || params.file_path || "";

    extensionService.postMessage({
      command: "revertFile",
      path: filePath,
      requestId,
      bypassIgnore,
      conversationId,
      actionId,
    });

    messageDispatcher.register(
      requestId,
      (msg) => {
        if (msg.error) {
          console.error(`[revert_file] Error response`, {
            requestId,
            filePath,
            error: msg.error,
          });
          resolve(
            `[revert_file for '${filePath}'] Result: Error - ${msg.error}`,
          );
        } else {
          resolve(
            `[revert_file for '${filePath}'] Result: File reverted successfully (undo applied)`,
          );
        }
      },
      getToolTimeout('revert_file'),
      () => {
        console.warn(`[revert_file] Timeout`, { requestId, filePath });
        resolve(null);
      },
    );
  });
}
