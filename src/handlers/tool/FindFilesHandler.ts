/**
 *? Usage:
 *    Tìm file theo tên (glob pattern) trong workspace, trả về danh sách đường dẫn.
 *
 *? Function:
 *    handleFindFiles(): Tìm file theo tên (glob pattern), trả về danh sách đường dẫn.
 */
import * as vscode from "vscode";

export class FindFilesHandler {
  public async handleFindFiles(message: any, webviewView: vscode.WebviewView) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) throw new Error("No workspace folder found");
      const fileNames: string[] = message.fileNames || message.file_names || [];
      if (!fileNames || fileNames.length === 0)
        throw new Error("No file names provided");
      const results: {
        fileName: string;
        matches: Array<{ path: string }>;
      }[] = [];
      for (const fileName of fileNames) {
        const globPattern = `**/${fileName}`;
        try {
          const files = await vscode.workspace.findFiles(
            globPattern,
            "**/node_modules/**",
          );
          const matches = files.map((fileUri) => ({
            path: vscode.workspace.asRelativePath(fileUri),
          }));
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