import {
  ExecutorContext,
  ExecutorOptions,
  ToolExecutor,
} from "../../types/executor-types";

export class RevertFileExecutor implements ToolExecutor {
  async execute(
    action: any,
    context: ExecutorContext,
    options: ExecutorOptions = {},
  ): Promise<string | null> {
    const { bypassIgnore = false } = options;
    const {
      setToolOutputs,
      conversationIdRef,
      getToolTimeout,
      extensionService,
      messageDispatcher,
    } = context;

    return new Promise((resolve) => {
      const requestId = `revert-${Date.now()}-${Math.random()}`;
      const filePath = action.params.path || action.params.file_path;
      const version = action.params.version;
      const actionId = action.actionId;

      extensionService.postMessage({
        command: "revertFile",
        path: filePath,
        version,
        requestId,
        bypassIgnore,
        conversationId: conversationIdRef?.current,
        actionId: actionId,
      });

      messageDispatcher.register(
        requestId,
        (msg) => {
          if (msg.error) {
            console.error(`[revert_file] Error response`, {
              requestId,
              filePath,
              error: msg.error,
            });
            setToolOutputs((prev) => ({
              ...prev,
              [actionId]: {
                output: `Error - ${msg.error}`,
                isError: true,
              },
            }));
            resolve(
              `[revert_file for '${filePath}'] Result: Error - ${msg.error}`,
            );
          } else {
            const versionMsg =
              version !== undefined ? ` to version ${version}` : "";
            const result = `[revert_file for '${filePath}'] Result: File reverted successfully${versionMsg}`;

            // Store old/new content in action params for diff view
            if (msg.oldContent !== undefined && msg.newContent !== undefined) {
              action.params.old_content = msg.oldContent;
              action.params.new_content = msg.newContent;
            }

            // Store output in toolOutputs
            setToolOutputs((prev) => ({
              ...prev,
              [actionId]: {
                output: "Reverted",
                isError: false,
                diagnostics: msg.diagnostics || undefined,
              },
            }));

            resolve(result);
          }
        },
        getToolTimeout(action.type),
        () => {
          console.warn(`[revert_file] Timeout`, { requestId, filePath });
          const timeoutError = `Operation timed out after ${
            getToolTimeout(action.type) / 1000
          }s. The file revert took too long to complete.`;
          setToolOutputs((prev) => ({
            ...prev,
            [actionId]: {
              output: timeoutError,
              isError: true,
            },
          }));
          resolve(
            `[revert_file for '${filePath}'] Result: Error - ${timeoutError}`,
          );
        },
      );
    });
  }
}
