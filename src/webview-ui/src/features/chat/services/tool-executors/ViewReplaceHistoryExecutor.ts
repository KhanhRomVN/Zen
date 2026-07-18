import { extensionService, messageDispatcher } from "@/services/ExtensionService";
import { TOOL_TIMEOUTS } from "../../constants/constants";

const VIEW_REPLACE_HISTORY_TIMEOUT_MS = TOOL_TIMEOUTS.replace_in_file || 10000;

export interface ViewReplaceHistoryParams {
  file_path?: string;
  filePath?: string;
  path?: string;
}

/**
 * Execute view_replace_history tool
 * Xem lịch sử replace_in_file của một file
 */
export async function executeViewReplaceHistory(
  params: ViewReplaceHistoryParams,
  conversationId?: string,
): Promise<string | null> {
  return new Promise((resolve) => {
    const requestId = `view-history-${Date.now()}-${Math.random()}`;
    const filePath = params.path || params.file_path || params.filePath || "";

    extensionService.postMessage({
      command: "viewReplaceHistory",
      filePath,
      conversationId,
      requestId,
    });

    messageDispatcher.register(
      requestId,
      (msg) => {
        if (msg.error) {
          console.error(`[view_replace_history] Error response`, {
            requestId,
            filePath,
            error: msg.error,
          });
          resolve(
            `[view_replace_history for '${filePath}'] Result: Error - ${msg.error}`,
          );
        } else {
          const histories = msg.histories || [];
          
          if (histories.length === 0) {
            resolve(
              `[view_replace_history for '${filePath}'] Result: No replace_in_file history found for this file.`,
            );
            return;
          }

          let result = `[view_replace_history for '${filePath}'] Found ${histories.length} version(s):\n\n`;
          
          histories.forEach((h: any, index: number) => {
            const date = new Date(h.timestamp).toLocaleString();
            result += `**Version ${h.version}**\n`;
            result += `- Errors: ${h.errorCount}, Warnings: ${h.warningCount}\n`;
            result += `- Date: ${date}\n`;
            if (index < histories.length - 1) {
              result += `\n`;
            }
          });

          resolve(result);
        }
      },
      VIEW_REPLACE_HISTORY_TIMEOUT_MS,
      () => {
        console.warn(`[view_replace_history] Timeout`, { requestId, filePath });
        resolve(null);
      },
    );
  });
}
