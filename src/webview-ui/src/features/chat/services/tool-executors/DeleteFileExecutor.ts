import {
  ExecutorContext,
  ExecutorOptions,
  ToolExecutor,
} from "../../types/executor-types";

export class DeleteFileExecutor implements ToolExecutor {
  async execute(
    action: any,
    context: ExecutorContext,
    options: ExecutorOptions = {},
  ): Promise<string | null> {
    const { getToolTimeout, extensionService, messageDispatcher } = context;

    return new Promise((resolve) => {
      const requestId = `delete-file-${Date.now()}-${Math.random()}`;
      const filePath = action.params.file_path;

      extensionService.postMessage({
        command: "deleteFile",
        file_path: filePath,
        requestId,
      });

      messageDispatcher.register(
        requestId,
        (msg) => {
          if (msg.error) {
            resolve(
              `[delete_file for '${filePath}'] Result: Error - ${msg.error}`,
            );
            return;
          }
          resolve(
            `[delete_file for '${filePath}'] Result: File deleted successfully`,
          );
        },
        getToolTimeout(action.type),
        () => {
          const timeoutError = `Operation timed out after ${
            getToolTimeout(action.type) / 1000
          }s. Failed to delete file.`;
          resolve(
            `[delete_file for '${filePath}'] Result: Error - ${timeoutError}`,
          );
        },
      );
    });
  }
}
