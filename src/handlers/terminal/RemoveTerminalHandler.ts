/**
 *? Usage:
 *    Đóng terminal và gửi response về webview.
 *
 *? Function:
 *    handleRemoveTerminal(): Đóng terminal và gửi response về webview.
 */
import * as vscode from "vscode";

// MANAGERS
import { ProcessManager } from "../../managers/ProcessManager";

export class RemoveTerminalHandler {
  constructor(private processManager: ProcessManager) {}

  public handleRemoveTerminal(message: any, webviewView: vscode.WebviewView) {
    this.processManager.close(message.terminalId);
    webviewView.webview.postMessage({
      command: "removeTerminalResult",
      terminalId: message.terminalId,
      success: true,
    });
  }
}