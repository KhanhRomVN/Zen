/**
 * ------------------------------------------------------------------
 * Close Terminal Handler
 * ------------------------------------------------------------------
 * Đóng và xóa terminal: kill process, dọn buffer, gửi response nếu
 * có webview. Hỗ trợ: close theo terminalId, theo actionId, hoặc
 * closeAll. Nếu có kill=true hoặc finalize=true, TerminalManager sẽ
 * fire onCommandFinished để webview có thể resolve pending tool
 * execution, tránh treo AI.
 *
 * Main functions:
 * - handleCloseTerminal() : Đóng terminal — nếu actionId === "all" thì
 *                           closeAll(true), nếu có terminalId thì
 *                           close(terminalId, notify), nếu chỉ có actionId
 *                           thì tìm bằng list() rồi close
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── VSCode ──
import * as vscode from "vscode";

// ── Managers ──
import { TerminalManager } from "../../managers/TerminalManager";

// ─── Class ──────────────────────────────────────────────────────────────
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

    let targetTerminalId = message.terminalId;
    if (!targetTerminalId && message.actionId) {
      targetTerminalId = this.terminalManager.findByActionId(message.actionId);
    }

    if (targetTerminalId) {
      this.terminalManager.close(targetTerminalId, notify);
    } else {
      // Fallback: if specific terminalId cannot be resolved, close all active terminals
      this.terminalManager.closeAll(notify);
    }

    if (webviewView) {
      webviewView.webview.postMessage({
        command: "closeTerminalResult",
        terminalId: targetTerminalId || message.terminalId,
        actionId: message.actionId,
        success: true,
      });
    }
  }
}
