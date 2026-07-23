import * as vscode from "vscode";
/**
 *? Usage:
 *    Xử lý lệnh git: git status (porcelain + diff stats + branch + unpushed) và git diff cho từng file.
 *
 *? Function:
 *    handleRunGitStatus(): Trả về trạng thái git (porcelain, diff --numstat, branch, unpushed commits).
 *    handleGitDiff()     : Trả về diff của một file (hỗ trợ cả file chưa tracked).
 */
import * as fs from "fs";
import * as path from "path";

export class GitHandler {
  constructor() {}

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

  public async handleGitDiff(message: any, webviewView: vscode.WebviewView) {
    const { exec } = require("child_process");
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      webviewView.webview.postMessage({
        command: "gitDiffResult",
        requestId: message.requestId,
        error: "No workspace folder found",
      });
      return;
    }

    const filePath = message.file_path || message.path;
    if (!filePath) {
      webviewView.webview.postMessage({
        command: "gitDiffResult",
        requestId: message.requestId,
        error: "file_path is required",
      });
      return;
    }

    const cwd = workspaceFolder.uri.fsPath;
    const escapedPath = filePath.replace(/"/g, '\\"');

    exec(
      `git ls-files -- "${escapedPath}"`,
      { cwd, maxBuffer: 1024 * 1024 * 10 },
      (lsErr: any, lsStdout: string) => {
        const isTracked = lsStdout.trim().length > 0;
        if (!isTracked) {
          const absPath = path.isAbsolute(filePath)
            ? filePath
            : path.join(cwd, filePath);
          try {
            const content = fs.readFileSync(absPath, "utf-8");
            const diffOutput = `--- /dev/null\n+++ b/${filePath}\n@@ -0,0 +1,${content.split("\n").length} @@\n${content
              .split("\n")
              .map((l: string) => "+ " + l)
              .join("\n")}`;
            webviewView.webview.postMessage({
              command: "gitDiffResult",
              requestId: message.requestId,
              diff: diffOutput,
            });
          } catch {
            webviewView.webview.postMessage({
              command: "gitDiffResult",
              requestId: message.requestId,
              diff: "",
            });
          }
          return;
        }

        exec(
          `git status --porcelain -- "${escapedPath}"`,
          { cwd, maxBuffer: 1024 * 1024 * 10 },
          (_statusErr: any, statusStdout: string) => {
            let isStaged = false;
            const lines = statusStdout
              .trim()
              .split("\n")
              .filter((l) => l.length > 0);
            for (const line of lines) {
              if (line.length >= 2 && line[0] !== " " && line[0] !== "?") {
                isStaged = true;
                break;
              }
            }

            const diffCmd = isStaged
              ? `git diff --cached -- "${escapedPath}"`
              : `git diff -- "${escapedPath}"`;
            exec(
              diffCmd,
              { cwd, maxBuffer: 1024 * 1024 * 10 },
              (err: any, stdout: string, stderr: string) => {
                const hasDiffOutput = stdout && stdout.trim().length > 0;
                if (
                  (err && err.code === 1 && stdout.trim() === "") ||
                  (!hasDiffOutput && !err)
                ) {
                  const absPath = path.isAbsolute(filePath)
                    ? filePath
                    : path.join(cwd, filePath);
                  try {
                    const content = fs.readFileSync(absPath, "utf-8");
                    const lines = content.split("\n");
                    const prefix = isStaged ? "staged" : "unstaged";
                    const diffOutput = `--- a/${filePath}\n+++ b/${filePath} (${prefix})\n@@ -1,${lines.length} +1,${lines.length} @@\n${lines.map((l: string) => " " + l).join("\n")}`;
                    webviewView.webview.postMessage({
                      command: "gitDiffResult",
                      requestId: message.requestId,
                      diff: diffOutput,
                    });
                  } catch {
                    webviewView.webview.postMessage({
                      command: "gitDiffResult",
                      requestId: message.requestId,
                      diff: "",
                      error: null,
                    });
                  }
                  return;
                }
                if (err) {
                  webviewView.webview.postMessage({
                    command: "gitDiffResult",
                    requestId: message.requestId,
                    error: stderr || err.message || "Git diff failed",
                  });
                  return;
                }
                webviewView.webview.postMessage({
                  command: "gitDiffResult",
                  requestId: message.requestId,
                  diff: stdout || "",
                });
              },
            );
          },
        );
      },
    );
  }
}
