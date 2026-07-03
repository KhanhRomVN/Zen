import { extensionService, messageDispatcher } from "@/services/ExtensionService";
import { DeleteFileParams } from "../../types/tool-types";

const TOOL_TIMEOUT_STANDARD = 10_000;

export const executeDeleteFile = (params: DeleteFileParams): Promise<string | null> => {
  return new Promise((resolve) => {
    const requestId = `delete-file-${Date.now()}-${Math.random()}`;
    const filePath = params.file_path;
    
    extensionService.postMessage({
      command: "deleteFile",
      file_path: filePath,
      requestId,
    });
    
    messageDispatcher.register(
      requestId,
      (msg) => {
        if (msg.error) {
          resolve(`[delete_file for '${filePath}'] Result: Error - ${msg.error}`);
          return;
        }
        resolve(`[delete_file for '${filePath}'] Result: File deleted successfully`);
      },
      TOOL_TIMEOUT_STANDARD,
      () => resolve(null),
    );
  });
};
