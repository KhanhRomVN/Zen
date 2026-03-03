import * as vscode from "vscode";
import * as os from "os";
import { ProcessManager } from "../../managers/ProcessManager";

export class TerminalHandler {
  constructor(private processManager: ProcessManager) {}

  public async handleRunCommand(message: any, webviewView: vscode.WebviewView) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      const cwd = workspaceFolder?.uri.fsPath || os.homedir();

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
      webviewView.webview.postMessage({
        command: "runCommandResult",
        requestId: message.requestId,
        error: e.message,
      });
    }
  }

  public async handleFocusTerminal(message: any) {
    try {
      this.processManager.focus(message.terminalId);
    } catch (e: any) {
      console.error("Failed to focus terminal:", e);
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

  public handleAttachTerminalToVSCode(message: any) {
    this.processManager.attachToVSCode(message.terminalId);
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
