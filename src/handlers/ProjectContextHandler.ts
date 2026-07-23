import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as os from "os";
import * as crypto from "crypto";

import { PathService } from "../services/PathService";

export class ProjectContextHandler {
  private pathService: PathService;

  constructor() {
    this.pathService = PathService.getInstance();
  }

  private getProjectContextDir(workspaceFolderPath: string): string {
    return this.pathService.getProjectContextDir(workspaceFolderPath);
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
    if (depth > 20) return "  ".repeat(depth) + "... (max depth reached)";

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

      // treeView removed - no longer using FileSystemAnalyzer
      const treeView = "";

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
}
