import { extensionService, messageDispatcher } from "@/services/ExtensionService";
import { TOOL_TIMEOUTS } from "../../constants/constants";
import { ReplaceInFileParams } from "../../types/tool-types";

const REPLACE_IN_FILE_TIMEOUT_MS = TOOL_TIMEOUTS.replace_in_file || 10000;
/**
 * Execute replace_in_file tool
 * Replaces content in a file using diff format
 */
export async function executeReplaceInFile(
  params: ReplaceInFileParams,
  skipDiagnostics: boolean = false,
  bypassIgnore: boolean = false,
  conversationId?: string,
  actionId?: string
): Promise<string | null> {
  return new Promise((resolve) => {
    const requestId = `replace-${Date.now()}-${Math.random()}`;
    const filePath = params.path || params.file_path || "";

    extensionService.postMessage({
      command: "replaceInFile",
      path: filePath,
      old_str: params.old_str,
      new_str: params.new_str,
      diff: params.diff, // Legacy support
      requestId,
      skipDiagnostics,
      bypassIgnore,
      conversationId,
      actionId,
    });

    messageDispatcher.register(
      requestId,
      (msg) => {
        if (msg.error) {
          console.error(`[replace_in_file] Error response`, {
            requestId,
            filePath,
            error: msg.error,
          });
          resolve(
            `[replace_in_file for '${filePath}'] Result: Error - ${msg.error}`,
          );
        } else {
          let result = `[replace_in_file for '${filePath}'] Result: File updated successfully`;
          if (msg.diagnostics?.length > 0)
            result += `\n\n⚠️ **Diagnostics Found:**\n${msg.diagnostics.join("\n")}`;
          resolve(result);
        }
      },
      REPLACE_IN_FILE_TIMEOUT_MS,
      () => {
        console.warn(`[replace_in_file] Timeout`, { requestId, filePath });
        resolve(null);
      },
    );
  });
}
