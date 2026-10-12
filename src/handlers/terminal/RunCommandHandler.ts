/**
 * ------------------------------------------------------------------
 * Run Command Handler
 * ------------------------------------------------------------------
 * Chạy lệnh shell với security check, hỗ trợ folder_path tùy chỉnh.
 *
 * Main functions:
 * - handleRunCommand() : Chạy lệnh shell với security check, hỗ trợ
 *                        folder_path tùy chỉnh
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Node ──
import * as os from "os";
import * as path from "path";

// ── VSCode ──
import * as vscode from "vscode";

// ── AGENT ──
import { SecurityValidator } from "../../utils/security";

// ── Managers ──
import { TerminalManager } from "../../managers/TerminalManager";

// ─── Class ──────────────────────────────────────────────────────────────
export class RunCommandHandler {
  constructor(private terminalManager: TerminalManager) {}

  public async handleRunCommand(message: any, webviewView: vscode.WebviewView) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      const workspacePath = workspaceFolder?.uri.fsPath || os.homedir();

      let cwd = workspacePath;
      if (message.folderPath) {
        const isAbsolute =
          message.folderPath.startsWith("/") ||
          message.folderPath.match(/^[a-zA-Z]:\\/);

        if (isAbsolute) {
          cwd = message.folderPath;
        } else {
          cwd = path.join(workspacePath, message.folderPath);
        }
      }

      // Bỏ qua security check nếu user đã xác nhận proceed (flag từ UI)
      if (!message._bypassDangerCheck) {
        const securityCheck = SecurityValidator.validateCommand(
          message.commandText,
        );
        if (!securityCheck.safe) {
          // KHÔNG throw — gửi cảnh báo về webview để hiển thị dialog Confirm/Cancel
          webviewView.webview.postMessage({
            command: "dangerousCommandDetected",
            actionId: message.actionId,
            requestId: message.requestId,
            commandText: message.commandText,
            folderPath: message.folderPath,
            reason: securityCheck.reason || "Command validation failed",
          });
          return;
        }
      }

      const result = await this.terminalManager.startInteractive(cwd);
      const terminalId = result.id;

      webviewView.webview.postMessage({
        command: "runCommandResult",
        requestId: message.requestId,
        terminalId: terminalId,
        actionId: message.actionId,
      });

      this.terminalManager.sendInput(
        terminalId,
        `${message.commandText}\n`,
        message.actionId,
      );
    } catch (e: any) {
      console.error(`[RunCommandHandler] handleRunCommand ERROR`, {
        actionId: message.actionId,
        command: message.commandText,
        folderPath: message.folderPath,
        error: e.message,
        stack: e.stack,
      });
      // FIX: Thêm actionId vào error response để webview resolve pending promise
      webviewView.webview.postMessage({
        command: "runCommandResult",
        requestId: message.requestId,
        actionId: message.actionId,
        terminalId: undefined,
        error: e.message,
        output: "",
      });
    }
  }
}
