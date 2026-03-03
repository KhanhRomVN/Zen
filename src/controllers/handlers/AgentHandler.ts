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
      const result = await this.agentManager.executeAction(message.action);
      webviewView.webview.postMessage({
        command: "executeAgentActionResult",
        requestId: message.requestId,
        result,
      });
    }
  }
}
