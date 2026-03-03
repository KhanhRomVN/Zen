import * as vscode from "vscode";
import { AgentCapabilityManager } from "../../agent/AgentCapabilityManager";

export class AgentHandler {
  constructor(private agentManager: AgentCapabilityManager | undefined) {}

  public handleUpdateAgentPermissions(message: any) {
    if (this.agentManager) {
      this.agentManager.updatePermissions(message.permissions);
    }
  }

  public async handleExecuteAgentAction(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    if (this.agentManager) {
      try {
        const result = await this.agentManager.executeAction(message.action);
        webviewView.webview.postMessage({
          command: "agentActionResult",
          requestId: message.action.requestId,
          result,
        });
      } catch (e: any) {
        webviewView.webview.postMessage({
          command: "agentActionResult",
          requestId: message.action.requestId,
          result: { success: false, error: e.message },
        });
      }
    }
  }
}
