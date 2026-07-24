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
import { SecurityValidator } from "../../utils/security";

// MANAGERS
import { CheckpointManager } from "../../managers/CheckpointManager";
import { FileLockManager } from "../../managers/FileLockManager";

// SERVICES
import { DiagnosticsService } from "../../services/DiagnosticsService";
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
      } finally {
        release();
      }

      if (!message.skipDiagnostics) {
        const diagnosticsService = DiagnosticsService.getInstance();
        const fileDiagnostics = await diagnosticsService.getDiagnostics(
          absolutePath,
          pathValue,
          50000,
        );
        webviewView.webview.postMessage({
          command: "writeFileResult",
          requestId: message.requestId,
          path: pathValue,
          success: true,
          diagnostics: fileDiagnostics,
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
