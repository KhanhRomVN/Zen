/**
 * ------------------------------------------------------------------
 * Account Import/Export Handler
 * ------------------------------------------------------------------
 * Xử lý import/export tài khoản: import từ file JSON qua API,
 * export ra file JSON vào thư mục người dùng chọn.
 *
 * Main functions:
 * - handleImportAccounts() : Import tài khoản từ file JSON qua API
 * - handleExportAccounts() : Export tài khoản ra file JSON
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Node ──
import * as fs from "fs";
import * as path from "path";

// ── VSCode ──
import * as vscode from "vscode";

// ─── Class ──────────────────────────────────────────────────────────────
export class AccountImportExportHandler {
  public async handleImportAccounts(message: any, webviewView: vscode.WebviewView) {
    const apiUrl = message.apiUrl;
    if (!apiUrl) return;

    const fileUris = await vscode.window.showOpenDialog({
      canSelectMany: false,
      filters: { JSON: ["json"] },
    });
    if (!fileUris || fileUris.length === 0) return;

    try {
      const content = await fs.promises.readFile(fileUris[0].fsPath, "utf8");
      const parsed = JSON.parse(content);
      const response = await fetch(`${apiUrl}/v1/accounts/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
      if (!response.ok) {
        webviewView.webview.postMessage({
          requestId: message.requestId,
          error: `Import failed: HTTP ${response.status} ${response.statusText}`,
        });
        return;
      }
      const result = await response.json();
      webviewView.webview.postMessage({ requestId: message.requestId, result });
    } catch (error: any) {
      webviewView.webview.postMessage({
        requestId: message.requestId,
        error: error?.message || String(error),
      });
    }
  }

  public async handleExportAccounts(message: any) {
    const saveUri = await vscode.window.showSaveDialog({
      defaultUri: vscode.Uri.file(message.fileName || "accounts.json"),
      filters: { JSON: ["json"] },
    });
    if (!saveUri) return;

    try {
      await fs.promises.writeFile(saveUri.fsPath, message.content, "utf8");
      vscode.window.showInformationMessage(`Exported: ${saveUri.fsPath}`);
    } catch (error: any) {
      vscode.window.showErrorMessage(
        `Export failed: ${error?.message || String(error)}`,
      );
    }
  }
}