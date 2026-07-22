import {
  ExecutorContext,
  ExecutorOptions,
  ToolExecutor,
} from "../../types/executor-types";

export class ViewReplaceHistoryExecutor implements ToolExecutor {
  async execute(
    action: any,
    context: ExecutorContext,
    options: ExecutorOptions = {},
  ): Promise<string | null> {
    const {
      setToolOutputs,
      conversationIdRef,
      getToolTimeout,
      extensionService,
      messageDispatcher,
    } = context;

    return new Promise((resolve) => {
      const requestId = `view-history-${Date.now()}-${Math.random()}`;
      const filePath = action.params.path || action.params.file_path;
      const actionId = action.actionId;

      extensionService.postMessage({
        command: "viewReplaceHistory",
        filePath,
        conversationId: conversationIdRef?.current,
        requestId,
      });

      messageDispatcher.register(
        requestId,
        (msg) => {
          if (msg.error) {
            console.error(`[view_replace_history] Error response`, {
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
              `[view_replace_history for '${filePath}'] Result: Error - ${msg.error}`,
            );
          } else {
            const histories = msg.histories || [];

            if (histories.length === 0) {
              const result = `[view_replace_history for '${filePath}'] Result: No replace_in_file history found for this file.`;
              setToolOutputs((prev) => ({
                ...prev,
                [actionId]: {
                  output: "No history",
                  isError: false,
                },
              }));
              resolve(result);
              return;
            }

            let result = `[view_replace_history for '${filePath}'] Found ${histories.length} version(s):\n\n`;

            histories.forEach(
              (
                h: {
                  version: number;
                  errorCount: number;
                  warningCount: number;
                  lineCount: number;
                },
                index: number,
              ) => {
                result += `**Version ${h.version}**\n`;
                result += `- Lines: ${h.lineCount}, Errors: ${h.errorCount}, Warnings: ${h.warningCount}\n`;
                if (index < histories.length - 1) {
                  result += `\n`;
                }
              },
            );

            const stringified = JSON.stringify(histories);
            setToolOutputs((prev) => ({
              ...prev,
              [actionId]: {
                output: stringified,
                isError: false,
              },
            }));

            resolve(result);
          }
        },
        getToolTimeout(action.type),
        () => {
          console.warn(`[view_replace_history] Timeout`, {
            requestId,
            filePath,
          });
          const timeoutError = `Operation timed out after ${
            getToolTimeout(action.type) / 1000
          }s. Failed to retrieve file history.`;
          setToolOutputs((prev) => ({
            ...prev,
            [actionId]: {
              output: timeoutError,
              isError: true,
            },
          }));
          resolve(
            `[view_replace_history for '${filePath}'] Result: Error - ${timeoutError}`,
          );
        },
      );
    });
  }
}
