import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { ContextManager } from "../../../context/ContextManager";
import { FileLockManager } from "../../../managers/FileLockManager";
import { RecentItemsManager } from "../../../context/RecentItemsManager";
import { CheckpointManager } from "../../../managers/CheckpointManager";
import { SnapshotManager } from "../../../managers/SnapshotManager";
import { ReplaceInFileHistoryManager } from "../../../managers/ReplaceInFileHistoryManager";
import { SecurityValidator } from "../../../agent/validators/SecurityValidator";
import { LoggerService } from "../../../services/LoggerService";

export class FileOperationHandler {
  private _workspaceFilesCache: any[] | null = null;
  private _workspaceFoldersCache: any[] | null = null;
  private _lastCacheUpdate: number = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000;

  constructor(
    private contextManager: ContextManager,
    private fileLockManager: FileLockManager,
    private recentItemsManager: RecentItemsManager | undefined,
  ) {}

  private resolveWorkspacePath(workspaceFolder: vscode.WorkspaceFolder, pathValue: string): vscode.Uri {
    if (path.isAbsolute(pathValue)) return vscode.Uri.file(pathValue);
    return vscode.Uri.joinPath(workspaceFolder.uri, pathValue);
  }

  private async resolveWorkspacePathWithFallback(workspaceFolder: vscode.WorkspaceFolder, pathValue: string): Promise<vscode.Uri> {
    const candidates = path.isAbsolute(pathValue)
      ? [vscode.Uri.file(pathValue), vscode.Uri.joinPath(workspaceFolder.uri, pathValue)]
      : [vscode.Uri.joinPath(workspaceFolder.uri, pathValue), vscode.Uri.file(pathValue)];
    let lastError: unknown;
    for (const uri of candidates) {
      try { await vscode.workspace.fs.stat(uri); return uri; } catch (e) { lastError = e; }
    }
    throw lastError;
  }

  private getDiagnosticsForFile(uri: vscode.Uri): Array<{ severity: string; message: string; line: number; column: number; source?: string; code?: string | number }> {
    return vscode.languages.getDiagnostics(uri)
      .filter((d) => d.severity === vscode.DiagnosticSeverity.Error || d.severity === vscode.DiagnosticSeverity.Warning)
      .map((d) => ({
        severity: d.severity === vscode.DiagnosticSeverity.Error ? "Error" : "Warning",
        message: d.message, line: d.range.start.line + 1, column: d.range.start.character + 1,
        source: d.source, code: d.code ? (typeof d.code === "object" ? d.code.value : d.code) : undefined,
      }));
  }

  private getDiagnosticCountForFile(uri: vscode.Uri): { errorCount: number; warningCount: number } {
    const diagnostics = vscode.languages.getDiagnostics(uri);
    return {
      errorCount: diagnostics.filter((d) => d.severity === vscode.DiagnosticSeverity.Error).length,
      warningCount: diagnostics.filter((d) => d.severity === vscode.DiagnosticSeverity.Warning).length,
    };
  }

  // ── List Files ──
  public async handleListFiles(message: any, webviewView: vscode.WebviewView) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) return;
      const pathValue = message.path || message.folder_path || message.filePath;
      const dirPath = pathValue || ".";
      const absolutePath = await this.resolveWorkspacePathWithFallback(workspaceFolder, dirPath)
        .catch(() => this.resolveWorkspacePath(workspaceFolder, dirPath));

      let maxDepth = 1;
      if (message.depth !== undefined && message.depth !== null) {
        if (String(message.depth).toLowerCase() === "max") maxDepth = 999;
        else maxDepth = parseInt(String(message.depth), 10) || 1;
      } else if (message.recursive === "true" || message.recursive === true) maxDepth = 20;
      else if (message.recursive) maxDepth = parseInt(String(message.recursive), 10) || 1;

      const fsAnalyzer = this.contextManager.getFileSystemAnalyzer();
      const ignoreCheck = await fsAnalyzer.isIgnored(absolutePath.fsPath);
      if (ignoreCheck.ignored && !message.bypassIgnore) {
        throw new Error(`Path '${dirPath}' is out of scope (ignored by .gitignore or project settings).`);
      }

      const treeNode = await fsAnalyzer.getFileTreeJson(maxDepth, absolutePath.fsPath, true);
      const convertType = (node: any): any => ({
        ...node,
        type: node.type === "directory" ? "folder" : node.type,
        children: node.children?.map(convertType),
      });
      const tree = (treeNode.children || []).map(convertType);

      webviewView.webview.postMessage({ command: "listFilesResult", requestId: message.requestId, path: pathValue, files: tree });
    } catch (e: any) {
      webviewView.webview.postMessage({ command: "listFilesResult", requestId: message.requestId, path: message.path || message.folder_path, error: e.message });
    }
  }

  // ── Get File Stats ──
  public async handleGetFileStats(message: any, webviewView: vscode.WebviewView) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) return;
      const uri = await this.resolveWorkspacePathWithFallback(workspaceFolder, message.path);
      const stat = await vscode.workspace.fs.stat(uri);
      const content = await vscode.workspace.fs.readFile(uri);
      const lines = Buffer.from(content).toString("utf8").split("\n").length;
      webviewView.webview.postMessage({ command: "fileStatsResult", requestId: message.requestId, id: message.id, path: message.path, lines, stats: { size: stat.size, mtime: stat.mtime, type: stat.type === vscode.FileType.Directory ? "directory" : "file" } });
    } catch (e: any) {
      webviewView.webview.postMessage({ command: "fileStatsResult", requestId: message.requestId, id: message.id, path: message.path, error: e.message });
    }
  }

  // ── Get Diagnostics ──
  public async handleGetDiagnostics(message: any, webviewView: vscode.WebviewView) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) { webviewView.webview.postMessage({ command: "getDiagnosticsResult", requestId: message.requestId, path: message.path, diagnostics: [] }); return; }
      const uri = await this.resolveWorkspacePathWithFallback(workspaceFolder, message.path);
      webviewView.webview.postMessage({ command: "getDiagnosticsResult", requestId: message.requestId, path: message.path, diagnostics: this.getDiagnosticsForFile(uri) });
    } catch (e: any) {
      webviewView.webview.postMessage({ command: "getDiagnosticsResult", requestId: message.requestId, path: message.path, diagnostics: [], error: e.message });
    }
  }

  // ── Workspace Files/Folders/Tree ──
  public async handleGetWorkspaceFiles(message: any, webviewView: vscode.WebviewView) {
    const now = Date.now();
    if (this._workspaceFilesCache && now - this._lastCacheUpdate < this.CACHE_TTL) {
      webviewView.webview.postMessage({ command: "workspaceFilesResponse", requestId: message.requestId, files: this._workspaceFilesCache });
      return;
    }
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;
    const fsAnalyzer = this.contextManager.getFileSystemAnalyzer();
    const recentFiles = this.recentItemsManager ? this.recentItemsManager.getRecentFiles() : [];
    const files = await vscode.workspace.findFiles("**/*");
    const stats = await Promise.all(files.map(async (f) => {
      const relativePath = vscode.workspace.asRelativePath(f);
      try {
        const s = await vscode.workspace.fs.stat(f);
        const lines = await fsAnalyzer.getFileLineCount(f.fsPath);
        return { path: relativePath, lastModified: s.mtime, type: "file", size: s.size, lines, isRecent: recentFiles.includes(relativePath) };
      } catch { return null; }
    }));
    const result = stats.filter((x) => x).sort((a: any, b: any) => b.lastModified - a.lastModified);
    this._workspaceFilesCache = result; this._lastCacheUpdate = now;
    webviewView.webview.postMessage({ command: "workspaceFilesResponse", requestId: message.requestId, files: result });
  }

  public async handleGetWorkspaceFolders(message: any, webviewView: vscode.WebviewView) {
    const now = Date.now();
    if (this._workspaceFoldersCache && now - this._lastCacheUpdate < this.CACHE_TTL) {
      webviewView.webview.postMessage({ command: "workspaceFoldersResponse", requestId: message.requestId, folders: this._workspaceFoldersCache });
      return;
    }
    const fsAnalyzer = this.contextManager.getFileSystemAnalyzer();
    const foldersWithCounts = await fsAnalyzer.getFolderPaths();
    const recentFolders = this.recentItemsManager ? this.recentItemsManager.getRecentFolders() : [];
    const result = foldersWithCounts.map((f) => ({ name: path.basename(f.path), path: f.path, type: "folder", isRecent: recentFolders.includes(f.path), fileCount: f.count }));
    this._workspaceFoldersCache = result;
    webviewView.webview.postMessage({ command: "workspaceFoldersResponse", requestId: message.requestId, folders: result });
  }

  public async handleGetWorkspaceTree(message: any, webviewView: vscode.WebviewView) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;
    const raw = await this.contextManager.getRawFileTree();
    const normalize = (node: any): any => ({ ...node, path: path.relative(workspaceFolder.uri.fsPath, node.path).replace(/\\/g, "/"), children: node.children?.map(normalize) });
    webviewView.webview.postMessage({ command: "workspaceTreeResult", requestId: message.requestId, tree: raw ? normalize(raw) : null });
  }

  // ── Find Files ──
  public async handleFindFiles(message: any, webviewView: vscode.WebviewView) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) throw new Error("No workspace folder found");
      const fileNames: string[] = message.fileNames || message.file_names || [];
      if (!fileNames || fileNames.length === 0) throw new Error("No file names provided");
      const results: { fileName: string; matches: Array<{ path: string; errorCount?: number; warningCount?: number }> }[] = [];
      for (const fileName of fileNames) {
        const globPattern = `**/${fileName}`;
        try {
          const files = await vscode.workspace.findFiles(globPattern, "**/node_modules/**");
          const matches = files.map((fileUri) => {
            const relativePath = vscode.workspace.asRelativePath(fileUri);
            const dc = this.getDiagnosticCountForFile(fileUri);
            return { path: relativePath, errorCount: dc.errorCount, warningCount: dc.warningCount };
          });
          results.push({ fileName, matches });
        } catch (error: any) { results.push({ fileName, matches: [] }); }
      }
      webviewView.webview.postMessage({ command: "findFilesResult", requestId: message.requestId, results, totalMatches: results.reduce((sum, r) => sum + r.matches.length, 0) });
    } catch (e: any) {
      webviewView.webview.postMessage({ command: "findFilesResult", requestId: message.requestId, error: e.message });
    }
  }

  // ── Delete File/Folder ──
  public async handleDeleteFile(message: any, webviewView: vscode.WebviewView) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) throw new Error("No workspace");
      const filePath = message.file_path;
      if (!filePath) throw new Error("'file_path' is required");
      const absPath = path.isAbsolute(filePath) ? filePath : path.join(workspaceFolder.uri.fsPath, filePath);
      await CheckpointManager.getInstance().createCheckpoint(absPath, "delete");
      await fs.promises.unlink(absPath);
      webviewView.webview.postMessage({ command: "deleteFileResult", requestId: message.requestId, success: true });
    } catch (e: any) {
      webviewView.webview.postMessage({ command: "deleteFileResult", requestId: message.requestId, error: e.message });
    }
  }

  public async handleDeleteFolder(message: any, webviewView: vscode.WebviewView) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) throw new Error("No workspace");
      const folderPath = message.folder_path;
      if (!folderPath) throw new Error("'folder_path' is required");
      const absPath = path.isAbsolute(folderPath) ? folderPath : path.join(workspaceFolder.uri.fsPath, folderPath);
      const cpm = CheckpointManager.getInstance();
      const collectFiles = async (dir: string) => {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) await collectFiles(full);
          else await cpm.createCheckpoint(full, "delete");
        }
      };
      await collectFiles(absPath);
      await fs.promises.rm(absPath, { recursive: true, force: true });
      webviewView.webview.postMessage({ command: "deleteFolderResult", requestId: message.requestId, success: true });
    } catch (e: any) {
      webviewView.webview.postMessage({ command: "deleteFolderResult", requestId: message.requestId, error: e.message });
    }
  }

  // ── Move File ──
  public async handleMoveFile(message: any, webviewView: vscode.WebviewView) {
    const logger = LoggerService.getInstance();
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) throw new Error("No workspace");
      const sourcePath = message.file_path || message.source_path;
      const targetFolderPath = message.target_folder_path;
      if (!sourcePath) throw new Error("'file_path' is required");
      if (!targetFolderPath) throw new Error("'target_folder_path' is required");

      const absSource = path.isAbsolute(sourcePath) ? sourcePath : path.join(workspaceFolder.uri.fsPath, sourcePath);
      const absTargetFolder = path.isAbsolute(targetFolderPath) ? targetFolderPath : path.join(workspaceFolder.uri.fsPath, targetFolderPath);

      const sc = SecurityValidator.validatePath(absSource, false);
      if (!sc.safe) throw new Error(sc.reason || "Security validation failed for source");
      const tc = SecurityValidator.validatePath(absTargetFolder, true);
      if (!tc.safe) throw new Error(tc.reason || "Security validation failed for target");

      try { await fs.promises.stat(absSource); } catch { throw new Error(`Source file not found: '${sourcePath}'`); }
      await fs.promises.mkdir(absTargetFolder, { recursive: true });
      const fileName = path.basename(absSource);
      const absDest = path.join(absTargetFolder, fileName);

      const cpm = CheckpointManager.getInstance();
      if (message.conversationId) cpm.setActiveConversationId(message.conversationId);
      await cpm.createCheckpoint(absSource, "delete");

      try { await fs.promises.rename(absSource, absDest); } catch (renameErr: any) {
        if (renameErr.code === "EXDEV") { await fs.promises.copyFile(absSource, absDest); await fs.promises.unlink(absSource); }
        else throw renameErr;
      }
      const newPath = path.relative(workspaceFolder.uri.fsPath, absDest).replace(/\\/g, "/");
      webviewView.webview.postMessage({ command: "moveFileResult", requestId: message.requestId, success: true, newPath });
    } catch (e: any) {
      webviewView.webview.postMessage({ command: "moveFileResult", requestId: message.requestId, error: e.message });
    }
  } 

  // ── Revert File ──
  public async handleRevertFile(message: any, webviewView: vscode.WebviewView) {
    const logger = LoggerService.getInstance();
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) throw new Error("No workspace");
      const filePath = message.file_path || message.path;
      const version = message.version; // Thêm hỗ trợ version parameter
      
      if (!filePath) throw new Error("'file_path' is required");
      const absPath = path.isAbsolute(filePath) ? filePath : path.join(workspaceFolder.uri.fsPath, filePath);
      const pc = SecurityValidator.validatePath(absPath, false);
      if (!pc.safe) throw new Error(pc.reason || "Security validation failed");
      try { await fs.promises.stat(absPath); } catch { throw new Error(`File not found: '${filePath}'`); }
      
      const beforeContent = await fs.promises.readFile(absPath, "utf-8");

      logger.info(`[DEBUG revert_file] Before revert - contentLength: ${beforeContent.length}, lines: ${beforeContent.split('\n').length}`);

      let afterContent: string;

      // Nếu có version, sử dụng replace history thay vì checkpoint
      if (version !== undefined && version !== null && message.conversationId) {
        const historyManager = ReplaceInFileHistoryManager.getInstance();
        historyManager.setActiveConversationId(message.conversationId);

        const history = await historyManager.getHistoryVersion(absPath, parseInt(version, 10));
        if (!history) {
          throw new Error(`No history found for version ${version} of file '${filePath}'`);
        }

        afterContent = history.fullContent;

        // Ghi nội dung từ history vào file
        await fs.promises.writeFile(absPath, afterContent, "utf-8");

        // Xóa các version sau version được chọn
        await historyManager.deleteVersionsAfter(absPath, parseInt(version, 10));
      } else {
        // Sử dụng checkpoint cũ (revert 1 lần)
        const cpm = CheckpointManager.getInstance();
        const checkpoint = await cpm.getLastCheckpointForFile(absPath);

        if (!checkpoint) {
          throw new Error(`No checkpoint found for file '${filePath}'. Cannot revert.`);
        }

        if (checkpoint.content === null) {
          throw new Error(`Checkpoint for '${filePath}' has no content. Cannot revert.`);
        }

        afterContent = checkpoint.content;
        await fs.promises.writeFile(absPath, afterContent, "utf-8");
      }

      const fileUri = vscode.Uri.file(absPath);

      logger.info(`[DEBUG revert_file] After revert - contentLength: ${afterContent.length}, lines: ${afterContent.split('\n').length}`);

      // Check if revert actually changed content
      if (beforeContent === afterContent) {
        logger.warn(`[DEBUG revert_file] WARNING: Content unchanged after revert!`);
      }

      // Đợi language server cập nhật diagnostics (500ms)
      await new Promise(resolve => setTimeout(resolve, 500));

      // Lấy diagnostics sau khi revert
      const diagnostics = this.getDiagnosticsForFile(fileUri);

      logger.info(`[DEBUG revert_file] Diagnostics count: ${diagnostics.length}, errors: ${diagnostics.filter(d => d.severity === 'Error').length}, warnings: ${diagnostics.filter(d => d.severity === 'Warning').length}`);

      if (message.conversationId && message.actionId) {
        await SnapshotManager.getInstance().saveSnapshot(message.conversationId, message.actionId, absPath, "revert", beforeContent, afterContent);
      }
      webviewView.webview.postMessage({ command: "revertFileResult", requestId: message.requestId, success: true, path: filePath, oldContent: beforeContent, newContent: afterContent, diagnostics });
    } catch (e: any) {
      logger.error(`[DEBUG revert_file] Error: ${e.message}`);
      webviewView.webview.postMessage({ command: "revertFileResult", requestId: message.requestId, error: e.message });
    }
  }

  // ── Get Snapshot ──
  public async handleGetSnapshot(message: any, webviewView: vscode.WebviewView): Promise<void> {
    try {
      const { conversationId, actionId, requestId } = message;
      if (!conversationId || !actionId) throw new Error("conversationId and actionId are required");
      const snapshot = await SnapshotManager.getInstance().getSnapshot(conversationId, actionId);
      if (!snapshot) { webviewView.webview.postMessage({ command: "getSnapshotResult", requestId, error: "Snapshot not found" }); return; }
      webviewView.webview.postMessage({ command: "getSnapshotResult", requestId, actionId, filePath: snapshot.filePath, operation: snapshot.operation, beforeContent: snapshot.beforeContent, afterContent: snapshot.afterContent, timestamp: snapshot.timestamp });
    } catch (e: any) {
      webviewView.webview.postMessage({ command: "getSnapshotResult", requestId: message.requestId, error: e.message });
    }
  }

  // ── View Replace History ──
  public async handleViewReplaceHistory(message: any, webviewView: vscode.WebviewView): Promise<void> {
    try {
      const { filePath, conversationId, requestId } = message;
      if (!filePath) throw new Error("filePath is required");
      if (!conversationId) throw new Error("conversationId is required");

      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) throw new Error("No workspace folder");

      const absPath = path.isAbsolute(filePath)
        ? filePath
        : path.join(workspaceFolder.uri.fsPath, filePath);

      const historyManager = ReplaceInFileHistoryManager.getInstance();
      historyManager.setActiveConversationId(conversationId);

      const histories = await historyManager.getHistoryList(absPath);

      webviewView.webview.postMessage({
        command: "viewReplaceHistoryResult",
        requestId,
        filePath,
        histories,
      });
    } catch (e: any) {
      webviewView.webview.postMessage({
        command: "viewReplaceHistoryResult",
        requestId: message.requestId,
        error: e.message,
      });
    }
  }

  // ── Bypass Gitignore ──
  public async handleAskBypassGitignore(message: any, webviewView: vscode.WebviewView) {
    try {
      const { path: pathValue, requestId } = message;
      if (!pathValue) throw new Error("Path is required");
      this.contextManager.getFileSystemAnalyzer().addBypassPath(pathValue);
      webviewView.webview.postMessage({ command: "askBypassGitignoreResult", requestId, path: pathValue, success: true });
    } catch (error: any) {
      webviewView.webview.postMessage({ command: "askBypassGitignoreResult", requestId: message.requestId, error: String(error) });
    }
  }
}