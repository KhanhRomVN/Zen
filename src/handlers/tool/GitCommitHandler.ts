/**
 * ------------------------------------------------------------------
 * Git Commit Handler
 * ------------------------------------------------------------------
 * Thực thi lệnh git commit với message từ webview.
 *
 * Main functions:
 * - handleGitCommit() : Chạy `git commit -m "<message>"` trong workspace
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── VSCode ──
import * as vscode from "vscode";

// ── Node ──
import { execFile } from "child_process";
import * as path from "path";

// ─── Class ──────────────────────────────────────────────────────────────
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

      let cwd = workspaceFolder.uri.fsPath;
      if (message.repoPath) {
        const normalized = String(message.repoPath)
          .replace(/^([/\\]|\.\.([/\\]|$))+/, "");
        const abs = path.resolve(workspaceFolder.uri.fsPath, normalized);
        const rel = path.relative(workspaceFolder.uri.fsPath, abs);
        if (rel.startsWith("..") || path.isAbsolute(rel)) {
          throw new Error("repoPath vượt ra ngoài workspace");
        }
        cwd = abs;
      }

      // FIX P2 Security: dùng execFile với args array thay vì exec string
      // để tránh command injection qua commit message (không cần shell escape)
      const commitResult = await new Promise<{
        stdout: string;
        stderr: string;
      }>((resolve, reject) => {
        execFile(
          "git",
          ["commit", "-m", commitMessage],
          { cwd, shell: false },
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

      let pushed = false;
      if (message.push) {
        await new Promise<void>((resolve, reject) => {
          execFile(
            "git",
            ["push"],
            { cwd, shell: false, timeout: 60000 },
            (err: any, _stdout: string, stderr: string) => {
              if (err) {
                reject(new Error(`Push failed: ${stderr || err.message}`));
              } else {
                resolve();
              }
            },
          );
        });
        pushed = true;
      }
      webviewView?.webview?.postMessage({ command: "gitCommitDone", pushed });
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
        } catch (e) {
          // FIX Bổ sung: log lỗi thay vì empty catch block
          console.error(
            "[GitCommitHandler] Fallback postMessage failed:",
            e instanceof Error ? e.message : String(e),
          );
        }
      }
    }
  }
}
