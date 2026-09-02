import {
  ExecutorContext,
  ExecutorOptions,
  ToolExecutor,
} from "../../types/executor-types";

export class ConversationTitleExecutor implements ToolExecutor {
  async execute(
    action: any,
    context: ExecutorContext,
    options: ExecutorOptions = {},
  ): Promise<string | null> {
    const {
      getToolTimeout,
      extensionService,
      messageDispatcher,
      conversationIdRef,
    } = context;

    return new Promise((resolve) => {
      const requestId = `set-title-${Date.now()}-${Math.random()}`;
      const title = (action.params.title || "").trim();
      const conversationId = conversationIdRef?.current || "";

      if (!title) {
        resolve("[conversation_title] Result: Error - title is required");
        return;
      }

      extensionService.postMessage({
        command: "setConversationTitle",
        conversationId,
        title,
        requestId,
      });

      messageDispatcher.register(
        requestId,
        (msg) => {
          if (msg.error) {
            resolve(`[conversation_title] Result: Error - ${msg.error}`);
            return;
          }
          resolve(`[conversation_title] Result: Title updated to "${title}"`);
        },
        getToolTimeout(action.type),
        () => {
          const timeoutError = `Operation timed out after ${
            getToolTimeout(action.type) / 1000
          }s. Failed to update conversation title.`;
          resolve(`[conversation_title] Result: Error - ${timeoutError}`);
        },
      );
    });
  }
}
