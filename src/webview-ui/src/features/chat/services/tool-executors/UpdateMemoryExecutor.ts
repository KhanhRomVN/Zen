import {
  ExecutorContext,
  ExecutorOptions,
  ToolExecutor,
} from "../../types/executor-types";

export class UpdateMemoryExecutor implements ToolExecutor {
  async execute(
    action: any,
    context: ExecutorContext,
    _options: ExecutorOptions = {},
  ): Promise<string | null> {
    const { setToolOutputs, getToolTimeout, extensionService, messageDispatcher } =
      context;

    return new Promise((resolve) => {
      const requestId = `update-memory-${Date.now()}-${Math.random()}`;
      const actionId = action.actionId;

      // Check for validation error from parser
      if (action.params._validationError) {
        const errMsg = action.params._validationError;
        console.warn(`[Zen][update_memory] Validation error: ${errMsg}`);
        resolve(`[update_memory] Result: Error - ${errMsg}`);
        return;
      }

      extensionService.postMessage({
        command: "updateMemory",
        old_content: action.params.old_content,
        new_content: action.params.new_content,
        requestId,
      });

      messageDispatcher.register(
        requestId,
        (msg) => {
          if (msg.error) {
            console.error(`[update_memory] Error response`, {
              requestId,
              error: msg.error,
            });
            setToolOutputs((prev) => ({
              ...prev,
              [actionId]: { output: `Error - ${msg.error}`, isError: true },
            }));
            resolve(`[update_memory] Result: Error - ${msg.error}`);
          } else {
            const createdInfo = msg.created ? " (created)" : "";
            let result = `[update_memory] Result: Memory updated successfully${createdInfo}`;
            
            setToolOutputs((prev) => ({
              ...prev,
              [actionId]: {
                output: msg.content || action.params.new_content || "",
                isError: false,
              },
            }));

            resolve(result);
          }
        },
        getToolTimeout(action.type),
        () => {
          console.warn(`[update_memory] Timeout`, { requestId });
          const timeoutError = `Operation timed out after ${getToolTimeout(action.type) / 1000}s.`;
          setToolOutputs((prev) => ({
            ...prev,
            [actionId]: { output: timeoutError, isError: true },
          }));
          resolve(`[update_memory] Result: Error - ${timeoutError}`);
        },
      );
    });
  }
}