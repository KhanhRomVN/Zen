import {
  extensionService,
  messageDispatcher,
} from "@/services/ExtensionService";
import { getToolTimeout } from "../../constants/constants";
import { ListFilesParams } from "../../types/tool-types";

/**
 * Execute list_files tool
 * Lists files in a directory
 */
export async function executeListFiles(
  params: ListFilesParams,
  bypassIgnore: boolean = false,
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

        // Return raw JSON array - let the UI format it
        resolve(listResults);
      },
      TOOL_TIMEOUT,
      () => resolve(null),
    );
  });
}
