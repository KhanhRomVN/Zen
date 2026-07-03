import { extensionService, messageDispatcher } from "@/services/ExtensionService";
import { DeleteFolderParams } from "../../types/tool-types";

const TOOL_TIMEOUT_STANDARD = 10_000;

export const executeDeleteFolder = (params: DeleteFolderParams): Promise<string | null> => {
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
          resolve(`[delete_folder for '${folderPath}'] Result: Error - ${msg.error}`);
          return;
        }
        resolve(`[delete_folder for '${folderPath}'] Result: Folder deleted successfully`);
      },
      TOOL_TIMEOUT_STANDARD,
      () => resolve(null),
    );
  });
};
