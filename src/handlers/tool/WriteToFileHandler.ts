/**
 *? Usage:
 *    Ghi file mới hoặc ghi đè trong workspace: write_to_file. Có queue, lock, checkpoint, snapshot.
 *
 *? Function:
 *    handleWriteToFile(): Ghi nội dung mới vào file (tạo hoặc ghi đè).
 */
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

// AGENT
import { SecurityValidator } from "../../agent/validators/SecurityValidator";

// MANAGERS
import { CheckpointManager } from "../../managers/CheckpointManager";
import { FileLockManager } from "../../managers/FileLockManager";
import { SnapshotManager } from "../../managers/SnapshotManager";

// SERVICES
import { LoggerService } from "../../services/LoggerService";
import { PathService } from "../../services/PathService";

export class WriteToFileHandler {
  private _writeFileQueue: Promise<void> = Promise.resolve();
  private pathService: PathService;

  constructor(private fileLockManager: FileLockManager) {
    this.pathService = PathService.getInstance();
  }

  private getProjectContextDir(workspaceFolderPath: string): string {
    return this.pathService.getProjectContextDir(workspaceFolderPath);
  }

  private resolveWorkspacePath(
    workspaceFolder: vscode.WorkspaceFolder,
    pathValue: string,
  ): vscode.Uri {
    if (path.isAbsolute(pathValue)) return vscode.Uri.file(pathValue);
    return vscode.Uri.joinPath(workspaceFolder.uri, pathValue);
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
        severity:
          d.severity === vscode.DiagnosticSeverity.Error ? "Error" : "Warning",
        message: d.message,
        line: d.range.start.line + 1,
        column: d.range.start.character + 1,
        source: d.source,
        code: d.code
          ? typeof d.code === "object"
            ? d.code.value
            : d.code
          : undefined,
      }));
  }

  private isNonCodeFile(pathValue: string): boolean {
    const exts = [
      ".md",
      ".txt",
      ".log",
      ".csv",
      ".xml",
      ".html",
      ".css",
      ".json",
      ".yaml",
      ".yml",
      ".toml",
      ".ini",
      ".cfg",
      ".conf",
      ".env",
      ".gitignore",
      ".dockerignore",
      ".editorconfig",
      ".properties",
      ".lock",
      ".sum",
      ".mod",
    ];
    return exts.some((ext) => pathValue.toLowerCase().endsWith(ext));
  }

  private async waitForDiagnosticsWithFallback(
    uri: vscode.Uri,
    pathValue: string,
    maxTimeoutMs: number = 50000,
  ): Promise<void> {
    const debugStart = Date.now();
    return new Promise<void>((resolve) => {
      const fallbackTimeout = 2000;
      const stableWaitTime = 800;
      let stableTimeout: NodeJS.Timeout | null = null;
      let hasEvent = false;
      let resolved = false;

      const finish = (reason: string) => {
        if (resolved) return;
        resolved = true;
        const elapsed = Date.now() - debugStart;
        resolve();
      };

      const fallback = setTimeout(() => {
        if (!hasEvent) {
          clearTimeout(timeout);
          if (stableTimeout) clearTimeout(stableTimeout);
          disposable?.dispose();
          finish("fallback_no_event");
        }
      }, fallbackTimeout);

      const timeout = setTimeout(() => {
        clearTimeout(fallback);
        if (stableTimeout) clearTimeout(stableTimeout);
        disposable?.dispose();
        finish("timeout");
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
            finish("stable");
          }, stableWaitTime);
        }
      });
    });
  }

  // ── Write File ──
  public async handleWriteToFile(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    const logger = LoggerService.getInstance();
    try {
      await this.enqueueWriteOperation(async () => {
        await this._writeFileInternal(message, webviewView);
      });
    } catch (e: any) {
      logger.error("[handleWriteToFile] Failed", { error: e.message });
    }
  }

  private async _writeFileInternal(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    const logger = LoggerService.getInstance();
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) throw new Error("No workspace");
      const pathValue = message.path || message.filePath || message.file_path;
      if (!pathValue) throw new Error("'path' must be of type string.");

      let absolutePath: vscode.Uri;
      absolutePath = this.resolveWorkspacePath(workspaceFolder, pathValue);

      const sec = SecurityValidator.validatePath(absolutePath.fsPath, true);
      if (!sec.safe)
        throw new Error(sec.reason || "Security validation failed");

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
            await vscode.window.showTextDocument(doc, {
              preview: false,
              preserveFocus: true,
            });
          } catch {}
          await this.waitForDiagnosticsWithFallback(
            absolutePath,
            pathValue,
            50000,
          );
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
}