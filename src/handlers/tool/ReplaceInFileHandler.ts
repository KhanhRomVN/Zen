/**
 *? Usage:
 *    Thay thế nội dung trong file: replace_in_file và validate fuzzy match. Có queue, lock, checkpoint, snapshot, history.
 *
 *? Function:
 *    handleReplaceInFile()     : Thay thế nội dung trong file (dùng old_str/new_str hoặc diff format).
 *    handleValidateFuzzyMatch(): Kiểm tra fuzzy match giữa search block và nội dung file.
 */
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

// AGENT
import { SecurityValidator } from "../../agent/validators/SecurityValidator";

// MANAGERS
import { CheckpointManager } from "../../managers/CheckpointManager";
import { FileLockManager } from "../../managers/FileLockManager";
import { ReplaceInFileHistoryManager } from "../../managers/ReplaceInFileHistoryManager";
import { SnapshotManager } from "../../managers/SnapshotManager";

// SERVICES
import { LoggerService } from "../../services/LoggerService";
import { PathService } from "../../services/PathService";

// UTILS
import { FuzzyMatcher } from "../../utils/FuzzyMatcher";

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

  private getDiagnosticsForFile(uri: vscode.Uri): Array<{
    severity: string;
    message: string;
    line: number;
    column: number;
    source?: string;
    code?: string | number;
  }> {
    return vscode.languages
      .getDiagnostics(uri)
      .filter(
        (d) =>
          d.severity === vscode.DiagnosticSeverity.Error ||
          d.severity === vscode.DiagnosticSeverity.Warning,
      )
      .map((d) => ({
        severity:
          d.severity === vscode.DiagnosticSeverity.Error ? "Error" : "Warning",
        message: d.message,
        line: d.range.start.line + 1,
        column: d.range.start.character + 1,
        source: d.source,
        code: d.code
          ? typeof d.code === "object"
            ? d.code.value
            : d.code
          : undefined,
      }));
  }

  private isNonCodeFile(pathValue: string): boolean {
    const exts = [
      ".md",
      ".txt",
      ".log",
      ".csv",
      ".xml",
      ".html",
      ".css",
      ".json",
      ".yaml",
      ".yml",
      ".toml",
      ".ini",
      ".cfg",
      ".conf",
      ".env",
      ".gitignore",
      ".dockerignore",
      ".editorconfig",
      ".properties",
      ".lock",
      ".sum",
      ".mod",
    ];
    return exts.some((ext) => pathValue.toLowerCase().endsWith(ext));
  }

  private async waitForDiagnosticsWithFallback(
    uri: vscode.Uri,
    pathValue: string,
    maxTimeoutMs: number = 50000,
  ): Promise<void> {
    const debugStart = Date.now();
    return new Promise<void>((resolve) => {
      const fallbackTimeout = 2000;
      const stableWaitTime = 800;
      let stableTimeout: NodeJS.Timeout | null = null;
      let hasEvent = false;
      let resolved = false;

      const finish = (reason: string) => {
        if (resolved) return;
        resolved = true;
        const elapsed = Date.now() - debugStart;
        resolve();
      };

      const fallback = setTimeout(() => {
        if (!hasEvent) {
          clearTimeout(timeout);
          if (stableTimeout) clearTimeout(stableTimeout);
          disposable?.dispose();
          finish("fallback_no_event");
        }
      }, fallbackTimeout);

      const timeout = setTimeout(() => {
        clearTimeout(fallback);
        if (stableTimeout) clearTimeout(stableTimeout);
        disposable?.dispose();
        finish("timeout");
      }, maxTimeoutMs);

      const disposable = vscode.languages.onDidChangeDiagnostics((e) => {
        if (e.uris.some((u) => u.fsPath === uri.fsPath)) {
          if (!hasEvent) {
            hasEvent = true;
            clearTimeout(fallback);
          }
          if (stableTimeout) clearTimeout(stableTimeout);
          stableTimeout = setTimeout(() => {
            clearTimeout(timeout);
            clearTimeout(fallback);
            disposable.dispose();
            finish("stable");
          }, stableWaitTime);
        }
      });
    });
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
    try {
      let content = "";
      try {
        content = Buffer.from(
          await vscode.workspace.fs.readFile(absPath),
        ).toString("utf8");
      } catch (e: any) {
        throw e;
      }

      let searchArgs: string;
      let replaceArgs: string;
      if (message.old_str !== undefined && message.new_str !== undefined) {
        const clean = (t: string) => t.replace(/^```[a-zA-Z]*$/gm, "").trim();
        searchArgs = clean(message.old_str);
        replaceArgs = clean(message.new_str);
      } else if (message.diff !== undefined && message.diff !== null) {
        const match = message.diff.match(
          /<<<<<<< SEARCH\s*\n([\s\S]*?)\s*=======\s*\n([\s\S]*?)(?:>>>>>>>|>)\s*REPLACE/,
        );
        if (!match) throw new Error("Invalid diff format");
        const clean = (t: string) => t.replace(/^```[a-zA-Z]*$/gm, "").trim();
        searchArgs = clean(match[1]);
        replaceArgs = clean(match[2]);
      } else {
        throw new Error("Missing old_str/new_str or diff parameter");
      }

      let target = searchArgs;
      if (content.indexOf(searchArgs) === -1) {
        const fuzzy = FuzzyMatcher.findMatch(content, searchArgs);
        if (!fuzzy || fuzzy.score <= 1e-9)
          throw new Error("Search text not found");
        target = fuzzy.originalText;
      }
      newContent = content.replace(target, replaceArgs);
      if (newContent === content) throw new Error("No change made");
      await vscode.workspace.fs.writeFile(
        absPath,
        Buffer.from(newContent, "utf8"),
      );

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
      webviewView.webview.postMessage({
        command: "replaceInFileResult",
        requestId: message.requestId,
        error: e.message,
      });
      release();
      return;
    }
    release();

    let diagnostics: Array<{
      severity: string;
      message: string;
      line: number;
      column: number;
      source?: string;
      code?: string | number;
    }> = [];

    if (!message.skipDiagnostics) {
      if (!this.isNonCodeFile(pathValue)) {
        try {
          await vscode.workspace.openTextDocument(absPath);
        } catch {}
        await this.waitForDiagnosticsWithFallback(absPath, pathValue, 50000);
      }
      diagnostics = this.getDiagnosticsForFile(absPath);
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
      await historyManager.saveHistory(
        absPath.fsPath,
        newContent,
        errorCount,
        warningCount,
      );
    }

    webviewView.webview.postMessage({
      command: "replaceInFileResult",
      requestId: message.requestId,
      path: message.path,
      success: true,
      diagnostics: diagnostics,
      content: newContent,
    });
  }

  // ── Validate Fuzzy Match ──
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