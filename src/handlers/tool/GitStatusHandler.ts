/**
 *? Usage:
 *    Xử lý lệnh git status: porcelain + diff stats + branch + unpushed commits.
 *
 *? Function:
 *    handleRunGitStatus(): Trả về trạng thái git (porcelain, diff --numstat, branch, unpushed commits).
 */
import * as vscode from "vscode";

export class GitStatusHandler {
  public async handleRunGitStatus(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    const { exec } = require("child_process");
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      webviewView.webview.postMessage({
        command: "gitStatusResult",
        requestId: message.requestId,
        error: "No workspace folder found",
      });
      return;
    }

    const cwd = workspaceFolder.uri.fsPath;
    const runCommand = (
      cmd: string,
    ): Promise<{ stdout: string; stderr: string; error?: any }> => {
      return new Promise((resolve) => {
        exec(
          cmd,
          { cwd, maxBuffer: 1024 * 1024 * 10 },
          (err: any, stdout: string, stderr: string) => {
            if (err) resolve({ stdout: "", stderr, error: err });
            else resolve({ stdout, stderr });
          },
        );
      });
    };

    const statusPromise = runCommand("git status --porcelain");
    const diffPromise = runCommand("git diff --numstat");
    const diffCachedPromise = runCommand("git diff --cached --numstat");
    const unpushedPromise = runCommand("git log origin/HEAD..HEAD --oneline");
    const branchPromise = runCommand("git rev-parse --abbrev-ref HEAD");

    Promise.all([
      statusPromise,
      diffPromise,
      diffCachedPromise,
      unpushedPromise,
      branchPromise,
    ])
      .then(
        ([
          statusResult,
          diffResult,
          diffCachedResult,
          unpushedResult,
          branchResult,
        ]) => {
          if (statusResult.error) {
            if (statusResult.error.code === "ENOENT") {
              webviewView.webview.postMessage({
                command: "gitStatusResult",
                requestId: message.requestId,
                error: "Git is not installed or not in PATH.",
              });
            } else {
              webviewView.webview.postMessage({
                command: "gitStatusResult",
                requestId: message.requestId,
                error:
                  statusResult.stderr ||
                  statusResult.error.message ||
                  "Git status failed",
              });
            }
            return;
          }

          const diffStats: Record<string, { added: number; deleted: number }> =
            {};
          const parseDiff = (output: string) => {
            output
              .split("\n")
              .filter((l) => l.trim())
              .forEach((line) => {
                const parts = line.split("\t");
                if (parts.length >= 3) {
                  const fp = parts.slice(2).join("\t").trim();
                  if (fp)
                    diffStats[fp] = {
                      added: parseInt(parts[0], 10) || 0,
                      deleted: parseInt(parts[1], 10) || 0,
                    };
                }
              });
          };
          parseDiff(diffResult.stdout);
          parseDiff(diffCachedResult.stdout);

          const unpushedCommits = unpushedResult.stdout
            .split("\n")
            .filter((l: string) => l.trim().length > 0);
          const branch = branchResult.stdout?.trim() || "";

          webviewView.webview.postMessage({
            command: "gitStatusResult",
            requestId: message.requestId,
            output: statusResult.stdout,
            diffStats,
            unpushedCommits,
            branch,
          });
        },
      )
      .catch((err) => {
        webviewView.webview.postMessage({
          command: "gitStatusResult",
          requestId: message.requestId,
          error: err.message || "Failed to get git status",
        });
      });
  }
}