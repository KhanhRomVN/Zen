import * as vscode from "vscode";
import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";
import * as fs from "fs";
import { GlobalStorageManager } from "../storage-manager";

export interface TimelineEvent {
  timestamp: number;
  eventType:
    | "file_modified"
    | "file_added"
    | "file_deleted"
    | "folder_added"
    | "folder_deleted"
    | "initial_state";
  filePath: string;
  fileName: string;
  fileSize?: number;
  snapshotPath?: string;
  unconfirmed?: boolean;
  fileExists?: boolean;
  diff?: {
    additions: number;
    deletions: number;
    diffText?: string;
  };
}

export interface BackupMetadata {
  conversationId: string;
  workspacePath: string;
  createdAt: number;
  lastModified: number;
  totalEvents: number;
  originalFiles: string[];
}

export class BackupManager {
  private readonly backupRoot: string;
  private workspaceRoot: string | null = null;
  private _storageManager?: GlobalStorageManager;

  // Watcher State
  private _backupFileWatcher?: vscode.FileSystemWatcher;
  private _disposables: vscode.Disposable[] = [];
  private _activeConversationId?: string;
  private _processedDeletions = new Set<string>();

  constructor(storageManager?: GlobalStorageManager) {
    this.backupRoot = path.join(os.homedir(), "khanhromvn-zen", "backups");
    this._storageManager = storageManager;
  }

  setWorkspaceRoot(workspacePath: string): void {
    this.workspaceRoot = workspacePath;
  }

  getBackupFolderPath(conversationId: string): string {
    return path.join(this.backupRoot, conversationId);
  }

  // #region Folder & Metadata Management

  async createBackupFolder(conversationId: string): Promise<string> {
    if (!this.workspaceRoot) throw new Error("Workspace root not set");

    const backupFolder = this.getBackupFolderPath(conversationId);
    const snapshotsFolder = path.join(backupFolder, "snapshots");

    try {
      await vscode.workspace.fs.createDirectory(vscode.Uri.file(backupFolder));
      await vscode.workspace.fs.createDirectory(
        vscode.Uri.file(snapshotsFolder),
      );

      const metadata: BackupMetadata = {
        conversationId,
        workspacePath: this.workspaceRoot,
        createdAt: Date.now(),
        lastModified: Date.now(),
        totalEvents: 0,
        originalFiles: [],
      };

      await vscode.workspace.fs.writeFile(
        vscode.Uri.file(path.join(backupFolder, "metadata.json")),
        Buffer.from(JSON.stringify(metadata, null, 2), "utf8"),
      );

      await vscode.workspace.fs.writeFile(
        vscode.Uri.file(path.join(backupFolder, "timeline.json")),
        Buffer.from(JSON.stringify([], null, 2), "utf8"),
      );

      return backupFolder;
    } catch (error) {
      console.error(`[BackupManager] Failed to create backup folder: ${error}`);
      throw error;
    }
  }

  async backupFolderExists(conversationId: string): Promise<boolean> {
    const backupFolder = this.getBackupFolderPath(conversationId);
    try {
      await vscode.workspace.fs.stat(vscode.Uri.file(backupFolder));
      return true;
    } catch {
      return false;
    }
  }

  private getRelativePath(absolutePath: string): string {
    if (!this.workspaceRoot) throw new Error("Workspace root not set");
    return path.relative(this.workspaceRoot, absolutePath);
  }

  // #endregion

  // #region File Watcher & Logic (Moved from ZenChatViewProvider)

  async startBackupFileWatcher(
    conversationId: string,
    workspaceFolder: vscode.WorkspaceFolder,
    webviewView: vscode.WebviewView,
  ): Promise<void> {
    console.log(`[BackupManager] Starting watcher for: ${conversationId}`);

    this._activeConversationId = conversationId;
    this.setWorkspaceRoot(workspaceFolder.uri.fsPath);

    const exists = await this.backupFolderExists(conversationId);
    if (!exists) {
      await this.createBackupFolder(conversationId);
    }

    // 1. onWillSave
    const willSaveDisposable = vscode.workspace.onWillSaveTextDocument((e) => {
      if (!this._activeConversationId) return;
      const doc = e.document;
      if (vscode.workspace.getWorkspaceFolder(doc.uri) === workspaceFolder) {
        if (BackupManager.isIgnoredFile(doc.uri.fsPath)) return;

        e.waitUntil(
          (async () => {
            const isBinary = await BackupManager.isBinaryFile(doc.uri.fsPath);
            let unconfirmed = false;
            if (isBinary) {
              const ext =
                path.extname(doc.uri.fsPath).toLowerCase().replace(".", "") ||
                "no_ext";
              const decision = await this.getBinaryFileDecision(
                workspaceFolder.uri.fsPath,
                ext,
              );
              if (decision === "deny") return;
              if (decision === undefined) unconfirmed = true;
            }

            const blacklist = await this.getBackupBlacklist(
              workspaceFolder.uri.fsPath,
            );
            await this.ensureOriginalSnapshot(
              this._activeConversationId!,
              doc.uri.fsPath,
              unconfirmed,
              blacklist,
            );

            if (unconfirmed) {
              const { size } = await this.checkFileSize(doc.uri.fsPath);
              if (size > 1024 * 1024) {
                webviewView.webview.postMessage({
                  command: "promptLargeBinaryBackup",
                  filePath: doc.uri.fsPath,
                  extension:
                    path
                      .extname(doc.uri.fsPath)
                      .toLowerCase()
                      .replace(".", "") || "no_ext",
                  size,
                });
              }
            }
          })(),
        );
      }
    });
    this._disposables.push(willSaveDisposable);

    // 2. onWillDelete
    const willDeleteDisposable = vscode.workspace.onWillDeleteFiles(
      async (e) => {
        if (!this._activeConversationId) return;
        for (const uri of e.files) {
          if (uri.fsPath.startsWith(workspaceFolder.uri.fsPath)) {
            if (uri.fsPath.includes("khanhromvn-zen/backups")) continue;
            if (BackupManager.isIgnoredFile(uri.fsPath)) continue;

            const blacklist = await this.getBackupBlacklist(
              workspaceFolder.uri.fsPath,
            );
            await this.backupFile(
              this._activeConversationId,
              uri.fsPath,
              "file_deleted",
              false,
              blacklist,
            );

            this._processedDeletions.add(uri.fsPath);
            setTimeout(() => this._processedDeletions.delete(uri.fsPath), 2000);

            webviewView.webview.postMessage({
              command: "backupEventAdded",
              conversationId: this._activeConversationId,
            });
          }
        }
      },
    );
    this._disposables.push(willDeleteDisposable);

    // 3. FileSystemWatcher
    if (!this._backupFileWatcher) {
      this._backupFileWatcher =
        vscode.workspace.createFileSystemWatcher("**/*");

      this._backupFileWatcher.onDidChange(async (uri) => {
        await this.handleFileChange(
          uri,
          workspaceFolder,
          webviewView,
          "file_modified",
        );
      });
      this._backupFileWatcher.onDidCreate(async (uri) => {
        await this.handleFileChange(
          uri,
          workspaceFolder,
          webviewView,
          "file_added",
        );
      });
      this._backupFileWatcher.onDidDelete(async (uri) => {
        if (this._processedDeletions.has(uri.fsPath)) return;
        await this.handleFileChange(
          uri,
          workspaceFolder,
          webviewView,
          "file_deleted",
        );
      });
    }
  }

  stopBackupFileWatcher(): void {
    console.log(
      `[BackupManager] Stopping watcher. Active ID: ${this._activeConversationId}`,
    );
    this._activeConversationId = undefined;

    if (this._backupFileWatcher) {
      this._backupFileWatcher.dispose();
      this._backupFileWatcher = undefined;
    }

    this._disposables.forEach((d) => d.dispose());
    this._disposables = [];
  }

  private async handleFileChange(
    uri: vscode.Uri,
    workspaceFolder: vscode.WorkspaceFolder,
    webviewView: vscode.WebviewView,
    eventType: "file_modified" | "file_added" | "file_deleted",
  ): Promise<void> {
    if (!this._activeConversationId) return;
    if (!uri.fsPath.startsWith(workspaceFolder.uri.fsPath)) return;
    if (uri.fsPath.includes("khanhromvn-zen/backups")) return;
    if (BackupManager.isIgnoredFile(uri.fsPath)) return;

    if (eventType === "file_deleted") {
      try {
        const blacklist = await this.getBackupBlacklist(
          workspaceFolder.uri.fsPath,
        );
        await this.backupFile(
          this._activeConversationId,
          uri.fsPath,
          eventType,
          false,
          blacklist,
        );
        webviewView.webview.postMessage({
          command: "backupEventAdded",
          conversationId: this._activeConversationId,
        });
      } catch {}
      return;
    }

    const { size, needsWarning } = await this.checkFileSize(uri.fsPath);

    if (needsWarning) {
      webviewView.webview.postMessage({
        command: "backupSizeWarning",
        filePath: uri.fsPath,
        size,
        conversationId: this._activeConversationId,
        eventType,
      });
    } else {
      const isBinary = await BackupManager.isBinaryFile(uri.fsPath);
      let unconfirmed = false;
      const ext =
        path.extname(uri.fsPath).toLowerCase().replace(".", "") || "no_ext";

      if (isBinary) {
        const decision = await this.getBinaryFileDecision(
          workspaceFolder.uri.fsPath,
          ext,
        );
        if (decision === "deny") return;
        if (decision === undefined) unconfirmed = true;
      }

      try {
        const blacklist = await this.getBackupBlacklist(
          workspaceFolder.uri.fsPath,
        );
        await this.backupFile(
          this._activeConversationId,
          uri.fsPath,
          eventType,
          unconfirmed,
          blacklist,
        );

        if (unconfirmed && size > 1024 * 1024) {
          webviewView.webview.postMessage({
            command: "promptLargeBinaryBackup",
            filePath: uri.fsPath,
            extension: ext,
            size,
          });
        }
        webviewView.webview.postMessage({
          command: "backupEventAdded",
          conversationId: this._activeConversationId,
        });
      } catch (error) {
        console.error("Failed to backup file:", error);
      }
    }
  }

  // #endregion

  // #region Core Backup Methods

  async checkFileSize(
    filePath: string,
  ): Promise<{ size: number; needsWarning: boolean }> {
    try {
      const stat = await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
      const size = stat.size;
      return { size, needsWarning: size > 1024 * 1024 };
    } catch {
      return { size: 0, needsWarning: false };
    }
  }

  private generateSnapshotFilename(
    eventType: string,
    fileName: string,
  ): string {
    const timestamp = Date.now();
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    return `${timestamp}_${eventType}_${sanitizedName}`;
  }

  async ensureOriginalSnapshot(
    conversationId: string,
    absoluteFilePath: string,
    unconfirmed?: boolean,
    blacklist: string[] = [],
  ): Promise<void> {
    const backupFolder = this.getBackupFolderPath(conversationId);
    const metadataPath = path.join(backupFolder, "metadata.json");
    const relativePath = this.getRelativePath(absoluteFilePath);

    if (BackupManager.isBlacklisted(relativePath, blacklist)) return;

    try {
      const metadataUri = vscode.Uri.file(metadataPath);
      const fileData = await vscode.workspace.fs.readFile(metadataUri);
      const metadata: BackupMetadata = JSON.parse(
        Buffer.from(fileData).toString("utf8"),
      );

      if (metadata.originalFiles.includes(relativePath)) return;

      await this.backupFile(
        conversationId,
        absoluteFilePath,
        "initial_state",
        unconfirmed,
      );

      metadata.originalFiles.push(relativePath);
      await vscode.workspace.fs.writeFile(
        metadataUri,
        Buffer.from(JSON.stringify(metadata, null, 2), "utf8"),
      );
    } catch (error) {
      console.error(`Failed to ensure original snapshot: ${error}`);
    }
  }

  async backupFile(
    conversationId: string,
    absoluteFilePath: string,
    eventType:
      | "file_modified"
      | "file_added"
      | "file_deleted"
      | "initial_state",
    unconfirmed?: boolean,
    blacklist: string[] = [],
  ): Promise<void> {
    if (!this.workspaceRoot) throw new Error("Workspace root not set");

    // Check ignored/blacklisted
    if (BackupManager.isIgnoredFile(absoluteFilePath)) return;
    const relativePath = this.getRelativePath(absoluteFilePath);
    if (BackupManager.isBlacklisted(relativePath, blacklist)) return;

    try {
      const backupFolder = this.getBackupFolderPath(conversationId);
      const fileName = path.basename(absoluteFilePath);

      // Batching logic for modifiers
      if (eventType === "file_modified") {
        const lastEvent = await this.getLastEventForFile(
          conversationId,
          relativePath,
        );
        if (
          lastEvent &&
          lastEvent.eventType === "file_modified" &&
          Date.now() - lastEvent.timestamp < 60000
        ) {
          if (lastEvent.snapshotPath) {
            const absoluteSnapshotPath = path.join(
              backupFolder,
              lastEvent.snapshotPath,
            );
            const fileContent = await vscode.workspace.fs.readFile(
              vscode.Uri.file(absoluteFilePath),
            );
            await vscode.workspace.fs.writeFile(
              vscode.Uri.file(absoluteSnapshotPath),
              fileContent,
            );
            return;
          }
        }
      }

      let fileSize = 0;
      let snapshotPath: string | undefined;

      if (eventType !== "file_deleted") {
        const snapshotFilename = this.generateSnapshotFilename(
          eventType,
          fileName,
        );
        snapshotPath = path.join("snapshots", snapshotFilename);
        const absoluteSnapshotPath = path.join(backupFolder, snapshotPath);
        const fileContent = await vscode.workspace.fs.readFile(
          vscode.Uri.file(absoluteFilePath),
        );
        await vscode.workspace.fs.writeFile(
          vscode.Uri.file(absoluteSnapshotPath),
          fileContent,
        );
        fileSize = fileContent.length;
      } else {
        try {
          // Try to snapshot before delete (if exists)
          const fileContent = await vscode.workspace.fs.readFile(
            vscode.Uri.file(absoluteFilePath),
          );
          const snapshotFilename = this.generateSnapshotFilename(
            eventType,
            fileName,
          );
          snapshotPath = path.join("snapshots", snapshotFilename);
          const absoluteSnapshotPath = path.join(backupFolder, snapshotPath);
          await vscode.workspace.fs.writeFile(
            vscode.Uri.file(absoluteSnapshotPath),
            fileContent,
          );
          fileSize = fileContent.length;
        } catch {
          // File gone
        }
      }

      const event: TimelineEvent = {
        timestamp: Date.now(),
        eventType,
        filePath: relativePath,
        fileName,
        fileSize,
        snapshotPath,
        unconfirmed,
      };

      await this.appendToTimeline(conversationId, event);
      await this.updateMetadata(conversationId);
    } catch (error) {
      console.error(`Failed to backup file: ${error}`);
      throw error;
    }
  }

  // #endregion

  // #region Helper Methods

  private async getLastEventForFile(
    conversationId: string,
    filePath: string,
  ): Promise<TimelineEvent | undefined> {
    const timeline = await this.getTimeline(conversationId);
    for (let i = timeline.length - 1; i >= 0; i--) {
      if (timeline[i].filePath === filePath) return timeline[i];
    }
    return undefined;
  }

  private async appendToTimeline(
    conversationId: string,
    event: TimelineEvent,
  ): Promise<void> {
    const backupFolder = this.getBackupFolderPath(conversationId);
    const timelinePath = path.join(backupFolder, "timeline.json");
    try {
      const timelineUri = vscode.Uri.file(timelinePath);
      let timeline: TimelineEvent[] = [];
      try {
        const fileData = await vscode.workspace.fs.readFile(timelineUri);
        timeline = JSON.parse(Buffer.from(fileData).toString("utf8"));
      } catch {
        timeline = [];
      }

      timeline.push(event);
      await vscode.workspace.fs.writeFile(
        timelineUri,
        Buffer.from(JSON.stringify(timeline, null, 2), "utf8"),
      );
    } catch (error) {
      throw error;
    }
  }

  async getTimeline(conversationId: string): Promise<TimelineEvent[]> {
    const timelinePath = path.join(
      this.getBackupFolderPath(conversationId),
      "timeline.json",
    );
    try {
      const fileData = await vscode.workspace.fs.readFile(
        vscode.Uri.file(timelinePath),
      );
      return JSON.parse(Buffer.from(fileData).toString("utf8"));
    } catch {
      return [];
    }
  }

  private async updateMetadata(conversationId: string): Promise<void> {
    const backupFolder = this.getBackupFolderPath(conversationId);
    const metadataPath = path.join(backupFolder, "metadata.json");
    try {
      const metadataUri = vscode.Uri.file(metadataPath);
      const fileData = await vscode.workspace.fs.readFile(metadataUri);
      const metadata: BackupMetadata = JSON.parse(
        Buffer.from(fileData).toString("utf8"),
      );
      const timeline = await this.getTimeline(conversationId);

      metadata.lastModified = Date.now();
      metadata.totalEvents = timeline.length;

      await vscode.workspace.fs.writeFile(
        metadataUri,
        Buffer.from(JSON.stringify(metadata, null, 2), "utf8"),
      );
    } catch {}
  }

  // #endregion

  // #region Static Helpers

  public static isBinaryFile(filePath: string): Promise<boolean> {
    // Simple check or robust check
    return new Promise(async (resolve) => {
      try {
        const uri = vscode.Uri.file(filePath);
        const stat = await vscode.workspace.fs.stat(uri);
        if (stat.size === 0) return resolve(false);
        const content = await vscode.workspace.fs.readFile(uri);
        const sample = content.slice(0, Math.min(content.length, 8192));
        for (let i = 0; i < sample.length; i++) {
          if (sample[i] === 0) return resolve(true);
        }
        resolve(false);
      } catch {
        resolve(false);
      }
    });
  }

  public static isIgnoredFile(filePath: string): boolean {
    const fileName = path.basename(filePath);
    const lower = filePath.toLowerCase();

    if (fileName.startsWith(".attach pid")) return true;
    if (lower.includes("/.git/") || lower.endsWith("/.git")) return true;
    if (lower.includes("/node_modules/") || lower.endsWith("/node_modules"))
      return true;

    const system = [
      ".ds_store",
      "thumbs.db",
      ".vscode",
      ".idea",
      ".sln",
      ".suo",
    ];
    if (system.includes(fileName.toLowerCase())) return true;

    if (
      fileName.endsWith(".tmp") ||
      fileName.endsWith(".bak") ||
      fileName.endsWith(".swp") ||
      fileName.startsWith("~")
    )
      return true;

    return false;
  }

  public static isBlacklisted(filePath: string, blacklist: string[]): boolean {
    const normalized = filePath.replace(/\\/g, "/");
    let blacklisted = false;
    for (const pattern of blacklist) {
      const isNegation = pattern.startsWith("!");
      const actual = (isNegation ? pattern.slice(1) : pattern).replace(
        /\\/g,
        "/",
      );
      if (normalized === actual || normalized.startsWith(actual + "/")) {
        blacklisted = !isNegation;
      }
    }
    return blacklisted;
  }

  // #endregion

  // #region Storage Logic (Decisions & Blacklist)

  async getBinaryFileDecision(
    workspaceFolderPath: string,
    extension: string,
  ): Promise<"allow" | "deny" | undefined> {
    if (!this._storageManager) return undefined;
    const hash = crypto
      .createHash("md5")
      .update(workspaceFolderPath)
      .digest("hex");
    const key = `backup_binary_decisions_${hash}`;
    const stored = await this._storageManager.get(key);
    if (!stored) return undefined;
    try {
      return JSON.parse(stored)[extension];
    } catch {
      return undefined;
    }
  }

  async setBinaryFileDecision(
    workspaceFolderPath: string,
    extension: string,
    decision: "allow" | "deny",
  ): Promise<void> {
    if (!this._storageManager) return;
    const hash = crypto
      .createHash("md5")
      .update(workspaceFolderPath)
      .digest("hex");
    const key = `backup_binary_decisions_${hash}`;
    const stored = await this._storageManager.get(key);
    let decisions: Record<string, any> = stored ? JSON.parse(stored) : {};
    decisions[extension] = decision;
    await this._storageManager.set(key, JSON.stringify(decisions));
  }

  async getBackupBlacklist(workspaceFolderPath: string): Promise<string[]> {
    if (!this._storageManager) return [];
    const hash = crypto
      .createHash("md5")
      .update(workspaceFolderPath)
      .digest("hex");
    const key = `backup_blacklist_${hash}`;
    const stored = await this._storageManager.get(key);
    try {
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  async addToBackupBlacklist(
    workspaceFolderPath: string,
    pathToAdd: string,
  ): Promise<void> {
    if (!this._storageManager) return;
    const blacklist = await this.getBackupBlacklist(workspaceFolderPath);
    // Logic from extension.ts
    let updated = blacklist.filter(
      (p) => p !== "!" + pathToAdd && !p.startsWith("!" + pathToAdd + "/"),
    );
    if (!BackupManager.isBlacklisted(pathToAdd, updated)) {
      updated = updated.filter((p) => !p.startsWith(pathToAdd + "/"));
      updated.push(pathToAdd);
    }
    const hash = crypto
      .createHash("md5")
      .update(workspaceFolderPath)
      .digest("hex");
    await this._storageManager.set(
      `backup_blacklist_${hash}`,
      JSON.stringify(updated),
    );
  }

  async removeFromBackupBlacklist(
    workspaceFolderPath: string,
    pathToRemove: string,
  ): Promise<void> {
    if (!this._storageManager) return;
    const blacklist = await this.getBackupBlacklist(workspaceFolderPath);
    let updated = blacklist.filter(
      (p) => p !== pathToRemove && !p.startsWith(pathToRemove + "/"),
    );
    if (BackupManager.isBlacklisted(pathToRemove, updated)) {
      updated.push("!" + pathToRemove);
    } else {
      updated = updated.filter((p) => !p.startsWith("!" + pathToRemove + "/"));
    }
    const hash = crypto
      .createHash("md5")
      .update(workspaceFolderPath)
      .digest("hex");
    await this._storageManager.set(
      `backup_blacklist_${hash}`,
      JSON.stringify(updated),
    );
  }

  // #endregion

  // #region Missing Methods Implementation

  async getSnapshotContent(
    conversationId: string,
    snapshotPath: string,
  ): Promise<string> {
    const backupFolder = this.getBackupFolderPath(conversationId);
    const uri = vscode.Uri.file(path.join(backupFolder, snapshotPath));
    const content = await vscode.workspace.fs.readFile(uri);
    return Buffer.from(content).toString("utf8");
  }

  async deleteFileBackup(
    conversationId: string,
    filePath: string,
  ): Promise<void> {
    const timeline = await this.getTimeline(conversationId);
    const updated = timeline.filter((e) => e.filePath !== filePath);
    const backupFolder = this.getBackupFolderPath(conversationId);

    // Update timeline
    await vscode.workspace.fs.writeFile(
      vscode.Uri.file(path.join(backupFolder, "timeline.json")),
      Buffer.from(JSON.stringify(updated, null, 2), "utf8"),
    );

    // Update metadata
    await this.updateMetadata(conversationId);
  }

  async deleteByExtension(
    conversationId: string,
    extension: string,
  ): Promise<void> {
    const timeline = await this.getTimeline(conversationId);
    const toDelete = timeline.filter((e) =>
      e.filePath.toLowerCase().endsWith(`.${extension}`),
    );
    const updated = timeline.filter(
      (e) => !e.filePath.toLowerCase().endsWith(`.${extension}`),
    );

    const backupFolder = this.getBackupFolderPath(conversationId);
    const snapshotsDir = path.join(backupFolder, "snapshots");

    // Correctly handle promises
    for (const event of toDelete) {
      if (event.snapshotPath) {
        try {
          await vscode.workspace.fs.delete(
            vscode.Uri.file(path.join(backupFolder, event.snapshotPath)),
          );
        } catch {}
      }
    }

    await vscode.workspace.fs.writeFile(
      vscode.Uri.file(path.join(backupFolder, "timeline.json")),
      Buffer.from(JSON.stringify(updated, null, 2), "utf8"),
    );
    await this.updateMetadata(conversationId);
  }

  async clearUnconfirmedByExtension(
    conversationId: string,
    extension: string,
  ): Promise<void> {
    const timeline = await this.getTimeline(conversationId);
    const updated = timeline.map((e) => {
      if (e.unconfirmed && e.filePath.toLowerCase().endsWith(`.${extension}`)) {
        return { ...e, unconfirmed: false };
      }
      return e;
    });

    const backupFolder = this.getBackupFolderPath(conversationId);
    await vscode.workspace.fs.writeFile(
      vscode.Uri.file(path.join(backupFolder, "timeline.json")),
      Buffer.from(JSON.stringify(updated, null, 2), "utf8"),
    );
  }

  async restoreSnapshot(
    conversationId: string,
    filePath: string,
    snapshotPath: string,
  ): Promise<void> {
    if (!this.workspaceRoot) throw new Error("Workspace root not set");

    const backupFolder = this.getBackupFolderPath(conversationId);
    const absoluteSnapshotPath = path.join(backupFolder, snapshotPath);
    const absoluteFilePath = path.join(this.workspaceRoot, filePath);

    const content = await vscode.workspace.fs.readFile(
      vscode.Uri.file(absoluteSnapshotPath),
    );
    await vscode.workspace.fs.writeFile(
      vscode.Uri.file(absoluteFilePath),
      content,
    );
  }

  // #endregion

  // #region Cleanup

  async cleanupOldConversations(projectContextDir: string): Promise<void> {
    // Logic from ZenChatViewProvider
    const MAX_CONVERSATIONS = 30;
    try {
      const entries = await fs.promises.readdir(projectContextDir, {
        withFileTypes: true,
      });
      const conversations = entries
        .filter((e) => e.isFile() && e.name.endsWith(".json"))
        .map((e) => ({
          name: e.name,
          id: e.name.replace(".json", ""),
          path: path.join(projectContextDir, e.name),
          mtime: fs.statSync(path.join(projectContextDir, e.name)).mtimeMs,
        }))
        .sort((a, b) => b.mtime - a.mtime);

      if (conversations.length <= MAX_CONVERSATIONS) return;

      const toDelete = conversations.slice(MAX_CONVERSATIONS);
      for (const conv of toDelete) {
        await fs.promises.unlink(conv.path);
        await this.cleanupBackup(conv.id);
      }
    } catch (e) {
      console.error("Cleanup failed", e);
    }
  }

  async cleanupBackup(conversationId: string): Promise<void> {
    const backupFolder = this.getBackupFolderPath(conversationId);
    try {
      await vscode.workspace.fs.delete(vscode.Uri.file(backupFolder), {
        recursive: true,
        useTrash: false,
      });
    } catch {}
  }

  // #endregion
}
