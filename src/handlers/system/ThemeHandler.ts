/**
 *? Usage:
 *    Xử lý theme: gửi theme hiện tại cho webview, cập nhật theme khi có thay đổi.
 *
 *? Function:
 *    updateTheme()        : Gửi theme hiện tại cho webview.
 *    handleRequestTheme() : Xử lý yêu cầu theme từ webview.
 */
import * as vscode from "vscode";

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