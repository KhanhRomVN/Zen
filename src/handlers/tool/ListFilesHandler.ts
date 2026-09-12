/**
 * ------------------------------------------------------------------
 * List Files Handler
 * ------------------------------------------------------------------
 * Liệt kê cây thư mục với depth tùy chỉnh, bỏ qua thư mục ẩn và
 * node_modules.
 *
 * Main functions:
 * - handleListFiles() : Liệt kê cây thư mục với depth tùy chỉnh,
 *                       bỏ qua thư mục ẩn và node_modules
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── VSCode ──
import * as vscode from "vscode";

// ── Node ──
import * as path from "path";

// ── Security ──
import { SecurityValidator } from "../../utils/security";

// ─── Constants ─────────────────────────────────────────────────────────
/** Ngưỡng tối đa để đếm dòng — file lớn hơn sẽ fallback về hiển thị size. */
const MAX_LINE_COUNT_FILE_SIZE = 1024 * 1024; // 1 MB

/** Whitelist extension text — chỉ đếm dòng cho file text, bỏ qua binary/ảnh. */
const TEXT_FILE_EXTENSIONS = new Set<string>([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".json",
  ".md",
  ".markdown",
  ".txt",
  ".css",
  ".scss",
  ".sass",
  ".less",
  ".html",
  ".htm",
  ".xml",
  ".svg",
  ".py",
  ".go",
  ".rs",
  ".java",
  ".kt",
  ".kts",
  ".swift",
  ".c",
  ".h",
  ".cpp",
  ".cc",
  ".cxx",
  ".hpp",
  ".rb",
  ".php",
  ".cs",
  ".dart",
  ".lua",
  ".yml",
  ".yaml",
  ".toml",
  ".ini",
  ".conf",
  ".env",
  ".sh",
  ".bash",
  ".zsh",
  ".fish",
  ".ps1",
  ".bat",
  ".cmd",
  ".log",
  ".vue",
  ".svelte",
  ".astro",
  ".sql",
  ".graphql",
  ".gql",
  ".proto",
]);

// ─── Class ──────────────────────────────────────────────────────────────
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

            // Đếm số dòng cho file text ≤ 1MB; fallback size cho binary/file lớn
            let lines: number | undefined;
            const ext = path.extname(name).toLowerCase();
            if (
              size !== undefined &&
              size <= MAX_LINE_COUNT_FILE_SIZE &&
              TEXT_FILE_EXTENSIONS.has(ext)
            ) {
              try {
                const buf = await vscode.workspace.fs.readFile(entryUri);
                const text = Buffer.from(buf).toString("utf-8");
                if (text.length === 0) {
                  lines = 0;
                } else {
                  const nlCount = (text.match(/\n/g) || []).length;
                  lines = text.endsWith("\n") ? nlCount : nlCount + 1;
                }
              } catch {
                lines = undefined;
              }
            }

            results.push({
              name,
              type: "file",
              size,
              lines,
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
