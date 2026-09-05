/**
 * ------------------------------------------------------------------
 * Replace In File Handler
 * ------------------------------------------------------------------
 * Thay thế nội dung trong file: replace_in_file và validate fuzzy
 * match. Có queue, lock, checkpoint, snapshot, history.
 *
 * Main functions:
 * - handleReplaceInFile()      : Thay thế nội dung trong file (dùng
 *                                old_str/new_str hoặc diff format)
 * - handleValidateFuzzyMatch() : Kiểm tra fuzzy match giữa search block
 *                                và nội dung file
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── VSCode ──
import * as vscode from "vscode";
import * as path from "path";

// ── AGENT ──
import { SecurityValidator } from "../../utils/security";

// ── Managers ──
import { CheckpointManager } from "../../managers/CheckpointManager";
import { FileLockManager } from "../../managers/FileLockManager";
import { ReplaceInFileHistoryManager } from "../../managers/ReplaceInFileHistoryManager";

// ── Services ──
import { DiagnosticsService } from "../../services/DiagnosticsService";
import { LoggerService } from "../../services/LoggerService";
import { PathService } from "../../services/PathService";

// ── Utils ──
import { FuzzyMatcher } from "../../utils/FuzzyMatcher";

// ─── Class ──────────────────────────────────────────────────────────────
export class ReplaceInFileHandler {
  private _replaceFileQueue: Promise<void> = Promise.resolve();
  private pathService: PathService;

  constructor(private fileLockManager: FileLockManager) {
    this.pathService = PathService.getInstance();
  }

  private getProjectContextDir(workspaceFolderPath: string): string {
    return this.pathService.getProjectContextDir(workspaceFolderPath);
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

  private enqueueReplaceOperation<T>(operation: () => Promise<T>): Promise<T> {
    const logger = LoggerService.getInstance();
    this._replaceFileQueue = this._replaceFileQueue
      .then(() => operation())
      .catch((err) => {
        logger.error("[enqueueReplaceOperation] Error", { error: err.message });
        throw err;
      }) as Promise<void>;
    return this._replaceFileQueue as Promise<T>;
  }

  // ── Replace In File ──
  public async handleReplaceInFile(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    const logger = LoggerService.getInstance();
    try {
      await this.enqueueReplaceOperation(async () => {
        await this._replaceInFileInternal(message, webviewView);
      });
    } catch (e: any) {
      logger.error("[handleReplaceInFile] Failed", { error: e.message });
    }
  }

  private async _replaceInFileInternal(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    const logger = LoggerService.getInstance();
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return;
    }
    const pathValue = message.path || message.filePath || message.file_path;
    if (!pathValue) {
      webviewView.webview.postMessage({
        command: "replaceInFileResult",
        requestId: message.requestId,
        error: "The 'path' argument must be of type string.",
      });
      return;
    }

    let absPath: vscode.Uri;
    try {
      absPath = await this.resolveWorkspacePathWithFallback(
        workspaceFolder,
        pathValue,
      );
    } catch {
      const resolvedPath = path.isAbsolute(pathValue)
        ? vscode.Uri.file(pathValue)
        : vscode.Uri.joinPath(workspaceFolder.uri, pathValue);
      absPath = resolvedPath;
    }

    const sec = SecurityValidator.validatePath(absPath.fsPath, true);
    if (!sec.safe) {
      webviewView.webview.postMessage({
        command: "replaceInFileResult",
        requestId: message.requestId,
        error: sec.reason || "Security validation failed",
      });
      return;
    }

    try {
      await vscode.workspace.fs.stat(absPath);
    } catch {
      webviewView.webview.postMessage({
        command: "replaceInFileResult",
        requestId: message.requestId,
        error: `File not found: '${pathValue}'`,
      });
      return;
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
    let oldContent: string | undefined;
    let oldContentErrorCount: number | undefined;
    let oldContentWarningCount: number | undefined;
    try {
      let content = "";
      try {
        content = Buffer.from(
          await vscode.workspace.fs.readFile(absPath),
        ).toString("utf8");
        oldContent = content;
      } catch (e: any) {
        throw e;
      }

      let searchArgs: string;
      let replaceArgs: string;
      if (message.old_str !== undefined && message.new_str !== undefined) {
        const clean = (t: string) => t.replace(/^```[a-zA-Z]*$/gm, "");
        searchArgs = clean(message.old_str);
        replaceArgs = clean(message.new_str);
      } else if (message.diff !== undefined && message.diff !== null) {
        const match = message.diff.match(
          /<<<<<<< SEARCH\s*\n([\s\S]*?)\s*=======\s*\n([\s\S]*?)(?:>>>>>>>|>)\s*REPLACE/,
        );
        if (!match) {
          throw new Error("Invalid diff format");
        }
        const clean = (t: string) => t.replace(/^```[a-zA-Z]*$/gm, "");
        searchArgs = clean(match[1]);
        replaceArgs = clean(match[2]);
      } else {
        throw new Error("Missing old_str/new_str or diff parameter");
      }

      const hasCRLF = content.includes("\r\n");
      const normalizedContent = content.replace(/\r\n/g, "\n");
      const normalizedSearch = searchArgs.replace(/\r\n/g, "\n");
      const normalizedReplace = replaceArgs.replace(/\r\n/g, "\n");

      let targetPos = normalizedContent.indexOf(normalizedSearch);
      let matchLength = normalizedSearch.length;

      if (targetPos === -1) {
        const fuzzy = FuzzyMatcher.findMatch(normalizedContent, normalizedSearch);
        if (!fuzzy || fuzzy.similarity < 0.6) {
          throw new Error("Search text not found");
        }
        targetPos = normalizedContent.indexOf(fuzzy.originalText);
        if (targetPos === -1) {
          throw new Error("Search text not found");
        }
        matchLength = fuzzy.originalText.length;
      }

      const updatedContent =
        normalizedContent.slice(0, targetPos) +
        normalizedReplace +
        normalizedContent.slice(targetPos + matchLength);

      if (updatedContent === normalizedContent) {
        throw new Error("No change made");
      }

      newContent = hasCRLF
        ? updatedContent.replace(/\n/g, "\r\n")
        : updatedContent;

      await vscode.workspace.fs.writeFile(
        absPath,
        Buffer.from(newContent, "utf8"),
      );
    } catch (e: any) {
      webviewView.webview.postMessage({
        command: "replaceInFileResult",
        requestId: message.requestId,
        error: e.message,
      });
      return;
    } finally {
      // FIX P3: Use finally to ensure release() runs exactly once (was called twice before)
      release();
    }

    let diagnostics: Array<{
      severity: string;
      message: string;
      line: number;
      column: number;
      source?: string;
      code?: string | number;
    }> = [];
    let diagnosticsMessage: string | null = null;

    if (!message.skipDiagnostics) {
      const diagResult = await DiagnosticsService.getInstance().getDiagnostics(
        absPath,
        pathValue,
        undefined, // Use default wait time from DiagnosticsService
      );
      diagnostics = diagResult.diagnostics;
      
      // Create suggestion message if timeout or incomplete
      if (diagResult.skippedReason === "timeout_no_diagnostics") {
        diagnosticsMessage = "⏱️ Language Server timeout while fetching diagnostics. Try using read_file to get diagnostics later.";
      } else if (diagResult.skippedReason === "possibly_incomplete") {
        diagnosticsMessage = "⚠️ Language Server may still be analyzing. Try using read_file to get diagnostics later.";
      } else if (diagResult.skippedReason === "file_too_large") {
        diagnosticsMessage = "📁 File too large (>100KB) - diagnostics skipped to avoid performance issues.";
      }
    }

    if (message.conversationId && newContent !== undefined) {
      const errorCount = diagnostics.filter(
        (d) => d.severity === "Error",
      ).length;
      const warningCount = diagnostics.filter(
        (d) => d.severity === "Warning",
      ).length;

      const historyManager = ReplaceInFileHistoryManager.getInstance();
      historyManager.setActiveConversationId(message.conversationId);

      // Get diagnostic for oldContent if this is the first replace (version 0 will be created)
      if (oldContent && !message.skipDiagnostics) {
        const currentVersion = await historyManager.getCurrentVersion(
          absPath.fsPath,
        );
        if (currentVersion === 0) {
          // This is first replace, need to get diagnostic for oldContent
          // Temporarily write oldContent to file to get diagnostics
          await vscode.workspace.fs.writeFile(
            absPath,
            Buffer.from(oldContent, "utf8"),
          );

          const oldDiagResult =
            await DiagnosticsService.getInstance().getDiagnostics(
              absPath,
              pathValue,
              15000,
            );

          oldContentErrorCount = oldDiagResult.diagnostics.filter(
            (d) => d.severity === "Error",
          ).length;
          oldContentWarningCount = oldDiagResult.diagnostics.filter(
            (d) => d.severity === "Warning",
          ).length;

          // Write back newContent
          await vscode.workspace.fs.writeFile(
            absPath,
            Buffer.from(newContent, "utf8"),
          );
        }
      }

      // Pass oldContent (content before replace) for version 0 baseline
      await historyManager.saveHistory(
        absPath.fsPath,
        newContent,
        errorCount,
        warningCount,
        message.messageId,
        message.messageTimestamp,
        message.responseNumber,
        oldContent,
        oldContentErrorCount,
        oldContentWarningCount,
      );

      // Get current version after saving
      const currentVersion = await historyManager.getCurrentVersion(
        absPath.fsPath,
      );

      webviewView.webview.postMessage({
        command: "replaceInFileResult",
        requestId: message.requestId,
        path: message.path,
        success: true,
        diagnostics: diagnostics,
        diagnosticsMessage: diagnosticsMessage,
        content: newContent,
        version: currentVersion,
      });
      return;
    }

    webviewView.webview.postMessage({
      command: "replaceInFileResult",
      requestId: message.requestId,
      path: message.path,
      success: true,
      diagnostics: diagnostics,
      diagnosticsMessage: diagnosticsMessage,
      content: newContent,
    });
  }

  // ── Validate Fuzzy Match ──
  public async handleValidateFuzzyMatch(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) {
      return;
    }
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
      webviewView.webview.postMessage({
        command: "validateFuzzyMatchResult",
        id: message.id,
        status: "exact",
        searchBlock: search,
        foundBlock: search,
        score: 1.0,
        startLine: content.substring(0, exact).split(/\r?\n/).length,
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
}
