import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import * as crypto from "crypto";
import * as os from "os";
import { ContextManager } from "../../context/ContextManager";
import { FileLockManager } from "../../managers/FileLockManager";
import { RecentItemsManager } from "../../context/RecentItemsManager";
import { FuzzyMatcher } from "../../utils/FuzzyMatcher";
import { CheckpointManager } from "../../utils/CheckpointManager";
import { SnapshotManager } from "../../utils/SnapshotManager";
import { SecurityValidator } from "../../agent/validators/SecurityValidator";
import { LoggerService } from "../../services/LoggerService";

export class FileHandler {
  private _workspaceFilesCache: any[] | null = null;
  private _workspaceFoldersCache: any[] | null = null;
  private _lastCacheUpdate: number = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  // Sequential queuing for file operations to prevent race conditions
  private _readFileQueue: Promise<void> = Promise.resolve();
  private _writeFileQueue: Promise<void> = Promise.resolve();
  private _replaceFileQueue: Promise<void> = Promise.resolve();

  constructor(
    private contextManager: ContextManager,
    private fileLockManager: FileLockManager,
    private recentItemsManager: RecentItemsManager | undefined,
  ) {}

  private resolveWorkspacePath(
    workspaceFolder: vscode.WorkspaceFolder,
    pathValue: string,
  ): vscode.Uri {
    if (path.isAbsolute(pathValue)) {
      return vscode.Uri.file(pathValue);
    }
    return vscode.Uri.joinPath(workspaceFolder.uri, pathValue);
  }

  private async resolveWorkspacePathWithFallback(
    workspaceFolder: vscode.WorkspaceFolder,
    pathValue: string,
  ): Promise<vscode.Uri> {
    const candidates = path.isAbsolute(pathValue)
      ? [
          vscode.Uri.file(pathValue),
          vscode.Uri.joinPath(workspaceFolder.uri, pathValue),
        ]
      : [
          vscode.Uri.joinPath(workspaceFolder.uri, pathValue),
          vscode.Uri.file(pathValue),
        ];

    let lastError: unknown;
    for (const uri of candidates) {
      try {
        await vscode.workspace.fs.stat(uri);
        return uri;
      } catch (e) {
        lastError = e;
      }
    }
    throw lastError;
  }

  private getContextRoot(): string {
    return path.join(os.homedir(), "khanhromvn-zen");
  }

  private getProjectContextDir(workspaceFolderPath: string): string {
    const hash = crypto
      .createHash("md5")
      .update(workspaceFolderPath)
      .digest("hex");
    return path.join(this.getContextRoot(), "projects", hash);
  }

  /**
   * Enqueues a function to execute sequentially for read operations.
   * Prevents concurrent file opening/diagnostics collection which causes race conditions.
   */
  private enqueueReadOperation<T>(operation: () => Promise<T>): Promise<T> {
    const logger = LoggerService.getInstance();
    this._readFileQueue = this._readFileQueue
      .then(() => operation())
      .catch((err) => {
        logger.error("[enqueueReadOperation] Error in queued operation", {
          error: err.message,
        });
        throw err;
      }) as Promise<void>;
    return this._readFileQueue as Promise<T>;
  }

  /**
   * Enqueues a function to execute sequentially for write operations.
   * Prevents concurrent file opening/diagnostics collection which causes race conditions.
   */
  private enqueueWriteOperation<T>(operation: () => Promise<T>): Promise<T> {
    const logger = LoggerService.getInstance();
    this._writeFileQueue = this._writeFileQueue
      .then(() => operation())
      .catch((err) => {
        logger.error("[enqueueWriteOperation] Error in queued operation", {
          error: err.message,
        });
        throw err;
      }) as Promise<void>;
    return this._writeFileQueue as Promise<T>;
  }

  /**
   * Enqueues a function to execute sequentially for replace operations.
   * Prevents concurrent file opening/diagnostics collection which causes race conditions.
   */
  private enqueueReplaceOperation<T>(operation: () => Promise<T>): Promise<T> {
    const logger = LoggerService.getInstance();
    this._replaceFileQueue = this._replaceFileQueue
      .then(() => operation())
      .catch((err) => {
        logger.error("[enqueueReplaceOperation] Error in queued operation", {
          error: err.message,
        });
        throw err;
      }) as Promise<void>;
    return this._replaceFileQueue as Promise<T>;
  }

  private getDiagnosticsForFile(uri: vscode.Uri): Array<{
    severity: string;
    message: string;
    line: number;
    column: number;
    source?: string;
    code?: string | number;
  }> {
    const diagnostics = vscode.languages.getDiagnostics(uri);

    const filtered = diagnostics
      .filter(
        (d) =>
          d.severity === vscode.DiagnosticSeverity.Error ||
          d.severity === vscode.DiagnosticSeverity.Warning,
      )
      .map((d) => ({
        severity:
          d.severity === vscode.DiagnosticSeverity.Error ? "Error" : "Warning",
        message: d.message,
        line: d.range.start.line + 1, // 1-indexed for display
        column: d.range.start.character + 1, // 1-indexed for display
        source: d.source,
        code: d.code
          ? typeof d.code === "object"
            ? d.code.value
            : d.code
          : undefined,
      }));

    return filtered;
  }

  private getDiagnosticCountForFile(uri: vscode.Uri): {
    errorCount: number;
    warningCount: number;
  } {
    const diagnostics = vscode.languages.getDiagnostics(uri);

    const errorCount = diagnostics.filter(
      (d) => d.severity === vscode.DiagnosticSeverity.Error,
    ).length;

    const warningCount = diagnostics.filter(
      (d) => d.severity === vscode.DiagnosticSeverity.Warning,
    ).length;

    return { errorCount, warningCount };
  }

  /**
   * Ensures file is opened in VS Code to trigger language server analysis.
   * Does not close the file - keeps it open for diagnostics cache.
   */
  private async ensureFileOpened(uri: vscode.Uri): Promise<void> {
    const logger = LoggerService.getInstance();
    try {
      // Check if file is already open (in workspace, not just visible)
      const isAlreadyOpen = vscode.workspace.textDocuments.some(
        (doc) => doc.uri.fsPath === uri.fsPath,
      );

      if (isAlreadyOpen) {
        // File already open, nothing to do
        logger.info("[ensureFileOpened] File already open, skipping", {
          file: uri.fsPath,
        });
        return;
      }

      logger.info("[ensureFileOpened] Opening file for the first time", {
        file: uri.fsPath,
      });

      // Open the document and show it to trigger language server
      const doc = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(doc, {
        preview: true,
        viewColumn: vscode.ViewColumn.Active,
      });

      logger.info("[ensureFileOpened] File opened successfully", {
        file: uri.fsPath,
      });
    } catch (e) {
      // Silently ignore errors - file might not exist yet or other issues
      logger.error("[ensureFileOpened] Error opening file", {
        file: uri.fsPath,
        error: e,
      });
    }
  }

  public async handleReadFile(message: any, webviewView: vscode.WebviewView) {
    const logger = LoggerService.getInstance();
    logger.info(`[handleReadFile] 📥 Enqueuing read operation`, {
      path: message.path || message.filePath || message.file_path,
      requestId: message.requestId,
    });

    try {
      // Enqueue this operation to prevent concurrent language server overload
      await this.enqueueReadOperation(async () => {
        await this._handleReadFileInternal(message, webviewView);
      });
    } catch (e: any) {
      logger.error(`[handleReadFile] Failed to complete queued operation`, {
        path: message.path || message.filePath || message.file_path,
        error: e.message,
      });
      // Error response already sent by _handleReadFileInternal
    }
  }

  private async _handleReadFileInternal(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) throw new Error("No workspace");
      const pathValue = message.path || message.filePath || message.file_path;
      if (!pathValue)
        throw new Error("The 'path' argument must be of type string.");

      let absPath: vscode.Uri;
      if (pathValue.endsWith("workspace.md")) {
        const pcDir = this.getProjectContextDir(workspaceFolder.uri.fsPath);
        await fs.promises.mkdir(pcDir, { recursive: true });
        absPath = vscode.Uri.file(path.join(pcDir, path.basename(pathValue)));
      } else {
        absPath = await this.resolveWorkspacePathWithFallback(
          workspaceFolder,
          pathValue,
        );
      }

      // Security Check
      const securityCheck = SecurityValidator.validatePath(
        absPath.fsPath,
        false,
      );
      if (!securityCheck.safe) {
        throw new Error(securityCheck.reason || "Security validation failed");
      }

      // File existence check (early detection before waiting for diagnostics)
      if (!pathValue.endsWith("workspace.md")) {
        const fileExists = fs.existsSync(absPath.fsPath);
        if (!fileExists) {
          throw new Error(
            `File not found: ${pathValue}`,
          );
        }
      }

      const fsAnalyzer = this.contextManager.getFileSystemAnalyzer();
      const ignoreCheck = await fsAnalyzer.isIgnored(absPath.fsPath);
      if (
        ignoreCheck.ignored &&
        !pathValue.endsWith("workspace.md") &&
        !message.bypassIgnore
      ) {
        throw new Error(
          `Path '${pathValue}' is out of scope (ignored by .gitignore or project settings).`,
        );
      }

      // Ensure file is opened to trigger language server (BEFORE reading content)
      if (!message.skipDiagnostics) {
        await this.ensureFileOpened(absPath);

        // Wait for diagnostics from language server with event-based approach
        const logger = LoggerService.getInstance();
        await new Promise<void>((resolve) => {
          const maxTimeout = 300000; // 5 minutes maximum (for extremely large files)
          const stableWaitTime = 800; // Wait 800ms of no new diagnostic events before considering "stable"
          const startTime = Date.now();

          let lastDiagnosticEventTime = Date.now();
          let diagnosticStableTimeout: NodeJS.Timeout | null = null;
          let hasReceivedEvent = false;

          logger.info(
            `[_handleReadFileInternal] ⏳ Starting diagnostics wait (event-driven)`,
            {
              path: pathValue,
              maxTimeout,
              stableWaitTime,
            },
          );

          const timeoutHandle = setTimeout(() => {
            const elapsedTime = Date.now() - startTime;
            logger.warn(`[_handleReadFileInternal] ⏱️ Safety timeout reached`, {
              path: pathValue,
              elapsedTime,
              hasReceivedEvent,
            });
            if (diagnosticStableTimeout) {
              clearTimeout(diagnosticStableTimeout);
            }
            disposable?.dispose();
            resolve();
          }, maxTimeout);

          const disposable = vscode.languages.onDidChangeDiagnostics((e) => {
            const isOurFile = e.uris.some(
              (uri) => uri.fsPath === absPath.fsPath,
            );

            if (isOurFile) {
              const elapsedTime = Date.now() - startTime;
              lastDiagnosticEventTime = Date.now();
              hasReceivedEvent = true;

              if (diagnosticStableTimeout) {
                clearTimeout(diagnosticStableTimeout);
              }

              const currentDiagnostics = this.getDiagnosticsForFile(absPath);
              logger.info(
                `[_handleReadFileInternal] 🔔 Diagnostics event received`,
                {
                  path: pathValue,
                  elapsedTime,
                  diagnosticsCount: currentDiagnostics.length,
                },
              );

              diagnosticStableTimeout = setTimeout(() => {
                const finalDiagnostics = this.getDiagnosticsForFile(absPath);
                const finalElapsedTime = Date.now() - startTime;
                clearTimeout(timeoutHandle);
                disposable.dispose();
                logger.info(
                  `[_handleReadFileInternal] ✅ Diagnostics stable, resolving`,
                  {
                    path: pathValue,
                    elapsedTime: finalElapsedTime,
                    diagnosticsCount: finalDiagnostics.length,
                  },
                );
                resolve();
              }, stableWaitTime);
            }
          });
        });
      }

      let content = "";
      try {
        content = Buffer.from(
          await vscode.workspace.fs.readFile(absPath),
        ).toString("utf8");
      } catch (e: any) {
        if (pathValue.endsWith("workspace.md")) {
          content = "";
        } else {
          throw e;
        }
      }

      if (message.startLine !== undefined) {
        const lines = content.split(/\r?\n/);
        const end =
          message.endLine !== undefined ? message.endLine + 1 : lines.length;
        content = lines.slice(message.startLine || 0, end).join("\n");
      }
      const diagnostics = this.getDiagnosticsForFile(absPath);

      webviewView.webview.postMessage({
        command: "fileContent",
        requestId: message.requestId,
        path: pathValue,
        content,
        diagnostics: diagnostics.length ? diagnostics : undefined,
      });
    } catch (e: any) {
      webviewView.webview.postMessage({
        command: "fileContent",
        requestId: message.requestId,
        error: e.message,
      });
    }
  }

  public async handleWriteFile(message: any, webviewView: vscode.WebviewView) {
    const logger = LoggerService.getInstance();
    logger.info(`[handleWriteFile] 📥 Enqueuing write operation`, {
      path: message.path || message.filePath || message.file_path,
      requestId: message.requestId,
    });

    try {
      // Enqueue this operation to prevent concurrent language server overload
      await this.enqueueWriteOperation(async () => {
        await this._handleWriteFileInternal(message, webviewView);
      });
    } catch (e: any) {
      logger.error(`[handleWriteFile] Failed to complete queued operation`, {
        path: message.path || message.filePath || message.file_path,
        error: e.message,
      });
      // Error response already sent by _handleWriteFileInternal
    }
  }

  private async _handleWriteFileInternal(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    const logger = LoggerService.getInstance();
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) throw new Error("No workspace");
      const pathValue = message.path || message.filePath || message.file_path;
      if (!pathValue)
        throw new Error("The 'path' argument must be of type string.");

      logger.info(`[_handleWriteFileInternal] Start`, {
        path: pathValue,
        contentLength: message.content?.length,
        requestId: message.requestId,
      });

      let absolutePath: vscode.Uri;
      if (pathValue.endsWith("workspace.md")) {
        const pcDir = this.getProjectContextDir(workspaceFolder.uri.fsPath);
        await fs.promises.mkdir(pcDir, { recursive: true });
        absolutePath = vscode.Uri.file(
          path.join(pcDir, path.basename(pathValue)),
        );
      } else {
        absolutePath = this.resolveWorkspacePath(workspaceFolder, pathValue);
      }

      // Security Check
      const securityCheck = SecurityValidator.validatePath(
        absolutePath.fsPath,
        true,
      );
      if (!securityCheck.safe) {
        throw new Error(securityCheck.reason || "Security validation failed");
      }

      const release = await this.fileLockManager.acquire(absolutePath.fsPath);
      try {
        if (message.conversationId) {
          CheckpointManager.getInstance().setActiveConversationId(
            message.conversationId,
          );
        }
        const fileExists = fs.existsSync(absolutePath.fsPath);
        let beforeContent: string | null = null;
        if (fileExists) {
          try {
            beforeContent = await fs.promises.readFile(
              absolutePath.fsPath,
              "utf-8",
            );
          } catch {
            beforeContent = null;
          }
        }
        await CheckpointManager.getInstance().createCheckpoint(
          absolutePath.fsPath,
          fileExists ? "modify" : "create",
        );

        await vscode.workspace.fs.createDirectory(
          vscode.Uri.joinPath(absolutePath, ".."),
        );
        await vscode.workspace.fs.writeFile(
          absolutePath,
          Buffer.from(message.content, "utf8"),
        );
        logger.info(`[_handleWriteFileInternal] File written successfully`, {
          path: pathValue,
        });

        if (message.conversationId && message.actionId) {
          await SnapshotManager.getInstance().saveSnapshot(
            message.conversationId,
            message.actionId,
            absolutePath.fsPath,
            "write",
            beforeContent,
            message.content,
          );
        }
      } finally {
        release();
      }

      if (!message.skipDiagnostics) {
        try {
          const doc = await vscode.workspace.openTextDocument(absolutePath);
          // Show document in editor to trigger language server analysis
          await vscode.window.showTextDocument(doc, {
            preview: false,
            preserveFocus: true, // Don't steal focus from webview
          });
        } catch {}

        // Wait for diagnostics from language server with event-based approach
        await new Promise<void>((resolve) => {
          const maxTimeout = 30000; // 30 seconds safety timeout
          const stableWaitTime = 800; // Wait 800ms of no new diagnostic events before considering "stable"
          const startTime = Date.now();

          let lastDiagnosticEventTime = Date.now();
          let diagnosticStableTimeout: NodeJS.Timeout | null = null;
          let hasReceivedEvent = false; // Track if we've received at least one event

          logger.info(
            `[_handleWriteFileInternal] ⏳ Starting diagnostics wait (event-driven)`,
            {
              path: pathValue,
              maxTimeout,
              stableWaitTime,
            },
          );

          const timeoutHandle = setTimeout(() => {
            const elapsedTime = Date.now() - startTime;
            logger.warn(
              `[_handleWriteFileInternal] ⏱️ Safety timeout reached`,
              {
                path: pathValue,
                elapsedTime,
                hasReceivedEvent,
              },
            );
            if (diagnosticStableTimeout) {
              clearTimeout(diagnosticStableTimeout);
            }
            disposable?.dispose();
            resolve();
          }, maxTimeout);

          const disposable = vscode.languages.onDidChangeDiagnostics((e) => {
            const affectedPaths = e.uris.map((uri) => uri.fsPath);
            const isOurFile = e.uris.some(
              (uri) => uri.fsPath === absolutePath.fsPath,
            );

            if (isOurFile) {
              const elapsedTime = Date.now() - startTime;
              lastDiagnosticEventTime = Date.now();
              hasReceivedEvent = true;

              // Clear any existing stable timeout
              if (diagnosticStableTimeout) {
                clearTimeout(diagnosticStableTimeout);
              }

              const currentDiagnostics =
                this.getDiagnosticsForFile(absolutePath);
              logger.info(
                `[_handleWriteFileInternal] 🔔 Diagnostics event received`,
                {
                  path: pathValue,
                  elapsedTime,
                  diagnosticsCount: currentDiagnostics.length,
                  affectedPaths,
                },
              );

              // Wait for diagnostics to become stable (no new events for stableWaitTime)
              diagnosticStableTimeout = setTimeout(() => {
                const finalDiagnostics =
                  this.getDiagnosticsForFile(absolutePath);
                const finalElapsedTime = Date.now() - startTime;
                clearTimeout(timeoutHandle);
                disposable.dispose();
                logger.info(
                  `[_handleWriteFileInternal] ✅ Diagnostics stable, resolving`,
                  {
                    path: pathValue,
                    elapsedTime: finalElapsedTime,
                    diagnosticsCount: finalDiagnostics.length,
                    timeSinceLastEvent: Date.now() - lastDiagnosticEventTime,
                  },
                );
                resolve();
              }, stableWaitTime);
            }
          });
        });

        const diagnostics = this.getDiagnosticsForFile(absolutePath);
        logger.info(
          `[_handleWriteFileInternal] 📊 Final diagnostics collection`,
          {
            path: pathValue,
            diagnosticsCount: diagnostics.length,
            hasDiagnostics: diagnostics.length > 0,
          },
        );

        if (diagnostics.length) {
          logger.warn(`[_handleWriteFileInternal] Diagnostics found`, {
            path: pathValue,
            count: diagnostics.length,
            diagnostics: diagnostics.map((d) => ({
              severity: d.severity,
              line: d.line,
              message: d.message.substring(0, 100),
            })),
          });
        }

        // ALWAYS send diagnostics field (even if empty) for consistency
        webviewView.webview.postMessage({
          command: "writeFileResult",
          requestId: message.requestId,
          path: pathValue,
          success: true,
          diagnostics: diagnostics, // Always include, even if empty array
        });
      } else {
        // When skipping diagnostics, send empty array to indicate "no diagnostics checked"
        webviewView.webview.postMessage({
          command: "writeFileResult",
          requestId: message.requestId,
          path: pathValue,
          success: true,
          diagnostics: [], // Empty array = diagnostics not checked
        });
      }
    } catch (e: any) {
      logger.error(`[_handleWriteFileInternal] Error`, {
        path: message.path || message.filePath || message.file_path,
        error: e.message,
      });
      webviewView.webview.postMessage({
        command: "writeFileResult",
        requestId: message.requestId,
        path: message.path || message.filePath || message.file_path,
        error: e.message,
      });
    }
  }

  public async handleReplaceInFile(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    const logger = LoggerService.getInstance();
    logger.info(`[handleReplaceInFile] 📥 Enqueuing replace operation`, {
      path: message.path || message.filePath || message.file_path,
      requestId: message.requestId,
    });

    try {
      // Enqueue this operation to prevent concurrent language server overload
      await this.enqueueReplaceOperation(async () => {
        await this._handleReplaceInFileInternal(message, webviewView);
      });
    } catch (e: any) {
      logger.error(
        `[handleReplaceInFile] Failed to complete queued operation`,
        {
          path: message.path || message.filePath || message.file_path,
          error: e.message,
        },
      );
      // Error response already sent by _handleReplaceInFileInternal
    }
  }

  private async _handleReplaceInFileInternal(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    const logger = LoggerService.getInstance();
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;
    const pathValue = message.path || message.filePath || message.file_path;
    if (!pathValue) {
      webviewView.webview.postMessage({
        command: "replaceInFileResult",
        requestId: message.requestId,
        error: "The 'path' argument must be of type string.",
      });
      return;
    }

    logger.info(`[_handleReplaceInFileInternal] Start`, {
      path: pathValue,
      hasOldStr: !!message.old_str,
      hasNewStr: !!message.new_str,
      hasDiff: !!message.diff,
      requestId: message.requestId,
    });

    let absPath: vscode.Uri;
    if (pathValue.endsWith("workspace.md")) {
      const pcDir = this.getProjectContextDir(workspaceFolder.uri.fsPath);
      await fs.promises.mkdir(pcDir, { recursive: true });
      absPath = vscode.Uri.file(path.join(pcDir, path.basename(pathValue)));
    } else {
      try {
        absPath = await this.resolveWorkspacePathWithFallback(
          workspaceFolder,
          pathValue,
        );
      } catch {
        absPath = this.resolveWorkspacePath(workspaceFolder, pathValue);
      }
    }

    // Security Check
    const securityCheck = SecurityValidator.validatePath(absPath.fsPath, true);
    if (!securityCheck.safe) {
      webviewView.webview.postMessage({
        command: "replaceInFileResult",
        requestId: message.requestId,
        error: securityCheck.reason || "Security validation failed",
      });
      return;
    }

    // Ensure file is opened to trigger language server (BEFORE replacing)
    if (!message.skipDiagnostics) {
      await this.ensureFileOpened(absPath);
    }

    if (message.conversationId) {
      CheckpointManager.getInstance().setActiveConversationId(
        message.conversationId,
      );
    }
    await CheckpointManager.getInstance().createCheckpoint(
      absPath.fsPath,
      "modify",
    );

    const release = await this.fileLockManager.acquire(absPath.fsPath);
    let newContent: string | undefined;

    try {
      let content = "";
      try {
        content = Buffer.from(
          await vscode.workspace.fs.readFile(absPath),
        ).toString("utf8");
      } catch (e: any) {
        if (!pathValue.endsWith("workspace.md")) {
          throw e;
        }
      }

      // Support both new schema (old_str/new_str) and legacy schema (diff)
      let searchArgs: string;
      let replaceArgs: string;

      if (message.old_str !== undefined && message.new_str !== undefined) {
        // New schema: direct old_str and new_str
        const clean = (text: string) =>
          text.replace(/^```[a-zA-Z]*$/gm, "").trim();
        searchArgs = clean(message.old_str);
        replaceArgs = clean(message.new_str);

        logger.debug(
          `[_handleReplaceInFileInternal] Using new schema (old_str/new_str)`,
          {
            path: pathValue,
            searchLength: searchArgs.length,
            replaceLength: replaceArgs.length,
          },
        );
      } else if (message.diff !== undefined && message.diff !== null) {
        // Legacy schema: parse diff format
        const match = message.diff.match(
          /<<<<<<< SEARCH\s*\n([\s\S]*?)\s*=======\s*\n([\s\S]*?)(?:>>>>>>>|>)\s*REPLACE/,
        );
        if (!match) {
          logger.error(`[_handleReplaceInFileInternal] Invalid diff format`, {
            path: pathValue,
            diff: message.diff?.substring(0, 200),
          });
          throw new Error("Invalid diff format");
        }

        const clean = (text: string) =>
          text.replace(/^```[a-zA-Z]*$/gm, "").trim();
        searchArgs = clean(match[1]);
        replaceArgs = clean(match[2]);

        logger.debug(
          `[_handleReplaceInFileInternal] Using legacy schema (diff)`,
          {
            path: pathValue,
            searchLength: searchArgs.length,
            replaceLength: replaceArgs.length,
          },
        );
      } else {
        logger.error(
          `[_handleReplaceInFileInternal] Missing required parameters`,
          {
            path: pathValue,
            hasOldStr: message.old_str !== undefined,
            hasNewStr: message.new_str !== undefined,
            hasDiff: message.diff !== undefined,
            messageKeys: Object.keys(message),
          },
        );
        throw new Error("Missing old_str/new_str or diff parameter");
      }

      let target = searchArgs;
      if (content.indexOf(searchArgs) === -1) {
        logger.warn(
          `[_handleReplaceInFileInternal] Exact match not found, trying fuzzy`,
          {
            path: pathValue,
          },
        );
        const fuzzy = FuzzyMatcher.findMatch(content, searchArgs);
        if (!fuzzy || fuzzy.score <= 1e-9) {
          logger.error(`[_handleReplaceInFileInternal] Search text not found`, {
            path: pathValue,
          });
          throw new Error("Search text not found");
        }
        logger.info(`[_handleReplaceInFileInternal] Fuzzy match found`, {
          path: pathValue,
          score: fuzzy.score,
        });
        target = fuzzy.originalText;
      } else {
        logger.debug(`[_handleReplaceInFileInternal] Exact match found`, {
          path: pathValue,
        });
      }

      newContent = content.replace(target, replaceArgs);
      if (newContent === content) throw new Error("No change made");
      await vscode.workspace.fs.writeFile(
        absPath,
        Buffer.from(newContent, "utf8"),
      );
      logger.info(`[_handleReplaceInFileInternal] File updated successfully`, {
        path: pathValue,
      });

      if (message.conversationId && message.actionId && newContent) {
        await SnapshotManager.getInstance().saveSnapshot(
          message.conversationId,
          message.actionId,
          absPath.fsPath,
          "replace",
          content,
          newContent,
        );
      }
    } catch (e: any) {
      logger.error(`[_handleReplaceInFileInternal] Error during replace`, {
        path: pathValue,
        error: e.message,
      });
      webviewView.webview.postMessage({
        command: "replaceInFileResult",
        requestId: message.requestId,
        error: e.message,
      });
      release();
      return;
    }
    release();

    if (!message.skipDiagnostics) {
      try {
        await vscode.workspace.openTextDocument(absPath);
      } catch {}

      // Wait for diagnostics from language server with event-based approach
      await new Promise<void>((resolve) => {
        const maxTimeout = 30000; // 30 seconds safety timeout
        const stableWaitTime = 800; // Wait 800ms of no new diagnostic events before considering "stable"
        const startTime = Date.now();

        let lastDiagnosticEventTime = Date.now();
        let diagnosticStableTimeout: NodeJS.Timeout | null = null;
        let hasReceivedEvent = false; // Track if we've received at least one event

        logger.info(
          `[_handleReplaceInFileInternal] ⏳ Starting diagnostics wait (event-driven)`,
          {
            path: pathValue,
            maxTimeout,
            stableWaitTime,
          },
        );

        const timeoutHandle = setTimeout(() => {
          const elapsedTime = Date.now() - startTime;
          logger.warn(
            `[_handleReplaceInFileInternal] ⏱️ Safety timeout reached`,
            {
              path: pathValue,
              elapsedTime,
              hasReceivedEvent,
            },
          );
          if (diagnosticStableTimeout) {
            clearTimeout(diagnosticStableTimeout);
          }
          disposable?.dispose();
          resolve();
        }, maxTimeout);

        const disposable = vscode.languages.onDidChangeDiagnostics((e) => {
          const affectedPaths = e.uris.map((uri) => uri.fsPath);
          const isOurFile = e.uris.some((uri) => uri.fsPath === absPath.fsPath);

          if (isOurFile) {
            const elapsedTime = Date.now() - startTime;
            lastDiagnosticEventTime = Date.now();
            hasReceivedEvent = true;

            // Clear any existing stable timeout
            if (diagnosticStableTimeout) {
              clearTimeout(diagnosticStableTimeout);
            }

            const currentDiagnostics = this.getDiagnosticsForFile(absPath);
            logger.info(
              `[_handleReplaceInFileInternal] 🔔 Diagnostics event received`,
              {
                path: pathValue,
                elapsedTime,
                diagnosticsCount: currentDiagnostics.length,
                affectedPaths,
              },
            );

            // Wait for diagnostics to become stable (no new events for stableWaitTime)
            diagnosticStableTimeout = setTimeout(() => {
              const finalDiagnostics = this.getDiagnosticsForFile(absPath);
              const finalElapsedTime = Date.now() - startTime;
              clearTimeout(timeoutHandle);
              disposable.dispose();
              logger.info(
                `[_handleReplaceInFileInternal] ✅ Diagnostics stable, resolving`,
                {
                  path: pathValue,
                  elapsedTime: finalElapsedTime,
                  diagnosticsCount: finalDiagnostics.length,
                  timeSinceLastEvent: Date.now() - lastDiagnosticEventTime,
                },
              );
              resolve();
            }, stableWaitTime);
          }
        });
      });

      const diagnostics = this.getDiagnosticsForFile(absPath);
      logger.info(
        `[_handleReplaceInFileInternal] 📊 Final diagnostics collection`,
        {
          path: pathValue,
          diagnosticsCount: diagnostics.length,
          hasDiagnostics: diagnostics.length > 0,
        },
      );

      if (diagnostics.length) {
        logger.warn(`[_handleReplaceInFileInternal] Diagnostics found`, {
          path: pathValue,
          count: diagnostics.length,
          diagnostics: diagnostics.map((d) => ({
            severity: d.severity,
            line: d.line,
            message: d.message.substring(0, 100),
          })),
        });
      }

      // ALWAYS send diagnostics field (even if empty) for consistency
      webviewView.webview.postMessage({
        command: "replaceInFileResult",
        requestId: message.requestId,
        path: message.path,
        success: true,
        diagnostics: diagnostics, // Always include, even if empty array
        content: newContent,
      });
    } else {
      // When skipping diagnostics, send empty array to indicate "no diagnostics checked"
      webviewView.webview.postMessage({
        command: "replaceInFileResult",
        requestId: message.requestId,
        path: message.path,
        success: true,
        diagnostics: [], // Empty array = diagnostics not checked
      });
    }
  }

  public async handleAskBypassGitignore(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    try {
      const { path: pathValue, requestId } = message;
      if (!pathValue) throw new Error("Path is required");

      const fsAnalyzer = this.contextManager.getFileSystemAnalyzer();
      fsAnalyzer.addBypassPath(pathValue);

      webviewView.webview.postMessage({
        command: "askBypassGitignoreResult",
        requestId,
        path: pathValue,
        success: true,
      });
    } catch (error: any) {
      webviewView.webview.postMessage({
        command: "askBypassGitignoreResult",
        requestId: message.requestId,
        error: String(error),
      });
    }
  }

  public async handleValidateFuzzyMatch(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;
    const absPath = vscode.Uri.joinPath(workspaceFolder.uri, message.path);
    const content = Buffer.from(
      await vscode.workspace.fs.readFile(absPath),
    ).toString("utf8");
    const match = message.diff.match(
      /<<<<<<< SEARCH\s*\n([\s\S]*?)\n\s*=======\s*\n([\s\S]*?)(?:>>>>>>>|>)\s*REPLACE/,
    );
    if (!match) {
      webviewView.webview.postMessage({
        command: "validateFuzzyMatchResult",
        id: message.id,
        status: "invalid_format",
      });
      return;
    }
    const clean = (text: string) =>
      text
        .replace(/^```[a-zA-Z]*$/gm, "")
        .trim()
        .replace(/\r\n/g, "\n");
    const search = clean(match[1]);
    const exact = content.replace(/\r\n/g, "\n").indexOf(search);

    if (exact !== -1) {
      const startLine = content.substring(0, exact).split(/\r?\n/).length;
      webviewView.webview.postMessage({
        command: "validateFuzzyMatchResult",
        id: message.id,
        status: "exact",
        searchBlock: search,
        foundBlock: search,
        score: 1.0,
        startLine,
      });
    } else {
      const fuzzy = FuzzyMatcher.findMatch(content, search);
      if (fuzzy) {
        webviewView.webview.postMessage({
          command: "validateFuzzyMatchResult",
          id: message.id,
          status: "fuzzy",
          score: fuzzy.score,
          searchBlock: search,
          foundBlock: fuzzy.originalText,
          startLine: fuzzy.startLine,
        });
      } else {
        webviewView.webview.postMessage({
          command: "validateFuzzyMatchResult",
          id: message.id,
          status: "none",
          searchBlock: search,
        });
      }
    }
  }

  public async handleGetWorkspaceFiles(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    const now = Date.now();
    if (
      this._workspaceFilesCache &&
      now - this._lastCacheUpdate < this.CACHE_TTL
    ) {
      webviewView.webview.postMessage({
        command: "workspaceFilesResponse",
        requestId: message.requestId,
        files: this._workspaceFilesCache,
      });
      return;
    }

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;

    const fsAnalyzer = this.contextManager.getFileSystemAnalyzer();
    const recentFiles = this.recentItemsManager
      ? this.recentItemsManager.getRecentFiles()
      : [];

    const files = await vscode.workspace.findFiles("**/*");
    const stats = await Promise.all(
      files.map(async (f) => {
        const relativePath = vscode.workspace.asRelativePath(f);

        try {
          const s = await vscode.workspace.fs.stat(f);
          const lines = await fsAnalyzer.getFileLineCount(f.fsPath);
          return {
            path: relativePath,
            lastModified: s.mtime,
            type: "file",
            size: s.size,
            lines,
            isRecent: recentFiles.includes(relativePath),
          };
        } catch {
          return null;
        }
      }),
    );

    const result = stats
      .filter((x) => x)
      .sort((a: any, b: any) => b.lastModified - a.lastModified);

    this._workspaceFilesCache = result;
    this._lastCacheUpdate = now;

    webviewView.webview.postMessage({
      command: "workspaceFilesResponse",
      requestId: message.requestId,
      files: result,
    });
  }

  public async handleGetWorkspaceFolders(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    const now = Date.now();
    if (
      this._workspaceFoldersCache &&
      now - this._lastCacheUpdate < this.CACHE_TTL
    ) {
      webviewView.webview.postMessage({
        command: "workspaceFoldersResponse",
        requestId: message.requestId,
        folders: this._workspaceFoldersCache,
      });
      return;
    }

    const fsAnalyzer = this.contextManager.getFileSystemAnalyzer();
    const foldersWithCounts = await fsAnalyzer.getFolderPaths();
    const recentFolders = this.recentItemsManager
      ? this.recentItemsManager.getRecentFolders()
      : [];

    const result = foldersWithCounts.map((f) => ({
      name: path.basename(f.path),
      path: f.path,
      type: "folder",
      isRecent: recentFolders.includes(f.path),
      fileCount: f.count,
    }));

    this._workspaceFoldersCache = result;
    webviewView.webview.postMessage({
      command: "workspaceFoldersResponse",
      requestId: message.requestId,
      folders: result,
    });
  }

  public async handleGetWorkspaceTree(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return;
    const raw = await this.contextManager.getRawFileTree();
    const normalize = (node: any): any => ({
      ...node,
      path: path
        .relative(workspaceFolder.uri.fsPath, node.path)
        .replace(/\\/g, "/"),
      children: node.children?.map(normalize),
    });
    webviewView.webview.postMessage({
      command: "workspaceTreeResult",
      requestId: message.requestId,
      tree: raw ? normalize(raw) : null,
    });
  }

  public async handleListFiles(message: any, webviewView: vscode.WebviewView) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) return;
      const pathValue = message.path || message.folder_path || message.filePath;
      const dirPath = pathValue || ".";
      const recursiveParam = message.recursive;
      const absolutePath = await this.resolveWorkspacePathWithFallback(
        workspaceFolder,
        dirPath,
      ).catch(() => this.resolveWorkspacePath(workspaceFolder, dirPath));

      let maxDepth = 1;
      if (message.depth !== undefined && message.depth !== null) {
        maxDepth = parseInt(String(message.depth), 10) || 1;
      } else if (recursiveParam === "true" || recursiveParam === true)
        maxDepth = 20;
      else if (recursiveParam)
        maxDepth = parseInt(String(recursiveParam), 10) || 1;

      const fsAnalyzer = this.contextManager.getFileSystemAnalyzer();
      const ignoreCheck = await fsAnalyzer.isIgnored(absolutePath.fsPath);
      if (ignoreCheck.ignored && !message.bypassIgnore) {
        throw new Error(
          `Path '${dirPath}' is out of scope (ignored by .gitignore or project settings).`,
        );
      }
      
      // Get tree as JSON structure instead of string
      const treeNode = await fsAnalyzer.getFileTreeJson(
        maxDepth,
        absolutePath.fsPath,
        true,
      );
      
      // Convert to format expected by TreeBlock (array of children)
      // Also convert type from "directory" to "folder" for TreeBlock compatibility
      const convertType = (node: any): any => ({
        ...node,
        type: node.type === "directory" ? "folder" : node.type,
        children: node.children?.map(convertType),
      });
      
      const tree = (treeNode.children || []).map(convertType);

      webviewView.webview.postMessage({
        command: "listFilesResult",
        requestId: message.requestId,
        path: pathValue,
        files: tree,
      });
    } catch (e: any) {
      webviewView.webview.postMessage({
        command: "listFilesResult",
        requestId: message.requestId,
        path: message.path || message.folder_path,
        error: e.message,
      });
    }
  }

  public async handleGetFileStats(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) return;
      const uri = await this.resolveWorkspacePathWithFallback(
        workspaceFolder,
        message.path,
      );
      const stat = await vscode.workspace.fs.stat(uri);
      const content = await vscode.workspace.fs.readFile(uri);
      const lines = Buffer.from(content).toString("utf8").split("\n").length;

      webviewView.webview.postMessage({
        command: "fileStatsResult",
        requestId: message.requestId,
        id: message.id,
        path: message.path,
        lines: lines,
        stats: {
          size: stat.size,
          mtime: stat.mtime,
          type: stat.type === vscode.FileType.Directory ? "directory" : "file",
        },
      });
    } catch (e: any) {
      webviewView.webview.postMessage({
        command: "fileStatsResult",
        requestId: message.requestId,
        id: message.id,
        path: message.path,
        error: e.message,
      });
    }
  }

  public async handleGetDiagnostics(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        webviewView.webview.postMessage({
          command: "getDiagnosticsResult",
          requestId: message.requestId,
          path: message.path,
          diagnostics: [],
        });
        return;
      }

      const uri = await this.resolveWorkspacePathWithFallback(
        workspaceFolder,
        message.path,
      );

      // Get diagnostics for the file
      const diagnostics = this.getDiagnosticsForFile(uri);

      webviewView.webview.postMessage({
        command: "getDiagnosticsResult",
        requestId: message.requestId,
        path: message.path,
        diagnostics: diagnostics,
      });
    } catch (e: any) {
      // If file doesn't exist or error, return empty diagnostics
      webviewView.webview.postMessage({
        command: "getDiagnosticsResult",
        requestId: message.requestId,
        path: message.path,
        diagnostics: [],
        error: e.message,
      });
    }
  }

  public async handleGetGitChanges(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    // Git changes logic via git extension or simple shell
  }

  public async handleRunGitStatus(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    const { exec } = require("child_process");
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      webviewView.webview.postMessage({
        command: "gitStatusResult",
        requestId: message.requestId,
        error: "No workspace folder found",
      });
      return;
    }

    const cwd = workspaceFolder.uri.fsPath;

    // Run git status and git diff --numstat in parallel
    const runCommand = (
      cmd: string,
    ): Promise<{ stdout: string; stderr: string; error?: any }> => {
      return new Promise((resolve) => {
        exec(
          cmd,
          { cwd, maxBuffer: 1024 * 1024 * 10 },
          (err: any, stdout: string, stderr: string) => {
            if (err) {
              resolve({ stdout: "", stderr, error: err });
            } else {
              resolve({ stdout, stderr });
            }
          },
        );
      });
    };

    const statusPromise = runCommand("git status --porcelain");
    const diffPromise = runCommand("git diff --numstat");
    const diffCachedPromise = runCommand("git diff --cached --numstat");
    const unpushedPromise = runCommand("git log origin/HEAD..HEAD --oneline");
    const branchPromise = runCommand("git rev-parse --abbrev-ref HEAD");

    Promise.all([
      statusPromise,
      diffPromise,
      diffCachedPromise,
      unpushedPromise,
      branchPromise,
    ])
      .then(
        ([
          statusResult,
          diffResult,
          diffCachedResult,
          unpushedResult,
          branchResult,
        ]) => {
          // Check for git status error
          if (statusResult.error) {
            console.error(
              `[Git] Error running git status:`,
              statusResult.error,
            );
            if (statusResult.error.code === "ENOENT") {
              webviewView.webview.postMessage({
                command: "gitStatusResult",
                requestId: message.requestId,
                error:
                  "Git is not installed or not in PATH. Please install Git and try again.",
              });
            } else {
              webviewView.webview.postMessage({
                command: "gitStatusResult",
                requestId: message.requestId,
                error:
                  statusResult.stderr ||
                  statusResult.error.message ||
                  "Git status failed",
              });
            }
            return;
          }

          const statusOutput = statusResult.stdout;
          const diffOutput = diffResult.stdout;
          const diffCachedOutput = diffCachedResult.stdout;
          const unpushedOutput = unpushedResult.stdout || "";

          // Parse diff stats
          const diffStats: Record<string, { added: number; deleted: number }> =
            {};

          // Parse unstaged diff stats
          const diffLines = diffOutput
            .split("\n")
            .filter((line) => line.trim());
          for (const line of diffLines) {
            const parts = line.split("\t");
            if (parts.length >= 3) {
              const added = parseInt(parts[0], 10) || 0;
              const deleted = parseInt(parts[1], 10) || 0;
              const filePath = parts.slice(2).join("\t").trim();
              if (filePath) {
                diffStats[filePath] = { added, deleted };
              }
            }
          }

          // Parse staged diff stats (overwrite if both staged and unstaged have changes)
          const diffCachedLines = diffCachedOutput
            .split("\n")
            .filter((line) => line.trim());
          for (const line of diffCachedLines) {
            const parts = line.split("\t");
            if (parts.length >= 3) {
              const added = parseInt(parts[0], 10) || 0;
              const deleted = parseInt(parts[1], 10) || 0;
              const filePath = parts.slice(2).join("\t").trim();
              if (filePath) {
                // For staged files, we want to show the staged diff stats
                diffStats[filePath] = { added, deleted };
              }
            }
          }

          // Parse unpushed commits
          const unpushedCommits = unpushedOutput
            .split("\n")
            .filter((line: string) => line.trim().length > 0);

          const branch = branchResult.stdout?.trim() || "";

          // Send combined result
          webviewView.webview.postMessage({
            command: "gitStatusResult",
            requestId: message.requestId,
            output: statusOutput,
            diffStats: diffStats,
            unpushedCommits: unpushedCommits,
            branch: branch,
          });
        },
      )
      .catch((err) => {
        console.error(`[Git] Error in Promise.all:`, err);
        webviewView.webview.postMessage({
          command: "gitStatusResult",
          requestId: message.requestId,
          error: err.message || "Failed to get git status",
        });
      });
  }

  public async handleDeleteFile(message: any, webviewView: vscode.WebviewView) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) throw new Error("No workspace");
      const filePath = message.file_path;
      if (!filePath) throw new Error("'file_path' is required");

      const absPath = path.isAbsolute(filePath)
        ? filePath
        : path.join(workspaceFolder.uri.fsPath, filePath);

      const checkpointManager = CheckpointManager.getInstance();
      await checkpointManager.createCheckpoint(absPath, "delete");

      await fs.promises.unlink(absPath);

      webviewView.webview.postMessage({
        command: "deleteFileResult",
        requestId: message.requestId,
        success: true,
      });
    } catch (e: any) {
      webviewView.webview.postMessage({
        command: "deleteFileResult",
        requestId: message.requestId,
        error: e.message,
      });
    }
  }

  public async handleDeleteFolder(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) throw new Error("No workspace");
      const folderPath = message.folder_path;
      if (!folderPath) throw new Error("'folder_path' is required");

      const absPath = path.isAbsolute(folderPath)
        ? folderPath
        : path.join(workspaceFolder.uri.fsPath, folderPath);

      const checkpointManager = CheckpointManager.getInstance();
      const collectFiles = async (dir: string) => {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          const full = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            await collectFiles(full);
          } else {
            await checkpointManager.createCheckpoint(full, "delete");
          }
        }
      };
      await collectFiles(absPath);

      await fs.promises.rm(absPath, { recursive: true, force: true });

      webviewView.webview.postMessage({
        command: "deleteFolderResult",
        requestId: message.requestId,
        success: true,
      });
    } catch (e: any) {
      webviewView.webview.postMessage({
        command: "deleteFolderResult",
        requestId: message.requestId,
        error: e.message,
      });
    }
  }

  public async handleMoveFile(message: any, webviewView: vscode.WebviewView) {
    const logger = LoggerService.getInstance();
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) throw new Error("No workspace");

      const sourcePath = message.file_path || message.source_path;
      const targetFolderPath = message.target_folder_path;
      if (!sourcePath) throw new Error("'file_path' is required");
      if (!targetFolderPath)
        throw new Error("'target_folder_path' is required");

      logger.info(`[move_file] Start`, {
        source: sourcePath,
        targetFolder: targetFolderPath,
        requestId: message.requestId,
      });

      const absSource = path.isAbsolute(sourcePath)
        ? sourcePath
        : path.join(workspaceFolder.uri.fsPath, sourcePath);

      const absTargetFolder = path.isAbsolute(targetFolderPath)
        ? targetFolderPath
        : path.join(workspaceFolder.uri.fsPath, targetFolderPath);

      // Security checks
      const sourceCheck = SecurityValidator.validatePath(absSource, false);
      if (!sourceCheck.safe)
        throw new Error(
          sourceCheck.reason || "Security validation failed for source",
        );

      const targetCheck = SecurityValidator.validatePath(absTargetFolder, true);
      if (!targetCheck.safe)
        throw new Error(
          targetCheck.reason || "Security validation failed for target",
        );

      // Verify source file exists
      try {
        await fs.promises.stat(absSource);
      } catch {
        throw new Error(`Source file not found: '${sourcePath}'`);
      }

      // Ensure target folder exists (create if needed)
      await fs.promises.mkdir(absTargetFolder, { recursive: true });

      const fileName = path.basename(absSource);
      const absDestination = path.join(absTargetFolder, fileName);

      // Create checkpoint for undo support
      const checkpointManager = CheckpointManager.getInstance();
      if (message.conversationId) {
        checkpointManager.setActiveConversationId(message.conversationId);
      }
      await checkpointManager.createCheckpoint(absSource, "delete");

      // Move file: try rename first (same filesystem), fallback to copy+delete
      try {
        await fs.promises.rename(absSource, absDestination);
      } catch (renameErr: any) {
        // EXDEV = cross-device rename not permitted — fallback to copy + delete
        if (renameErr.code === "EXDEV") {
          await fs.promises.copyFile(absSource, absDestination);
          await fs.promises.unlink(absSource);
        } else {
          throw renameErr;
        }
      }

      const newPath = path
        .relative(workspaceFolder.uri.fsPath, absDestination)
        .replace(/\\/g, "/");

      logger.info(`[move_file] File moved successfully`, {
        source: sourcePath,
        destination: absDestination,
        newPath,
      });

      webviewView.webview.postMessage({
        command: "moveFileResult",
        requestId: message.requestId,
        success: true,
        newPath,
      });
    } catch (e: any) {
      logger.error(`[move_file] Error`, {
        source: message.file_path || message.source_path,
        error: e.message,
      });
      webviewView.webview.postMessage({
        command: "moveFileResult",
        requestId: message.requestId,
        error: e.message,
      });
    }
  }

  public async handleGitDiff(message: any, webviewView: vscode.WebviewView) {
    const logger = LoggerService.getInstance();
    const { exec } = require("child_process");
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      webviewView.webview.postMessage({
        command: "gitDiffResult",
        requestId: message.requestId,
        error: "No workspace folder found",
      });
      return;
    }

    const filePath = message.file_path || message.path;
    if (!filePath) {
      webviewView.webview.postMessage({
        command: "gitDiffResult",
        requestId: message.requestId,
        error: "file_path is required",
      });
      return;
    }

    const cwd = workspaceFolder.uri.fsPath;
    // Escape the file path for shell
    const escapedPath = filePath.replace(/"/g, '\\"');

    // Step 1: Check if the file is tracked by git
    exec(
      `git ls-files -- "${escapedPath}"`,
      { cwd, maxBuffer: 1024 * 1024 * 10 },
      (lsErr: any, lsStdout: string) => {
        const isTracked = lsStdout.trim().length > 0;

        if (!isTracked) {
          // File is untracked (new file) - read its content and show as diff
          const absPath = path.isAbsolute(filePath)
            ? filePath
            : path.join(cwd, filePath);
          try {
            const content = fs.readFileSync(absPath, "utf-8");
            const diffOutput = `--- /dev/null\n+++ b/${filePath}\n@@ -0,0 +1,${content.split("\n").length} @@\n${content
              .split("\n")
              .map((line: string) => "+ " + line)
              .join("\n")}`;
            webviewView.webview.postMessage({
              command: "gitDiffResult",
              requestId: message.requestId,
              diff: diffOutput,
            });
            return;
          } catch (readErr) {
            webviewView.webview.postMessage({
              command: "gitDiffResult",
              requestId: message.requestId,
              diff: "",
            });
            return;
          }
        }

        // Step 2: Check if the file is staged (added to index)
        exec(
          `git status --porcelain -- "${escapedPath}"`,
          { cwd, maxBuffer: 1024 * 1024 * 10 },
          (statusErr: any, statusStdout: string) => {
            let isStaged = false;
            if (!statusErr) {
              const lines = statusStdout
                .trim()
                .split("\n")
                .filter((l) => l.length > 0);
              for (const line of lines) {
                // Status format: "XY path" where X = staged, Y = unstaged
                // X can be 'A' (added), 'M' (modified), 'D' (deleted), etc.
                if (line.length >= 2) {
                  const stagedChar = line[0];
                  if (stagedChar !== " " && stagedChar !== "?") {
                    isStaged = true;
                    break;
                  }
                }
              }
            }

            // Step 3: Run git diff with the appropriate flags
            const diffCmd = isStaged
              ? `git diff --cached -- "${escapedPath}"`
              : `git diff -- "${escapedPath}"`;

            exec(
              diffCmd,
              { cwd, maxBuffer: 1024 * 1024 * 10 },
              (err: any, stdout: string, stderr: string) => {
                // If git diff returns empty output, fallback to reading the file directly
                const hasDiffOutput = stdout && stdout.trim().length > 0;
                const isErrorWithNoOutput =
                  err && err.code === 1 && stdout.trim() === "";

                if (isErrorWithNoOutput || (!hasDiffOutput && !err)) {
                  const absPath = path.isAbsolute(filePath)
                    ? filePath
                    : path.join(cwd, filePath);
                  try {
                    const content = fs.readFileSync(absPath, "utf-8");
                    const lines = content.split("\n");
                    // Determine if staged or unstaged for the header
                    const prefix = isStaged ? "staged" : "unstaged";
                    const diffOutput = `--- a/${filePath}\n+++ b/${filePath} (${prefix})\n@@ -1,${lines.length} +1,${lines.length} @@\n${lines.map((line: string) => " " + line).join("\n")}`;
                    webviewView.webview.postMessage({
                      command: "gitDiffResult",
                      requestId: message.requestId,
                      diff: diffOutput,
                    });
                    return;
                  } catch (readErr) {
                    // If file can't be read, return empty diff
                    webviewView.webview.postMessage({
                      command: "gitDiffResult",
                      requestId: message.requestId,
                      diff: "",
                      error: null,
                    });
                    return;
                  }
                }

                if (err) {
                  webviewView.webview.postMessage({
                    command: "gitDiffResult",
                    requestId: message.requestId,
                    error: stderr || err.message || "Git diff failed",
                  });
                  return;
                }

                webviewView.webview.postMessage({
                  command: "gitDiffResult",
                  requestId: message.requestId,
                  diff: stdout || "",
                });
              },
            );
          },
        );
      },
    );
  }

  public async handleGetSnapshot(
    message: any,
    webviewView: vscode.WebviewView,
  ): Promise<void> {
    try {
      const { conversationId, actionId, requestId } = message;
      if (!conversationId || !actionId) {
        throw new Error("conversationId and actionId are required");
      }
      const snapshot = await SnapshotManager.getInstance().getSnapshot(
        conversationId,
        actionId,
      );
      if (!snapshot) {
        webviewView.webview.postMessage({
          command: "getSnapshotResult",
          requestId,
          error: "Snapshot not found",
        });
        return;
      }
      webviewView.webview.postMessage({
        command: "getSnapshotResult",
        requestId,
        actionId,
        filePath: snapshot.filePath,
        operation: snapshot.operation,
        beforeContent: snapshot.beforeContent,
        afterContent: snapshot.afterContent,
        timestamp: snapshot.timestamp,
      });
    } catch (e: any) {
      webviewView.webview.postMessage({
        command: "getSnapshotResult",
        requestId: message.requestId,
        error: e.message,
      });
    }
  }

  public async handleFindFiles(message: any, webviewView: vscode.WebviewView) {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        throw new Error("No workspace folder found");
      }

      const fileNames: string[] = message.fileNames || message.file_names || [];
      if (!fileNames || fileNames.length === 0) {
        throw new Error("No file names provided");
      }

      // Use VSCode's findFiles API with glob patterns
      const results: {
        fileName: string;
        matches: Array<{
          path: string;
          errorCount?: number;
          warningCount?: number;
        }>;
      }[] = [];

      for (const fileName of fileNames) {
        // Create glob pattern: **/{fileName}
        const globPattern = `**/${fileName}`;
        try {
          const files = await vscode.workspace.findFiles(
            globPattern,
            "**/node_modules/**", // Exclude node_modules by default
          );

          const matches = files.map((fileUri) => {
            const relativePath = vscode.workspace.asRelativePath(fileUri);
            const diagnosticCount = this.getDiagnosticCountForFile(fileUri);
            return {
              path: relativePath,
              errorCount: diagnosticCount.errorCount,
              warningCount: diagnosticCount.warningCount,
            };
          });

          results.push({
            fileName,
            matches,
          });
        } catch (error: any) {
          console.error(
            `[FileHandler][handleFindFiles] Error searching for '${fileName}':`,
            error,
          );
          results.push({
            fileName,
            matches: [],
          });
        }
      }

      // Calculate total matches
      const totalMatches = results.reduce(
        (sum, r) => sum + r.matches.length,
        0,
      );

      webviewView.webview.postMessage({
        command: "findFilesResult",
        requestId: message.requestId,
        results,
        totalMatches,
      });
    } catch (e: any) {
      console.error(`[FileHandler][handleFindFiles] ❌ Error:`, e);
      webviewView.webview.postMessage({
        command: "findFilesResult",
        requestId: message.requestId,
        error: e.message,
      });
    }
  }
}
