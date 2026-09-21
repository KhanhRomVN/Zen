/**
 * ------------------------------------------------------------------
 * Profile Folder Handler
 * ------------------------------------------------------------------
 * Liệt kê tên các thư mục con cấp 1 của Chromium Profile Folder để
 * webview hiển thị danh sách profile khi thêm account.
 *
 * Main functions:
 * - handleListChromiumProfiles() : Đọc thư mục cấp 1, chỉ trả về tên folder
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Node ──
import * as fs from "fs";

// ── VSCode ──
import * as vscode from "vscode";

// ─── Class ──────────────────────────────────────────────────────────────
export class ProfileFolderHandler {
  /**
   * Chỉ readdir đúng 1 cấp (không đệ quy, không stat từng file) để tránh lag
   * khi thư mục profile lớn. Trả về danh sách tên folder qua
   * `chromiumProfilesResult`.
   */
  public async handleListChromiumProfiles(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    const basePath = message.path;

    if (typeof basePath !== "string" || !basePath.trim()) {
      webviewView.webview.postMessage({
        command: "chromiumProfilesResult",
        requestId: message.requestId,
        folders: [],
        error: "Chromium Profile Folder chưa được cấu hình",
      });
      return;
    }

    try {
      const entries = await fs.promises.readdir(basePath, {
        withFileTypes: true,
      });
      const folders = entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort((a, b) => a.localeCompare(b));

      webviewView.webview.postMessage({
        command: "chromiumProfilesResult",
        requestId: message.requestId,
        folders,
      });
    } catch (error: any) {
      console.error("[ProfileFolderHandler] readdir error:", error);
      webviewView.webview.postMessage({
        command: "chromiumProfilesResult",
        requestId: message.requestId,
        folders: [],
        error: error?.message || "Không đọc được Chromium Profile Folder",
      });
    }
  }
}