import {
  extensionService,
  messageDispatcher,
} from "@/services/ExtensionService";
import { getToolTimeout } from "../../constants/constants";
import { DeleteFolderParams } from "../../types/tool-types";

export const executeDeleteFolder = (
  params: DeleteFolderParams,
): Promise<string | null> => {
  return new Promise((resolve) => {
    const requestId = `delete-folder-${Date.now()}-${Math.random()}`;
    const folderPath = params.folder_path;

    extensionService.postMessage({
      command: "deleteFolder",
      folder_path: folderPath,
      requestId,
    });

    messageDispatcher.register(
      requestId,
      (msg) => {
        if (msg.error) {
          resolve(
            `[delete_folder for '${folderPath}'] Result: Error - ${msg.error}`,
          );
          return;
        }
        resolve(
          `[delete_folder for '${folderPath}'] Result: Folder deleted successfully`,
        );
      },
      TOOL_TIMEOUT,
      () => resolve(null),
    );
  });
};
