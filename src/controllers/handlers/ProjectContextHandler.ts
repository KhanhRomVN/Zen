import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as crypto from "crypto";
import * as os from "os";
import { ContextManager } from "../../context/ContextManager";
import { ProjectStructureManager } from "../../context/ProjectStructureManager";
import { GlobalStorageManager } from "../../storage-manager";

export class ProjectContextHandler {
  private _projectContextWatcher?: vscode.FileSystemWatcher;
  private _projectContextDisposables: vscode.Disposable[] = [];

  constructor(
    private contextManager: ContextManager,
    private projectStructureManager: ProjectStructureManager | undefined,
    private storageManager: GlobalStorageManager | undefined,
  ) {}

  private getContextRoot(): string {
    return path.join(os.homedir(), "khanhromvn-zen");
  }

  private getProjectContextDir(workspaceFolderPath: string): string {
    const hash = crypto
      .createHash("md5")
      .update(workspaceFolderPath)
      .digest("hex");
    return path.join(this.getContextRoot(), "projects", hash);
  }

  private getProjectContextKey(pathValue: string): string {
    return `project-context-${crypto
      .createHash("md5")
      .update(pathValue)
      .digest("hex")}`;
  }

  public async handleGetProjectStructureBlacklist(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    if (!this.projectStructureManager) return;
    const blacklist = await this.projectStructureManager.getBlacklist();
    webviewView.webview.postMessage({
      command: "projectStructureBlacklistResult",
      requestId: message.requestId,
      blacklist,
    });
  }

  public async handleGetFolderTree(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) return;

      const folderUri = path.isAbsolute(message.path)
        ? vscode.Uri.file(message.path)
        : vscode.Uri.joinPath(workspaceFolder.uri, message.path);

      const tree = await this.generateMinimalTree(folderUri.fsPath);

      webviewView.webview.postMessage({
        command: "getFolderTreeResult",
        requestId: message.requestId,
        path: message.path,
        tree,
      });
    } catch (e: any) {
      webviewView.webview.postMessage({
        command: "getFolderTreeResult",
        requestId: message.requestId,
        error: e.message,
      });
    }
  }

  private async generateMinimalTree(dir: string, depth = 0): Promise<string> {
    if (depth > 3) return "  ".repeat(depth) + "... (max depth reached)";

    let result = "";
    const items = await fs.promises.readdir(dir, { withFileTypes: true });

    for (const item of items) {
      if (item.name.startsWith(".")) continue;

      const indent = "  ".repeat(depth);
      if (item.isDirectory()) {
        result += `${indent}${item.name}/\n`;
        result += await this.generateMinimalTree(
          path.join(dir, item.name),
          depth + 1,
        );
      } else {
        result += `${indent}${item.name}\n`;
      }
    }
    return result;
  }

  public async handleGetProjectContext(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) throw new Error("No workspace");

      const projectContextDir = this.getProjectContextDir(
        workspaceFolder.uri.fsPath,
      );

      let workspace = "";
      const workspacePath = path.join(projectContextDir, "workspace.md");
      if (fs.existsSync(workspacePath)) {
        workspace = await fs.promises.readFile(workspacePath, "utf-8");
      }

      const treeView = await this.contextManager
        .getFileSystemAnalyzer()
        .getFileTree(3);

      webviewView.webview.postMessage({
        command: "projectContextResult",
        requestId: message.requestId,
        data: {
          workspace,
          treeView,
          rootPath: workspaceFolder.uri.fsPath,
          homedir: os.homedir(),
        },
      });
    } catch (error: any) {
      webviewView.webview.postMessage({
        command: "projectContextResult",
        requestId: message.requestId,
        error: error.message,
      });
    }
  }

  public async handleStartProjectContextWatch(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    if (this._projectContextWatcher) {
      return;
    }

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;

    this._projectContextWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(workspaceFolder, "**/*"),
    );

    const debouncedRefresh = this.debounce(async () => {
      await this.handleGetProjectContext(
        { requestId: "auto-watch" },
        webviewView,
      );
    }, 2000);

    this._projectContextDisposables.push(
      this._projectContextWatcher.onDidChange(debouncedRefresh),
      this._projectContextWatcher.onDidCreate(debouncedRefresh),
      this._projectContextWatcher.onDidDelete(debouncedRefresh),
    );
  }

  public stopProjectContextWatch() {
    if (this._projectContextWatcher) {
      this._projectContextWatcher.dispose();
      this._projectContextWatcher = undefined;
    }
    this._projectContextDisposables.forEach((d) => d.dispose());
    this._projectContextDisposables = [];
  }

  public async handleStopProjectContextWatch(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    this.stopProjectContextWatch();
  }

  private debounce(fn: Function, delay: number) {
    let timeout: NodeJS.Timeout;
    return (...args: any[]) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => fn(...args), delay);
    };
  }

  public async handleRequestContext(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    let pc = null;
    if (workspaceFolder && this.storageManager) {
      pc = await this.storageManager.get(
        this.getProjectContextKey(workspaceFolder.uri.fsPath),
      );
      if (pc) {
        try {
          pc = JSON.parse(pc);
        } catch {
          pc = null;
        }
      }
    }

    this.contextManager
      .generateContext(message.task, message.isFirstRequest, pc)
      .then((context: any) => {
        webviewView.webview.postMessage({
          command: "requestContextResult",
          requestId: message.requestId,
          context,
        });
      })
      .catch((e: any) => {
        webviewView.webview.postMessage({
          command: "requestContextResult",
          requestId: message.requestId,
          error: e.message,
        });
      });
  }
}
