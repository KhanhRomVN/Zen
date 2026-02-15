import * as vscode from "vscode";
import * as path from "path";
import { TextDecoder, TextEncoder } from "util";

export class GlobalStorageManager {
  private readonly storageUri: vscode.Uri;
  private readonly storageDir: vscode.Uri;

  constructor(private readonly context: vscode.ExtensionContext) {
    this.storageUri = context.globalStorageUri;
    this.storageDir = vscode.Uri.joinPath(this.storageUri, "storage");
  }

  /**
   * Initialize storage (create directory if not exists)
   */
  async initialize(): Promise<void> {
    try {
      await vscode.workspace.fs.createDirectory(this.storageDir);
    } catch (error) {
      // console.error("[Storage] Failed to create storage directory:", error);
    }
  }

  /**
   * Migrate data from globalState to file storage
   * Only migrates keys starting with "zen-conversation" to avoid moving small settings
   */
  async migrateFromGlobalState(): Promise<void> {
    const keys = this.context.globalState.keys();
    const migratedKeys: string[] = [];

    for (const key of keys) {
      // Only migrate conversation data
      if (key.startsWith("zen-conversation")) {
        try {
          // Check if already exists in file storage
          const exists = await this.exists(key);
          if (exists) {
            // Already migrated, just delete from globalState
            await this.context.globalState.update(key, undefined);
            continue;
          }

          const value = this.context.globalState.get<string>(key);
          if (value) {
            await this.set(key, value);
            migratedKeys.push(key);
            // Delete from globalState after successful write
            await this.context.globalState.update(key, undefined);
          }
        } catch (error) {
          // console.error(`[Storage] Failed to migrate key ${key}:`, error);
        }
      }
    }

    if (migratedKeys.length > 0) {
    }
  }

  /**
   * Safe encode key to filename
   * Base64 encode to handle special characters safely
   */
  private keyToFilename(key: string): string {
    return Buffer.from(key).toString("base64") + ".json";
  }

  /**
   * Decode filename back to key
   */
  private filenameToKey(filename: string): string {
    const base = path.basename(filename, ".json");
    return Buffer.from(base, "base64").toString("utf8");
  }

  private getKeyUri(key: string): vscode.Uri {
    return vscode.Uri.joinPath(this.storageDir, this.keyToFilename(key));
  }

  async exists(key: string): Promise<boolean> {
    try {
      await vscode.workspace.fs.stat(this.getKeyUri(key));
      return true;
    } catch {
      return false;
    }
  }

  async get(key: string): Promise<string | undefined> {
    try {
      const fileUri = this.getKeyUri(key);
      const content = await vscode.workspace.fs.readFile(fileUri);
      return new TextDecoder().decode(content);
    } catch (error) {
      // File not found or read error
      return undefined;
    }
  }

  async set(key: string, value: string): Promise<void> {
    try {
      const fileUri = this.getKeyUri(key);
      const content = new TextEncoder().encode(value);
      await vscode.workspace.fs.writeFile(fileUri, content);
    } catch (error) {
      throw new Error(`Failed to write storage for key ${key}: ${error}`);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const fileUri = this.getKeyUri(key);
      await vscode.workspace.fs.delete(fileUri, { useTrash: false });
    } catch (error) {
      // Ignore if file doesn't exist
    }
  }

  async list(prefix?: string): Promise<string[]> {
    try {
      const entries = await vscode.workspace.fs.readDirectory(this.storageDir);
      const keys = entries
        .filter(([_, type]) => type === vscode.FileType.File)
        .map(([name]) => this.filenameToKey(name));

      if (prefix) {
        return keys.filter((key) => key.startsWith(prefix));
      }
      return keys;
    } catch (error) {
      // console.error("[Storage] Failed to list keys:", error);
      return [];
    }
  }
}
