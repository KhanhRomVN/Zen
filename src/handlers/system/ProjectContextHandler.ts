/**
 *? Usage:
 *    Cung cấp thông tin ngữ cảnh dự án và hệ thống: workspace root, homedir, OS, IDE, shell, cwd.
 *
 *? Function:
 *    handleGetProjectContext(): Trả về rootPath và homedir cho webview.
 *    handleGetSystemInfo()     : Trả về thông tin OS, IDE, shell, home, cwd.
 */
import * as os from "os";
import * as vscode from "vscode";

export class ProjectContextHandler {
  constructor() {}

  public async handleGetProjectContext(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) throw new Error("No workspace");

      webviewView.webview.postMessage({
        command: "projectContextResult",
        requestId: message.requestId,
        data: {
          rootPath: workspaceFolder.uri.fsPath,
          homedir: os.homedir(),
        },
      });
    } catch (error: any) {
      webviewView.webview.postMessage({
        command: "projectContextResult",
        requestId: message.requestId,
        error: error.message,
      });
    }
  }

  public handleGetSystemInfo(message: any, webviewView: vscode.WebviewView) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const platform = process.platform;
    const homeDir = os.homedir();
    const shell = process.env.SHELL || "/bin/bash";
    let osName = "Unknown";
    if (platform === "linux") osName = "Linux";
    else if (platform === "darwin") osName = "macOS";
    else if (platform === "win32") osName = "Windows";

    webviewView.webview.postMessage({
      command: "systemInfo",
      requestId: message.requestId,
      data: {
        os: osName,
        ide: "Visual Studio Code",
        shell: shell,
        homeDir: homeDir,
        cwd: workspaceFolder?.uri.fsPath || homeDir,
      },
    });
  }
}
