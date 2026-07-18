import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as crypto from "crypto";
import * as os from "os";
import { FileLockManager } from "../../../managers/FileLockManager";
import { CheckpointManager } from "../../../managers/CheckpointManager";
import { SnapshotManager } from "../../../managers/SnapshotManager";
import { ReplaceInFileHistoryManager } from "../../../managers/ReplaceInFileHistoryManager";
import { SecurityValidator } from "../../../agent/validators/SecurityValidator";
import { FuzzyMatcher } from "../../../utils/FuzzyMatcher";
import { LoggerService } from "../../../services/LoggerService";

export class FileWriteHandler {
  private _writeFileQueue: Promise<void> = Promise.resolve();
  private _replaceFileQueue: Promise<void> = Promise.resolve();

  constructor(private fileLockManager: FileLockManager) {}

  private getContextRoot(): string {
    return path.join(os.homedir(), "khanhromvn-zen");
  }

  private getProjectContextDir(workspaceFolderPath: string): string {
    const hash = crypto.createHash("md5").update(workspaceFolderPath).digest("hex");
    return path.join(this.getContextRoot(), "projects", hash);
  }

  private resolveWorkspacePath(workspaceFolder: vscode.WorkspaceFolder, pathValue: string): vscode.Uri {
    if (path.isAbsolute(pathValue)) return vscode.Uri.file(pathValue);
    return vscode.Uri.joinPath(workspaceFolder.uri, pathValue);
  }

  private async resolveWorkspacePathWithFallback(
    workspaceFolder: vscode.WorkspaceFolder,
    pathValue: string,
  ): Promise<vscode.Uri> {
    const candidates = path.isAbsolute(pathValue)
      ? [vscode.Uri.file(pathValue), vscode.Uri.joinPath(workspaceFolder.uri, pathValue)]
      : [vscode.Uri.joinPath(workspaceFolder.uri, pathValue), vscode.Uri.file(pathValue)];
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

  private enqueueWriteOperation<T>(operation: () => Promise<T>): Promise<T> {
    const logger = LoggerService.getInstance();
    this._writeFileQueue = this._writeFileQueue
      .then(() => operation())
      .catch((err) => {
        logger.error("[enqueueWriteOperation] Error", { error: err.message });
        throw err;
      }) as Promise<void>;
    return this._writeFileQueue as Promise<T>;
  }

  private enqueueReplaceOperation<T>(operation: () => Promise<T>): Promise<T> {
    const logger = LoggerService.getInstance();
    this._replaceFileQueue = this._replaceFileQueue
      .then(() => operation())
      .catch((err) => {
        logger.error("[enqueueReplaceOperation] Error", { error: err.message });
        throw err;
      }) as Promise<void>;
    return this._replaceFileQueue as Promise<T>;
  }

  private getDiagnosticsForFile(uri: vscode.Uri): Array<{
    severity: string;
    message: string;
    line: number;
    column: number;
    source?: string;
    code?: string | number;
  }> {
    return vscode.languages
      .getDiagnostics(uri)
      .filter(
        (d) =>
          d.severity === vscode.DiagnosticSeverity.Error ||
          d.severity === vscode.DiagnosticSeverity.Warning,
      )
      .map((d) => ({
        severity: d.severity === vscode.DiagnosticSeverity.Error ? "Error" : "Warning",
        message: d.message,
        line: d.range.start.line + 1,
        column: d.range.start.character + 1,
        source: d.source,
        code: d.code ? (typeof d.code === "object" ? d.code.value : d.code) : undefined,
      }));
  }

  private isNonCodeFile(pathValue: string): boolean {
    const exts = [
      ".md", ".txt", ".log", ".csv", ".xml", ".html", ".css",
      ".json", ".yaml", ".yml", ".toml", ".ini", ".cfg", ".conf",
      ".env", ".gitignore", ".dockerignore", ".editorconfig",
      ".properties", ".lock", ".sum", ".mod",
    ];
    return exts.some((ext) => pathValue.toLowerCase().endsWith(ext));
  }

  private async ensureFileOpened(uri: vscode.Uri): Promise<void> {
    try {
      if (vscode.workspace.textDocuments.some((doc) => doc.uri.fsPath === uri.fsPath)) return;
      const doc = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(doc, { preview: true, viewColumn: vscode.ViewColumn.Active });
    } catch (e) {}
  }

  private async waitForDiagnosticsWithFallback(
    uri: vscode.Uri,
    pathValue: string,
    maxTimeoutMs: number = 50000, // 50 giây - đủ buffer trong 1 phút timeout của frontend
  ): Promise<void> {
    return new Promise<void>((resolve) => {
      const fallbackTimeout = 2000;
      const stableWaitTime = 800;
      const startTime = Date.now();
      let stableTimeout: NodeJS.Timeout | null = null;
      let hasEvent = false;

      const fallback = setTimeout(() => {
        if (!hasEvent) {
          clearTimeout(timeout);
          if (stableTimeout) clearTimeout(stableTimeout);
          disposable?.dispose();
          resolve();
        }
      }, fallbackTimeout);

      const timeout = setTimeout(() => {
        clearTimeout(fallback);
        if (stableTimeout) clearTimeout(stableTimeout);
        disposable?.dispose();
        resolve();
      }, maxTimeoutMs);

      const disposable = vscode.languages.onDidChangeDiagnostics((e) => {
        if (e.uris.some((u) => u.fsPath === uri.fsPath)) {
          if (!hasEvent) {
            hasEvent = true;
            clearTimeout(fallback);
          }
          if (stableTimeout) clearTimeout(stableTimeout);
          stableTimeout = setTimeout(() => {
            clearTimeout(timeout);
            clearTimeout(fallback);
            disposable.dispose();
            resolve();
          }, stableWaitTime);
        }
      });
    });
  }

  // ── Write File ──
  public async handleWriteFile(message: any, webviewView: vscode.WebviewView) {
    const logger = LoggerService.getInstance();
    try {
      await this.enqueueWriteOperation(async () => {
        await this._writeFileInternal(message, webviewView);
      });
    } catch (e: any) {
      logger.error("[handleWriteFile] Failed", { error: e.message });
    }
  }

  private async _writeFileInternal(message: any, webviewView: vscode.WebviewView) {
    const logger = LoggerService.getInstance();
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) throw new Error("No workspace");
      const pathValue = message.path || message.filePath || message.file_path;
      if (!pathValue) throw new Error("'path' must be of type string.");

      let absolutePath: vscode.Uri;
      if (pathValue.endsWith("workspace.md")) {
        const pcDir = this.getProjectContextDir(workspaceFolder.uri.fsPath);
        await fs.promises.mkdir(pcDir, { recursive: true });
        absolutePath = vscode.Uri.file(path.join(pcDir, path.basename(pathValue)));
      } else {
        absolutePath = this.resolveWorkspacePath(workspaceFolder, pathValue);
      }

      const sec = SecurityValidator.validatePath(absolutePath.fsPath, true);
      if (!sec.safe) throw new Error(sec.reason || "Security validation failed");

      const release = await this.fileLockManager.acquire(absolutePath.fsPath);
      try {
        if (message.conversationId) {
          CheckpointManager.getInstance().setActiveConversationId(message.conversationId);
        }
        const fileExists = fs.existsSync(absolutePath.fsPath);
        let beforeContent: string | null = null;
        if (fileExists) {
          try {
            beforeContent = await fs.promises.readFile(absolutePath.fsPath, "utf-8");
          } catch {
            beforeContent = null;
          }
        }
        await CheckpointManager.getInstance().createCheckpoint(
          absolutePath.fsPath,
          fileExists ? "modify" : "create",
        );
        await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(absolutePath, ".."));
        await vscode.workspace.fs.writeFile(absolutePath, Buffer.from(message.content, "utf8"));

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
        if (!this.isNonCodeFile(pathValue)) {
          try {
            const doc = await vscode.workspace.openTextDocument(absolutePath);
            await vscode.window.showTextDocument(doc, { preview: false, preserveFocus: true });
          } catch {}
          await this.waitForDiagnosticsWithFallback(absolutePath, pathValue, 50000); // 50 giây
        }
        webviewView.webview.postMessage({
          command: "writeFileResult",
          requestId: message.requestId,
          path: pathValue,
          success: true,
          diagnostics: this.getDiagnosticsForFile(absolutePath),
        });
      } else {
        webviewView.webview.postMessage({
          command: "writeFileResult",
          requestId: message.requestId,
          path: pathValue,
          success: true,
          diagnostics: [],
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

  // ── Replace In File ──
  public async handleReplaceInFile(message: any, webviewView: vscode.WebviewView) {
    const logger = LoggerService.getInstance();
    try {
      await this.enqueueReplaceOperation(async () => {
        await this._replaceInFileInternal(message, webviewView);
      });
    } catch (e: any) {
      logger.error("[handleReplaceInFile] Failed", { error: e.message });
    }
  }

  private async _replaceInFileInternal(message: any, webviewView: vscode.WebviewView) {
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

    let absPath: vscode.Uri;
    if (pathValue.endsWith("workspace.md")) {
      const pcDir = this.getProjectContextDir(workspaceFolder.uri.fsPath);
      await fs.promises.mkdir(pcDir, { recursive: true });
      absPath = vscode.Uri.file(path.join(pcDir, path.basename(pathValue)));
    } else {
      try {
        absPath = await this.resolveWorkspacePathWithFallback(workspaceFolder, pathValue);
      } catch {
        absPath = this.resolveWorkspacePath(workspaceFolder, pathValue);
      }
    }

    const sec = SecurityValidator.validatePath(absPath.fsPath, true);
    if (!sec.safe) {
      webviewView.webview.postMessage({
        command: "replaceInFileResult",
        requestId: message.requestId,
        error: sec.reason || "Security validation failed",
      });
      return;
    }

    // Kiểm tra file tồn tại trước khi replace
    try { await vscode.workspace.fs.stat(absPath); } catch {
      webviewView.webview.postMessage({
        command: "replaceInFileResult",
        requestId: message.requestId,
        error: `File not found: '${pathValue}'`,
      });
      return;
    }

    if (message.conversationId) {
      CheckpointManager.getInstance().setActiveConversationId(message.conversationId);
    }
    await CheckpointManager.getInstance().createCheckpoint(absPath.fsPath, "modify");

    const release = await this.fileLockManager.acquire(absPath.fsPath);
    let newContent: string | undefined;
    try {
      let content = "";
      try {
        content = Buffer.from(await vscode.workspace.fs.readFile(absPath)).toString("utf8");
      } catch (e: any) {
        if (!pathValue.endsWith("workspace.md")) throw e;
      }

      let searchArgs: string;
      let replaceArgs: string;
      if (message.old_str !== undefined && message.new_str !== undefined) {
        const clean = (t: string) => t.replace(/^```[a-zA-Z]*$/gm, "").trim();
        searchArgs = clean(message.old_str);
        replaceArgs = clean(message.new_str);
      } else if (message.diff !== undefined && message.diff !== null) {
        const match = message.diff.match(
          /<<<<<<< SEARCH\s*\n([\s\S]*?)\s*=======\s*\n([\s\S]*?)(?:>>>>>>>|>)\s*REPLACE/,
        );
        if (!match) throw new Error("Invalid diff format");
        const clean = (t: string) => t.replace(/^```[a-zA-Z]*$/gm, "").trim();
        searchArgs = clean(match[1]);
        replaceArgs = clean(match[2]);
      } else {
        throw new Error("Missing old_str/new_str or diff parameter");
      }

      let target = searchArgs;
      if (content.indexOf(searchArgs) === -1) {
        const fuzzy = FuzzyMatcher.findMatch(content, searchArgs);
        if (!fuzzy || fuzzy.score <= 1e-9) throw new Error("Search text not found");
        target = fuzzy.originalText;
      }
      newContent = content.replace(target, replaceArgs);
      if (newContent === content) throw new Error("No change made");
      await vscode.workspace.fs.writeFile(absPath, Buffer.from(newContent, "utf8"));

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
      webviewView.webview.postMessage({
        command: "replaceInFileResult",
        requestId: message.requestId,
        error: e.message,
      });
      release();
      return;
    }
    release();

    // Lấy diagnostics trước khi gửi response
    let diagnostics: Array<{
      severity: string;
      message: string;
      line: number;
      column: number;
      source?: string;
      code?: string | number;
    }> = [];

    if (!message.skipDiagnostics) {
      if (!this.isNonCodeFile(pathValue)) {
        try { await vscode.workspace.openTextDocument(absPath); } catch {}
        await this.waitForDiagnosticsWithFallback(absPath, pathValue, 50000); // 50 giây
      }
      diagnostics = this.getDiagnosticsForFile(absPath);
    }

    // Lưu lịch sử replace_in_file thành công
    if (message.conversationId && newContent !== undefined) {
      const errorCount = diagnostics.filter((d) => d.severity === "Error").length;
      const warningCount = diagnostics.filter((d) => d.severity === "Warning").length;
      
      const historyManager = ReplaceInFileHistoryManager.getInstance();
      historyManager.setActiveConversationId(message.conversationId);
      await historyManager.saveHistory(
        absPath.fsPath,
        newContent,
        errorCount,
        warningCount,
      );
    }

    // Gửi response
    webviewView.webview.postMessage({
      command: "replaceInFileResult",
      requestId: message.requestId,
      path: message.path,
      success: true,
      diagnostics: diagnostics,
      content: newContent,
    });
  }
}