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
      
      const fileName: string = message.fileName || message.file_name || "";
      const folderPath: string | undefined = message.folderPath || message.folder_path;
      
      if (!fileName) throw new Error("No file name provided");

      // Build glob pattern based on whether folder_path is provided
      let globPattern: string;
      let excludePattern = "**/node_modules/**";
      
      if (folderPath) {
        // Search only within the specified folder
        globPattern = `${folderPath}/**/${fileName}`;
      } else {
        // Search entire workspace
        globPattern = `**/${fileName}`;
      }

      try {
        const files = await vscode.workspace.findFiles(
          globPattern,
          excludePattern,
        );
        
        const matches = files.map((fileUri) => ({
          path: vscode.workspace.asRelativePath(fileUri),
        }));

        webviewView.webview.postMessage({
          command: "findFilesResult",
          requestId: message.requestId,
          fileName,
          folderPath: folderPath || null,
          matches,
          totalMatches: matches.length,
        });
      } catch (error: any) {
        webviewView.webview.postMessage({
          command: "findFilesResult",
          requestId: message.requestId,
          fileName,
          folderPath: folderPath || null,
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