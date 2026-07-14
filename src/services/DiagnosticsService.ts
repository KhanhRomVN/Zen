import * as vscode from "vscode";
import { LoggerService } from "./LoggerService";

/**
 * Centralized diagnostics logic — used by FileReadHandler, FileWriteHandler,
 * FileSystemAnalyzer, and GrepCapability to avoid ~200 lines of duplication.
 */
export class DiagnosticsService {
  private static instance: DiagnosticsService;

  public static getInstance(): DiagnosticsService {
    if (!DiagnosticsService.instance) {
      DiagnosticsService.instance = new DiagnosticsService();
    }
    return DiagnosticsService.instance;
  }

  /**
   * Non-code file extensions that don't have language servers.
   */
  private static readonly NON_CODE_EXTENSIONS = [
    ".md", ".txt", ".log", ".csv", ".xml", ".html", ".css",
    ".json", ".yaml", ".yml", ".toml", ".ini", ".cfg", ".conf",
    ".env", ".gitignore", ".dockerignore", ".editorconfig",
    ".properties", ".lock", ".sum", ".mod",
  ];

  /**
   * Get filtered diagnostics (errors + warnings only) for a file URI.
   */
  public getDiagnostics(uri: vscode.Uri): Array<{
    severity: string;
    message: string;
    line: number;
    column: number;
    source?: string;
    code?: string | number;
  }> {
    const diagnostics = vscode.languages.getDiagnostics(uri);
    return diagnostics
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

  /**
   * Get error/warning counts for a file URI.
   */
  public getDiagnosticCount(uri: vscode.Uri): {
    errorCount: number;
    warningCount: number;
  } {
    const diagnostics = vscode.languages.getDiagnostics(uri);
    return {
      errorCount: diagnostics.filter(
        (d) => d.severity === vscode.DiagnosticSeverity.Error,
      ).length,
      warningCount: diagnostics.filter(
        (d) => d.severity === vscode.DiagnosticSeverity.Warning,
      ).length,
    };
  }

  /**
   * Check if a file path belongs to a non-code file (no language server).
   */
  public isNonCodeFile(pathValue: string): boolean {
    return DiagnosticsService.NON_CODE_EXTENSIONS.some((ext) =>
      pathValue.toLowerCase().endsWith(ext),
    );
  }

  /**
   * Ensure a file is opened in VS Code to trigger language server analysis.
   * Safe to call multiple times — skips if already open.
   */
  public async ensureFileOpened(uri: vscode.Uri): Promise<void> {
    const logger = LoggerService.getInstance();
    try {
      const isAlreadyOpen = vscode.workspace.textDocuments.some(
        (doc) => doc.uri.fsPath === uri.fsPath,
      );
      if (isAlreadyOpen) {
        logger.info("[DiagnosticsService] File already open, skipping", {
          file: uri.fsPath,
        });
        return;
      }
      logger.info("[DiagnosticsService] Opening file for the first time", {
        file: uri.fsPath,
      });
      const doc = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(doc, {
        preview: true,
        viewColumn: vscode.ViewColumn.Active,
      });
      logger.info("[DiagnosticsService] File opened successfully", {
        file: uri.fsPath,
      });
    } catch (e) {
      logger.error("[DiagnosticsService] Error opening file", {
        file: uri.fsPath,
        error: e,
      });
    }
  }

  /**
   * Wait for diagnostics to stabilize with a hybrid approach:
   * - Returns immediately if no diagnostic events after 2s (fallback)
   * - Waits for stable diagnostics if events are received
   * - Safety timeout of maxTimeoutMs (default 30s)
   */
  public async waitForDiagnostics(
    uri: vscode.Uri,
    pathValue: string,
    maxTimeoutMs: number = 30000,
  ): Promise<void> {
    const logger = LoggerService.getInstance();
    return new Promise<void>((resolve) => {
      const fallbackTimeout = 2000;
      const stableWaitTime = 800;
      const startTime = Date.now();
      let stableTimeout: NodeJS.Timeout | null = null;
      let hasReceivedEvent = false;

      logger.info(
        `[DiagnosticsService] ⏳ Waiting for diagnostics`,
        { path: pathValue, fallbackTimeout, maxTimeout: maxTimeoutMs },
      );

      const fallbackHandle = setTimeout(() => {
        if (!hasReceivedEvent) {
          logger.info(
            `[DiagnosticsService] ⚡ No events, proceeding (fallback)`,
            { path: pathValue, elapsedTime: Date.now() - startTime },
          );
          clearTimeout(timeoutHandle);
          if (stableTimeout) clearTimeout(stableTimeout);
          disposable?.dispose();
          resolve();
        }
      }, fallbackTimeout);

      const timeoutHandle = setTimeout(() => {
        logger.warn(
          `[DiagnosticsService] ⏱️ Safety timeout reached`,
          { path: pathValue, elapsedTime: Date.now() - startTime, hasReceivedEvent },
        );
        clearTimeout(fallbackHandle);
        if (stableTimeout) clearTimeout(stableTimeout);
        disposable?.dispose();
        resolve();
      }, maxTimeoutMs);

      const disposable = vscode.languages.onDidChangeDiagnostics((e) => {
        if (e.uris.some((u) => u.fsPath === uri.fsPath)) {
          if (!hasReceivedEvent) {
            hasReceivedEvent = true;
            clearTimeout(fallbackHandle);
            logger.info(
              `[DiagnosticsService] 🔔 First event received`,
              { path: pathValue, elapsedTime: Date.now() - startTime },
            );
          }
          if (stableTimeout) clearTimeout(stableTimeout);
          stableTimeout = setTimeout(() => {
            const elapsed = Date.now() - startTime;
            clearTimeout(timeoutHandle);
            clearTimeout(fallbackHandle);
            disposable.dispose();
            logger.info(
              `[DiagnosticsService] ✅ Diagnostics stable`,
              { path: pathValue, elapsedTime: elapsed, count: this.getDiagnostics(uri).length },
            );
            resolve();
          }, stableWaitTime);
        }
      });
    });
  }
}