/**
 *? Usage:
 *    Tìm file theo tên (glob pattern) trong workspace hoặc trong folder cụ thể, trả về danh sách đường dẫn.
 *
 *? Function:
 *    handleFindFiles(): Tìm file theo tên (glob pattern), có thể giới hạn trong folder_path nếu được cung cấp.
 */
import * as vscode from "vscode";

export class FindFilesHandler {
  public async handleFindFiles(message: any, webviewView: vscode.WebviewView) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) throw new Error("No workspace folder found");

      const fileName: string = (message.fileName || message.file_name || "").trim();
      let rawFolder: string | undefined = message.folderPath || message.folder_path;

      if (!fileName) throw new Error("No file name provided");

      // Normalize folderPath
      let cleanFolder = (rawFolder || "").trim().replace(/^[.\\/]+/, "").replace(/[\\/]+$/, "");
      if (cleanFolder === "." || cleanFolder === "./") {
        cleanFolder = "";
      }

      const excludePattern = "**/node_modules/**";
      let searchPattern: vscode.GlobPattern;

      if (cleanFolder) {
        const folderUri = vscode.Uri.joinPath(workspaceFolder.uri, cleanFolder);
        const glob = fileName.startsWith("**/") ? fileName : `**/${fileName}`;
        searchPattern = new vscode.RelativePattern(folderUri, glob);
      } else {
        const glob = fileName.startsWith("**/") ? fileName : `**/${fileName}`;
        searchPattern = new vscode.RelativePattern(workspaceFolder, glob);
      }

      try {
        const files = await vscode.workspace.findFiles(
          searchPattern,
          excludePattern,
          100, // Max 100 results
        );

        const matches = files.map((fileUri) => ({
          path: vscode.workspace.asRelativePath(fileUri, false),
        }));

        webviewView.webview.postMessage({
          command: "findFilesResult",
          requestId: message.requestId,
          fileName,
          folderPath: rawFolder || null,
          matches,
          totalMatches: matches.length,
        });
      } catch (error: any) {
        webviewView.webview.postMessage({
          command: "findFilesResult",
          requestId: message.requestId,
          fileName,
          folderPath: rawFolder || null,
          matches: [],
          totalMatches: 0,
          error: error.message,
        });
      }
    } catch (e: any) {
      webviewView.webview.postMessage({
        command: "findFilesResult",
        requestId: message.requestId,
        error: e.message,
      });
    }
  }
}
