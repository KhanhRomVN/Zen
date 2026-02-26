import * as vscode from "vscode";
import * as path from "path";

export class RecentItemsManager {
  private static readonly MAX_RECENT_ITEMS = 20;
  private static readonly STORAGE_KEY = "zen.recentFiles";
  private _recentFiles: string[] = [];

  constructor(private readonly _context: vscode.ExtensionContext) {
    this.loadRecentFiles();
    this.setupListeners();
  }

  private loadRecentFiles(): void {
    this._recentFiles = this._context.globalState.get<string[]>(
      RecentItemsManager.STORAGE_KEY,
      [],
    );
    // Filter out non-existent or absolute paths if needed, but relative is better
  }

  private setupListeners(): void {
    this._context.subscriptions.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor && editor.document.uri.scheme === "file") {
          this.addFile(editor.document.uri);
        }
      }),
    );
  }

  private addFile(uri: vscode.Uri): void {
    const relativePath = vscode.workspace.asRelativePath(uri);
    // Remove if already exists to move to top
    this._recentFiles = this._recentFiles.filter((p) => p !== relativePath);
    // Add to top
    this._recentFiles.unshift(relativePath);
    // Limit size
    if (this._recentFiles.length > RecentItemsManager.MAX_RECENT_ITEMS) {
      this._recentFiles = this._recentFiles.slice(
        0,
        RecentItemsManager.MAX_RECENT_ITEMS,
      );
    }
    // Save
    this._context.globalState.update(
      RecentItemsManager.STORAGE_KEY,
      this._recentFiles,
    );
  }

  public getRecentFiles(): string[] {
    return this._recentFiles;
  }

  public getRecentFolders(): string[] {
    const folders = new Set<string>();
    this._recentFiles.forEach((f) => {
      const dir = path.dirname(f);
      if (dir !== "." && dir !== "/") {
        folders.add(dir);
      }
    });
    return Array.from(folders);
  }
}
