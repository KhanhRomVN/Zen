/**
 *? Usage:
 *    Quản lý terminal: chạy lệnh shell (có kiểm tra bảo mật), gửi input, dừng, liệt kê, xóa terminal.
 *
 *? Function:
 *    handleRunCommand()    : Chạy lệnh shell với security check, hỗ trợ folder_path tùy chỉnh.
 *    handleStopCommand()   : Dừng lệnh đang chạy (theo actionId hoặc terminalId).
 *    handleTerminalInput() : Gửi input đến terminal đang chạy.
 *    handleListTerminals() : Trả về danh sách terminal đang hoạt động.
 *    handleRemoveTerminal(): Đóng terminal.
 *    handleStopTerminal()  : Dừng terminal.
 */
import * as os from "os";
import * as vscode from "vscode";

// AGENT
import { SecurityValidator } from "../agent/validators/SecurityValidator";

// MANAGERS
import { ProcessManager } from "../managers/ProcessManager";

export class TerminalHandler {
  constructor(private processManager: ProcessManager) {}

  public async handleRunCommand(message: any, webviewView: vscode.WebviewView) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      const workspacePath = workspaceFolder?.uri.fsPath || os.homedir();

      // Support folder_path param for custom working directory
      let cwd = workspacePath;
      if (message.folderPath) {
        // Check if folderPath is absolute or relative
        const isAbsolute =
          message.folderPath.startsWith("/") ||
          message.folderPath.match(/^[a-zA-Z]:\\/); // Windows absolute path

        if (isAbsolute) {
          cwd = message.folderPath;
        } else {
          // Relative to workspace
          cwd = `${workspacePath}/${message.folderPath}`;
        }
      }

      // Security Check
      const securityCheck = SecurityValidator.validateCommand(
        message.commandText,
      );
      if (!securityCheck.safe) {
        throw new Error(securityCheck.reason || "Command validation failed");
      }

      const result = await this.processManager.startInteractive(cwd);
      const terminalId = result.id;

      webviewView.webview.postMessage({
        command: "runCommandResult",
        requestId: message.requestId,
        terminalId: terminalId,
        actionId: message.actionId,
      });

      this.processManager.sendInput(
        terminalId,
        `${message.commandText}\n`,
        message.actionId,
      );
    } catch (e: any) {
      console.error(`[TerminalHandler] handleRunCommand ERROR`, {
        actionId: message.actionId,
        command: message.commandText,
        folderPath: message.folderPath,
        error: e.message,
        stack: e.stack,
      });
      webviewView.webview.postMessage({
        command: "runCommandResult",
        requestId: message.requestId,
        error: e.message,
      });
    }
  }

  public async handleStopCommand(message: any) {
    if (message.actionId === "all") {
      this.processManager.stopAll();
    } else if (message.terminalId) {
      this.processManager.stop(message.terminalId);
    } else {
      const target = this.processManager
        .list()
        .find((t) => t.activeActionId === message.actionId);
      if (target) {
        this.processManager.stop(target.id);
      }
    }
  }

  public handleTerminalInput(message: any) {
    this.processManager.sendInput(message.terminalId, message.data);
  }

  public handleListTerminals(message: any, webviewView: vscode.WebviewView) {
    const terminals = this.processManager.list();
    webviewView.webview.postMessage({
      command: "listTerminalsResult",
      requestId: message.requestId,
      terminals,
    });
  }

  public handleRemoveTerminal(message: any, webviewView: vscode.WebviewView) {
    this.processManager.close(message.terminalId);
    webviewView.webview.postMessage({
      command: "removeTerminalResult",
      terminalId: message.terminalId,
      success: true,
    });
  }

  public handleStopTerminal(message: any) {
    this.processManager.close(message.terminalId);
  }
}
