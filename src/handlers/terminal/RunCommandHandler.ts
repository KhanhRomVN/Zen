/**
 *? Usage:
 *    Chạy lệnh shell với security check, hỗ trợ folder_path tùy chỉnh.
 *
 *? Function:
 *    handleRunCommand(): Chạy lệnh shell với security check, hỗ trợ folder_path tùy chỉnh.
 */
import * as os from "os";
import * as vscode from "vscode";

// AGENT
import { SecurityValidator } from "../../agent/validators/SecurityValidator";

// MANAGERS
import { ProcessManager } from "../../managers/ProcessManager";

export class RunCommandHandler {
  constructor(private processManager: ProcessManager) {}

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
          cwd = `${workspacePath}/${message.folderPath}`;
        }
      }

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
      console.error(`[RunCommandHandler] handleRunCommand ERROR`, {
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
}