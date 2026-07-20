import { extensionService, messageDispatcher } from "@/services/ExtensionService";
import { TOOL_TIMEOUT } from "../../constants/constants";
import { MoveFileParams } from "../../types/tool-types";

export const executeMoveFile = (params: MoveFileParams): Promise<string | null> => {
  return new Promise((resolve) => {
    const requestId = `move-file-${Date.now()}-${Math.random()}`;
    const filePath = params.file_path;
    const targetFolderPath = params.target_folder_path;
    
    extensionService.postMessage({
      command: "moveFile",
      file_path: filePath,
      target_folder_path: targetFolderPath,
      requestId,
    });
    
    messageDispatcher.register(
      requestId,
      (msg) => {
        if (msg.error) {
          resolve(`[move_file from '${filePath}' to '${targetFolderPath}'] Result: Error - ${msg.error}`);
          return;
        }
        resolve(`[move_file from '${filePath}' to '${targetFolderPath}'] Result: File moved successfully to '${msg.newPath || targetFolderPath}'`);
      },
      TOOL_TIMEOUT,
      () => resolve(null),
    );
  });
};
