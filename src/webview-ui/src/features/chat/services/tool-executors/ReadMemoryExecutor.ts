import {
  ExecutorContext,
  ExecutorOptions,
  ToolExecutor,
} from "../../types/executor-types";

export class ReadMemoryExecutor implements ToolExecutor {
  async execute(
    action: any,
    context: ExecutorContext,
    _options: ExecutorOptions = {},
  ): Promise<string | null> {
    const { setToolOutputs, getToolTimeout, extensionService, messageDispatcher } =
      context;

    return new Promise((resolve) => {
      const requestId = `read-memory-${Date.now()}-${Math.random()}`;
      const actionId = action.actionId;

      extensionService.postMessage({
        command: "readMemory",
        requestId,
      });

      messageDispatcher.register(
        requestId,
        (msg) => {
          if (msg.error) {
            setToolOutputs((prev) => ({
              ...prev,
              [actionId]: { output: `Error - ${msg.error}`, isError: true },
            }));
            resolve(`[read_memory] Result: Error - ${msg.error}`);
          } else {
            const content = msg.content || "";
            const header = msg.exists === false ? "(memory file does not exist yet)" : "";
            const output = `[read_memory] Result:${header}\n\`\`\`\n${content}\n\`\`\``;
            setToolOutputs((prev) => ({
              ...prev,
              [actionId]: { output: content, isError: false },
            }));
            resolve(output);
          }
        },
        getToolTimeout(action.type),
        () => {
          console.warn(`[read_memory] Timeout`, { requestId });
          const timeoutError = `Operation timed out after ${getToolTimeout(action.type) / 1000}s.`;
          setToolOutputs((prev) => ({
            ...prev,
            [actionId]: { output: timeoutError, isError: true },
          }));
          resolve(`[read_memory] Result: Error - ${timeoutError}`);
        },
      );
    });
  }
}