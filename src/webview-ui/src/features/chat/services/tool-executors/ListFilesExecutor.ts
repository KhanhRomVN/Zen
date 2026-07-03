import { extensionService, messageDispatcher } from "@/services/ExtensionService";
import { TOOL_TIMEOUTS } from "../../constants/constants";
import { ListFilesParams } from "../../types/tool-types";

const LIST_FILES_TIMEOUT_MS = TOOL_TIMEOUTS.list_files || 10000;
/**
 * Execute list_files tool
 * Lists files in a directory
 */
export async function executeListFiles(
  params: ListFilesParams,
  bypassIgnore: boolean = false
): Promise<string | null> {
  return new Promise((resolve) => {
    const requestId = `list-${Date.now()}-${Math.random()}`;
    const folderPath = params.path || params.folder_path || "";

    extensionService.postMessage({
      command: "listFiles",
      path: folderPath,
      recursive: params.recursive,
      depth: params.depth,
      type: params.type,
      requestId,
      bypassIgnore,
    });

    messageDispatcher.register(
      requestId,
      (msg) => {
        if (msg.error) {
          resolve(
            `[list_files for '${folderPath}'] Result: Error - ${msg.error}`,
          );
          return;
        }
        const listResults = msg.files || msg.results;
        resolve(
          `[list_files for '${folderPath}'] Result:\n\`\`\`\n${Array.isArray(listResults) ? JSON.stringify(listResults, null, 2) : String(listResults)}\n\`\`\``,
        );
      },
      LIST_FILES_TIMEOUT_MS,
      () => resolve(null),
    );
  });
}
