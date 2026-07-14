import * as vscode from "vscode";
import { AgentManager } from "../../agent/AgentManager";

export class AgentHandler {
  constructor(private agentManager: AgentManager | undefined) {}

  public handleUpdateAgentPermissions(message: any) {
    if (this.agentManager) {
      this.agentManager.updatePermissions(message.permissions);
    }
  }

  public async handleExecuteAgentAction(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    const requestId = message.action?.requestId;
    const actionType = message.action?.type;

    if (this.agentManager) {
      try {
        const result = await this.agentManager.executeAction(message.action);

        webviewView.webview.postMessage({
          command: "agentActionResult",
          requestId: message.action.requestId,
          result,
        });
      } catch (e: any) {
        console.error(`[Zen][AgentHandler] ❌ Action failed:`, {
          requestId,
          actionType,
          error: e.message,
          stack: e.stack,
        });

        webviewView.webview.postMessage({
          command: "agentActionResult",
          requestId: message.action.requestId,
          result: { success: false, error: e.message },
        });
      }
    } else {
      console.warn(
        `[Zen][AgentHandler] ⚠️ No agentManager available for requestId: ${requestId}`,
      );
    }
  }
}
