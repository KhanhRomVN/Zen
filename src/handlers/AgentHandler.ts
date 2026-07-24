/**
 *? Usage:
 *    Xử lý thực thi grep của AI agent.
 *
 *? Function:
 *    handleExecuteGrep(): Thực thi grep và trả kết quả về webview.
 */
import * as vscode from "vscode";

// AGENT
import { AgentManager } from "../agent/AgentManager";

export class AgentHandler {
  constructor(private agentManager: AgentManager | undefined) {}

  public async handleExecuteGrep(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    const requestId = message.action?.requestId;

    if (this.agentManager) {
      try {
        const result = await this.agentManager.executeGrep(message.action);

        webviewView.webview.postMessage({
          command: "agentActionResult",
          requestId: message.action.requestId,
          result,
        });
      } catch (e: any) {
        console.error(`[Zen][AgentHandler] ❌ Grep failed:`, {
          requestId,
          error: e.message,
          stack: e.stack,
        });

        webviewView.webview.postMessage({
          command: "agentActionResult",
          requestId: message.action.requestId,
          result: { success: false, error: e.message },
        });
      }
    }
  }
}