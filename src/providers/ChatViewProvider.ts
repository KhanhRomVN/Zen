import * as vscode from "vscode";

// CONTROLLERS
import { ChatController } from "../controllers/ChatController";

// MANAGERS
import { FileLockManager } from "../managers/FileLockManager";
import { TerminalManager } from "../managers/TerminalManager";

// STORAGE
import { GlobalStorageManager } from "../storage/GlobalStorageManager";

// TYPES
// (none currently needed from types/Agent)

export class ChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "zen-chat";
  private _view?: vscode.WebviewView;
  private chatController?: ChatController;
  private _terminalManager: TerminalManager;
  private _fileLockManager: FileLockManager;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _storageManager: GlobalStorageManager,
  ) {
    this._terminalManager = new TerminalManager();
    this._fileLockManager = new FileLockManager();
  }

  public getTerminalManager(): TerminalManager {
    return this._terminalManager;
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    const startTime = Date.now();
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    // Initialize ChatController
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const workspaceRoot = workspaceFolder?.uri.fsPath || "";

    vscode.commands.executeCommand(
      "setContext",
      "zen.workspaceFolderPath",
      workspaceRoot,
    );

    this.chatController = new ChatController(
      this._storageManager,
      workspaceRoot,
      this._terminalManager,
      this._fileLockManager,
    );

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);
    webviewView.webview.onDidReceiveMessage(async (data) => {
      if (this.chatController) {
        await this.chatController.handleMessage(data, webviewView);
      }
    });

    // Listen for Command Finished
    const cmdFinishedDisposable = this._terminalManager.onCommandFinished(
      (event) => {
        const isError =
          event.exitCode !== null &&
          event.exitCode !== undefined &&
          event.exitCode !== 0;
        const result = webviewView.webview.postMessage({
          command: "commandExecuted",
          actionId: event.actionId,
          output: event.output,
          terminalId: event.terminalId,
          commandText: event.commandText,
          error: isError ? `Exit code ${event.exitCode}` : undefined,
        });
        if (result && typeof (result as any).then === "function") {
          (result as any).then((sent: boolean) => {
            if (!sent)
              console.warn(
                `[ChatViewProvider] commandExecuted NOT delivered (webview hidden/disposed?)`,
                { actionId: event.actionId },
              );
          });
        }
      },
    );

    // Listen for real-time terminal data
    this._terminalManager.onDidWriteData((event) => {
      webviewView.webview.postMessage({
        command: "terminalOutput",
        terminalId: event.terminalId,
        data: event.data,
      });
    });

    // Listen for terminal status changes
    this._terminalManager.onTerminalStatusChanged((event) => {
      webviewView.webview.postMessage({
        command: "terminalStatusChanged",
        terminalId: event.terminalId,
        status: event.status,
      });
    });

    // Initial Theme Update
    if (this.chatController) {
      this.chatController.updateTheme(webviewView.webview);
    }

    // Listen for Theme Changes
    const themeDisposable = vscode.window.onDidChangeActiveColorTheme(() => {
      this.chatController?.updateTheme(webviewView.webview);
    });

    webviewView.onDidDispose(() => {
      themeDisposable.dispose();
      cmdFinishedDisposable.dispose();
    });
  }

  public postMessageToWebview(message: any) {
    if (this._view && this._view.visible) {
      this._view.webview.postMessage(message);
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._extensionUri,
        "src/webview-ui/dist",
        "webview.js",
      ),
    );

    const imagesUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "images"),
    );

    // Escape HTML entities in URI to prevent decoding issues with special characters like &
    const escapedImagesUri = imagesUri
      .toString()
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    const nonce = this.getNonce();
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const folderPath = workspaceFolder?.uri.fsPath || null;
    const cspSource = webview.cspSource;

    return `<!DOCTYPE html>
<html lang="en">
<head>
 <meta charset="UTF-8">
 <meta name="viewport" content="width=device-width, initial-scale=1.0">
 <meta http-equiv="Content-Security-Policy" content="default-src 'none'; connect-src http://localhost:* ws://localhost:*; style-src ${cspSource} 'unsafe-inline'; img-src ${cspSource} data: https:; font-src ${cspSource}; script-src 'nonce-${nonce}' ${cspSource} 'unsafe-eval'; worker-src blob: data: ${cspSource} https: http:;">
 <title>Zen Chat</title>
 <script nonce="${nonce}">
 window.__zenWorkspaceFolderPath = ${JSON.stringify(folderPath)};
 window.__zenImagesUri = "${escapedImagesUri}";
 </script>
 <style>
 :root {
 --primary-bg: var(--vscode-editor-background, #1e1e1e);
 --secondary-bg: var(--vscode-sideBar-background, #252526);
 --tertiary-bg: var(--vscode-panel-background, #2d2d30);
 --hover-bg: var(--vscode-list-hoverBackground, #2a2d2e);
 --primary-text: var(--vscode-foreground, #cccccc);
 --secondary-text: var(--vscode-descriptionForeground, #858585);
 --accent-text: var(--vscode-textLink-foreground, #4fc3f7);
 --border-color: var(--vscode-panel-border, #3e3e42);
 --input-bg: var(--vscode-input-background, #3c3c3c);
 --button-primary: var(--vscode-button-background, #0e639c);
 --button-primary-hover: var(--vscode-button-hoverBackground, #1177bb);
 --button-secondary: var(--vscode-button-secondaryBackground, var(--vscode-sideBar-background, #2d2d30));
 --button-secondary-hover: var(--vscode-button-secondaryHoverBackground, #3e3e42);
 }
</style>
</head>
<body>
 <div id="root"></div>
 <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  private getNonce(): string {
    let text = "";
    const possible =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }
}
