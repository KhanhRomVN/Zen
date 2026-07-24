/**
 *? Usage:
 *    Tìm file theo tên (glob pattern) trong workspace, trả về danh sách kèm error/warning count.
 *
 *? Function:
 *    handleFindFiles(): Tìm file theo tên (glob pattern), trả về danh sách kèm error/warning count.
 */
import * as vscode from "vscode";

export class FindFilesHandler {
  private getDiagnosticCountForFile(uri: vscode.Uri): {
    errorCount: number;
    warningCount: number;
  } {
    const diagnostics = vscode.languages.getDiagnostics(uri);
    return {
      errorCount: diagnostics.filter(
        (d) => d.severity === vscode.DiagnosticSeverity.Error,
      ).length,
      warningCount: diagnostics.filter(
        (d) => d.severity === vscode.DiagnosticSeverity.Warning,
      ).length,
    };
  }

  public async handleFindFiles(message: any, webviewView: vscode.WebviewView) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) throw new Error("No workspace folder found");
      const fileNames: string[] = message.fileNames || message.file_names || [];
      if (!fileNames || fileNames.length === 0)
        throw new Error("No file names provided");
      const results: {
        fileName: string;
        matches: Array<{
          path: string;
          errorCount?: number;
          warningCount?: number;
        }>;
      }[] = [];
      for (const fileName of fileNames) {
        const globPattern = `**/${fileName}`;
        try {
          const files = await vscode.workspace.findFiles(
            globPattern,
            "**/node_modules/**",
          );
          const matches = files.map((fileUri) => {
            const relativePath = vscode.workspace.asRelativePath(fileUri);
            const dc = this.getDiagnosticCountForFile(fileUri);
            return {
              path: relativePath,
              errorCount: dc.errorCount,
              warningCount: dc.warningCount,
            };
          });
          results.push({ fileName, matches });
        } catch (error: any) {
          results.push({ fileName, matches: [] });
        }
      }
      webviewView.webview.postMessage({
        command: "findFilesResult",
        requestId: message.requestId,
        results,
        totalMatches: results.reduce((sum, r) => sum + r.matches.length, 0),
      });
    } catch (e: any) {
      webviewView.webview.postMessage({
        command: "findFilesResult",
        requestId: message.requestId,
        error: e.message,
      });
    }
  }
}