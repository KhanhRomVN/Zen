/**
 *? Usage:
 *    Đóng và xóa terminal: kill process, dọn buffer, gửi response nếu có webview.
 *    Hỗ trợ: close theo terminalId, theo actionId, hoặc closeAll.
 *
 *? Function:
 *    handleCloseTerminal(): Đóng terminal — nếu actionId === "all" thì closeAll, nếu có terminalId thì close, nếu chỉ có actionId thì tìm bằng list() rồi close.
 */
import * as vscode from "vscode";

// MANAGERS
import { TerminalManager } from "../../managers/TerminalManager";

export class CloseTerminalHandler {
  constructor(private terminalManager: TerminalManager) {}

  public handleCloseTerminal(
    message: any,
    webviewView?: vscode.WebviewView,
  ) {
    if (message.actionId === "all") {
      this.terminalManager.closeAll();
      return;
    }

    if (message.terminalId) {
      this.terminalManager.close(message.terminalId);
    }

    if (webviewView) {
      webviewView.webview.postMessage({
        command: "closeTerminalResult",
        terminalId: message.terminalId,
        success: true,
      });
    }
  }
}