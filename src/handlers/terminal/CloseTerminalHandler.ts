/**
 *? Usage:
 *    Đóng và xóa terminal: kill process, dọn buffer, gửi response nếu có webview.
 *    Hỗ trợ: close theo terminalId, theo actionId, hoặc closeAll.
 *    Nếu có kill=true hoặc finalize=true, TerminalManager sẽ fire onCommandFinished
 *    để webview có thể resolve pending tool execution, tránh treo AI.
 *
 *? Function:
 *    handleCloseTerminal(): Đóng terminal — nếu actionId === "all" thì closeAll(true),
 *    nếu có terminalId thì close(terminalId, notify), nếu chỉ có actionId thì tìm bằng list() rồi close.
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
      this.terminalManager.closeAll(true);
      return;
    }

    const notify = !!(
      message.kill ||
      message.finalize ||
      (message.actionId && message.actionId !== "all")
    );
    if (message.terminalId) {
      this.terminalManager.close(message.terminalId, notify);
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