import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

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
   * Get recently modified files from Git history
   * Sorted by modification frequency (most frequent first) and checking for existence
   */
  public async getRecentGitChanges(limit: number = 10): Promise<string[]> {
    try {
      const gitExtension =
        vscode.extensions.getExtension("vscode.git")?.exports;
      if (!gitExtension) {
        return [];
      }

      const api = gitExtension.getAPI(1);
      const repo = api.repositories[0];
      if (!repo) {
        return [];
      }

      const rootPath = repo.rootUri.fsPath;

      // Execute git log command to get file changes from last 500 commits
      // We want raw list of files to count frequency
      const { stdout } = await execAsync(
        `git log --name-only --pretty=format: -n 500`,
        { cwd: rootPath }
      );

      const fileCounts = new Map<string, number>();

      stdout
        .split("\n")
        .map((line: string) => line.trim())
        .filter((line: string) => line.length > 0)
        .forEach((file: string) => {
          fileCounts.set(file, (fileCounts.get(file) || 0) + 1);
        });

      // Sort files by frequency (descending)
      const sortedFiles = Array.from(fileCounts.entries())
        .sort((a, b) => b[1] - a[1]) // Sort by count descending
        .map(([file]) => file);

      // Filter for existence and limit
      const validFiles: string[] = [];

      for (const file of sortedFiles) {
        if (validFiles.length >= limit) break;

        try {
          const fullPath = path.join(rootPath, file);
          // Use accessSync to check existence
          // R_OK checks for read permission which implies existence
          fs.accessSync(fullPath, fs.constants.F_OK);
          validFiles.push(file);
        } catch {
          // File does not exist or not accessible, skip
          continue;
        }
      }

      return validFiles;
    } catch (error) {
      console.error("Failed to get git history:", error);
      return [];
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
