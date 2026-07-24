/**
 *? Usage:
 *    Dịch vụ tập trung xử lý diagnostics từ language server.
 *    Dùng chung bởi ReadFileHandler, ReplaceInFileHandler, WriteToFileHandler, RevertFileHandler, FileMiscHandler.
 *
 *? Function:
 *    getDiagnostics(): Mở file (nếu cần) → chờ diagnostics ổn định → trả về danh sách error/warning.
 */
import * as vscode from "vscode";

// SERVICES
import { LoggerService } from "./LoggerService";

export class DiagnosticsService {
  private static instance: DiagnosticsService;

  public static getInstance(): DiagnosticsService {
    if (!DiagnosticsService.instance) {
      DiagnosticsService.instance = new DiagnosticsService();
    }
    return DiagnosticsService.instance;
  }

  private static readonly NON_CODE_EXTENSIONS = [
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

  private isNonCodeFile(pathValue: string): boolean {
    return DiagnosticsService.NON_CODE_EXTENSIONS.some((ext) =>
      pathValue.toLowerCase().endsWith(ext),
    );
  }

  private filterDiagnostics(diagnostics: vscode.Diagnostic[]): Array<{
    severity: string;
    message: string;
    line: number;
    column: number;
    source?: string;
    code?: string | number;
  }> {
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

  private async ensureFileOpened(uri: vscode.Uri): Promise<void> {
    const logger = LoggerService.getInstance();
    try {
      const isAlreadyOpen = vscode.workspace.textDocuments.some(
        (doc) => doc.uri.fsPath === uri.fsPath,
      );
      if (isAlreadyOpen) {
        return;
      }
      const doc = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(doc, {
        preview: true,
        viewColumn: vscode.ViewColumn.Active,
      });
    } catch (e) {
      logger.error("[DiagnosticsService] Error opening file", {
        file: uri.fsPath,
        error: e,
      });
    }
  }

  private async waitForDiagnostics(
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

      const fallbackHandle = setTimeout(() => {
        if (!hasReceivedEvent) {
          clearTimeout(timeoutHandle);
          if (stableTimeout) clearTimeout(stableTimeout);
          disposable?.dispose();
          resolve();
        }
      }, fallbackTimeout);

      const timeoutHandle = setTimeout(() => {
        logger.warn(`[DiagnosticsService] ⏱️ Safety timeout reached`, {
          path: pathValue,
          elapsedTime: Date.now() - startTime,
          hasReceivedEvent,
        });
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
          }
          if (stableTimeout) clearTimeout(stableTimeout);
          stableTimeout = setTimeout(() => {
            clearTimeout(timeoutHandle);
            clearTimeout(fallbackHandle);
            disposable.dispose();
            resolve();
          }, stableWaitTime);
        }
      });
    });
  }

  /**
   * Open file → wait for diagnostics to stabilize → return filtered diagnostics.
   * Skips non-code files automatically (returns empty array).
   * This is the single entry point for all diagnostic needs.
   */
  public async getDiagnostics(
    uri: vscode.Uri,
    pathValue: string,
    maxTimeoutMs: number = 30000,
  ): Promise<
    Array<{
      severity: string;
      message: string;
      line: number;
      column: number;
      source?: string;
      code?: string | number;
    }>
  > {
    if (this.isNonCodeFile(pathValue)) {
      return [];
    }
    await this.ensureFileOpened(uri);
    await this.waitForDiagnostics(uri, pathValue, maxTimeoutMs);
    return this.filterDiagnostics(vscode.languages.getDiagnostics(uri));
  }

  /**
   * Same as getDiagnostics but returns counts instead of full list.
   */
  public async getDiagnosticCountStabilized(
    uri: vscode.Uri,
    pathValue: string,
    maxTimeoutMs: number = 30000,
  ): Promise<{ errorCount: number; warningCount: number }> {
    const diagnostics = await this.getDiagnostics(uri, pathValue, maxTimeoutMs);
    return {
      errorCount: diagnostics.filter((d) => d.severity === "Error").length,
      warningCount: diagnostics.filter((d) => d.severity === "Warning").length,
    };
  }
}
