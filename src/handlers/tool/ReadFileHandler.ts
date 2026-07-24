/**
 *? Usage:
 *    Đọc nội dung file trong workspace, hỗ trợ đọc theo dòng (start_line/end_line), tích hợp security check, diagnostics, và hàng đợi tuần tự.
 *
 *? Function:
 *    handleReadFile(): Đọc file với queue, chờ diagnostics từ language server, trả về nội dung + lỗi/cảnh báo.
 */
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

// AGENT

// SERVICES
import { DiagnosticsService } from "../../services/DiagnosticsService";
import { LoggerService } from "../../services/LoggerService";
import { PathService } from "../../services/PathService";
import { SecurityValidator } from "../../utils/security";

export class ReadFileHandler {
  private _readFileQueue: Promise<void> = Promise.resolve();
  private pathService: PathService;

  constructor() {
    this.pathService = PathService.getInstance();
  }

  private getProjectContextDir(workspaceFolderPath: string): string {
    return this.pathService.getProjectContextDir(workspaceFolderPath);
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

  private enqueueReadOperation<T>(operation: () => Promise<T>): Promise<T> {
    const logger = LoggerService.getInstance();
    this._readFileQueue = this._readFileQueue
      .then(() => operation())
      .catch((err) => {
        logger.error("[enqueueReadOperation] Error", { error: err.message });
        throw err;
      }) as Promise<void>;
    return this._readFileQueue as Promise<T>;
  }

  public async handleReadFile(message: any, webviewView: vscode.WebviewView) {
    const logger = LoggerService.getInstance();
    try {
      await this.enqueueReadOperation(async () => {
        await this._handleReadFileInternal(message, webviewView);
      });
    } catch (e: any) {
      logger.error("[handleReadFile] Failed", { error: e.message });
    }
  }

  private async _handleReadFileInternal(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) throw new Error("No workspace");
      const pathValue = message.path || message.filePath || message.file_path;
      if (!pathValue)
        throw new Error("The 'path' argument must be of type string.");

      let absPath: vscode.Uri;
      absPath = await this.resolveWorkspacePathWithFallback(
        workspaceFolder,
        pathValue,
      );

      const securityCheck = SecurityValidator.validatePath(
        absPath.fsPath,
        false,
      );
      if (!securityCheck.safe)
        throw new Error(securityCheck.reason || "Security validation failed");

      if (!fs.existsSync(absPath.fsPath)) {
        throw new Error(`File not found: ${pathValue}`);
      }

      const logger = LoggerService.getInstance();
      const diagnosticsService = DiagnosticsService.getInstance();

      let diagnostics: Array<{
        severity: string;
        message: string;
        line: number;
        column: number;
        source?: string;
        code?: string | number;
      }> = [];

      if (!message.skipDiagnostics) {
        diagnostics = await diagnosticsService.getDiagnostics(
          absPath,
          pathValue,
          50000,
        );
      }

      let content = "";
      try {
        content = Buffer.from(
          await vscode.workspace.fs.readFile(absPath),
        ).toString("utf8");
      } catch (e: any) {
        throw e;
      }

      const startLine = message.start_line ?? message.startLine;
      const endLine = message.end_line ?? message.endLine;
      if (startLine !== undefined) {
        const lines = content.split(/\r?\n/);
        const end = endLine !== undefined ? endLine + 1 : lines.length;
        content = lines.slice(startLine || 0, end).join("\n");
      }

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
}
