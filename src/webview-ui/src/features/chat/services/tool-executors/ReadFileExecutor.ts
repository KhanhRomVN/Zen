import { extensionService, messageDispatcher } from "@/services/ExtensionService";
import { TOOL_TIMEOUTS } from "../../constants/constants";
import { ReadFileParams } from "../../types/tool-types";

const READ_FILE_TIMEOUT_MS = TOOL_TIMEOUTS.read_file || 10000;

/**
 * Execute read_file tool
 * Reads file content from the extension
 */
export async function executeReadFile(
  params: ReadFileParams,
  bypassIgnore: boolean = false
): Promise<string | null> {
  return new Promise((resolve) => {
    const requestId = `read-${Date.now()}-${Math.random()}`;
    const filePath = params.path || params.file_path || "";

    extensionService.postMessage({
      command: "readFile",
      path: filePath,
      start_line: params.start_line,
      end_line: params.end_line,
      requestId,
      bypassIgnore,
    });

    messageDispatcher.register(
      requestId,
      (msg) => {
        if (msg.error) {
          resolve(
            `[read_file for '${filePath}'] Result: Error - ${msg.error}`,
          );
        } else {
          const content = msg.content || "";
          resolve(
            `[read_file for '${filePath}'] Result:\n\`\`\`\n${content}\n\`\`\``,
          );
        }
      },
      READ_FILE_TIMEOUT_MS,
      () => {
        console.warn(`[read_file] Timeout`, { requestId, filePath });
        resolve(null);
      },
    );
  });
}
