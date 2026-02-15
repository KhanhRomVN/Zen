import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { GlobalStorageManager } from "../storage-manager";
import { ContextManager } from "./ContextManager";

export class ProjectStructureManager {
  private _blacklist: Set<string> = new Set();
  private _gitignoreWatcher: vscode.FileSystemWatcher | null = null;
  private _onChange?: () => void;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _contextManager: ContextManager,
  ) {}

  public setOnChange(callback: () => void): void {
    this._onChange = callback;
  }

  public async initialize(): Promise<void> {
    await this.loadGitignorePatterns();
    this.updateContextManager();
    this.setupGitignoreWatcher();
  }

  private setupGitignoreWatcher(): void {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;

    // Watch .gitignore file for changes
    const gitignorePattern = new vscode.RelativePattern(
      workspaceFolder,
      ".gitignore",
    );
    this._gitignoreWatcher =
      vscode.workspace.createFileSystemWatcher(gitignorePattern);

    // Reload patterns when .gitignore changes
    this._gitignoreWatcher.onDidChange(async () => {
      await this.reloadGitignorePatterns();
    });

    this._gitignoreWatcher.onDidCreate(async () => {
      await this.reloadGitignorePatterns();
    });

    this._gitignoreWatcher.onDidDelete(() => {
      // Clear gitignore patterns from blacklist
      this.clearGitignorePatterns();
    });
  }

  private async reloadGitignorePatterns(): Promise<void> {
    // Clear and reload from .gitignore only
    this._blacklist.clear();
    await this.loadGitignorePatterns();
    this.updateContextManager();
  }

  private clearGitignorePatterns(): void {
    // When .gitignore is deleted, clear blacklist
    this._blacklist.clear();
    this.updateContextManager();
  }

  private async loadGitignorePatterns(): Promise<void> {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return;
    }

    const gitignorePath = path.join(workspaceFolder.uri.fsPath, ".gitignore");
    if (!fs.existsSync(gitignorePath)) {
      return;
    }

    try {
      const content = fs.readFileSync(gitignorePath, "utf-8");
      const lines = content.split("\n");

      let addedCount = 0;
      for (const line of lines) {
        const trimmed = line.trim();
        // Skip empty lines and comments
        if (!trimmed || trimmed.startsWith("#")) continue;
        // Skip negation patterns (e.g., !important.log)
        if (trimmed.startsWith("!")) continue;

        // Normalize the pattern
        let pattern = trimmed;
        // Remove trailing slashes
        if (pattern.endsWith("/")) {
          pattern = pattern.slice(0, -1);
        }
        // Remove leading slashes for root-relative patterns
        if (pattern.startsWith("/")) {
          pattern = pattern.slice(1);
        }

        // Add to blacklist if not already present
        // For now, we'll add simple patterns (no wildcards)
        // Wildcard patterns like *.log would need more complex handling
        if (!pattern.includes("*") && !pattern.includes("?")) {
          this._blacklist.add(pattern);
          addedCount++;
        }
      }
    } catch (error) {
      /* console.error(
        "[ProjectStructureManager] Failed to load .gitignore patterns:",
        error
      ); */
    }
  }

  private updateContextManager(): void {
    this._contextManager.setBlacklist(Array.from(this._blacklist));
    // Notify listeners that blacklist has changed
    if (this._onChange) {
      this._onChange();
    }
  }

  public isBlacklisted(path: string): boolean {
    return this._blacklist.has(path);
  }

  public async getBlacklist(): Promise<string[]> {
    return Array.from(this._blacklist);
  }

  public async getRawFileTree() {
    return this._contextManager.getRawFileTree();
  }

  public async refresh(): Promise<void> {
    this._blacklist.clear();
    await this.loadGitignorePatterns();
    this.updateContextManager();
  }

  public dispose(): void {
    if (this._gitignoreWatcher) {
      this._gitignoreWatcher.dispose();
      this._gitignoreWatcher = null;
    }
  }
}
