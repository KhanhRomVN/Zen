import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as crypto from "crypto";
import * as os from "os";
import { ContextManager } from "../../context/ContextManager";
import { FileLockManager } from "../../managers/FileLockManager";
import { RecentItemsManager } from "../../context/RecentItemsManager";
import { FuzzyMatcher } from "../../utils/FuzzyMatcher";
import { CheckpointManager } from "../../utils/CheckpointManager";
import { SnapshotManager } from "../../utils/SnapshotManager";
import { SecurityValidator } from "../../agent/validators/SecurityValidator";
import { LoggerService } from "../../services/LoggerService";

export class FileHandler {
  private _workspaceFilesCache: any[] | null = null;
  private _workspaceFoldersCache: any[] | null = null;
  private _lastCacheUpdate: number = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  constructor(
    private contextManager: ContextManager,
    private fileLockManager: FileLockManager,
    private recentItemsManager: RecentItemsManager | undefined,
  ) {}

  private resolveWorkspacePath(
    workspaceFolder: vscode.WorkspaceFolder,
    pathValue: string,
  ): vscode.Uri {
    if (path.isAbsolute(pathValue)) {
      return vscode.Uri.file(pathValue);
    }
    return vscode.Uri.joinPath(workspaceFolder.uri, pathValue);
  }

  private async resolveWorkspacePathWithFallback(
    workspaceFolder: vscode.WorkspaceFolder,
    pathValue: string,
  ): Promise<vscode.Uri> {
    const candidates = path.isAbsolute(pathValue)
      ? [
          vscode.Uri.file(pathValue),
          vscode.Uri.joinPath(workspaceFolder.uri, pathValue),
        ]
      : [
          vscode.Uri.joinPath(workspaceFolder.uri, pathValue),
          vscode.Uri.file(pathValue),
        ];

    let lastError: unknown;
    for (const uri of candidates) {
      try {
        await vscode.workspace.fs.stat(uri);
        return uri;
      } catch (e) {
        lastError = e;
      }
    }
    throw lastError;
  }

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

  private getDiagnosticsForFile(uri: vscode.Uri): Array<{
    severity: string;
    message: string;
    line: number;
    column: number;
    source?: string;
    code?: string | number;
  }> {
    const diagnostics = vscode.languages.getDiagnostics(uri);
    return diagnostics
      .filter((d) => 
        d.severity === vscode.DiagnosticSeverity.Error || 
        d.severity === vscode.DiagnosticSeverity.Warning
      )
      .map((d) => ({
        severity: d.severity === vscode.DiagnosticSeverity.Error ? 'error' : 'warning',
        message: d.message,
        line: d.range.start.line + 1, // 1-indexed for display
        column: d.range.start.character + 1, // 1-indexed for display
        source: d.source,
        code: d.code ? (typeof d.code === 'object' ? d.code.value : d.code) : undefined,
      }));
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
        absPath = await this.resolveWorkspacePathWithFallback(
          workspaceFolder,
          pathValue,
        );
      }

      // Security Check
      const securityCheck = SecurityValidator.validatePath(
        absPath.fsPath,
        false,
      );
      if (!securityCheck.safe) {
        throw new Error(securityCheck.reason || "Security validation failed");
      }

      const fsAnalyzer = this.contextManager.getFileSystemAnalyzer();
      const ignoreCheck = await fsAnalyzer.isIgnored(absPath.fsPath);
      if (
        ignoreCheck.ignored &&
        !pathValue.endsWith("workspace.md") &&
        !message.bypassIgnore
      ) {
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
    const logger = LoggerService.getInstance();
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) throw new Error("No workspace");
      const pathValue = message.path || message.filePath || message.file_path;
      if (!pathValue)
        throw new Error("The 'path' argument must be of type string.");

      logger.info(`[write_to_file] Start`, {
        path: pathValue,
        contentLength: message.content?.length,
        requestId: message.requestId,
      });

      let absolutePath: vscode.Uri;
      if (pathValue.endsWith("workspace.md")) {
        const pcDir = this.getProjectContextDir(workspaceFolder.uri.fsPath);
        await fs.promises.mkdir(pcDir, { recursive: true });
        absolutePath = vscode.Uri.file(
          path.join(pcDir, path.basename(pathValue)),
        );
      } else {
        absolutePath = this.resolveWorkspacePath(workspaceFolder, pathValue);
      }

      // Security Check
      const securityCheck = SecurityValidator.validatePath(
        absolutePath.fsPath,
        true,
      );
      if (!securityCheck.safe) {
        throw new Error(securityCheck.reason || "Security validation failed");
      }

      const release = await this.fileLockManager.acquire(absolutePath.fsPath);
      try {
        if (message.conversationId) {
          CheckpointManager.getInstance().setActiveConversationId(
            message.conversationId,
          );
        }
        const fileExists = fs.existsSync(absolutePath.fsPath);
        let beforeContent: string | null = null;
        if (fileExists) {
          try {
            beforeContent = await fs.promises.readFile(
              absolutePath.fsPath,
              "utf-8",
            );
          } catch {
            beforeContent = null;
          }
        }
        await CheckpointManager.getInstance().createCheckpoint(
          absolutePath.fsPath,
          fileExists ? "modify" : "create",
        );

        await vscode.workspace.fs.createDirectory(
          vscode.Uri.joinPath(absolutePath, ".."),
        );
        await vscode.workspace.fs.writeFile(
          absolutePath,
          Buffer.from(message.content, "utf8"),
        );
        logger.info(`[write_to_file] File written successfully`, {
          path: pathValue,
        });

        if (message.conversationId && message.actionId) {
          await SnapshotManager.getInstance().saveSnapshot(
            message.conversationId,
            message.actionId,
            absolutePath.fsPath,
            "write",
            beforeContent,
            message.content,
          );
        }
      } finally {
        release();
      }

      if (!message.skipDiagnostics) {
        try {
          await vscode.workspace.openTextDocument(absolutePath);
        } catch {}
        await new Promise((r) => setTimeout(r, 1500));
        const diagnostics = this.getDiagnosticsForFile(absolutePath);
        if (diagnostics.length) {
          logger.warn(`[write_to_file] Diagnostics found`, {
            path: pathValue,
            count: diagnostics.length,
          });
        }
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
      logger.error(`[write_to_file] Error`, {
        path: message.path || message.filePath || message.file_path,
        error: e.message,
      });
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
    const logger = LoggerService.getInstance();
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

    logger.info(`[replace_in_file] Start`, {
      path: pathValue,
      hasOldStr: !!message.old_str,
      hasNewStr: !!message.new_str,
      hasDiff: !!message.diff,
      requestId: message.requestId,
    });

    let absPath: vscode.Uri;
    if (pathValue.endsWith("workspace.md")) {
      const pcDir = this.getProjectContextDir(workspaceFolder.uri.fsPath);
      await fs.promises.mkdir(pcDir, { recursive: true });
      absPath = vscode.Uri.file(path.join(pcDir, path.basename(pathValue)));
    } else {
      try {
        absPath = await this.resolveWorkspacePathWithFallback(
          workspaceFolder,
          pathValue,
        );
      } catch {
        absPath = this.resolveWorkspacePath(workspaceFolder, pathValue);
      }
    }

    // Security Check
    const securityCheck = SecurityValidator.validatePath(absPath.fsPath, true);
    if (!securityCheck.safe) {
      webviewView.webview.postMessage({
        command: "replaceInFileResult",
        requestId: message.requestId,
        error: securityCheck.reason || "Security validation failed",
      });
      return;
    }

    if (message.conversationId) {
      CheckpointManager.getInstance().setActiveConversationId(
        message.conversationId,
      );
    }
    await CheckpointManager.getInstance().createCheckpoint(
      absPath.fsPath,
      "modify",
    );

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

      // Support both new schema (old_str/new_str) and legacy schema (diff)
      let searchArgs: string;
      let replaceArgs: string;

      if (message.old_str !== undefined && message.new_str !== undefined) {
        // New schema: direct old_str and new_str
        const clean = (text: string) =>
          text.replace(/^```[a-zA-Z]*$/gm, "").trim();
        searchArgs = clean(message.old_str);
        replaceArgs = clean(message.new_str);
        
        logger.debug(`[replace_in_file] Using new schema (old_str/new_str)`, {
          path: pathValue,
          searchLength: searchArgs.length,
          replaceLength: replaceArgs.length,
        });
      } else if (message.diff !== undefined && message.diff !== null) {
        // Legacy schema: parse diff format
        const match = message.diff.match(
          /<<<<<<< SEARCH\s*\n([\s\S]*?)\s*=======\s*\n([\s\S]*?)(?:>>>>>>>|>)\s*REPLACE/,
        );
        if (!match) {
          logger.error(`[replace_in_file] Invalid diff format`, {
            path: pathValue,
            diff: message.diff?.substring(0, 200),
          });
          throw new Error("Invalid diff format");
        }

        const clean = (text: string) =>
          text.replace(/^```[a-zA-Z]*$/gm, "").trim();
        searchArgs = clean(match[1]);
        replaceArgs = clean(match[2]);

        logger.debug(`[replace_in_file] Using legacy schema (diff)`, {
          path: pathValue,
          searchLength: searchArgs.length,
          replaceLength: replaceArgs.length,
        });
      } else {
        logger.error(`[replace_in_file] Missing required parameters`, {
          path: pathValue,
          hasOldStr: message.old_str !== undefined,
          hasNewStr: message.new_str !== undefined,
          hasDiff: message.diff !== undefined,
          messageKeys: Object.keys(message),
        });
        throw new Error("Missing old_str/new_str or diff parameter");
      }

      let target = searchArgs;
      if (content.indexOf(searchArgs) === -1) {
        logger.warn(`[replace_in_file] Exact match not found, trying fuzzy`, {
          path: pathValue,
        });
        const fuzzy = FuzzyMatcher.findMatch(content, searchArgs);
        if (!fuzzy || fuzzy.score <= 1e-9) {
          logger.error(`[replace_in_file] Search text not found`, {
            path: pathValue,
          });
          throw new Error("Search text not found");
        }
        logger.info(`[replace_in_file] Fuzzy match found`, {
          path: pathValue,
          score: fuzzy.score,
        });
        target = fuzzy.originalText;
      } else {
        logger.debug(`[replace_in_file] Exact match found`, {
          path: pathValue,
        });
      }

      newContent = content.replace(target, replaceArgs);
      if (newContent === content) throw new Error("No change made");
      await vscode.workspace.fs.writeFile(
        absPath,
        Buffer.from(newContent, "utf8"),
      );
      logger.info(`[replace_in_file] File updated successfully`, {
        path: pathValue,
      });

      if (message.conversationId && message.actionId && newContent) {
        await SnapshotManager.getInstance().saveSnapshot(
          message.conversationId,
          message.actionId,
          absPath.fsPath,
          "replace",
          content,
          newContent,
        );
      }
    } catch (e: any) {
      logger.error(`[replace_in_file] Error during replace`, {
        path: pathValue,
        error: e.message,
      });
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
      if (diagnostics.length) {
        logger.warn(`[replace_in_file] Diagnostics found`, {
          path: pathValue,
          count: diagnostics.length,
        });
      }
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

    const fsAnalyzer = this.contextManager.getFileSystemAnalyzer();
    const recentFiles = this.recentItemsManager
      ? this.recentItemsManager.getRecentFiles()
      : [];

    const files = await vscode.workspace.findFiles("**/*");
    const stats = await Promise.all(
      files.map(async (f) => {
        const relativePath = vscode.workspace.asRelativePath(f);

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
      const absolutePath = await this.resolveWorkspacePathWithFallback(
        workspaceFolder,
        dirPath,
      ).catch(() => this.resolveWorkspacePath(workspaceFolder, dirPath));

      let maxDepth = 1;
      if (message.depth !== undefined && message.depth !== null) {
        maxDepth = parseInt(String(message.depth), 10) || 1;
      } else if (recursiveParam === "true" || recursiveParam === true)
        maxDepth = 20;
      else if (recursiveParam)
        maxDepth = parseInt(String(recursiveParam), 10) || 1;

      const fsAnalyzer = this.contextManager.getFileSystemAnalyzer();
      const ignoreCheck = await fsAnalyzer.isIgnored(absolutePath.fsPath);
      if (ignoreCheck.ignored && !message.bypassIgnore) {
        throw new Error(
          `Path '${dirPath}' is out of scope (ignored by .gitignore or project settings).`,
        );
      }
      const tree = await fsAnalyzer.getFileTree(
        maxDepth,
        absolutePath.fsPath,
        true,
      );

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
      const uri = await this.resolveWorkspacePathWithFallback(
        workspaceFolder,
        message.path,
      );
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

    // Run git status and git diff --numstat in parallel
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
          // Check for git status error
          if (statusResult.error) {
            console.error(
              `[Git] Error running git status:`,
              statusResult.error,
            );
            if (statusResult.error.code === "ENOENT") {
              webviewView.webview.postMessage({
                command: "gitStatusResult",
                requestId: message.requestId,
                error:
                  "Git is not installed or not in PATH. Please install Git and try again.",
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

          const statusOutput = statusResult.stdout;
          const diffOutput = diffResult.stdout;
          const diffCachedOutput = diffCachedResult.stdout;
          const unpushedOutput = unpushedResult.stdout || "";

          // Parse diff stats
          const diffStats: Record<string, { added: number; deleted: number }> =
            {};

          // Parse unstaged diff stats
          const diffLines = diffOutput
            .split("\n")
            .filter((line) => line.trim());
          for (const line of diffLines) {
            const parts = line.split("\t");
            if (parts.length >= 3) {
              const added = parseInt(parts[0], 10) || 0;
              const deleted = parseInt(parts[1], 10) || 0;
              const filePath = parts.slice(2).join("\t").trim();
              if (filePath) {
                diffStats[filePath] = { added, deleted };
              }
            }
          }

          // Parse staged diff stats (overwrite if both staged and unstaged have changes)
          const diffCachedLines = diffCachedOutput
            .split("\n")
            .filter((line) => line.trim());
          for (const line of diffCachedLines) {
            const parts = line.split("\t");
            if (parts.length >= 3) {
              const added = parseInt(parts[0], 10) || 0;
              const deleted = parseInt(parts[1], 10) || 0;
              const filePath = parts.slice(2).join("\t").trim();
              if (filePath) {
                // For staged files, we want to show the staged diff stats
                diffStats[filePath] = { added, deleted };
              }
            }
          }

          // Parse unpushed commits
          const unpushedCommits = unpushedOutput
            .split("\n")
            .filter((line: string) => line.trim().length > 0);

          const branch = branchResult.stdout?.trim() || "";

          // Send combined result
          webviewView.webview.postMessage({
            command: "gitStatusResult",
            requestId: message.requestId,
            output: statusOutput,
            diffStats: diffStats,
            unpushedCommits: unpushedCommits,
            branch: branch,
          });
        },
      )
      .catch((err) => {
        console.error(`[Git] Error in Promise.all:`, err);
        webviewView.webview.postMessage({
          command: "gitStatusResult",
          requestId: message.requestId,
          error: err.message || "Failed to get git status",
        });
      });
  }

  public async handleDeleteFile(message: any, webviewView: vscode.WebviewView) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) throw new Error("No workspace");
      const filePath = message.file_path;
      if (!filePath) throw new Error("'file_path' is required");

      const absPath = path.isAbsolute(filePath)
        ? filePath
        : path.join(workspaceFolder.uri.fsPath, filePath);

      const checkpointManager = CheckpointManager.getInstance();
      await checkpointManager.createCheckpoint(absPath, "delete");

      await fs.promises.unlink(absPath);

      webviewView.webview.postMessage({
        command: "deleteFileResult",
        requestId: message.requestId,
        success: true,
      });
    } catch (e: any) {
      webviewView.webview.postMessage({
        command: "deleteFileResult",
        requestId: message.requestId,
        error: e.message,
      });
    }
  }

  public async handleDeleteFolder(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) throw new Error("No workspace");
      const folderPath = message.folder_path;
      if (!folderPath) throw new Error("'folder_path' is required");

      const absPath = path.isAbsolute(folderPath)
        ? folderPath
        : path.join(workspaceFolder.uri.fsPath, folderPath);

      const checkpointManager = CheckpointManager.getInstance();
      const collectFiles = async (dir: string) => {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            await collectFiles(full);
          } else {
            await checkpointManager.createCheckpoint(full, "delete");
          }
        }
      };
      await collectFiles(absPath);

      await fs.promises.rm(absPath, { recursive: true, force: true });

      webviewView.webview.postMessage({
        command: "deleteFolderResult",
        requestId: message.requestId,
        success: true,
      });
    } catch (e: any) {
      webviewView.webview.postMessage({
        command: "deleteFolderResult",
        requestId: message.requestId,
        error: e.message,
      });
    }
  }

  public async handleMoveFile(message: any, webviewView: vscode.WebviewView) {
    const logger = LoggerService.getInstance();
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) throw new Error("No workspace");

      const sourcePath = message.file_path || message.source_path;
      const targetFolderPath = message.target_folder_path;
      if (!sourcePath) throw new Error("'file_path' is required");
      if (!targetFolderPath)
        throw new Error("'target_folder_path' is required");

      logger.info(`[move_file] Start`, {
        source: sourcePath,
        targetFolder: targetFolderPath,
        requestId: message.requestId,
      });

      const absSource = path.isAbsolute(sourcePath)
        ? sourcePath
        : path.join(workspaceFolder.uri.fsPath, sourcePath);

      const absTargetFolder = path.isAbsolute(targetFolderPath)
        ? targetFolderPath
        : path.join(workspaceFolder.uri.fsPath, targetFolderPath);

      // Security checks
      const sourceCheck = SecurityValidator.validatePath(absSource, false);
      if (!sourceCheck.safe)
        throw new Error(
          sourceCheck.reason || "Security validation failed for source",
        );

      const targetCheck = SecurityValidator.validatePath(absTargetFolder, true);
      if (!targetCheck.safe)
        throw new Error(
          targetCheck.reason || "Security validation failed for target",
        );

      // Verify source file exists
      try {
        await fs.promises.stat(absSource);
      } catch {
        throw new Error(`Source file not found: '${sourcePath}'`);
      }

      // Ensure target folder exists (create if needed)
      await fs.promises.mkdir(absTargetFolder, { recursive: true });

      const fileName = path.basename(absSource);
      const absDestination = path.join(absTargetFolder, fileName);

      // Create checkpoint for undo support
      const checkpointManager = CheckpointManager.getInstance();
      if (message.conversationId) {
        checkpointManager.setActiveConversationId(message.conversationId);
      }
      await checkpointManager.createCheckpoint(absSource, "delete");

      // Move file: try rename first (same filesystem), fallback to copy+delete
      try {
        await fs.promises.rename(absSource, absDestination);
      } catch (renameErr: any) {
        // EXDEV = cross-device rename not permitted — fallback to copy + delete
        if (renameErr.code === "EXDEV") {
          await fs.promises.copyFile(absSource, absDestination);
          await fs.promises.unlink(absSource);
        } else {
          throw renameErr;
        }
      }

      const newPath = path
        .relative(workspaceFolder.uri.fsPath, absDestination)
        .replace(/\\/g, "/");

      logger.info(`[move_file] File moved successfully`, {
        source: sourcePath,
        destination: absDestination,
        newPath,
      });

      webviewView.webview.postMessage({
        command: "moveFileResult",
        requestId: message.requestId,
        success: true,
        newPath,
      });
    } catch (e: any) {
      logger.error(`[move_file] Error`, {
        source: message.file_path || message.source_path,
        error: e.message,
      });
      webviewView.webview.postMessage({
        command: "moveFileResult",
        requestId: message.requestId,
        error: e.message,
      });
    }
  }

  public async handleGitDiff(message: any, webviewView: vscode.WebviewView) {
    const logger = LoggerService.getInstance();
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
    // Escape the file path for shell
    const escapedPath = filePath.replace(/"/g, '\\"');

    // Step 1: Check if the file is tracked by git
    exec(
      `git ls-files -- "${escapedPath}"`,
      { cwd, maxBuffer: 1024 * 1024 * 10 },
      (lsErr: any, lsStdout: string) => {
        const isTracked = lsStdout.trim().length > 0;

        if (!isTracked) {
          // File is untracked (new file) - read its content and show as diff
          const absPath = path.isAbsolute(filePath)
            ? filePath
            : path.join(cwd, filePath);
          try {
            const content = fs.readFileSync(absPath, "utf-8");
            const diffOutput = `--- /dev/null\n+++ b/${filePath}\n@@ -0,0 +1,${content.split("\n").length} @@\n${content
              .split("\n")
              .map((line: string) => "+ " + line)
              .join("\n")}`;
            webviewView.webview.postMessage({
              command: "gitDiffResult",
              requestId: message.requestId,
              diff: diffOutput,
            });
            return;
          } catch (readErr) {
            webviewView.webview.postMessage({
              command: "gitDiffResult",
              requestId: message.requestId,
              diff: "",
            });
            return;
          }
        }

        // Step 2: Check if the file is staged (added to index)
        exec(
          `git status --porcelain -- "${escapedPath}"`,
          { cwd, maxBuffer: 1024 * 1024 * 10 },
          (statusErr: any, statusStdout: string) => {
            let isStaged = false;
            if (!statusErr) {
              const lines = statusStdout
                .trim()
                .split("\n")
                .filter((l) => l.length > 0);
              for (const line of lines) {
                // Status format: "XY path" where X = staged, Y = unstaged
                // X can be 'A' (added), 'M' (modified), 'D' (deleted), etc.
                if (line.length >= 2) {
                  const stagedChar = line[0];
                  if (stagedChar !== " " && stagedChar !== "?") {
                    isStaged = true;
                    break;
                  }
                }
              }
            }

            // Step 3: Run git diff with the appropriate flags
            const diffCmd = isStaged
              ? `git diff --cached -- "${escapedPath}"`
              : `git diff -- "${escapedPath}"`;

            exec(
              diffCmd,
              { cwd, maxBuffer: 1024 * 1024 * 10 },
              (err: any, stdout: string, stderr: string) => {
                // If git diff returns empty output, fallback to reading the file directly
                const hasDiffOutput = stdout && stdout.trim().length > 0;
                const isErrorWithNoOutput =
                  err && err.code === 1 && stdout.trim() === "";

                if (isErrorWithNoOutput || (!hasDiffOutput && !err)) {
                  const absPath = path.isAbsolute(filePath)
                    ? filePath
                    : path.join(cwd, filePath);
                  try {
                    const content = fs.readFileSync(absPath, "utf-8");
                    const lines = content.split("\n");
                    // Determine if staged or unstaged for the header
                    const prefix = isStaged ? "staged" : "unstaged";
                    const diffOutput = `--- a/${filePath}\n+++ b/${filePath} (${prefix})\n@@ -1,${lines.length} +1,${lines.length} @@\n${lines.map((line: string) => " " + line).join("\n")}`;
                    webviewView.webview.postMessage({
                      command: "gitDiffResult",
                      requestId: message.requestId,
                      diff: diffOutput,
                    });
                    return;
                  } catch (readErr) {
                    // If file can't be read, return empty diff
                    webviewView.webview.postMessage({
                      command: "gitDiffResult",
                      requestId: message.requestId,
                      diff: "",
                      error: null,
                    });
                    return;
                  }
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

  public async handleGetSnapshot(
    message: any,
    webviewView: vscode.WebviewView,
  ): Promise<void> {
    try {
      const { conversationId, actionId, requestId } = message;
      if (!conversationId || !actionId) {
        throw new Error("conversationId and actionId are required");
      }
      const snapshot = await SnapshotManager.getInstance().getSnapshot(
        conversationId,
        actionId,
      );
      if (!snapshot) {
        webviewView.webview.postMessage({
          command: "getSnapshotResult",
          requestId,
          error: "Snapshot not found",
        });
        return;
      }
      webviewView.webview.postMessage({
        command: "getSnapshotResult",
        requestId,
        actionId,
        filePath: snapshot.filePath,
        operation: snapshot.operation,
        beforeContent: snapshot.beforeContent,
        afterContent: snapshot.afterContent,
        timestamp: snapshot.timestamp,
      });
    } catch (e: any) {
      webviewView.webview.postMessage({
        command: "getSnapshotResult",
        requestId: message.requestId,
        error: e.message,
      });
    }
  }
}
