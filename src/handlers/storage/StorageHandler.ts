/**
 *? Usage:
 *    Xử lý thao tác storage (get/set/delete/list) với cơ chế workspace-scoped keys — tự động thêm prefix hash workspace để cô lập dữ liệu giữa các dự án.
 *
 *? Function:
 *    handleStorageOperation(): Điều phối các lệnh storageGet/Set/Delete/List, tự động resolve key theo workspace.
 */
import * as crypto from "crypto";
import * as vscode from "vscode";

// STORAGE
import { GlobalStorageManager } from "../../storage/GlobalStorageManager";

/**
 * Keys that are scoped per-workspace.
 * When the webview reads/writes these keys, StorageHandler automatically
 * prefixes them with a hash of the current workspace root so that each
 * workspace has its own independent value.
 */
const WORKSPACE_SCOPED_KEYS = new Set(["zen_permission_mode"]);

export class StorageHandler {
  constructor(private storageManager: GlobalStorageManager | undefined) {}

  /**
   * Returns a stable short hash for the current workspace root path.
   * Returns empty string when no workspace is open (falls back to global).
   */
  private getWorkspacePrefix(): string {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) return "";
    const hash = crypto
      .createHash("md5")
      .update(folder.uri.fsPath)
      .digest("hex")
      .slice(0, 8);
    return `ws_${hash}__`;
  }

  /**
   * Resolves the actual storage key, adding a workspace prefix for
   * workspace-scoped keys so each workspace stores its own value.
   */
  private resolveKey(key: string): string {
    if (WORKSPACE_SCOPED_KEYS.has(key)) {
      const prefix = this.getWorkspacePrefix();
      return prefix ? `${prefix}${key}` : key;
    }
    return key;
  }

  public async handleStorageOperation(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    if (!this.storageManager) {
      webviewView.webview.postMessage({
        command: `${message.command}Response`,
        requestId: message.requestId,
        error: "Storage manager not initialized",
      });
      return;
    }

    try {
      let result: any;
      const { command, requestId, key, value } = message;

      if (command === "storageGet") {
        const resolvedKey = this.resolveKey(key);
        result = await this.storageManager.get(resolvedKey);
        webviewView.webview.postMessage({
          command: "storageGetResponse",
          requestId,
          key,
          value: result,
        });
      } else if (command === "storageSet") {
        const resolvedKey = this.resolveKey(key);
        await this.storageManager.set(resolvedKey, value);
        webviewView.webview.postMessage({
          command: "storageSetResponse",
          requestId,
          success: true,
        });
      } else if (command === "storageDelete") {
        const resolvedKey = this.resolveKey(key);
        await this.storageManager.delete(resolvedKey);
        webviewView.webview.postMessage({
          command: "storageDeleteResponse",
          requestId,
          success: true,
        });
      } else if (command === "storageList") {
        // For list operations, return logical keys (strip workspace prefix)
        const wsPrefix = this.getWorkspacePrefix();
        const rawKeys = await this.storageManager.list(message.prefix);
        const keys = rawKeys.map((k) =>
          wsPrefix && k.startsWith(wsPrefix) ? k.slice(wsPrefix.length) : k,
        );
        webviewView.webview.postMessage({
          command: "storageListResponse",
          requestId,
          keys,
        });
      }
    } catch (e: any) {
      webviewView.webview.postMessage({
        command: `${message.command}Response`,
        requestId: message.requestId,
        error: e.message,
      });
    }
  }
}
