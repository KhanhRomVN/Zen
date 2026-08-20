/**
 *? Usage:
 *    Liệt kê cây thư mục với depth tùy chỉnh, bỏ qua thư mục ẩn và node_modules.
 *
 *? Function:
 *    handleListFiles(): Liệt kê cây thư mục với depth tùy chỉnh, bỏ qua thư mục ẩn và node_modules.
 */
import * as vscode from "vscode";
import * as path from "path";

// SECURITY
import { SecurityValidator } from "../../utils/security";

export class ListFilesHandler {
  private async resolveWorkspacePathWithFallback(
    workspaceFolder: vscode.WorkspaceFolder,
    pathValue: string,
  ): Promise<vscode.Uri> {
    // FIX P1 Security: validate path trước khi resolve
    this.ensureSafePath(workspaceFolder, pathValue);

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
   * FIX P1 Security: Validate path before listing to prevent listing sensitive
   * system directories via absolute paths.
   */
  private ensureSafePath(
    workspaceFolder: vscode.WorkspaceFolder,
    pathValue: string,
  ): void {
    const dirPath = pathValue || ".";
    const absPath = path.isAbsolute(dirPath)
      ? dirPath
      : path.join(workspaceFolder.uri.fsPath, dirPath);
    const pc = SecurityValidator.validatePath(absPath, false);
    if (!pc.safe) {
      throw new Error(pc.reason || "Security validation failed");
    }
  }

  public async handleListFiles(message: any, webviewView: vscode.WebviewView) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        webviewView.webview.postMessage({
          command: "listFilesResult",
          requestId: message.requestId,
          path: message.path || message.folder_path,
          error: "No workspace folder found",
        });
        return;
      }

      const pathValue = message.path || message.folder_path || message.filePath;
      const dirPath = pathValue || ".";
      const absolutePath = await this.resolveWorkspacePathWithFallback(
        workspaceFolder,
        dirPath,
      ).catch(() => {
        // FIX Bổ sung: fallback vẫn phải validate security, không cho absolute bypass
        this.ensureSafePath(workspaceFolder, dirPath);
        if (path.isAbsolute(dirPath)) {
          return vscode.Uri.file(dirPath);
        }
        return vscode.Uri.joinPath(workspaceFolder.uri, dirPath);
      });

      let maxDepth = 1;
      if (message.depth !== undefined && message.depth !== null) {
        if (String(message.depth).toLowerCase() === "max") {
          maxDepth = 999;
        } else {
          maxDepth = parseInt(String(message.depth), 10) || 1;
        }
      } else if (message.recursive === "true" || message.recursive === true) {
        maxDepth = 20;
      } else if (message.recursive) {
        maxDepth = parseInt(String(message.recursive), 10) || 1;
      }

      const buildTree = async (
        dirUri: vscode.Uri,
        currentDepth: number,
      ): Promise<any[]> => {
        if (currentDepth > maxDepth) {
          return [];
        }

        let entries: [string, vscode.FileType][];
        try {
          entries = await vscode.workspace.fs.readDirectory(dirUri);
        } catch {
          return [];
        }

        entries.sort((a, b) => {
          const aIsDir = a[1] === vscode.FileType.Directory ? 0 : 1;
          const bIsDir = b[1] === vscode.FileType.Directory ? 0 : 1;
          if (aIsDir !== bIsDir) {
            return aIsDir - bIsDir;
          }
          return a[0].localeCompare(b[0]);
        });

        const results: any[] = [];
        for (const [name, fileType] of entries) {
          if (name === "node_modules" || name.startsWith(".")) {
            continue;
          }

          const entryUri = vscode.Uri.joinPath(dirUri, name);
          if (fileType === vscode.FileType.Directory) {
            const children = await buildTree(entryUri, currentDepth + 1);
            results.push({
              name,
              type: "folder",
              children,
            });
          } else {
            let size: number | undefined;
            try {
              const stat = await vscode.workspace.fs.stat(entryUri);
              size = stat.size;
            } catch {
              size = undefined;
            }
            results.push({
              name,
              type: "file",
              size,
            });
          }
        }
        return results;
      };

      const tree = await buildTree(absolutePath, 1);

      webviewView.webview.postMessage({
        command: "listFilesResult",
        requestId: message.requestId,
        path: pathValue,
        files: tree,
      });
    } catch (e: any) {
      webviewView.webview.postMessage({
        command: "listFilesResult",
        requestId: message.requestId,
        path: message.path || message.folder_path,
        error: e.message,
      });
    }
  }
}
