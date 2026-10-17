/**
 * ------------------------------------------------------------------
 * Workspace Items Handler
 * ------------------------------------------------------------------
 * Quét danh sách file/folder của workspace (chỉ lấy đường dẫn, không đọc
 * nội dung), bỏ qua các mục bị .gitignore, rồi gửi về webview.
 *
 * Main functions:
 * - handleGetWorkspaceItems() : Trả workspaceFilesResponse và
 *                               workspaceFoldersResponse cho webview
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Node ──
import { execFile } from "child_process";
import * as path from "path";

// ── VSCode ──
import * as vscode from "vscode";

// ─── Constants ──────────────────────────────────────────────────────────
const MAX_FILES = 20000;
const GIT_MAX_BUFFER = 64 * 1024 * 1024;
const FALLBACK_EXCLUDE = "**/{node_modules,.git}/**";

// ─── Class ──────────────────────────────────────────────────────────────
export class WorkspaceItemsHandler {
  public async handleGetWorkspaceItems(webviewView: vscode.WebviewView) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) throw new Error("No workspace folder found");

      const filePaths = await this.listFilePaths(workspaceFolder);

      const folderSet = new Set<string>();
      for (const filePath of filePaths) {
        let dir = path.posix.dirname(filePath);
        while (dir && dir !== "." && !folderSet.has(dir)) {
          folderSet.add(dir);
          dir = path.posix.dirname(dir);
        }
      }

      const files = filePaths.map((p) => ({ path: p, type: "file" as const }));
      const folders = Array.from(folderSet)
        .sort()
        .map((p) => ({ path: p, type: "folder" as const }));

      webviewView.webview.postMessage({
        command: "workspaceFilesResponse",
        files,
      });
      webviewView.webview.postMessage({
        command: "workspaceFoldersResponse",
        folders,
      });
    } catch (e: any) {
      webviewView.webview.postMessage({
        command: "workspaceFilesResponse",
        error: e.message,
      });
      webviewView.webview.postMessage({
        command: "workspaceFoldersResponse",
        error: e.message,
      });
    }
  }

  private async listFilePaths(
    workspaceFolder: vscode.WorkspaceFolder,
  ): Promise<string[]> {
    try {
      const stdout = await new Promise<string>((resolve, reject) => {
        execFile(
          "git",
          ["ls-files", "-z", "--cached", "--others", "--exclude-standard"],
          { cwd: workspaceFolder.uri.fsPath, maxBuffer: GIT_MAX_BUFFER },
          (error, out) => (error ? reject(error) : resolve(out)),
        );
      });
      return stdout
        .split("\0")
        .filter(Boolean)
        .map((p) => p.replace(/\\/g, "/"))
        .slice(0, MAX_FILES);
    } catch {
      // Không phải git repo / không có git → quét bằng VSCode, chỉ loại node_modules và .git
      const uris = await vscode.workspace.findFiles(
        new vscode.RelativePattern(workspaceFolder, "**/*"),
        FALLBACK_EXCLUDE,
        MAX_FILES,
      );
      return uris.map((uri) =>
        vscode.workspace.asRelativePath(uri, false).replace(/\\/g, "/"),
      );
    }
  }
}