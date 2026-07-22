import { ToolExecutor, ExecutorContext, ExecutorOptions } from "./types";

export class RunCommandExecutor implements ToolExecutor {
  private pendingToolResolvers: Map<string, (result: string | null) => void>;
  private commandStartTimes: Map<string, number>;
  private earlyCommandResults: Map<string, any>;

  constructor(
    pendingToolResolvers: Map<string, (result: string | null) => void>,
    commandStartTimes: Map<string, number>,
    earlyCommandResults: Map<string, any>
  ) {
    this.pendingToolResolvers = pendingToolResolvers;
    this.commandStartTimes = commandStartTimes;
    this.earlyCommandResults = earlyCommandResults;
  }

  async execute(
    action: any,
    context: ExecutorContext,
    options: ExecutorOptions = {}
  ): Promise<string | null> {
    const { extensionService } = context;

    return new Promise((resolve) => {
      const actionId = action.actionId;
      this.commandStartTimes.set(actionId, Date.now());

      extensionService.postMessage({
        command: "runCommand",
        commandText: action.params.command,
        folderPath: action.params.folder_path || action.params.cwd,
        actionId: actionId,
      });

      // Check if commandExecuted already arrived (race condition)
      if (this.earlyCommandResults.has(actionId)) {
        const msg = this.earlyCommandResults.get(actionId)!;
        this.earlyCommandResults.delete(actionId);
        const cmdText = msg.commandText || action.params.command || "command";
        const outputContent = (msg.output || "").trim();
        resolve(
          msg.error
            ? `Output: [run_command for '${cmdText}'] Error - ${msg.error}\n\`\`\`\n${outputContent}\n\`\`\``
            : `Output: [run_command for '${cmdText}']\n\`\`\`\n${outputContent}\n\`\`\``
        );
        return;
      }

      // Only resolve when process finishes naturally or user clicks "Kết thúc"
      this.pendingToolResolvers.set(actionId, resolve);
    });
  }
}
