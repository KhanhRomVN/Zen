import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";
import * as os from "os";
import * as vscode from "vscode";

export interface Checkpoint {
  id: string;
  type: "create" | "modify" | "delete";
  filePath: string;
  content: string | null;
  timestamp: number;
}

export class CheckpointManager {
  private static instance: CheckpointManager;
  private activeConversationId: string | null = null;

  private constructor() {}

  public static getInstance(): CheckpointManager {
    if (!CheckpointManager.instance) {
      CheckpointManager.instance = new CheckpointManager();
    }
    return CheckpointManager.instance;
  }

  public setActiveConversationId(conversationId: string | null) {
    this.activeConversationId = conversationId;
  }

  public getActiveConversationId(): string | null {
    return this.activeConversationId;
  }

  private getCheckpointsDir(conversationId: string): string {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) throw new Error("No workspace folder open");
    const hash = crypto
      .createHash("md5")
      .update(workspaceFolder.uri.fsPath)
      .digest("hex");
    const projectContextDir = path.join(
      os.homedir(),
      "khanhromvn-zen",
      "projects",
      hash,
    );
    return path.join(projectContextDir, conversationId, "checkpoints");
  }

  public async createCheckpoint(
    filePath: string,
    type: "create" | "modify" | "delete",
  ) {
    if (!this.activeConversationId) return;

    try {
      // Avoid checkpointing internal configuration directories or git files
      if (
        filePath.includes(".git") ||
        filePath.includes("khanhromvn-zen") ||
        filePath.includes("node_modules") ||
        filePath.includes(".vscode")
      ) {
        return;
      }

      const ckptDir = this.getCheckpointsDir(this.activeConversationId);
      await fs.promises.mkdir(ckptDir, { recursive: true });

      let content: string | null = null;
      if (type === "modify" || type === "delete") {
        if (fs.existsSync(filePath)) {
          const stats = await fs.promises.stat(filePath);
          if (stats.isFile()) {
            content = await fs.promises.readFile(filePath, "utf-8");
          } else {
            // Only checkpoint files, directories are ignored (we will recurse files in directories during delete)
            return;
          }
        } else {
          return;
        }
      }

      const timestamp = Date.now();
      const id = `ckpt_${timestamp}_${crypto.randomBytes(4).toString("hex")}`;
      const checkpoint: Checkpoint = {
        id,
        type,
        filePath,
        content,
        timestamp,
      };

      const ckptFilePath = path.join(ckptDir, `${id}.json`);
      await fs.promises.writeFile(
        ckptFilePath,
        JSON.stringify(checkpoint, null, 2),
        "utf-8",
      );
    } catch (error) {}
  }

  public async revertToCheckpoint(
    conversationId: string,
    revertTimestamp: number,
  ) {
    try {
      const ckptDir = this.getCheckpointsDir(conversationId);
      if (!fs.existsSync(ckptDir)) {
        return;
      }

      const files = await fs.promises.readdir(ckptDir);
      const checkpoints: Checkpoint[] = [];

      for (const file of files) {
        if (file.startsWith("ckpt_") && file.endsWith(".json")) {
          const filePath = path.join(ckptDir, file);
          try {
            const raw = await fs.promises.readFile(filePath, "utf-8");
            const ckpt: Checkpoint = JSON.parse(raw);
            if (ckpt.timestamp > revertTimestamp) {
              checkpoints.push({ ...ckpt, id: file });
            }
          } catch (e) {}
        }
      }

      if (checkpoints.length === 0) {
        return;
      }

      // Sort by timestamp descending to revert in reverse chronological order (newest first)
      checkpoints.sort((a, b) => b.timestamp - a.timestamp);

      for (const ckpt of checkpoints) {
        try {
          if (ckpt.type === "create") {
            if (fs.existsSync(ckpt.filePath)) {
              await fs.promises.unlink(ckpt.filePath);
            }
          } else if (ckpt.type === "modify" || ckpt.type === "delete") {
            if (ckpt.content !== null) {
              const dir = path.dirname(ckpt.filePath);
              await fs.promises.mkdir(dir, { recursive: true });
              await fs.promises.writeFile(ckpt.filePath, ckpt.content, "utf-8");
            }
          }

          // Clean up checkpoint file
          const ckptJsonPath = path.join(ckptDir, ckpt.id);
          await fs.promises.unlink(ckptJsonPath).catch(() => {});
        } catch (err: any) {}
      }
    } catch (error) {}
  }
}
