/**
 * ------------------------------------------------------------------
 * Account Import/Export Handler
 * ------------------------------------------------------------------
 * Xử lý import/export tài khoản:
 * - handlePreviewImport()  : Đọc file, gọi /import/preview, trả về danh sách để UI confirm
 * - handleConfirmImport()  : Nhận danh sách accounts đã confirm, gọi /import/override thật sự
 * - handleExportAccounts() : Export tài khoản ra file JSON
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

// ─── Class ──────────────────────────────────────────────────────────────
export class AccountImportExportHandler {
  /**
   * Bước 1: Mở file dialog, đọc file, gọi /import/preview.
   * Trả về preview data cho webview để hiển thị ImportReviewDrawer.
   * Không insert gì vào DB.
   */
  public async handlePreviewImport(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    const apiUrl = message.apiUrl;
    if (!apiUrl) return;

    const buildHeaders = (): Record<string, string> => {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (message.databaseManagerId) {
        headers["x-database-manager-id"] = message.databaseManagerId;
      }
      return headers;
    };

    const fileUris = await vscode.window.showOpenDialog({
      canSelectMany: false,
      canSelectFiles: true,
      canSelectFolders: false,
      filters: {
        "JSON Files": ["json"],
        "SQLite Databases": ["sqlite", "sqlite3", "db"],
        "All Files": ["*"],
      },
      openLabel: "Import",
    });
    if (!fileUris || fileUris.length === 0) {
      return;
    }

    try {
      const filePath = fileUris[0].fsPath;
      const ext = path.extname(filePath).toLowerCase();
      const isSqlite = ext === ".sqlite" || ext === ".sqlite3" || ext === ".db";
      let accountsToPreview: any[];

      if (isSqlite) {
        // SQLite: gọi preview với flag đặc biệt — backend đọc sqlite tự tìm accounts
        // Tạm thời chưa support preview cho sqlite, import thẳng
        const response = await fetch(`${apiUrl}/v1/accounts/import`, {
          method: "POST",
          headers: buildHeaders(),
          body: JSON.stringify({ __importFromSqlitePath: filePath }),
        });
        const result = await response.json();
        webviewView.webview.postMessage({
          requestId: message.requestId,
          result,
          isSqlite: true,
        });
        return;
      }

      // JSON file
      const content = fs.readFileSync(filePath, "utf8");
      const parsed = JSON.parse(content);

      if (!Array.isArray(parsed)) {
        webviewView.webview.postMessage({
          requestId: message.requestId,
          error: "File JSON không hợp lệ — phải là array of accounts",
        });
        return;
      }

      accountsToPreview = parsed;

      // Báo webview biết file đã chọn xong, đang gọi preview API
      webviewView.webview.postMessage({
        requestId: message.requestId,
        status: "analyzing",
        count: accountsToPreview.length,
      });

      // Gọi preview endpoint
      const previewResponse = await fetch(
        `${apiUrl}/v1/accounts/import/preview`,
        {
          method: "POST",
          headers: buildHeaders(),
          body: JSON.stringify(accountsToPreview),
        },
      );
      const previewResult = await previewResponse.json();

      // Trả về preview data kèm rawAccounts để dùng khi confirm
      webviewView.webview.postMessage({
        requestId: message.requestId,
        preview: previewResult,
        rawAccounts: accountsToPreview,
      });
    } catch (error: any) {
      console.error("[PreviewImport] Error:", error?.message || String(error));
      webviewView.webview.postMessage({
        requestId: message.requestId,
        error: error?.message || String(error),
      });
    }
  }

  /**
   * Bước 2: Sau khi user confirm trong drawer, gọi /import với danh sách
   * accounts đã được chọn (selectedAccounts từ webview).
   */
  public async handleConfirmImport(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    const { apiUrl, databaseManagerId, selectedAccounts, requestId } = message;
    if (!apiUrl || !Array.isArray(selectedAccounts)) return;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (databaseManagerId) headers["x-database-manager-id"] = databaseManagerId;

    try {
      const response = await fetch(`${apiUrl}/v1/accounts/import`, {
        method: "POST",
        headers,
        body: JSON.stringify(selectedAccounts),
      });
      const result = await response.json();
      webviewView.webview.postMessage({ requestId, result });
    } catch (error: any) {
      console.error("[ConfirmImport] Error:", error?.message || String(error));
      webviewView.webview.postMessage({
        requestId,
        error: error?.message || String(error),
      });
    }
  }

  public async handleExportAccounts(message: any) {
    const folderUris = await vscode.window.showOpenDialog({
      canSelectFiles: false,
      canSelectFolders: true,
      canSelectMany: false,
    });
    if (!folderUris || folderUris.length === 0) return;

    const filePath = path.join(folderUris[0].fsPath, message.fileName);
    fs.writeFileSync(filePath, message.content, "utf8");
    vscode.window.showInformationMessage(`Exported: ${filePath}`);
  }
}
