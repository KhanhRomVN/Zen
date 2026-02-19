import * as vscode from "vscode";
import * as path from "path";
import * as os from "os";
import * as crypto from "crypto";
import * as fs from "fs";

/**
 * Timeline Event Schema
 */
export interface TimelineEvent {
  timestamp: number;
  eventType:
    | "file_modified"
    | "file_added"
    | "file_deleted"
    | "folder_added"
    | "folder_deleted"
    | "initial_state"; // 🆕 New type for original content
  filePath: string; // Relative to workspace root
  fileName: string;
  fileSize?: number;
  snapshotPath?: string; // Relative to backup folder (e.g., "snapshots/123456_modified_file.ts")
  unconfirmed?: boolean; // 🆕 Mark binary files that haven't been confirmed/denied by user
  fileExists?: boolean; // 🆕 Check if file still exists in workspace
  diff?: {
    additions: number;
    deletions: number;
    diffText?: string; // Unified diff format
  };
}

/**
 * Backup Metadata Schema
 */
export interface BackupMetadata {
  conversationId: string;
  workspacePath: string;
  createdAt: number;
  lastModified: number;
  totalEvents: number;
  originalFiles: string[]; // 🆕 Track files that have their original state backed up
}

/**
 * BackupManager Service
 * Quản lý việc backup code changes trong workspace cho từng conversation
 */
export class BackupManager {
  private readonly backupRoot: string;
  private workspaceRoot: string | null = null;

  constructor() {
    // Backup root: ~/khanhromvn-zen/backups/
    this.backupRoot = path.join(os.homedir(), "khanhromvn-zen", "backups");
  }

  /**
   * Set workspace root path
   */
  setWorkspaceRoot(workspacePath: string): void {
    this.workspaceRoot = workspacePath;
  }

  /**
   * Get backup folder path for a conversation
   */
  getBackupFolderPath(conversationId: string): string {
    return path.join(this.backupRoot, conversationId);
  }

  /**
   * Create backup folder structure for a conversation
   */
  async createBackupFolder(conversationId: string): Promise<string> {
    if (!this.workspaceRoot) {
      throw new Error("Workspace root not set");
    }

    const backupFolder = this.getBackupFolderPath(conversationId);
    const snapshotsFolder = path.join(backupFolder, "snapshots");

    try {
      // Create directories
      await vscode.workspace.fs.createDirectory(vscode.Uri.file(backupFolder));
      await vscode.workspace.fs.createDirectory(
        vscode.Uri.file(snapshotsFolder),
      );

      // Create metadata.json
      const metadata: BackupMetadata = {
        conversationId,
        workspacePath: this.workspaceRoot,
        createdAt: Date.now(),
        lastModified: Date.now(),
        totalEvents: 0,
        originalFiles: [],
      };

      const metadataPath = path.join(backupFolder, "metadata.json");
      await vscode.workspace.fs.writeFile(
        vscode.Uri.file(metadataPath),
        Buffer.from(JSON.stringify(metadata, null, 2), "utf8"),
      );

      // Create timeline.json (empty array)
      const timelinePath = path.join(backupFolder, "timeline.json");
      await vscode.workspace.fs.writeFile(
        vscode.Uri.file(timelinePath),
        Buffer.from(JSON.stringify([], null, 2), "utf8"),
      );

      console.log(
        `[BackupManager] Created backup folder for conversation: ${conversationId}`,
      );
      return backupFolder;
    } catch (error) {
      console.error(`[BackupManager] Failed to create backup folder: ${error}`);
      throw error;
    }
  }

  /**
   * Check if backup folder exists
   */
  async backupFolderExists(conversationId: string): Promise<boolean> {
    const backupFolder = this.getBackupFolderPath(conversationId);
    try {
      await vscode.workspace.fs.stat(vscode.Uri.file(backupFolder));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check file/folder size
   * Returns size in bytes and whether warning is needed (>1MB)
   */
  async checkFileSize(
    filePath: string,
  ): Promise<{ size: number; needsWarning: boolean }> {
    try {
      const stat = await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
      const size = stat.size;
      const needsWarning = size > 1024 * 1024; // 1MB
      return { size, needsWarning };
    } catch (error) {
      console.error(`[BackupManager] Failed to check file size: ${error}`);
      return { size: 0, needsWarning: false };
    }
  }

  /**
   * Get relative path from workspace root
   */
  private getRelativePath(absolutePath: string): string {
    if (!this.workspaceRoot) {
      throw new Error("Workspace root not set");
    }
    return path.relative(this.workspaceRoot, absolutePath);
  }

  /**
   * Generate snapshot filename
   */
  private generateSnapshotFilename(
    eventType: string,
    fileName: string,
  ): string {
    const timestamp = Date.now();
    const sanitizedName = fileName.replace(/[^a-zA-Z0-9._-]/g, "_");
    return `${timestamp}_${eventType}_${sanitizedName}`;
  }

  /**
   * Ensure original snapshot exists for a file
   * Called on onWillSave
   */
  async ensureOriginalSnapshot(
    conversationId: string,
    absoluteFilePath: string,
    unconfirmed?: boolean,
    blacklist: string[] = [],
  ): Promise<void> {
    const backupFolder = this.getBackupFolderPath(conversationId);
    const metadataPath = path.join(backupFolder, "metadata.json");
    const relativePath = this.getRelativePath(absoluteFilePath);

    // 🆕 Check blacklist
    if (BackupManager.isBlacklisted(relativePath, blacklist)) {
      return;
    }

    try {
      // Read metadata
      const metadataUri = vscode.Uri.file(metadataPath);
      const fileData = await vscode.workspace.fs.readFile(metadataUri);
      const metadata: BackupMetadata = JSON.parse(
        Buffer.from(fileData).toString("utf8"),
      );

      // Check if already has original
      if (metadata.originalFiles.includes(relativePath)) {
        return;
      }

      // Create "Original" snapshot
      await this.backupFile(
        conversationId,
        absoluteFilePath,
        "initial_state",
        unconfirmed,
      );

      // Update metadata
      metadata.originalFiles.push(relativePath);
      await vscode.workspace.fs.writeFile(
        metadataUri,
        Buffer.from(JSON.stringify(metadata, null, 2), "utf8"),
      );

      console.log(
        `[BackupManager] Captured original state for: ${relativePath}`,
      );
    } catch (error) {
      console.error(
        `[BackupManager] Failed to ensure original snapshot: ${error}`,
      );
    }
  }

  /**
   * Check if a file is binary (not readable as text)
   * Reads first 8KB and checks for null bytes
   */
  public static async isBinaryFile(filePath: string): Promise<boolean> {
    try {
      const uri = vscode.Uri.file(filePath);
      const stat = await vscode.workspace.fs.stat(uri);
      if (stat.size === 0) return false;

      // Read first 8KB
      const content = await vscode.workspace.fs.readFile(uri);
      const sampleSize = Math.min(content.length, 8192);
      for (let i = 0; i < sampleSize; i++) {
        if (content[i] === 0) {
          return true; // Found null byte → binary
        }
      }
      return false;
    } catch {
      return false; // If can't read, assume not binary
    }
  }

  /**
   * Delete all backup events and snapshots for a specific file extension
   */
  public async deleteByExtension(
    conversationId: string,
    extension: string,
  ): Promise<void> {
    const timeline = await this.getTimeline(conversationId);
    const backupFolder = this.getBackupFolderPath(conversationId);
    const snapshotsDir = path.join(backupFolder, "snapshots");

    const extLower = extension.toLowerCase().replace(".", "");

    // Filter timeline
    const filteredTimeline = timeline.filter((event) => {
      const eventExt =
        path.extname(event.fileName).toLowerCase().replace(".", "") || "no_ext";
      const match = eventExt === extLower;

      if (match && event.snapshotPath) {
        // Delete snapshot file
        const fullSnapshotPath = path.join(backupFolder, event.snapshotPath);
        try {
          fs.unlinkSync(fullSnapshotPath);
        } catch (e) {
          console.error(`Failed to delete snapshot ${fullSnapshotPath}:`, e);
        }
      }

      return !match; // Keep if not matched
    });

    // Save updated timeline
    const timelinePath = path.join(backupFolder, "timeline.json");
    await vscode.workspace.fs.writeFile(
      vscode.Uri.file(timelinePath),
      Buffer.from(JSON.stringify(filteredTimeline, null, 2)),
    );
  }

  /**
   * Clear the 'unconfirmed' flag for all events of a specific extension
   */
  public async clearUnconfirmedByExtension(
    conversationId: string,
    extension: string,
  ): Promise<void> {
    const timeline = await this.getTimeline(conversationId);
    const extLower = extension.toLowerCase().replace(".", "");

    let changed = false;
    const updatedTimeline = timeline.map((event) => {
      const eventExt =
        path.extname(event.fileName).toLowerCase().replace(".", "") || "no_ext";
      if (eventExt === extLower && event.unconfirmed) {
        changed = true;
        return { ...event, unconfirmed: false };
      }
      return event;
    });

    if (changed) {
      const backupFolder = this.getBackupFolderPath(conversationId);
      const timelinePath = path.join(backupFolder, "timeline.json");
      await vscode.workspace.fs.writeFile(
        vscode.Uri.file(timelinePath),
        Buffer.from(JSON.stringify(updatedTimeline, null, 2)),
      );
    }
  }

  /**
   * Check if a path is blacklisted
   */
  public static isBlacklisted(filePath: string, blacklist: string[]): boolean {
    const normalizedPath = filePath.replace(/\\/g, "/");

    let blacklisted = false;
    for (const pattern of blacklist) {
      const isNegation = pattern.startsWith("!");
      const actualPattern = (isNegation ? pattern.slice(1) : pattern).replace(
        /\\/g,
        "/",
      );

      const matches =
        normalizedPath === actualPattern ||
        normalizedPath.startsWith(actualPattern + "/");

      if (matches) {
        blacklisted = !isNegation;
      }
    }
    return blacklisted;
  }

  /**
   * Check if a file should be ignored from backup (temporary, system, or binary junk)
   */
  public static isIgnoredFile(filePath: string): boolean {
    const fileName = path.basename(filePath);
    const relativePath = filePath.toLowerCase();

    // 1. Explicitly requested: .attach pidXXXXX
    if (fileName.startsWith(".attach pid")) {
      return true;
    }

    // 2. Common version control and dependencies
    if (
      relativePath.includes("/.git/") ||
      relativePath.endsWith("/.git") ||
      relativePath.includes("/node_modules/") ||
      relativePath.endsWith("/node_modules")
    ) {
      return true;
    }

    // 3. System files
    const systemFiles = [
      ".ds_store",
      "thumbs.db",
      ".vscode", // Usually shouldn't backup .vscode internal files if they change often
      ".idea",
      ".sln",
      ".suo",
    ];
    if (systemFiles.includes(fileName.toLowerCase())) {
      return true;
    }

    // 4. Common temp/cache patterns
    if (
      fileName.endsWith(".tmp") ||
      fileName.endsWith(".bak") ||
      fileName.endsWith(".swp") ||
      fileName.startsWith("~")
    ) {
      return true;
    }

    return false;
  }

  /**
   * Backup a file
   * Handles 1-minute batching for modifications
   */
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
    if (!this.workspaceRoot) {
      throw new Error("Workspace root not set");
    }

    const relativePath = this.getRelativePath(absoluteFilePath);

    // 🆕 Check blacklist
    if (BackupManager.isBlacklisted(relativePath, blacklist)) {
      console.log(`[BackupManager] Skipping blacklisted file: ${relativePath}`);
      return;
    }

    // 🆕 Check if file should be ignored
    if (BackupManager.isIgnoredFile(absoluteFilePath)) {
      // console.log(`[BackupManager] Skipping ignored file: ${absoluteFilePath}`);
      return;
    }

    try {
      const backupFolder = this.getBackupFolderPath(conversationId);
      const snapshotsFolder = path.join(backupFolder, "snapshots");
      const relativePath = this.getRelativePath(absoluteFilePath);
      const fileName = path.basename(absoluteFilePath);

      // Check for batching (only for file_modified)
      if (eventType === "file_modified") {
        const lastEvent = await this.getLastEventForFile(
          conversationId,
          relativePath,
        );
        if (
          lastEvent &&
          lastEvent.eventType === "file_modified" &&
          Date.now() - lastEvent.timestamp < 60000 // 1 minute window
        ) {
          // Update existing snapshot
          if (lastEvent.snapshotPath) {
            console.log(`[BackupManager] Batching update for: ${relativePath}`);
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
            // We do NOT update the timestamp to keep the "start of minute" reference,
            // or we could update fileSize if validation needed.
            return;
          }
        }
      }

      let fileSize = 0;
      let snapshotPath: string | undefined;

      // For add/modify/initial: copy file content to snapshot
      // For delete: We assumes this is called BEFORE deletion (onWillDelete), strictly speaking.
      // But if called onDidDelete, we can't read.
      // However, extension.ts will call this on onWillDelete for deletion events.
      if (eventType !== "file_deleted") {
        const snapshotFilename = this.generateSnapshotFilename(
          eventType,
          fileName,
        );
        snapshotPath = path.join("snapshots", snapshotFilename);
        const absoluteSnapshotPath = path.join(backupFolder, snapshotPath);

        // Read and copy file
        const fileContent = await vscode.workspace.fs.readFile(
          vscode.Uri.file(absoluteFilePath),
        );
        const textPreview = Buffer.from(fileContent.slice(0, 50))
          .toString("utf8")
          .replace(/\n/g, "\\n");
        console.log(
          `[BackupManager] DEBUG: Reading ${relativePath} for ${eventType}. Content starts with: "${textPreview}..."`,
        );

        await vscode.workspace.fs.writeFile(
          vscode.Uri.file(absoluteSnapshotPath),
          fileContent,
        );

        fileSize = fileContent.length;
      } else {
        // For file_deleted, we try to snapshot if it still exists (onWillDelete)
        // If it doesn't exist, we can't snapshot.
        try {
          const fileContent = await vscode.workspace.fs.readFile(
            vscode.Uri.file(absoluteFilePath),
          );
          // It exists! Snapshot it one last time?
          // User asked: "how to backup if deleted?" -> We save the state BEFORE deletion.
          // So we treat it like a snapshot, but mark event as deleted.
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
        } catch (e) {
          console.warn(
            `[BackupManager] Could not snapshot deleted file (might be already gone): ${absoluteFilePath}`,
          );
        }
      }

      // Create timeline event
      const event: TimelineEvent = {
        timestamp: Date.now(),
        eventType,
        filePath: relativePath,
        fileName,
        fileSize,
        snapshotPath,
        unconfirmed,
      };

      // 🆕 Handle binary file flags
      if (eventType !== "file_deleted") {
        const isBinary = await BackupManager.isBinaryFile(absoluteFilePath);
        if (isBinary) {
          // Check if already allowed in this context?
          // Extension host will handle the persistence check before calling backupFile or within it?
          // Let's pass an optional isUnconfirmed flat or handle it here?
          // Actually, according to the plan, we mark it as unconfirmed if the extension hasn't been allowed yet.
          // Since BackupManager is a service, let's allow passing an unconfirmed flag.
        }
      }

      console.log(
        `[BackupManager] DEBUG: Backing up ${relativePath} | Event: ${eventType} | Size: ${fileSize} bytes`,
      );

      // Append to timeline
      await this.appendToTimeline(conversationId, event);

      // Update metadata
      await this.updateMetadata(conversationId);

      console.log(
        `[BackupManager] Backed up file: ${relativePath} (${eventType})`,
      );
    } catch (error) {
      console.error(`[BackupManager] Failed to backup file: ${error}`);
      throw error;
    }
  }

  /**
   * Get last event for a file to check for batching
   */
  private async getLastEventForFile(
    conversationId: string,
    filePath: string,
  ): Promise<TimelineEvent | undefined> {
    const timeline = await this.getTimeline(conversationId);
    // Iterate backwards
    for (let i = timeline.length - 1; i >= 0; i--) {
      if (timeline[i].filePath === filePath) {
        return timeline[i];
      }
    }
    return undefined;
  }

  /**
   * Append event to timeline
   */
  private async appendToTimeline(
    conversationId: string,
    event: TimelineEvent,
  ): Promise<void> {
    const backupFolder = this.getBackupFolderPath(conversationId);
    const timelinePath = path.join(backupFolder, "timeline.json");

    try {
      // Read existing timeline
      const timelineUri = vscode.Uri.file(timelinePath);
      let timeline: TimelineEvent[] = [];

      try {
        const fileData = await vscode.workspace.fs.readFile(timelineUri);
        timeline = JSON.parse(Buffer.from(fileData).toString("utf8"));
        if (!Array.isArray(timeline)) timeline = [];
      } catch (readError: any) {
        timeline = [];
      }

      // Append new event
      timeline.push(event);

      // Write back
      await vscode.workspace.fs.writeFile(
        timelineUri,
        Buffer.from(JSON.stringify(timeline, null, 2), "utf8"),
      );
    } catch (error) {
      console.error(`[BackupManager] Failed to append to timeline: ${error}`);
      throw error;
    }
  }

  /**
   * Update metadata (lastModified, totalEvents)
   */
  private async updateMetadata(conversationId: string): Promise<void> {
    const backupFolder = this.getBackupFolderPath(conversationId);
    const metadataPath = path.join(backupFolder, "metadata.json");

    try {
      const metadataUri = vscode.Uri.file(metadataPath);
      const fileData = await vscode.workspace.fs.readFile(metadataUri);
      const metadata: BackupMetadata = JSON.parse(
        Buffer.from(fileData).toString("utf8"),
      );

      // Get timeline count
      const timelinePath = path.join(backupFolder, "timeline.json");
      const timelineData = await vscode.workspace.fs.readFile(
        vscode.Uri.file(timelinePath),
      );
      const timeline: TimelineEvent[] = JSON.parse(
        Buffer.from(timelineData).toString("utf8"),
      );

      metadata.lastModified = Date.now();
      metadata.totalEvents = timeline.length;

      await vscode.workspace.fs.writeFile(
        metadataUri,
        Buffer.from(JSON.stringify(metadata, null, 2), "utf8"),
      );
    } catch (error) {
      console.error(`[BackupManager] Failed to update metadata: ${error}`);
    }
  }

  /**
   * Get timeline for a conversation
   */
  async getTimeline(conversationId: string): Promise<TimelineEvent[]> {
    const backupFolder = this.getBackupFolderPath(conversationId);
    const timelinePath = path.join(backupFolder, "timeline.json");

    try {
      const timelineUri = vscode.Uri.file(timelinePath);
      const fileData = await vscode.workspace.fs.readFile(timelineUri);
      const timeline: TimelineEvent[] = JSON.parse(
        Buffer.from(fileData).toString("utf8"),
      );
      return timeline;
    } catch (error) {
      // console.error(`[BackupManager] Failed to get timeline: ${error}`);
      return [];
    }
  }

  /**
   * Restore a snapshot back to the workspace
   */
  public async restoreSnapshot(
    conversationId: string,
    filePath: string,
    snapshotPath: string,
  ): Promise<void> {
    const backupFolder = this.getBackupFolderPath(conversationId);
    const fullSnapshotPath = path.join(backupFolder, snapshotPath);

    if (!fs.existsSync(fullSnapshotPath)) {
      throw new Error(`Snapshot not found: ${fullSnapshotPath}`);
    }

    if (!this.workspaceRoot) {
      throw new Error("Workspace root not set");
    }

    const absoluteTargetPath = path.resolve(this.workspaceRoot, filePath);

    // Ensure parent directory exists
    const parentDir = path.dirname(absoluteTargetPath);
    if (!fs.existsSync(parentDir)) {
      await vscode.workspace.fs.createDirectory(vscode.Uri.file(parentDir));
    }

    // Copy snapshot back to workspace
    await vscode.workspace.fs.copy(
      vscode.Uri.file(fullSnapshotPath),
      vscode.Uri.file(absoluteTargetPath),
      { overwrite: true },
    );
  }

  /**
   * Get snapshot content
   */
  async getSnapshotContent(
    conversationId: string,
    snapshotPath: string,
  ): Promise<string> {
    const backupFolder = this.getBackupFolderPath(conversationId);
    const absolutePath = path.join(backupFolder, snapshotPath);

    try {
      const fileData = await vscode.workspace.fs.readFile(
        vscode.Uri.file(absolutePath),
      );
      return Buffer.from(fileData).toString("utf8");
    } catch (error) {
      console.error(`[BackupManager] Failed to get snapshot content: ${error}`);
      return "";
    }
  }

  /**
   * Delete backup history for a specific file
   */
  async deleteFileBackup(
    conversationId: string,
    filePath: string,
  ): Promise<void> {
    const backupFolder = this.getBackupFolderPath(conversationId);
    const snapshotsFolder = path.join(backupFolder, "snapshots");
    const timelinePath = path.join(backupFolder, "timeline.json");

    try {
      // 1. Get timeline
      const timelineUri = vscode.Uri.file(timelinePath);
      let timeline: TimelineEvent[] = [];
      try {
        const fileData = await vscode.workspace.fs.readFile(timelineUri);
        timeline = JSON.parse(Buffer.from(fileData).toString("utf8"));
      } catch {
        timeline = [];
      }

      // 2. Filter events and collect snapshots to delete
      const snapshotsToDelete: string[] = [];
      const newTimeline = timeline.filter((event) => {
        if (
          event.filePath === filePath ||
          event.filePath.startsWith(filePath + "/")
        ) {
          // Handle file and folder contents if applicable, though filePath is usually file specific
          // If it's the file we are deleting, mark snapshot for deletion
          if (event.snapshotPath) {
            snapshotsToDelete.push(event.snapshotPath);
          }
          return false; // Remove from new timeline
        }
        return true; // Keep others
      });

      // Also handle exact folder matches if user deletes a folder path
      // Logic: if filePath is "src/components", we remove "src/components/A.tsx", etc?
      // "filePath" passed here is likely a relative path.
      // If user deletes a folder in UI, we might pass the folder path.
      // Let's ensure we handle directory deletion recursively if needed.
      // Updated filter logic above handles prefix match for folders.

      // 3. Delete snapshot files
      for (const snapshotPath of snapshotsToDelete) {
        const absoluteSnapshotPath = path.join(backupFolder, snapshotPath);
        try {
          await vscode.workspace.fs.delete(
            vscode.Uri.file(absoluteSnapshotPath),
          );
        } catch (e) {
          console.warn(
            `[BackupManager] Failed to delete snapshot: ${snapshotPath}`,
            e,
          );
        }
      }

      // 4. Update timeline.json
      await vscode.workspace.fs.writeFile(
        timelineUri,
        Buffer.from(JSON.stringify(newTimeline, null, 2), "utf8"),
      );

      // 5. Update Metadata (originalFiles, etc)
      await this.removeFileFromMetadata(conversationId, filePath);
      await this.updateMetadata(conversationId); // Recalculate totals

      console.log(`[BackupManager] Deleted backup history for: ${filePath}`);
    } catch (error) {
      console.error(`[BackupManager] Failed to delete file backup: ${error}`);
      throw error;
    }
  }

  /**
   * Remove file from metadata.originalFiles
   */
  private async removeFileFromMetadata(
    conversationId: string,
    filePath: string,
  ): Promise<void> {
    const backupFolder = this.getBackupFolderPath(conversationId);
    const metadataPath = path.join(backupFolder, "metadata.json");
    try {
      const metadataUri = vscode.Uri.file(metadataPath);
      const fileData = await vscode.workspace.fs.readFile(metadataUri);
      const metadata: BackupMetadata = JSON.parse(
        Buffer.from(fileData).toString("utf8"),
      );

      if (metadata.originalFiles) {
        metadata.originalFiles = metadata.originalFiles.filter(
          (f) => f !== filePath && !f.startsWith(filePath + "/"),
        );
        await vscode.workspace.fs.writeFile(
          metadataUri,
          Buffer.from(JSON.stringify(metadata, null, 2), "utf8"),
        );
      }
    } catch (e) {
      console.error(
        `[BackupManager] Failed to update metadata for deletion: ${e}`,
      );
    }
  }

  /**
   * Clean up backup folder for a conversation
   */
  async cleanupBackup(conversationId: string): Promise<void> {
    const backupFolder = this.getBackupFolderPath(conversationId);

    try {
      await vscode.workspace.fs.delete(vscode.Uri.file(backupFolder), {
        recursive: true,
        useTrash: false,
      });
      console.log(
        `[BackupManager] Cleaned up backup for conversation: ${conversationId}`,
      );
    } catch (error) {
      console.error(`[BackupManager] Failed to cleanup backup: ${error}`);
    }
  }
}
