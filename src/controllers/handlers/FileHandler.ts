import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as crypto from "crypto";
import * as os from "os";
import { ContextManager } from "../../context/ContextManager";
import { FileLockManager } from "../../managers/FileLockManager";
import { ProjectStructureManager } from "../../context/ProjectStructureManager";
import { RecentItemsManager } from "../../context/RecentItemsManager";
import { FuzzyMatcher } from "../../utils/FuzzyMatcher";

export class FileHandler {
  private _workspaceFilesCache: any[] | null = null;
  private _workspaceFoldersCache: any[] | null = null;
  private _lastCacheUpdate: number = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(
    private contextManager: ContextManager,
    private fileLockManager: FileLockManager,
    private projectStructureManager: ProjectStructureManager | undefined,
    private recentItemsManager: RecentItemsManager | undefined,
  ) {}

  private getContextRoot(): string {
    return path.join(os.homedir(), "khanhromvn-zen");
  }

  private getProjectContextDir(workspaceFolderPath: string): string {
    const hash = crypto
      .createHash("md5")
      .update(workspaceFolderPath)
      .digest("hex");
    return path.join(this.getContextRoot(), "projects", hash);
  }

  private getDiagnosticsForFile(uri: vscode.Uri): string[] {
    const diagnostics = vscode.languages.getDiagnostics(uri);
    return diagnostics
      .filter((d) => d.severity === vscode.DiagnosticSeverity.Error)
      .map(
        (d) =>
          `[${d.source || "Error"}] ${d.message} (Line ${d.range.start.line + 1})`,
      );
  }

  public async handleReadFile(message: any, webviewView: vscode.WebviewView) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) throw new Error("No workspace");
      const pathValue = message.path || message.filePath || message.file_path;
      if (!pathValue)
        throw new Error("The 'path' argument must be of type string.");

      let absPath: vscode.Uri;
      if (pathValue.endsWith("workspace.md")) {
        const pcDir = this.getProjectContextDir(workspaceFolder.uri.fsPath);
        await fs.promises.mkdir(pcDir, { recursive: true });
        absPath = vscode.Uri.file(path.join(pcDir, path.basename(pathValue)));
      } else {
        absPath = vscode.Uri.joinPath(workspaceFolder.uri, pathValue);
      }

      const fsAnalyzer = this.contextManager.getFileSystemAnalyzer();
      const ignoreCheck = await fsAnalyzer.isIgnored(absPath.fsPath);
      if (ignoreCheck.ignored && !pathValue.endsWith("workspace.md")) {
        throw new Error(
          `Path '${pathValue}' is out of scope (ignored by .gitignore or project settings).`,
        );
      }

      let content = "";
      try {
        content = Buffer.from(
          await vscode.workspace.fs.readFile(absPath),
        ).toString("utf8");
      } catch (e: any) {
        if (pathValue.endsWith("workspace.md")) {
          content = "";
        } else {
          throw e;
        }
      }

      if (message.startLine !== undefined) {
        const lines = content.split(/\r?\n/);
        const end =
          message.endLine !== undefined ? message.endLine + 1 : lines.length;
        content = lines.slice(message.startLine || 0, end).join("\n");
      }
      const diagnostics = this.getDiagnosticsForFile(absPath);
      webviewView.webview.postMessage({
        command: "fileContent",
        requestId: message.requestId,
        path: pathValue,
        content,
        diagnostics: diagnostics.length ? diagnostics : undefined,
      });
    } catch (e: any) {
      webviewView.webview.postMessage({
        command: "fileContent",
        requestId: message.requestId,
        error: e.message,
      });
    }
  }

  public async handleWriteFile(message: any, webviewView: vscode.WebviewView) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) throw new Error("No workspace");
      const pathValue = message.path || message.filePath || message.file_path;
      if (!pathValue)
        throw new Error("The 'path' argument must be of type string.");

      let absolutePath: vscode.Uri;
      if (pathValue.endsWith("workspace.md")) {
        const pcDir = this.getProjectContextDir(workspaceFolder.uri.fsPath);
        await fs.promises.mkdir(pcDir, { recursive: true });
        absolutePath = vscode.Uri.file(
          path.join(pcDir, path.basename(pathValue)),
        );
      } else {
        absolutePath = vscode.Uri.joinPath(workspaceFolder.uri, pathValue);
      }
      await vscode.workspace.fs.createDirectory(
        vscode.Uri.joinPath(absolutePath, ".."),
      );
      await vscode.workspace.fs.writeFile(
        absolutePath,
        Buffer.from(message.content, "utf8"),
      );

      if (!message.skipDiagnostics) {
        try {
          await vscode.workspace.openTextDocument(absolutePath);
        } catch {}
        await new Promise((r) => setTimeout(r, 1500));
        const diagnostics = this.getDiagnosticsForFile(absolutePath);
        webviewView.webview.postMessage({
          command: "writeFileResult",
          requestId: message.requestId,
          path: pathValue,
          success: true,
          diagnostics: diagnostics.length ? diagnostics : undefined,
        });
      } else {
        webviewView.webview.postMessage({
          command: "writeFileResult",
          requestId: message.requestId,
          path: pathValue,
          success: true,
        });
      }
    } catch (e: any) {
      webviewView.webview.postMessage({
        command: "writeFileResult",
        requestId: message.requestId,
        path: message.path || message.filePath || message.file_path,
        error: e.message,
      });
    }
  }

  public async handleReplaceInFile(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;
    const pathValue = message.path || message.filePath || message.file_path;
    if (!pathValue) {
      webviewView.webview.postMessage({
        command: "replaceInFileResult",
        requestId: message.requestId,
        error: "The 'path' argument must be of type string.",
      });
      return;
    }
    let absPath: vscode.Uri;
    if (pathValue.endsWith("workspace.md")) {
      const pcDir = this.getProjectContextDir(workspaceFolder.uri.fsPath);
      await fs.promises.mkdir(pcDir, { recursive: true });
      absPath = vscode.Uri.file(path.join(pcDir, path.basename(pathValue)));
    } else {
      absPath = vscode.Uri.joinPath(workspaceFolder.uri, pathValue);
    }
    const release = await this.fileLockManager.acquire(absPath.fsPath);
    let newContent: string | undefined;

    try {
      let content = "";
      try {
        content = Buffer.from(
          await vscode.workspace.fs.readFile(absPath),
        ).toString("utf8");
      } catch (e: any) {
        if (!pathValue.endsWith("workspace.md")) {
          throw e;
        }
      }

      const match = message.diff.match(
        /<<<<<<< SEARCH\s*\n([\s\S]*?)\n\s*=======\s*\n([\s\S]*?)(?:>>>>>>>|>)\s*REPLACE/,
      );
      if (!match) throw new Error("Invalid diff format");

      const clean = (text: string) =>
        text.replace(/^```[a-zA-Z]*$/gm, "").trim();
      const searchArgs = clean(match[1]);
      const replaceArgs = clean(match[2]);

      let target = searchArgs;
      if (content.indexOf(searchArgs) === -1) {
        const fuzzy = FuzzyMatcher.findMatch(content, searchArgs);
        if (!fuzzy || fuzzy.score <= 1e-9)
          throw new Error("Search text not found");
        target = fuzzy.originalText;
      }
      newContent = content.replace(target, replaceArgs);
      if (newContent === content) throw new Error("No change made");
      await vscode.workspace.fs.writeFile(
        absPath,
        Buffer.from(newContent, "utf8"),
      );
    } catch (e: any) {
      webviewView.webview.postMessage({
        command: "replaceInFileResult",
        requestId: message.requestId,
        error: e.message,
      });
      release();
      return;
    }
    release();

    if (!message.skipDiagnostics) {
      try {
        await vscode.workspace.openTextDocument(absPath);
      } catch {}
      await new Promise((r) => setTimeout(r, 1500));
      const diagnostics = this.getDiagnosticsForFile(absPath);
      webviewView.webview.postMessage({
        command: "replaceInFileResult",
        requestId: message.requestId,
        path: message.path,
        success: true,
        diagnostics: diagnostics.length ? diagnostics : undefined,
        content: newContent,
      });
    } else {
      webviewView.webview.postMessage({
        command: "replaceInFileResult",
        requestId: message.requestId,
        path: message.path,
        success: true,
      });
    }
  }

  public async handleAskBypassGitignore(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    try {
      const { path: pathValue, requestId } = message;
      if (!pathValue) throw new Error("Path is required");

      const fsAnalyzer = this.contextManager.getFileSystemAnalyzer();
      fsAnalyzer.addBypassPath(pathValue);

      webviewView.webview.postMessage({
        command: "askBypassGitignoreResult",
        requestId,
        path: pathValue,
        success: true,
      });
    } catch (error: any) {
      webviewView.webview.postMessage({
        command: "askBypassGitignoreResult",
        requestId: message.requestId,
        error: String(error),
      });
    }
  }

  public async handleSearchFiles(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) return;
      const regex = message.regex;
      if (!regex) return;

      const pathValue = message.path || message.folder_path || message.filePath;
      const searchPath = pathValue || ".";
      const uri = vscode.Uri.joinPath(workspaceFolder.uri, searchPath);

      const fsAnalyzer = this.contextManager.getFileSystemAnalyzer();
      const ignoreCheck = await fsAnalyzer.isIgnored(uri.fsPath);
      if (ignoreCheck.ignored) {
        throw new Error(
          `Path '${searchPath}' is out of scope (ignored by .gitignore or project settings).`,
        );
      }

      const { exec } = require("child_process");
      const cmd = `grep -rIlE "${regex.replace(/"/g, '\\"')}" "${searchPath}"`;
      exec(
        cmd,
        { cwd: workspaceFolder.uri.fsPath, maxBuffer: 1024 * 1024 * 10 },
        (err: any, stdout: string) => {
          if (err && err.code !== 1) {
            webviewView.webview.postMessage({
              command: "searchFilesResult",
              requestId: message.requestId,
              error: err.message,
            });
          } else {
            const results = stdout
              .trim()
              .split("\n")
              .filter((l) => l.length > 0);
            webviewView.webview.postMessage({
              command: "searchFilesResult",
              requestId: message.requestId,
              path: pathValue,
              results,
            });
          }
        },
      );
    } catch (e: any) {
      webviewView.webview.postMessage({
        command: "searchFilesResult",
        requestId: message.requestId,
        path: message.path || message.folder_path,
        error: e.message,
      });
    }
  }

  public async handleValidateFuzzyMatch(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;
    const absPath = vscode.Uri.joinPath(workspaceFolder.uri, message.path);
    const content = Buffer.from(
      await vscode.workspace.fs.readFile(absPath),
    ).toString("utf8");
    const match = message.diff.match(
      /<<<<<<< SEARCH\s*\n([\s\S]*?)\n\s*=======\s*\n([\s\S]*?)(?:>>>>>>>|>)\s*REPLACE/,
    );
    if (!match) {
      webviewView.webview.postMessage({
        command: "validateFuzzyMatchResult",
        id: message.id,
        status: "invalid_format",
      });
      return;
    }
    const clean = (text: string) =>
      text
        .replace(/^```[a-zA-Z]*$/gm, "")
        .trim()
        .replace(/\r\n/g, "\n");
    const search = clean(match[1]);
    const exact = content.replace(/\r\n/g, "\n").indexOf(search);

    if (exact !== -1) {
      const startLine = content.substring(0, exact).split(/\r?\n/).length;
      webviewView.webview.postMessage({
        command: "validateFuzzyMatchResult",
        id: message.id,
        status: "exact",
        searchBlock: search,
        foundBlock: search,
        score: 1.0,
        startLine,
      });
    } else {
      const fuzzy = FuzzyMatcher.findMatch(content, search);
      if (fuzzy) {
        webviewView.webview.postMessage({
          command: "validateFuzzyMatchResult",
          id: message.id,
          status: "fuzzy",
          score: fuzzy.score,
          searchBlock: search,
          foundBlock: fuzzy.originalText,
          startLine: fuzzy.startLine,
        });
      } else {
        webviewView.webview.postMessage({
          command: "validateFuzzyMatchResult",
          id: message.id,
          status: "none",
          searchBlock: search,
        });
      }
    }
  }

  public async handleGetWorkspaceFiles(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    const now = Date.now();
    if (
      this._workspaceFilesCache &&
      now - this._lastCacheUpdate < this.CACHE_TTL
    ) {
      webviewView.webview.postMessage({
        command: "workspaceFilesResponse",
        requestId: message.requestId,
        files: this._workspaceFilesCache,
      });
      return;
    }

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;

    const blacklist = this.projectStructureManager
      ? await this.projectStructureManager.getBlacklist()
      : [];
    const fsAnalyzer = this.contextManager.getFileSystemAnalyzer();
    const recentFiles = this.recentItemsManager
      ? this.recentItemsManager.getRecentFiles()
      : [];

    const files = await vscode.workspace.findFiles("**/*");
    const stats = await Promise.all(
      files.map(async (f) => {
        const relativePath = vscode.workspace.asRelativePath(f);

        if (
          blacklist.some(
            (pattern) =>
              relativePath === pattern ||
              relativePath.startsWith(pattern + "/"),
          )
        ) {
          return null;
        }

        try {
          const s = await vscode.workspace.fs.stat(f);
          const lines = await fsAnalyzer.getFileLineCount(f.fsPath);
          return {
            path: relativePath,
            lastModified: s.mtime,
            type: "file",
            size: s.size,
            lines,
            isRecent: recentFiles.includes(relativePath),
          };
        } catch {
          return null;
        }
      }),
    );

    const result = stats
      .filter((x) => x)
      .sort((a: any, b: any) => b.lastModified - a.lastModified);

    this._workspaceFilesCache = result;
    this._lastCacheUpdate = now;

    webviewView.webview.postMessage({
      command: "workspaceFilesResponse",
      requestId: message.requestId,
      files: result,
    });
  }

  public async handleGetWorkspaceFolders(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    const now = Date.now();
    if (
      this._workspaceFoldersCache &&
      now - this._lastCacheUpdate < this.CACHE_TTL
    ) {
      webviewView.webview.postMessage({
        command: "workspaceFoldersResponse",
        requestId: message.requestId,
        folders: this._workspaceFoldersCache,
      });
      return;
    }

    const fsAnalyzer = this.contextManager.getFileSystemAnalyzer();
    const foldersWithCounts = await fsAnalyzer.getFolderPaths();
    const recentFolders = this.recentItemsManager
      ? this.recentItemsManager.getRecentFolders()
      : [];

    const result = foldersWithCounts.map((f) => ({
      name: path.basename(f.path),
      path: f.path,
      type: "folder",
      isRecent: recentFolders.includes(f.path),
      fileCount: f.count,
    }));

    this._workspaceFoldersCache = result;
    webviewView.webview.postMessage({
      command: "workspaceFoldersResponse",
      requestId: message.requestId,
      folders: result,
    });
  }

  public async handleGetWorkspaceTree(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;
    const raw = await this.contextManager.getRawFileTree();
    const normalize = (node: any): any => ({
      ...node,
      path: path
        .relative(workspaceFolder.uri.fsPath, node.path)
        .replace(/\\/g, "/"),
      children: node.children?.map(normalize),
    });
    webviewView.webview.postMessage({
      command: "workspaceTreeResult",
      requestId: message.requestId,
      tree: raw ? normalize(raw) : null,
    });
  }

  public async handleListFiles(message: any, webviewView: vscode.WebviewView) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) return;
      const pathValue = message.path || message.folder_path || message.filePath;
      const dirPath = pathValue || ".";
      const recursiveParam = message.recursive;
      const absolutePath = vscode.Uri.joinPath(workspaceFolder.uri, dirPath);

      let maxDepth = 1;
      if (recursiveParam === "true" || recursiveParam === true) maxDepth = 10;
      else if (recursiveParam)
        maxDepth = parseInt(String(recursiveParam), 10) || 1;

      const fsAnalyzer = this.contextManager.getFileSystemAnalyzer();
      const ignoreCheck = await fsAnalyzer.isIgnored(absolutePath.fsPath);
      if (ignoreCheck.ignored) {
        throw new Error(
          `Path '${dirPath}' is out of scope (ignored by .gitignore or project settings).`,
        );
      }
      const tree = await fsAnalyzer.getFileTree(maxDepth, absolutePath.fsPath);

      webviewView.webview.postMessage({
        command: "listFilesResult",
        requestId: message.requestId,
        path: pathValue,
        files: tree,
      });
    } catch (e: any) {
      webviewView.webview.postMessage({
        command: "listFilesResult",
        requestId: message.requestId,
        path: message.path || message.folder_path,
        error: e.message,
      });
    }
  }

  public async handleGetFileStats(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) return;
      const uri = vscode.Uri.joinPath(workspaceFolder.uri, message.path);
      const stat = await vscode.workspace.fs.stat(uri);
      const content = await vscode.workspace.fs.readFile(uri);
      const lines = Buffer.from(content).toString("utf8").split("\n").length;

      webviewView.webview.postMessage({
        command: "fileStatsResult",
        requestId: message.requestId,
        id: message.id,
        path: message.path,
        lines: lines,
        stats: {
          size: stat.size,
          mtime: stat.mtime,
          type: stat.type === vscode.FileType.Directory ? "directory" : "file",
        },
      });
    } catch (e: any) {
      webviewView.webview.postMessage({
        command: "fileStatsResult",
        requestId: message.requestId,
        id: message.id,
        path: message.path,
        error: e.message,
      });
    }
  }

  public async handleGetGitChanges(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    // Git changes logic via git extension or simple shell
  }
}
