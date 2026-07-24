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
        diagnostics: this.getDiagnosticsForFile(uri),
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
