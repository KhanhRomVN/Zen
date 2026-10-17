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
import * as fs from "fs";
import * as path from "path";

// ─── Types ──────────────────────────────────────────────────────────────
export interface GitRepoInfo {
  relPath: string;
  absPath: string;
  branch: string;
  staged: number;
  unstaged: number;
  untracked: number;
  added: number;
  deleted: number;
  unpushed: number;
}

const SCAN_MAX_DEPTH = 4;
const SCAN_IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "out",
  "build",
  ".next",
  "target",
  "vendor",
  "temp",
]);

// ─── Class ──────────────────────────────────────────────────────────────
const prefixPorcelainPaths = (output: string, repoRel: string): string => {
  const prefix = repoRel.replace(/\\/g, "/").replace(/^\.\/?|\/$/g, "");
  if (!prefix) return output;
  const withPrefix = (p: string) =>
    p.startsWith('"') ? `"${prefix}/${p.slice(1)}` : `${prefix}/${p}`;
  return output
    .split("\n")
    .map((line) => {
      if (line.length < 4) return line;
      const parts = line.slice(3).split(" -> ").map(withPrefix);
      return line.slice(0, 3) + parts.join(" -> ");
    })
    .join("\n");
};

export class GitStatusHandler {
  /**
   * Resolve repoPath (relative tới workspace) thành absolute path an toàn.
   * Trả về null nếu vượt ra ngoài workspace.
   */
  private resolveRepoCwd(
    repoPath?: string,
    fallbackWorkspaceFolder?: vscode.WorkspaceFolder,
  ): { cwd: string; folder: vscode.WorkspaceFolder } | null {
    const folder = fallbackWorkspaceFolder;
    if (!folder) return null;
    const base = folder.uri.fsPath;
    if (!repoPath) return { cwd: base, folder };
    const normalized = path
      .normalize(repoPath)
      .replace(/^([/\\]|\.\.([/\\]|$))+/, "");
    const abs = path.resolve(base, normalized);
    const rel = path.relative(base, abs);
    if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
    return { cwd: abs, folder };
  }

  /**
   * Quét toàn bộ workspaceFolders (đệ quy tối đa 4 cấp) tìm các folder
   * chứa .git (folder hoặc file worktree/submodule). Mỗi .git = 1 entry.
   */
  public async handleScanGitRepos(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    const folders = vscode.workspace.workspaceFolders || [];
    const repos: GitRepoInfo[] = [];

    const isGitDir = (dir: string): boolean => {
      try {
        fs.accessSync(path.join(dir, ".git"));
        return true;
      } catch {
        return false;
      }
    };

    const walk = (dir: string, depth: number, workspaceRoot: string): void => {
      if (depth > SCAN_MAX_DEPTH) return;
      if (isGitDir(dir)) {
        repos.push({
          relPath: path.relative(workspaceRoot, dir) || ".",
          absPath: dir,
          branch: "",
          staged: 0,
          unstaged: 0,
          untracked: 0,
          added: 0,
          deleted: 0,
          unpushed: 0,
        });
      }
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (SCAN_IGNORED_DIRS.has(entry.name)) continue;
        if (entry.name.startsWith(".") && entry.name !== ".git") continue;
        walk(path.join(dir, entry.name), depth + 1, workspaceRoot);
      }
    };

    for (const folder of folders) {
      walk(folder.uri.fsPath, 0, folder.uri.fsPath);
    }

    const runGit = (cwd: string, args: string[]): Promise<string> =>
      new Promise((resolve) => {
        exec(
          `git ${args.map((a) => JSON.stringify(a)).join(" ")}`,
          { cwd, maxBuffer: 1024 * 1024 * 10 },
          (err, stdout) => resolve(err ? "" : stdout),
        );
      });

    await Promise.all(
      repos.map(async (repo) => {
        const [porcelain, numstat, numstatCached, branchOut, unpushedOut] =
          await Promise.all([
            runGit(repo.absPath, ["status", "--porcelain"]),
            runGit(repo.absPath, ["diff", "--numstat"]),
            runGit(repo.absPath, ["diff", "--cached", "--numstat"]),
            runGit(repo.absPath, ["rev-parse", "--abbrev-ref", "HEAD"]),
            runGit(repo.absPath, ["log", "origin/HEAD..HEAD", "--oneline"]),
          ]);
        repo.branch = branchOut.trim() || "(no branch)";
        for (const line of porcelain.split("\n")) {
          if (!line.trim()) continue;
          const x = line[0];
          const y = line[1];
          if (x === "?" && y === "?") {
            repo.untracked++;
          } else if (x === "U" || y === "U" || (x === "A" && y === "A")) {
            repo.unstaged++;
          } else {
            if (x !== " " && x !== "?") repo.staged++;
            if (y !== " " && y !== "?") repo.unstaged++;
          }
        }
        const accumulate = (out: string) => {
          for (const line of out.split("\n")) {
            if (!line.trim()) continue;
            const parts = line.split("\t");
            if (parts.length >= 3) {
              const a = parseInt(parts[0], 10) || 0;
              const d = parseInt(parts[1], 10) || 0;
              repo.added += a;
              repo.deleted += d;
            }
          }
        };
        accumulate(numstat);
        accumulate(numstatCached);
        repo.unpushed = unpushedOut.split("\n").filter((l) => l.trim()).length;
      }),
    );

    webviewView.webview.postMessage({
      command: "scanGitReposResult",
      requestId: message.requestId,
      repos,
    });
  }

  private findFirstGitRepo(root: string): string | undefined {
    const walk = (dir: string, depth: number): string | undefined => {
      if (depth > SCAN_MAX_DEPTH) return undefined;
      if (fs.existsSync(path.join(dir, ".git"))) return dir;
      let entries: fs.Dirent[];
      try {
        entries = fs.readdirSync(dir, { withFileTypes: true });
      } catch {
        return undefined;
      }
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        if (SCAN_IGNORED_DIRS.has(entry.name)) continue;
        if (entry.name.startsWith(".")) continue;
        const found = walk(path.join(dir, entry.name), depth + 1);
        if (found) return found;
      }
      return undefined;
    };
    return walk(root, 0);
  }

  /**
   * Tên folder chứa .git (toplevel) và branch hiện tại của 1 repo,
   * dùng cho header của commit message.
   */
  public async handleGitRepoInfo(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    let cwd = workspaceRoot;
    if (workspaceRoot && message.repoPath) {
      const normalized = String(message.repoPath).replace(
        /^([/\\]|\.\.([/\\]|$))+/,
        "",
      );
      const abs = path.resolve(workspaceRoot, normalized);
      const rel = path.relative(workspaceRoot, abs);
      if (!rel.startsWith("..") && !path.isAbsolute(rel)) cwd = abs;
    }

    let resolvedRepoPath: string | undefined = message.repoPath || undefined;
    if (workspaceRoot && !message.repoPath) {
      for (const hint of (message.hintPaths as string[] | undefined) || []) {
        const absFile = path.isAbsolute(hint)
          ? hint
          : path.join(workspaceRoot, hint);
        let dir = path.dirname(absFile);
        let found: string | undefined;
        while (dir.startsWith(workspaceRoot)) {
          if (fs.existsSync(path.join(dir, ".git"))) {
            found = dir;
            break;
          }
          const parent = path.dirname(dir);
          if (parent === dir) break;
          dir = parent;
        }
        if (found) {
          cwd = found;
          resolvedRepoPath = path.relative(workspaceRoot, found) || ".";
          break;
        }
      }
    }
    if (workspaceRoot && !message.repoPath && !resolvedRepoPath) {
      const nested = this.findFirstGitRepo(workspaceRoot);
      if (nested && nested !== workspaceRoot) {
        cwd = nested;
        resolvedRepoPath = path.relative(workspaceRoot, nested);
      }
    }

    const runGit = (args: string[]): Promise<string> =>
      new Promise((resolve) => {
        exec(
          `git ${args.map((a) => JSON.stringify(a)).join(" ")}`,
          { cwd },
          (err, stdout, stderr) => {
            resolve(err ? "" : stdout.trim());
          },
        );
      });

    const [toplevel, branch] = await Promise.all([
      runGit(["rev-parse", "--show-toplevel"]),
      runGit(["rev-parse", "--abbrev-ref", "HEAD"]),
    ]);

    webviewView.webview.postMessage({
      command: "gitRepoInfoResult",
      requestId: message.requestId,
      folderName: toplevel ? path.basename(toplevel) : "",
      branch,
      repoPath: resolvedRepoPath,
    });
  }

  /**
   * Chi tiết 1 repo (lazy-load khi mở rộng trong picker): danh sách branch
   * local, commit chưa push của từng branch (commit đầy đủ chỉ cho branch
   * hiện tại) và file staged/unstaged của working tree.
   */
  public async handleScanGitRepoDetail(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    const reply = (payload: { detail?: unknown; error?: string }) =>
      webviewView.webview.postMessage({
        command: "scanGitRepoDetailResult",
        requestId: message.requestId,
        ...payload,
      });

    if (!message.absPath) {
      reply({ error: "Missing repo path" });
      return;
    }
    const absPath = path.resolve(String(message.absPath));
    const inWorkspace = (vscode.workspace.workspaceFolders || []).some((f) => {
      const rel = path.relative(f.uri.fsPath, absPath);
      return !rel.startsWith("..") && !path.isAbsolute(rel);
    });
    if (!inWorkspace) {
      reply({ error: "Repo is outside the workspace" });
      return;
    }

    const runGit = (args: string[]): Promise<string> =>
      new Promise((resolve) => {
        exec(
          `git ${args.map((a) => JSON.stringify(a)).join(" ")}`,
          { cwd: absPath, maxBuffer: 1024 * 1024 * 10 },
          (err, stdout) => resolve(err ? "" : stdout),
        );
      });

    try {
      const [refs, current, porcelain] = await Promise.all([
        runGit(["for-each-ref", "refs/heads", "--format=%(refname:short)"]),
        runGit(["rev-parse", "--abbrev-ref", "HEAD"]),
        runGit(["status", "--porcelain"]),
      ]);
      const currentBranch = current.trim();

      const branches = await Promise.all(
        refs
          .split("\n")
          .map((l) => l.trim())
          .filter(Boolean)
          .map(async (name) => {
            const range = `origin/HEAD..${name}`;
            const isCurrent = name === currentBranch;
            const count =
              parseInt(
                (await runGit(["rev-list", "--count", range])).trim(),
                10,
              ) || 0;
            let commits: {
              hash: string;
              subject: string;
              author: string;
              date: string;
            }[] = [];
            if (isCurrent && count > 0) {
              const log = await runGit([
                "log",
                range,
                "-n",
                "30",
                "--pretty=format:%h%x09%s%x09%an%x09%cr",
              ]);
              commits = log
                .split("\n")
                .filter((l) => l.trim())
                .map((l) => {
                  const [hash, subject, author, date] = l.split("\t");
                  return {
                    hash: hash || "",
                    subject: subject || "",
                    author: author || "",
                    date: date || "",
                  };
                });
            }
            return { name, isCurrent, unpushed: count, commits };
          }),
      );
      branches.sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent));

      const files: { path: string; status: string; staged: boolean }[] = [];
      for (const line of porcelain.split("\n")) {
        if (!line.trim()) continue;
        const x = line[0];
        const y = line[1];
        const filePath = line.slice(3);
        if (x === "?" && y === "?") {
          files.push({ path: filePath, status: "?", staged: false });
        } else if (x === "U" || y === "U" || (x === "A" && y === "A")) {
          files.push({ path: filePath, status: "U", staged: false });
        } else {
          if (x !== " ")
            files.push({ path: filePath, status: x, staged: true });
          if (y !== " ")
            files.push({ path: filePath, status: y, staged: false });
        }
      }

      reply({ detail: { branches, files: files.slice(0, 300) } });
    } catch (err) {
      reply({
        error:
          err instanceof Error ? err.message : "Failed to read repo detail",
      });
    }
  }

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

    const resolved = this.resolveRepoCwd(
      message.repoPath,
      vscode.workspace.workspaceFolders?.[0],
    );
    if (!resolved) {
      reply({
        hasGit: false,
        hasStaged: false,
        reason: "Chưa mở workspace",
      });
      return;
    }
    const cwd = resolved.cwd;

    try {
      fs.accessSync(path.join(cwd, ".git"));
    } catch {
      reply({
        hasGit: false,
        hasStaged: false,
        reason: "Folder không có thư mục .git",
      });
      return;
    }

    exec(
      "git diff --cached --name-only",
      { cwd, maxBuffer: 1024 * 1024 * 10 },
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
    const resolved = this.resolveRepoCwd(
      message.repoPath,
      vscode.workspace.workspaceFolders?.[0],
    );
    if (!resolved) {
      webviewView.webview.postMessage({
        command: "gitStatusResult",
        requestId: message.requestId,
        error: "No workspace folder found",
      });
      return;
    }

    const cwd = resolved.cwd;
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
          const statsPrefix =
            message.prefixPaths && message.repoPath
              ? String(message.repoPath)
                  .replace(/\\/g, "/")
                  .replace(/^\.\/?|\/$/g, "")
              : "";
          const outStats = statsPrefix
            ? Object.fromEntries(
                Object.entries(diffStats).map(([k, v]) => [
                  `${statsPrefix}/${k}`,
                  v,
                ]),
              )
            : diffStats;

          webviewView.webview.postMessage({
            command: "gitStatusResult",
            requestId: message.requestId,
            output:
              message.prefixPaths && message.repoPath
                ? prefixPorcelainPaths(
                    statusResult.stdout,
                    String(message.repoPath),
                  )
                : statusResult.stdout,
            diffStats: outStats,
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
