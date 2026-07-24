/**
 *? Usage:
 *    Xử lý các thao tác file linh tinh: file stats, diagnostics.
 *
 *? Function:
 *    handleGetFileStats()  : Trả về thông tin file (kích thước, dòng, thời gian sửa).
 *    handleGetDiagnostics(): Trả về diagnostics (lỗi/cảnh báo) cho một file.
 */
import * as vscode from "vscode";
import * as path from "path";

// SERVICES
import { DiagnosticsService } from "../../services/DiagnosticsService";

export class FileMiscHandler {
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

  // ── Get File Stats ──
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
      webviewView.webview.postMessage({
        command: "getDiagnosticsResult",
        requestId: message.requestId,
        path: message.path,
        diagnostics: await DiagnosticsService.getInstance().getDiagnostics(
          uri,
          message.path,
        ),
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
}
