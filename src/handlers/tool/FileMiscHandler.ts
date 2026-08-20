/**
 *? Usage:
 *    Xử lý các thao tác file linh tinh: file stats, diagnostics, file content.
 *
 *? Function:
 *    handleGetFileStats()   : Trả về thông tin file (kích thước, dòng, thời gian sửa).
 *    handleGetDiagnostics() : Trả về diagnostics (lỗi/cảnh báo) cho một file.
 *    handleGetFileContent() : Trả về nội dung đầy đủ của một file.
 */
import * as vscode from "vscode";
import * as path from "path";

// SERVICES
import { DiagnosticsService } from "../../services/DiagnosticsService";

// SECURITY
import { SecurityValidator } from "../../utils/security";

export class FileMiscHandler {
  private async resolveWorkspacePathWithFallback(
    workspaceFolder: vscode.WorkspaceFolder,
    pathValue: string,
  ): Promise<vscode.Uri> {
    // FIX P1 Security: validate path trước khi resolve (chống đọc file nhạy cảm)
    this.ensureSafePath(workspaceFolder, pathValue);

    // FIX Bổ sung: với absolute path, chỉ dùng Uri.file(pathValue) thay vì join workspace
    const candidates = path.isAbsolute(pathValue)
      ? [vscode.Uri.file(pathValue)]
      : [vscode.Uri.joinPath(workspaceFolder.uri, pathValue)];
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

  /**
   * FIX P1 Security: Validate path before any file operation to prevent reading
   * sensitive files (.env, credentials, .ssh/id_rsa, ...) via absolute paths.
   */
  private ensureSafePath(
    workspaceFolder: vscode.WorkspaceFolder,
    pathValue: string,
  ): void {
    if (!pathValue) {
      throw new Error("'path' is required");
    }
    const absPath = path.isAbsolute(pathValue)
      ? pathValue
      : path.join(workspaceFolder.uri.fsPath, pathValue);
    const pc = SecurityValidator.validatePath(absPath, false);
    if (!pc.safe) {
      throw new Error(pc.reason || "Security validation failed");
    }
  }

  // ── Get File Stats ──
  public async handleGetFileStats(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        return;
      }
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
        lines,
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

  // ── Get Diagnostics ──
  public async handleGetDiagnostics(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        webviewView.webview.postMessage({
          command: "getDiagnosticsResult",
          requestId: message.requestId,
          path: message.path,
          diagnostics: [],
        });
        return;
      }
      const uri = await this.resolveWorkspacePathWithFallback(
        workspaceFolder,
        message.path,
      );
      const diagResult = await DiagnosticsService.getInstance().getDiagnostics(
        uri,
        message.path,
      );
      webviewView.webview.postMessage({
        command: "getDiagnosticsResult",
        requestId: message.requestId,
        path: message.path,
        diagnostics: diagResult.diagnostics,
        skippedReason: diagResult.skippedReason || null,
      });
    } catch (e: any) {
      webviewView.webview.postMessage({
        command: "getDiagnosticsResult",
        requestId: message.requestId,
        path: message.path,
        diagnostics: [],
        error: e.message,
      });
    }
  }

  // ── Get File Content ──
  public async handleGetFileContent(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        webviewView.webview.postMessage({
          command: "getFileContentResult",
          requestId: message.requestId,
          path: message.path,
          content: null,
          error: "No workspace folder found",
        });
        return;
      }
      const uri = await this.resolveWorkspacePathWithFallback(
        workspaceFolder,
        message.path,
      );

      const content = Buffer.from(
        await vscode.workspace.fs.readFile(uri),
      ).toString("utf8");

      webviewView.webview.postMessage({
        command: "getFileContentResult",
        requestId: message.requestId,
        path: message.path,
        content,
      });
    } catch (e: any) {
      console.error("[FileMiscHandler] Error reading file:", e.message);
      webviewView.webview.postMessage({
        command: "getFileContentResult",
        requestId: message.requestId,
        path: message.path,
        content: null,
        error: e.message,
      });
    }
  }
}
