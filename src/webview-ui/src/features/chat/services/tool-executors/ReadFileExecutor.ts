import {
  ExecutorContext,
  ExecutorOptions,
  ToolExecutor,
} from "../../types/executor-types";
import { formatDiagnostics } from "../../utils/diagnostic-utils";

export class ReadFileExecutor implements ToolExecutor {
  async execute(
    action: any,
    context: ExecutorContext,
    options: ExecutorOptions = {},
  ): Promise<string | null> {
    const { bypassIgnore = false } = options;
    const {
      setToolOutputs,
      getToolTimeout,
      extensionService,
      messageDispatcher,
    } = context;

    return new Promise((resolve) => {
      const requestId = `read-${Date.now()}-${Math.random()}`;
      const filePath = action.params.path || action.params.file_path;
      const actionId = action.actionId;

      extensionService.postMessage({
        command: "readFile",
        path: filePath,
        start_line: action.params.start_line,
        end_line: action.params.end_line,
        requestId,
        bypassIgnore,
      });

      messageDispatcher.register(
        requestId,
        (msg) => {
          if (msg.error) {
            setToolOutputs((prev) => ({
              ...prev,
              [actionId]: {
                output: `Error - ${msg.error}`,
                isError: true,
              },
            }));
            resolve(
              `[read_file for '${filePath}'] Result: Error - ${msg.error}`,
            );
          } else {
            const content = msg.content || "";
            let output = `[read_file for '${filePath}'] Result:\n\`\`\`\n${content}\n\`\`\``;

            // Add diagnostics section if there are any warnings or errors
            if (msg.diagnostics && msg.diagnostics.length > 0) {
              const contentLines = content.split("\n");
              output += formatDiagnostics(msg.diagnostics, contentLines);
            }

            // Store output AND diagnostics in toolOutputs
            setToolOutputs((prev) => ({
              ...prev,
              [actionId]: {
                output: content,
                isError: false,
                diagnostics: msg.diagnostics || undefined,
              },
            }));

            resolve(output);
          }
        },
        getToolTimeout(action.type),
        () => {
          console.warn(`[read_file] Timeout`, { requestId, filePath });
          const timeoutError = `Operation timed out after ${
            getToolTimeout(action.type) / 1000
          }s. The file operation took too long to complete.`;
          setToolOutputs((prev) => ({
            ...prev,
            [actionId]: {
              output: timeoutError,
              isError: true,
            },
          }));
          resolve(
            `[read_file for '${filePath}'] Result: Error - ${timeoutError}`,
          );
        },
      );
    });
  }
}
