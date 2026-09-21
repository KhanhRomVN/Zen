/**
 * ------------------------------------------------------------------
 * Git Status Handler
 * ------------------------------------------------------------------
 * Xử lý lệnh git status: porcelain + diff stats + branch + unpushed
 * commits.
 *
 * Main functions:
 * - handleRunGitStatus() : Trả về trạng thái git (porcelain,
 *                          diff --numstat, branch, unpushed commits)
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── VSCode ──
import * as vscode from "vscode";

// ── Node ──
import { exec } from "child_process";

// ─── Class ──────────────────────────────────────────────────────────────
export class GitStatusHandler {
  /**
   * Kiểm tra workspace có thư mục .git và đã có file staged (git add) chưa.
   * Trả về qua `gitCheckReadyResult`: { hasGit, hasStaged, reason? }.
   */
  public async handleCheckGitReady(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    const reply = (payload: {
      hasGit: boolean;
      hasStaged: boolean;
      reason?: string;
    }) =>
      webviewView.webview.postMessage({
        command: "gitCheckReadyResult",
        requestId: message.requestId,
        ...payload,
      });

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      reply({
        hasGit: false,
        hasStaged: false,
        reason: "Chưa mở workspace",
      });
      return;
    }

    try {
      await vscode.workspace.fs.stat(
        vscode.Uri.joinPath(workspaceFolder.uri, ".git"),
      );
    } catch {
      reply({
        hasGit: false,
        hasStaged: false,
        reason: "Workspace không có thư mục .git",
      });
      return;
    }

    exec(
      "git diff --cached --name-only",
      { cwd: workspaceFolder.uri.fsPath, maxBuffer: 1024 * 1024 * 10 },
      (err: any, stdout: string, stderr: string) => {
        if (err) {
          reply({
            hasGit: true,
            hasStaged: false,
            reason:
              err.code === "ENOENT"
                ? "Git chưa được cài hoặc không có trong PATH"
                : stderr || err.message || "Không kiểm tra được git",
          });
          return;
        }
        const hasStaged = stdout.split("\n").some((l) => l.trim().length > 0);
        reply({
          hasGit: true,
          hasStaged,
          reason: hasStaged ? undefined : "Chưa có file nào được git add",
        });
      },
    );
  }

  public async handleRunGitStatus(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
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
            if (err) {
              resolve({ stdout: "", stderr, error: err });
            } else {
              resolve({ stdout, stderr });
            }
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
                  if (fp) {
                    diffStats[fp] = {
                      added: parseInt(parts[0], 10) || 0,
                      deleted: parseInt(parts[1], 10) || 0,
                    };
                  }
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
