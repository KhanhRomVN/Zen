import { extensionService, messageDispatcher } from "@/services/ExtensionService";
import { TOOL_TIMEOUTS } from "../../constants/constants";
import { WriteToFileParams } from "../../types/tool-types";

const WRITE_TO_FILE_TIMEOUT_MS = TOOL_TIMEOUTS.write_to_file || 10000;
/**
 * Execute write_to_file tool
 * Writes content to a file via the extension
 */
export async function executeWriteToFile(
  params: WriteToFileParams,
  skipDiagnostics: boolean = false,
  bypassIgnore: boolean = false,
  conversationId?: string,
  actionId?: string
): Promise<string | null> {
  return new Promise((resolve) => {
    const requestId = `write-${Date.now()}-${Math.random()}`;
    const filePath = params.path || params.file_path || "";

    extensionService.postMessage({
      command: "writeFile",
      path: filePath,
      content: params.content || "",
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
          console.error(`[write_to_file] Error response`, {
            requestId,
            filePath,
            error: msg.error,
          });
          resolve(
            `[write_to_file for '${filePath}'] Result: Error - ${msg.error}`,
          );
        } else {
          let result = `[write_to_file for '${filePath}'] Result: File written successfully`;
          if (msg.diagnostics?.length > 0)
            result += `\n\n⚠️ **Diagnostics Found:**\n${msg.diagnostics.join("\n")}`;
          resolve(result);
        }
      },
      WRITE_TO_FILE_TIMEOUT_MS,
      () => {
        console.warn(`[write_to_file] Timeout`, { requestId, filePath });
        resolve(null);
      },
    );
  });
}
