import * as vscode from "vscode";
import * as path from "path";
import { ChatController } from "../controllers/ChatController";
import { ContextManager } from "../context/ContextManager";
import { GlobalStorageManager } from "../storage-manager";
import { AgentCapabilityManager } from "../agent/AgentCapabilityManager";
import { AgentPermissions } from "../agent/types/AgentTypes";
import { BackupManager } from "../managers/BackupManager";
import { ProcessManager } from "../managers/ProcessManager";
import { FileLockManager } from "../managers/FileLockManager";
import { ProjectStructureManager } from "../context/ProjectStructureManager";
import { RecentItemsManager } from "../context/RecentItemsManager";
import * as crypto from "crypto";
import * as os from "os";

export class ZenChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "zen-chat";
  private _view?: vscode.WebviewView;
  private chatController?: ChatController;
  private _extensionContext?: vscode.ExtensionContext;
  private _agentManager?: AgentCapabilityManager;
  private _processManager: ProcessManager;
  private _fileLockManager: FileLockManager;
  private _backupManager?: BackupManager;
  private _recentItemsManager?: RecentItemsManager;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _contextManager: ContextManager,
    private readonly _storageManager: GlobalStorageManager,
    private readonly _projectStructureManager: ProjectStructureManager,
  ) {
    this._processManager = new ProcessManager();
    this._fileLockManager = new FileLockManager();
    this._backupManager = new BackupManager(this._storageManager);
  }

  public setExtensionContext(context: vscode.ExtensionContext) {
    this._extensionContext = context;
    if (this._extensionContext) {
      this._recentItemsManager = new RecentItemsManager(this._extensionContext);
    }
  }

  public getProcessManager(): ProcessManager {
    return this._processManager;
  }

  public initializeAgentManager() {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      const folderPath = workspaceFolder.uri.fsPath;

      // Compute project directory (matching ChatController logic)
      const hash = crypto.createHash("md5").update(folderPath).digest("hex");
      const projectDir = path.join(
        os.homedir(),
        "khanhromvn-zen",
        "projects",
        hash,
      );

      // Set project directory in ProcessManager to enable project-specific terminals
      this._processManager.setProjectDir(projectDir);

      vscode.commands.executeCommand(
        "setContext",
        "zen.workspaceFolderPath",
        folderPath,
      );

      const defaultPermissions: AgentPermissions = {
        readProjectFile: false,
        readAllFile: false,
        editProjectFiles: false,
        editAddFile: false,
        executeSafeCommand: false,
        executeAllCommands: false,
      };

      this._agentManager = new AgentCapabilityManager(
        defaultPermissions,
        folderPath,
      );
    }
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    // Initialize ChatController
    this.chatController = new ChatController(
      this._contextManager,
      this._storageManager,
      this._agentManager,
      this._backupManager,
      this._processManager,
      this._fileLockManager,
      this._projectStructureManager,
      this._recentItemsManager,
      this._extensionUri,
    );

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (data) => {
      if (this.chatController) {
        await this.chatController.handleMessage(data, webviewView);
      }
    });

    // Listen for Command Finished
    this._processManager.onCommandFinished((event) => {
      webviewView.webview.postMessage({
        command: "commandExecuted",
        actionId: event.actionId,
        output: event.output,
        terminalId: event.terminalId,
        commandText: event.commandText,
      });
    });

    // Listen for Terminal Changes
    this._processManager.onTerminalsChanged(() => {
      const terminals = this._processManager.list();
      webviewView.webview.postMessage({
        command: "listTerminalsResult",
        terminals,
      });
    });

    // Listen for real-time terminal data
    this._processManager.onDidWriteData((event) => {
      webviewView.webview.postMessage({
        command: "terminalOutput",
        terminalId: event.terminalId,
        data: event.data,
      });
    });

    // Listen for terminal status changes
    this._processManager.onTerminalStatusChanged((event) => {
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
 window.__zenImagesUri = "${imagesUri}";
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
