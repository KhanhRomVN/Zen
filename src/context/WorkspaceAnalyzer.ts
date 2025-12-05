import * as vscode from "vscode";
import * as path from "path";

export interface WorkspaceInfo {
  name: string;
  path: string;
  openTabs: string[];
  visibleFiles: string[];
  activeFile: string | null;
  gitBranch: string | null;
  gitRemote: string | null;
}

export class WorkspaceAnalyzer {
  /**
   * Lấy thông tin workspace hiện tại
   */
  public async getWorkspaceInfo(): Promise<WorkspaceInfo> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    const workspacePath =
      workspaceFolders && workspaceFolders.length > 0
        ? workspaceFolders[0].uri.fsPath
        : "";
    const workspaceName =
      workspaceFolders && workspaceFolders.length > 0
        ? workspaceFolders[0].name
        : "No workspace";

    return {
      name: workspaceName,
      path: workspacePath,
      openTabs: this.getOpenTabs(),
      visibleFiles: this.getVisibleFiles(),
      activeFile: this.getActiveFile(),
      gitBranch: await this.getGitBranch(),
      gitRemote: await this.getGitRemote(),
    };
  }

  /**
   * Lấy danh sách tabs đang mở
   */
  private getOpenTabs(): string[] {
    const tabs: string[] = [];
    const tabGroups = vscode.window.tabGroups.all;

    for (const group of tabGroups) {
      for (const tab of group.tabs) {
        if (tab.input instanceof vscode.TabInputText) {
          const relativePath = this.getRelativePath(tab.input.uri.fsPath);
          tabs.push(relativePath);
        }
      }
    }

    return tabs;
  }

  /**
   * Lấy danh sách files đang visible (hiển thị trong editor)
   */
  private getVisibleFiles(): string[] {
    const visibleEditors = vscode.window.visibleTextEditors;
    return visibleEditors.map((editor) =>
      this.getRelativePath(editor.document.uri.fsPath)
    );
  }

  /**
   * Lấy file đang active
   */
  private getActiveFile(): string | null {
    const activeEditor = vscode.window.activeTextEditor;
    if (!activeEditor) {
      return null;
    }
    return this.getRelativePath(activeEditor.document.uri.fsPath);
  }

  /**
   * Lấy Git branch hiện tại
   */
  private async getGitBranch(): Promise<string | null> {
    try {
      const gitExtension =
        vscode.extensions.getExtension("vscode.git")?.exports;
      if (!gitExtension) {
        return null;
      }

      const api = gitExtension.getAPI(1);
      const repo = api.repositories[0];
      if (!repo) {
        return null;
      }

      return repo.state.HEAD?.name || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Lấy Git remote URL
   */
  private async getGitRemote(): Promise<string | null> {
    try {
      const gitExtension =
        vscode.extensions.getExtension("vscode.git")?.exports;
      if (!gitExtension) {
        return null;
      }

      const api = gitExtension.getAPI(1);
      const repo = api.repositories[0];
      if (!repo) {
        return null;
      }

      const remotes = repo.state.remotes;
      if (remotes.length === 0) {
        return null;
      }

      return remotes[0].fetchUrl || null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Convert absolute path to relative path
   */
  private getRelativePath(absolutePath: string): string {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      return absolutePath;
    }

    const workspaceRoot = workspaceFolders[0].uri.fsPath;
    return path.relative(workspaceRoot, absolutePath);
  }
}
