/**
 *? Usage:
 *    Lưu và truy xuất snapshot trước/sau của thao tác file (write/replace/revert) để mở diff view.
 *
 *? Function:
 *    saveSnapshot(): Lưu snapshot (beforeContent, afterContent) theo actionId.
 *    getSnapshot() : Lấy snapshot theo conversationId + actionId.
 */
import * as crypto from "crypto";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import * as vscode from "vscode";

export interface Snapshot {
  filePath: string;
  operation: "write" | "replace" | "revert";
  beforeContent: string | null;
  afterContent: string;
  timestamp: number;
}

const IGNORED_PATHS = [".git", "khanhromvn-zen", "node_modules", ".vscode"];

export class SnapshotManager {
  private static instance: SnapshotManager;

  private constructor() {}

  public static getInstance(): SnapshotManager {
    if (!SnapshotManager.instance) {
      SnapshotManager.instance = new SnapshotManager();
    }
    return SnapshotManager.instance;
  }

  private getSnapshotsDir(conversationId: string): string {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) throw new Error("No workspace folder open");
    const hash = crypto
      .createHash("md5")
      .update(workspaceFolder.uri.fsPath)
      .digest("hex");
    const projectContextDir = path.join(os.homedir(), "khanhromvn-zen", "projects", hash);
    return path.join(projectContextDir, conversationId, "snapshots");
  }

  public async saveSnapshot(
    conversationId: string,
    actionId: string,
    filePath: string,
    operation: "write" | "replace" | "revert",
    beforeContent: string | null,
    afterContent: string,
  ): Promise<void> {
    try {
      // Skip ignored paths
      for (const ignored of IGNORED_PATHS) {
        if (filePath.includes(ignored)) {
          return;
        }
      }

      const snapshotsDir = this.getSnapshotsDir(conversationId);
      await fs.promises.mkdir(snapshotsDir, { recursive: true });

      const snapshot: Snapshot = {
        filePath,
        operation,
        beforeContent,
        afterContent,
        timestamp: Date.now(),
      };

      const snapshotFilePath = path.join(snapshotsDir, `${actionId}.json`);
      await fs.promises.writeFile(snapshotFilePath, JSON.stringify(snapshot, null, 2), "utf-8");
    } catch (_error) {
      // Silently ignore all errors — never affect file write result
    }
  }

  public async getSnapshot(
    conversationId: string,
    actionId: string,
  ): Promise<Snapshot | null> {
    try {
      const snapshotsDir = this.getSnapshotsDir(conversationId);
      const snapshotFilePath = path.join(snapshotsDir, `${actionId}.json`);
      const raw = await fs.promises.readFile(snapshotFilePath, "utf-8");
      return JSON.parse(raw) as Snapshot;
    } catch (_error) {
      return null;
    }
  }
}
