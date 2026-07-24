/**
 *? Usage:
 *    Thực thi lệnh git commit với message từ webview.
 *
 *? Function:
 *    handleGitCommit(): Chạy `git commit -m "<message>"` trong workspace.
 */
import * as vscode from "vscode";
import { exec } from "child_process";

export class GitCommitHandler {
  public async handleGitCommit(
    message: any,
    webviewView?: vscode.WebviewView,
  ) {
    const commitMessage = message.message;
    if (!commitMessage) {
      console.error("[GitCommitHandler] handleGitCommit: No message provided");
      return;
    }

    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        console.error("[GitCommitHandler] No workspace folder found");
        return;
      }

      const cwd = workspaceFolder.uri.fsPath;
      const escapedMessage = commitMessage.replace(/'/g, "'\\''");

      const commitResult = await new Promise<{
        stdout: string;
        stderr: string;
      }>((resolve, reject) => {
        exec(
          `git commit -m '${escapedMessage}'`,
          { cwd },
          (err: any, stdout: string, stderr: string) => {
            if (err && !stderr.includes("nothing to commit")) {
              reject(new Error(stderr || err.message));
            } else {
              resolve({ stdout, stderr });
            }
          },
        );
      });

      if (commitResult.stderr.includes("nothing to commit")) {
        return;
      }

      await vscode.env.clipboard.writeText(commitMessage);
    } catch (error) {
      console.error("[GitCommitHandler] handleGitCommit error:", error);
      const errorMsg = error instanceof Error ? error.message : String(error);

      if (webviewView?.webview) {
        webviewView.webview.postMessage({
          command: "commitError",
          error: errorMsg,
          timestamp: Date.now(),
        });
      } else {
        try {
          const activeTab = vscode.window.tabGroups.activeTabGroup?.activeTab;
          if (activeTab && "webview" in activeTab) {
            const webview = (activeTab as any).webview;
            if (webview) {
              webview.postMessage({
                command: "commitError",
                error: errorMsg,
                timestamp: Date.now(),
              });
            }
          }
        } catch (e) {}
      }
    }
  }
}