import * as vscode from "vscode";
import { GlobalStorageManager } from "../../storage-manager";

export class StorageHandler {
  constructor(private storageManager: GlobalStorageManager | undefined) {}

  public async handleStorageOperation(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    const { command, requestId, key, value } = message;
    if (!this.storageManager) {
      webviewView.webview.postMessage({
        command: `${command}Response`,
        requestId,
        error: "Storage manager not initialized",
      });
      return;
    }

    let result: any;
    if (command === "storageGet") result = await this.storageManager.get(key);
    else if (command === "storageSet")
      await this.storageManager.set(key, value);
    else if (command === "storageDelete") await this.storageManager.delete(key);
    else if (command === "storageList")
      result = await this.storageManager.list();

    const responsePayload: any = {
      command: `${command}Response`,
      requestId,
    };

    if (command === "storageGet") responsePayload.value = result;
    else if (command === "storageList") responsePayload.keys = result;
    else responsePayload.result = result;

    webviewView.webview.postMessage(responsePayload);
  }
}
