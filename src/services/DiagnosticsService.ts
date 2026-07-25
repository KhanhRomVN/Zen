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

  // Kích thước file tối đa (bytes) để mở editor lấy diagnostics.
  // File vượt ngưỡng này sẽ bị skip để tránh crash máy do LS + UI render.
  private static readonly MAX_FILE_SIZE_BYTES = 100 * 1024; // 100KB

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

  /**
   * Mở file trong editor để kích hoạt Language Server phân tích.
   * Trả về `true` nếu file đã được mở thành công, `false` nếu skip
   * (file quá lớn hoặc lỗi khi mở).
   */
  private async ensureFileOpened(uri: vscode.Uri): Promise<boolean> {
    const logger = LoggerService.getInstance();
    try {
      const isAlreadyOpen = vscode.workspace.textDocuments.some(
        (doc) => doc.uri.fsPath === uri.fsPath,
      );
      if (isAlreadyOpen) {
        return true;
      }

      // Kiểm tra kích thước file trước khi mở editor
      const stat = await vscode.workspace.fs.stat(uri);
      if (stat.size > DiagnosticsService.MAX_FILE_SIZE_BYTES) {
        logger.info(
          "[DiagnosticsService] File too large, skipping diagnostics",
          {
            file: uri.fsPath,
            sizeBytes: stat.size,
            thresholdBytes: DiagnosticsService.MAX_FILE_SIZE_BYTES,
          },
        );
        return false;
      }

      const doc = await vscode.workspace.openTextDocument(uri);
      await vscode.window.showTextDocument(doc, {
        preview: true,
        preserveFocus: true,
        viewColumn: vscode.ViewColumn.Active,
      });
      return true;
    } catch (e) {
      logger.error("[DiagnosticsService] Error opening file", {
        file: uri.fsPath,
        error: e,
      });
      return false;
    }
  }

  private async waitForDiagnostics(
    uri: vscode.Uri,
    pathValue: string,
    maxTimeoutMs: number = 30000,
  ): Promise<boolean> {
    const logger = LoggerService.getInstance();
    return new Promise<boolean>((resolve) => {
      const fallbackTimeout = 2000;
      const stableWaitTime = 800;
      const startTime = Date.now();
      let stableTimeout: NodeJS.Timeout | null = null;
      let hasReceivedEvent = false;
      let resolved = false;

      const finish = (timedOut: boolean) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(fallbackHandle);
        clearTimeout(timeoutHandle);
        if (stableTimeout) clearTimeout(stableTimeout);
        disposable?.dispose();
        if (timedOut) {
          logger.warn(
            `[DiagnosticsService] ⏱️ Diagnostics timeout — không lấy được diagnostics cho file này`,
            {
              path: pathValue,
              elapsedTime: Date.now() - startTime,
              hasReceivedEvent,
            },
          );
        }
        resolve(!timedOut);
      };

      const fallbackHandle = setTimeout(() => {
        if (!hasReceivedEvent) {
          finish(true);
        }
      }, fallbackTimeout);

      const timeoutHandle = setTimeout(() => {
        finish(true);
      }, maxTimeoutMs);

      const disposable = vscode.languages.onDidChangeDiagnostics((e) => {
        if (e.uris.some((u) => u.fsPath === uri.fsPath)) {
          if (!hasReceivedEvent) {
            hasReceivedEvent = true;
            clearTimeout(fallbackHandle);
          }
          if (stableTimeout) clearTimeout(stableTimeout);
          stableTimeout = setTimeout(() => {
            finish(false);
          }, stableWaitTime);
        }
      });
    });
  }

  /**
   * Open file → wait for diagnostics to stabilize → return filtered diagnostics.
   * Skips non-code files automatically (returns empty array).
   * Skips files larger than MAX_FILE_SIZE_BYTES to avoid resource spikes.
   * This is the single entry point for all diagnostic needs.
   */
  public async getDiagnostics(
    uri: vscode.Uri,
    pathValue: string,
    maxTimeoutMs: number = 30000,
  ): Promise<{
    diagnostics: Array<{
      severity: string;
      message: string;
      line: number;
      column: number;
      source?: string;
      code?: string | number;
    }>;
    skippedReason?: string;
  }> {
    if (this.isNonCodeFile(pathValue)) {
      return { diagnostics: [] };
    }

    const opened = await this.ensureFileOpened(uri);
    if (!opened) {
      return {
        diagnostics: [],
        skippedReason: `File quá lớn (>${DiagnosticsService.MAX_FILE_SIZE_BYTES / 1024}KB), đã skip diagnostics để tránh crash máy.`,
      };
    }

    const gotDiagnostics = await this.waitForDiagnostics(
      uri,
      pathValue,
      maxTimeoutMs,
    );

    if (!gotDiagnostics) {
      return {
        diagnostics: [],
        skippedReason:
          "Không lấy được diagnostics (timeout — Language Server không phản hồi kịp).",
      };
    }

    return {
      diagnostics: this.filterDiagnostics(
        vscode.languages.getDiagnostics(uri),
      ),
    };
  }

  /**
   * Same as getDiagnostics but returns counts instead of full list.
   */
  public async getDiagnosticCountStabilized(
    uri: vscode.Uri,
    pathValue: string,
    maxTimeoutMs: number = 30000,
  ): Promise<{
    errorCount: number;
    warningCount: number;
    skippedReason?: string;
  }> {
    const result = await this.getDiagnostics(uri, pathValue, maxTimeoutMs);
    return {
      errorCount: result.diagnostics.filter((d) => d.severity === "Error")
        .length,
      warningCount: result.diagnostics.filter((d) => d.severity === "Warning")
        .length,
      skippedReason: result.skippedReason,
    };
  }
}