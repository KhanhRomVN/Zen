import * as vscode from "vscode";
import * as path from "path";
import { TextDecoder, TextEncoder } from "util";

export class GlobalStorageManager {
  private readonly storageUri: vscode.Uri;
  private readonly storageDir: vscode.Uri;
  private _listCache: Map<string, { result: string[]; timestamp: number }> =
    new Map();
  private readonly LIST_CACHE_TTL = 5 * 60 * 1000; // 5 minutes
  private _getCache: Map<string, { value: string; timestamp: number }> =
    new Map();
  private readonly GET_CACHE_TTL = 2000; // 2 seconds

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
    const startTime = Date.now();

    // Check cache first
    const cached = this._getCache.get(key);
    if (cached && Date.now() - cached.timestamp < this.GET_CACHE_TTL) {
      return cached.value;
    }

    // Check if key exists first to avoid error logs for missing keys
    if (!(await this.exists(key))) {
      return undefined;
    }
    try {
      const fileUri = this.getKeyUri(key);
      const content = await vscode.workspace.fs.readFile(fileUri);
      const decoded = new TextDecoder().decode(content);

      // Store in cache
      this._getCache.set(key, { value: decoded, timestamp: Date.now() });

      return decoded;
    } catch (error) {
      // File not found or read error
      return undefined;
    }
  }

  async set(key: string, value: string): Promise<void> {
    const startTime = Date.now();
    try {
      const fileUri = this.getKeyUri(key);
      const content = new TextEncoder().encode(value);
      await vscode.workspace.fs.writeFile(fileUri, content);

      // Invalidate cache for this key
      this._getCache.delete(key);
      this._listCache.clear(); // Clear list cache since data changed
    } catch (error) {
      throw new Error(`Failed to write storage for key ${key}: ${error}`);
    }
  }

  async delete(key: string): Promise<void> {
    try {
      const fileUri = this.getKeyUri(key);
      await vscode.workspace.fs.delete(fileUri, { useTrash: false });

      // Invalidate cache for this key
      this._getCache.delete(key);
      this._listCache.clear(); // Clear list cache since data changed
    } catch (error) {
      // Ignore if file doesn't exist
    }
  }

  async list(prefix?: string): Promise<string[]> {
    const startTime = Date.now();
    const cacheKey = prefix || "all";
    const cached = this._listCache.get(cacheKey);

    // Return cached result if still valid
    if (cached && Date.now() - cached.timestamp < this.LIST_CACHE_TTL) {
      return cached.result;
    }

    try {
      const entries = await vscode.workspace.fs.readDirectory(this.storageDir);
      const keys = entries
        .filter(([_, type]) => type === vscode.FileType.File)
        .map(([name]) => this.filenameToKey(name));

      const result = prefix
        ? keys.filter((key) => key.startsWith(prefix))
        : keys;

      // Store in cache
      this._listCache.set(cacheKey, { result, timestamp: Date.now() });

      return result;
    } catch (error) {
      // console.error("[Storage] Failed to list keys:", error);
      return [];
    }
  }

  /**
   * Find toolOutputs for a conversation by scanning all zen-chat keys matching the conversationId.
   * The key format is: zen-chat:<tabId>:<folderPath>:<conversationId>
   */
  async getToolOutputsForConversation(
    conversationId: string,
  ): Promise<
    | Record<string, { output: string; isError: boolean; terminalId?: string }>
    | undefined
  > {
    try {
      const allKeys = await this.list("zen-chat:");
      const matchingKeys = allKeys.filter((k) =>
        k.endsWith(`:${conversationId}`),
      );
      for (const key of matchingKeys) {
        const raw = await this.get(key);
        if (!raw) continue;
        try {
          const parsed = JSON.parse(raw);
          if (
            parsed.toolOutputs &&
            Object.keys(parsed.toolOutputs).length > 0
          ) {
            return parsed.toolOutputs;
          }
        } catch {}
      }
      return undefined;
    } catch {
      return undefined;
    }
  }
}
