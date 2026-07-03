import {
  extensionService,
} from "../../../../services/ExtensionService";
import type { RunCommandParams } from "../../types/tool-types";

export const executeRunCommand = (
  params: RunCommandParams,
  actionId: string,
): Promise<string | null> => {
  return new Promise((resolve) => {
    extensionService.postMessage({
      command: "runCommand",
      commandText: params.command,
      actionId: actionId,
    });

    // The result is handled by the global commandExecuted listener in useToolExecution
    // Store the resolver to be called when commandExecuted arrives
    (window as any).__pendingRunCommandResolvers = (window as any).__pendingRunCommandResolvers || {};
    (window as any).__pendingRunCommandResolvers[actionId] = resolve;
  });
};