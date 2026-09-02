import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

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
      const content = fs.readFileSync(fileUris[0].fsPath, "utf8");
      const parsed = JSON.parse(content);
      const response = await fetch(`${apiUrl}/v1/accounts/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed),
      });
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