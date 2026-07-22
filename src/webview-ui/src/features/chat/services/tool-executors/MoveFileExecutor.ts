import {
  ExecutorContext,
  ExecutorOptions,
  ToolExecutor,
} from "../../types/executor-types";

export class MoveFileExecutor implements ToolExecutor {
  async execute(
    action: any,
    context: ExecutorContext,
    options: ExecutorOptions = {},
  ): Promise<string | null> {
    const { getToolTimeout, extensionService, messageDispatcher } = context;

    return new Promise((resolve) => {
      const requestId = `move-file-${Date.now()}-${Math.random()}`;
      const filePath = action.params.file_path;
      const targetFolderPath = action.params.target_folder_path;

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
            resolve(
              `[move_file from '${filePath}' to '${targetFolderPath}'] Result: Error - ${msg.error}`,
            );
            return;
          }
          resolve(
            `[move_file from '${filePath}' to '${targetFolderPath}'] Result: File moved successfully to '${
              msg.newPath || targetFolderPath
            }'`,
          );
        },
        getToolTimeout(action.type),
        () => {
          const timeoutError = `Operation timed out after ${
            getToolTimeout(action.type) / 1000
          }s. Failed to move file.`;
          resolve(
            `[move_file from '${filePath}' to '${targetFolderPath}'] Result: Error - ${timeoutError}`,
          );
        },
      );
    });
  }
}
