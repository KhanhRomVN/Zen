import {
  ExecutorContext,
  ExecutorOptions,
  ToolExecutor,
} from "../../types/executor-types";
import { formatDiagnostics } from "../../utils/diagnostic-utils";

export class ReplaceInFileExecutor implements ToolExecutor {
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
      const filePath = action.params.path || action.params.file_path;
      const actionId = action.actionId;
      // Nếu tool được convert từ claude (vd: str_replace → replace_in_file),
      // dùng tên tool gốc và sandbox path để build result string trả về cho claude.
      const resultToolName = action.params.original_tool_name || "replace_in_file";
      const resultPath = action.params.original_path || filePath;

      // Check for validation error from parser
      if (action.params._validationError) {
        const errMsg = action.params._validationError;
        console.warn(
          `[Zen][replace_in_file] Validation error | file="${filePath}" | error="${errMsg}"`,
        );
        resolve(
          `[${resultToolName} for '${resultPath}'] Result: Error - ${errMsg}`,
        );
        return;
      }

      const requestId = `replace-${Date.now()}-${Math.random()}`;
      const messageTimestamp = Date.now(); // Current timestamp for this tool execution
      const responseNumber = action.responseNumber; // Response number from the triggering message

      extensionService.postMessage({
        command: "replaceInFile",
        path: filePath,
        old_str: action.params.old_content,
        new_str: action.params.new_content,
        requestId,
        skipDiagnostics,
        bypassIgnore,
        conversationId: conversationIdRef?.current,
        actionId: actionId,
        messageId: actionId, // Use actionId as messageId for tracking
        messageTimestamp: messageTimestamp, // Timestamp for revert tracking
        responseNumber: responseNumber, // Response number for precise revert tracking
      });

      messageDispatcher.register(
        requestId,
        (msg) => {
          if (msg.error) {
            console.error(`[replace_in_file] Error response`, {
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
              `[${resultToolName} for '${resultPath}'] Result: Error - ${msg.error}`,
            );
          } else {
            // Build version info if available
            const versionInfo = msg.version ? ` (version #${msg.version})` : "";

            let result = `[${resultToolName} for '${resultPath}'] Result: File updated successfully${versionInfo}`;

            // Add diagnostics if any
            if (msg.diagnostics && msg.diagnostics.length > 0) {
              const errorCount = msg.diagnostics.filter(
                (d: any) => d.severity === "Error" || d.severity === "error",
              ).length;
              const warningCount = msg.diagnostics.filter(
                (d: any) =>
                  d.severity === "Warning" || d.severity === "warning",
              ).length;

              result = `[${resultToolName} for '${resultPath}'] Result: File updated successfully${versionInfo} with ${errorCount} error(s), ${warningCount} warning(s)`;

              const contentLines = (
                msg.content ||
                action.params.new_content ||
                ""
              ).split("\n");
              result += formatDiagnostics(msg.diagnostics, contentLines);
            }

            setToolOutputs((prev) => ({
              ...prev,
              [actionId]: {
                output: msg.content || action.params.new_content || "",
                isError: false,
                diagnostics: msg.diagnostics || undefined,
                version: msg.version || undefined,
              },
            }));

            resolve(result);
          }
        },
        getToolTimeout(action.type),
        () => {
          console.warn(`[replace_in_file] Timeout`, {
            requestId,
            filePath,
          });
          const timeoutError = `Operation timed out after ${
            getToolTimeout(action.type) / 1000
          }s. The file replacement took too long to complete (possibly waiting for diagnostics).`;
          setToolOutputs((prev) => ({
            ...prev,
            [actionId]: {
              output: timeoutError,
              isError: true,
            },
          }));
          resolve(
            `[${resultToolName} for '${resultPath}'] Result: Error - ${timeoutError}`,
          );
        },
      );
    });
  }
}
