import {
  extensionService,
  messageDispatcher,
} from "@/services/ExtensionService";
import { TOOL_TIMEOUTS } from "../../constants/constants";
import { RevertFileParams } from "../../types/tool-types";

const REVERT_FILE_TIMEOUT_MS = TOOL_TIMEOUTS.revert_file || 10000;

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
      REVERT_FILE_TIMEOUT_MS,
      () => {
        console.warn(`[revert_file] Timeout`, { requestId, filePath });
        resolve(null);
      },
    );
  });
}
