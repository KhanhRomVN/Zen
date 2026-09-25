import {
  ExecutorContext,
  ExecutorOptions,
  ToolExecutor,
} from "../../types/executor-types";
import { formatDiagnostics } from "../../utils/diagnostic-utils";

export class WriteToFileExecutor implements ToolExecutor {
  async execute(
    action: any,
    context: ExecutorContext,
    options: ExecutorOptions = {},
  ): Promise<string | null> {
    const { skipDiagnostics = false, bypassIgnore = false } = options;
    const {
      setToolOutputs,
      conversationIdRef,
      getToolTimeout,
      extensionService,
      messageDispatcher,
    } = context;

    return new Promise((resolve) => {
      const requestId = `write-${Date.now()}-${Math.random()}`;
      const filePath = action.params.path || action.params.file_path;
      const actionId = action.actionId;
      // Dùng tên tool gốc trong result string (vd: "create_file" khi convert từ Claude)
      const toolName = action.params.original_tool_name || "write_to_file";

      extensionService.postMessage({
        command: "writeFile",
        path: filePath,
        content: action.params.content,
        requestId,
        skipDiagnostics,
        bypassIgnore,
        conversationId: conversationIdRef?.current,
        actionId: actionId,
      });

      messageDispatcher.register(
        requestId,
        (msg) => {
          if (msg.error) {
            console.error(`[write_to_file] Error response`, {
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
              `[${toolName} for '${filePath}'] Result: Error - ${msg.error}`,
            );
          } else {
            let result = `[${toolName} for '${filePath}'] Result: File written successfully`;

            // Add skippedReason if diagnostics were skipped (file too large / timeout)
            if (msg.skippedReason) {
              result += `\n⚠️ ${msg.skippedReason}`;
            }

            // Add diagnostics if any
            if (msg.diagnostics && msg.diagnostics.length > 0) {
              const errorCount = msg.diagnostics.filter(
                (d: any) => d.severity === "Error" || d.severity === "error",
              ).length;
              const warningCount = msg.diagnostics.filter(
                (d: any) =>
                  d.severity === "Warning" || d.severity === "warning",
              ).length;

              result = `[${toolName} for '${filePath}'] Result: File written successfully with ${errorCount} error(s), ${warningCount} warning(s)`;

              const contentLines = action.params.content.split("\n");
              result += formatDiagnostics(msg.diagnostics, contentLines);
            }

            setToolOutputs((prev) => ({
              ...prev,
              [actionId]: {
                output: action.params.content,
                isError: false,
                diagnostics: msg.diagnostics || undefined,
                skippedReason: msg.skippedReason || undefined,
              },
            }));

            resolve(result);
          }
        },
        getToolTimeout(action.type),
        () => {
          console.warn(`[write_to_file] Timeout`, { requestId, filePath });
          const timeoutError = `Operation timed out after ${
            getToolTimeout(action.type) / 1000
          }s. The file write took too long to complete (possibly waiting for diagnostics).`;
          setToolOutputs((prev) => ({
            ...prev,
            [actionId]: {
              output: timeoutError,
              isError: true,
            },
          }));
          resolve(
            `[${toolName} for '${filePath}'] Result: Error - ${timeoutError}`,
          );
        },
      );
    });
  }
}
