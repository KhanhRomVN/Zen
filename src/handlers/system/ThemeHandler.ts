/**
 * ------------------------------------------------------------------
 * Theme Handler
 * ------------------------------------------------------------------
 * Xử lý theme cho extension: gửi theme hiện tại cho webview và cập
 * nhật theme khi có thay đổi từ phía người dùng.
 *
 * Main functions:
 * - updateTheme()        : Gửi theme hiện tại cho webview
 * - handleRequestTheme() : Xử lý yêu cầu theme từ webview
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── VSCode ──
import * as vscode from "vscode";

// ─── Class ──────────────────────────────────────────────────────────────
export class ThemeHandler {
  public async handleRequestTheme(webviewView: vscode.WebviewView) {
    await this.updateTheme(webviewView.webview);
  }

  public async updateTheme(webview: vscode.Webview) {
    const theme = vscode.window.activeColorTheme;
    const themeKind = theme.kind;
    const colorTheme =
      vscode.workspace
        .getConfiguration("workbench")
        .get<string>("colorTheme") || "Default Dark Modern";

    webview.postMessage({
      command: "updateTheme",
      theme: themeKind,
      themeId: colorTheme,
      themeVersion: Date.now(),
    });
  }
}
