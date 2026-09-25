/**
 * ------------------------------------------------------------------
 * Workspace Zip Handler
 * ------------------------------------------------------------------
 * Zip toàn bộ source code của workspace hiện tại và trả về base64
 * cho webview để upload kèm message đầu tiên khi dùng Claude provider.
 *
 * Main functions:
 * - handleZipWorkspace() : Zip workspace → base64, gửi lại webview
 *
 * Behaviour:
 * - Bỏ qua các thư mục/file không cần thiết: node_modules, .git,
 *   dist, build, out, .cache, target, __pycache__, *.pyc, .env,
 *   *.lock, *.log, và các file binary thông dụng.
 * - Giới hạn kích thước file đơn lẻ: 2 MB (bỏ qua nếu lớn hơn).
 * - Giới hạn tổng số file: 5000.
 * - Tên file zip: <workspace-folder-name>.zip
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import JSZip from "jszip";

// ─── Constants ──────────────────────────────────────────────────────────

/** Thư mục bỏ qua hoàn toàn (không walk vào bên trong) */
const SKIP_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  "out",
  ".cache",
  "target",
  "__pycache__",
  ".venv",
  "venv",
  ".env",
  ".idea",
  ".vscode",
  "coverage",
  ".nyc_output",
  ".next",
  ".nuxt",
  "vendor",
]);

/** Extension bỏ qua */
const SKIP_EXTENSIONS = new Set([
  ".lock",
  ".log",
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".ico",
  ".mp4",
  ".mp3",
  ".wav",
  ".pdf",
  ".zip",
  ".tar",
  ".gz",
  ".rar",
  ".7z",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".bin",
  ".wasm",
  ".map",
  ".min.js",
  ".min.css",
  ".ttf",
  ".woff",
  ".woff2",
  ".eot",
  ".db",
  ".sqlite",
  ".sqlite3",
  ".pyc",
  ".vsix",   // VS Code extension packages — rất nặng, không cần thiết
  ".blend",  // Blender files
  ".psd",    // Photoshop
  ".sketch", // Sketch
  ".fig",    // Figma
  ".mp4", ".mkv", ".avi", ".mov", // Video
  ".fbx", ".obj", ".glb", ".gltf", // 3D assets
]);

/** Tên file bỏ qua (exact match, case-insensitive) */
const SKIP_FILENAMES = new Set([
  ".ds_store",
  "thumbs.db",
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "bun.lockb",
  "composer.lock",
  "gemfile.lock",
  "cargo.lock",
]);

const MAX_FILE_BYTES = 500 * 1024; // 500 KB mỗi file — source code hầu như không vượt mức này
const MAX_FILE_COUNT = 5000;
/** Tổng dung lượng raw (trước nén) tối đa — để zip output không vượt 35MB của Claude */
const MAX_TOTAL_RAW_BYTES = 60 * 1024 * 1024; // 60 MB raw ≈ ~20–25 MB sau DEFLATE

// ─── Class ───────────────────────────────────────────────────────────────

export class WorkspaceZipHandler {
  /**
   * Zip toàn bộ workspace → trả base64 + tên file về webview.
   * Gọi từ ChatController khi nhận command "zipWorkspace".
   */
  public async handleZipWorkspace(
    message: any,
    webviewView: vscode.WebviewView,
  ): Promise<void> {
    const requestId: string = message.requestId;

    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        webviewView.webview.postMessage({
          command: "zipWorkspaceResult",
          requestId,
          error: "No workspace folder open",
        });
        return;
      }

      const rootPath = workspaceFolder.uri.fsPath;
      const folderName = path.basename(rootPath);
      const zipName = `${folderName}.zip`;

      const zip = new JSZip();
      const state = { fileCount: 0, skippedCount: 0, totalRawBytes: 0 };

      // Walk workspace recursively — truyền folderName để wrap files trong <folderName>/
      this._walkDir(rootPath, rootPath, folderName, zip, state);

      console.log(
        `[WorkspaceZipHandler] Zipping workspace: ${rootPath} | files=${state.fileCount} | skipped=${state.skippedCount} | rawBytes=${state.totalRawBytes}`,
      );

      // Generate zip as base64
      const zipBuffer = await zip.generateAsync({
        type: "nodebuffer",
        compression: "DEFLATE",
        compressionOptions: { level: 6 },
      });

      const base64 = zipBuffer.toString("base64");
      const mimeType = "application/zip";

      console.log(
        `[WorkspaceZipHandler] Zip complete | zipName=${zipName} | files=${state.fileCount} | size=${zipBuffer.length} bytes`,
      );

      webviewView.webview.postMessage({
        command: "zipWorkspaceResult",
        requestId,
        data: {
          base64,
          mimeType,
          fileName: zipName,
          fileCount: state.fileCount,
          skippedCount: state.skippedCount,
          sizeBytes: zipBuffer.length,
        },
      });
    } catch (err: any) {
      console.error("[WorkspaceZipHandler] Error:", err);
      webviewView.webview.postMessage({
        command: "zipWorkspaceResult",
        requestId,
        error: err.message || String(err),
      });
    }
  }

  // ─── Private Helpers ─────────────────────────────────────────────────

  private _walkDir(
    dirPath: string,
    rootPath: string,
    folderName: string,
    zip: JSZip,
    state: { fileCount: number; skippedCount: number; totalRawBytes: number },
  ): void {
    if (state.fileCount >= MAX_FILE_COUNT) return;
    if (state.totalRawBytes >= MAX_TOTAL_RAW_BYTES) return;

    let entries: fs.Dirent[];
    try {
      entries = fs.readdirSync(dirPath, { withFileTypes: true });
    } catch {
      return; // Permission denied or other error
    }

    for (const entry of entries) {
      if (state.fileCount >= MAX_FILE_COUNT) break;
      if (state.totalRawBytes >= MAX_TOTAL_RAW_BYTES) break;

      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(rootPath, fullPath);

      if (entry.isDirectory()) {
        // Skip known heavy/irrelevant directories
        if (SKIP_DIRS.has(entry.name)) continue;
        // Skip hidden dirs (except .github, .husky etc.)
        if (
          entry.name.startsWith(".") &&
          entry.name !== ".github" &&
          entry.name !== ".husky"
        ) {
          continue;
        }

        this._walkDir(fullPath, rootPath, folderName, zip, state);
      } else if (entry.isFile()) {
        // Skip by filename
        if (SKIP_FILENAMES.has(entry.name.toLowerCase())) {
          state.skippedCount++;
          continue;
        }

        // Skip by extension
        const ext = path.extname(entry.name).toLowerCase();
        const nameLower = entry.name.toLowerCase();
        const hasSkippedExt =
          SKIP_EXTENSIONS.has(ext) ||
          nameLower.endsWith(".min.js") ||
          nameLower.endsWith(".min.css");
        if (hasSkippedExt) {
          state.skippedCount++;
          continue;
        }

        // Skip by file size
        let stat: fs.Stats;
        try {
          stat = fs.statSync(fullPath);
        } catch {
          state.skippedCount++;
          continue;
        }

        if (stat.size > MAX_FILE_BYTES) {
          state.skippedCount++;
          continue;
        }

        // Read and add to zip
        try {
          const content = fs.readFileSync(fullPath);
          // Wrap trong folder <folderName>/ để khi claude unzip ra sẽ có:
          //   /home/claude/work/<folderName>/<relativePath>
          // mapSandboxPath strip đúng 1 segment (<folderName>) → không bị duplicate.
          const zipPath = `${folderName}/${relativePath.split(path.sep).join("/")}`;
          zip.file(zipPath, content);
          state.fileCount++;
          state.totalRawBytes += stat.size;
        } catch {
          state.skippedCount++;
        }
      }
    }
  }
}
