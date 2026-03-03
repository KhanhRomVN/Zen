import * as vscode from "vscode";
import { GlobalStorageManager } from "../../storage-manager";

export class StorageHandler {
  constructor(private storageManager: GlobalStorageManager | undefined) {}

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
        result = await this.storageManager.get(key);
        webviewView.webview.postMessage({
          command: "storageGetResponse",
          requestId,
          key,
          value: result,
        });
      } else if (command === "storageSet") {
        await this.storageManager.set(key, value);
        webviewView.webview.postMessage({
          command: "storageSetResponse",
          requestId,
          success: true,
        });
      } else if (command === "storageDelete") {
        await this.storageManager.delete(key);
        webviewView.webview.postMessage({
          command: "storageDeleteResponse",
          requestId,
          success: true,
        });
      } else if (command === "storageList") {
        result = await this.storageManager.list(message.prefix);
        webviewView.webview.postMessage({
          command: "storageListResponse",
          requestId,
          keys: result,
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
