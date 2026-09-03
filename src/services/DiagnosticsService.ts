/**
 * ------------------------------------------------------------------
 * Diagnostics Service
 * ------------------------------------------------------------------
 * Dịch vụ tập trung xử lý diagnostics từ language server.
 * Dùng chung bởi ReadFileHandler, ReplaceInFileHandler, WriteToFileHandler,
 * RevertFileHandler, FileMiscHandler.
 *
 * Main functions:
 * - getDiagnostics()              : Mở file (nếu cần) → chờ diagnostics ổn
 *                                   định → trả về danh sách error/warning
 * - getDiagnosticCountStabilized(): Giống getDiagnostics nhưng trả về counts
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── VSCode ──
import * as vscode from "vscode";

// ── Services ──
import { LoggerService } from "./LoggerService";
import { CustomLSPService } from "./CustomLSPService";

// ─── Class ──────────────────────────────────────────────────────────────
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
   * Trả về object với status và thông tin về việc file đã được mở hay chưa.
   */
  private async ensureFileOpened(uri: vscode.Uri): Promise<{
    success: boolean;
    alreadyOpen: boolean;
  }> {
    const logger = LoggerService.getInstance();
    try {
      const isAlreadyOpen = vscode.workspace.textDocuments.some(
        (doc) => doc.uri.fsPath === uri.fsPath,
      );

      // Kiểm tra kích thước file trước khi mở editor
      const stat = await vscode.workspace.fs.stat(uri);

      if (stat.size > DiagnosticsService.MAX_FILE_SIZE_BYTES) {
        return { success: false, alreadyOpen: false };
      }

      if (isAlreadyOpen) {
        return { success: true, alreadyOpen: true };
      }

      const doc = await vscode.workspace.openTextDocument(uri);

      await vscode.window.showTextDocument(doc, {
        preview: true,
        preserveFocus: true,
        viewColumn: vscode.ViewColumn.Active,
      });

      return { success: true, alreadyOpen: false };
    } catch (e) {
      logger.error("[DiagnosticsService] ❌ Error opening file", {
        file: uri.fsPath,
        error: e,
      });
      return { success: false, alreadyOpen: false };
    }
  }

  private async waitForDiagnostics(
    uri: vscode.Uri,
    pathValue: string,
    alreadyOpen: boolean,
    maxTimeoutMs: number = 30000,
  ): Promise<boolean> {
    const logger = LoggerService.getInstance();

    // Nếu file đã mở, check xem có thể dùng cached diagnostics không
    if (alreadyOpen) {
      const doc = vscode.workspace.textDocuments.find(
        (d) => d.uri.fsPath === uri.fsPath,
      );
      const cachedDiagnostics = vscode.languages.getDiagnostics(uri);
      const isDirty = doc?.isDirty ?? false;

      // Chỉ dùng cache nếu file không dirty (không có thay đổi chưa phân tích)
      if (!isDirty) {
        return true;
      }
    }

    // File mới mở → đợi LSP phân tích
    return new Promise<boolean>((resolve) => {
      const fallbackTimeout = 2000;
      const stableWaitTime = 800;
      const startTime = Date.now();
      let stableTimeout: NodeJS.Timeout | null = null;
      let hasReceivedEvent = false;
      let resolved = false;
      let eventCount = 0;

      const finish = (timedOut: boolean) => {
        if (resolved) return;
        resolved = true;
        clearTimeout(fallbackHandle);
        clearTimeout(timeoutHandle);
        if (stableTimeout) clearTimeout(stableTimeout);
        disposable?.dispose();

        const elapsedTime = Date.now() - startTime;

        if (timedOut) {
          logger.warn(
            `[DiagnosticsService] ⏱️ Diagnostics timeout — không lấy được diagnostics cho file này`,
            {
              path: pathValue,
              elapsedTime,
              hasReceivedEvent,
              eventCount,
              fallbackTriggered: !hasReceivedEvent,
            },
          );
        }
        resolve(!timedOut);
      };

      const fallbackHandle = setTimeout(() => {
        if (!hasReceivedEvent) {
          logger.warn(
            "[DiagnosticsService] 🚨 Fallback timeout triggered — no diagnostic events received",
            {
              path: pathValue,
              elapsedTime: Date.now() - startTime,
            },
          );
          finish(true);
        }
      }, fallbackTimeout);

      const timeoutHandle = setTimeout(() => {
        logger.warn("[DiagnosticsService] 🚨 Max timeout triggered", {
          path: pathValue,
          elapsedTime: Date.now() - startTime,
          hasReceivedEvent,
          eventCount,
        });
        finish(true);
      }, maxTimeoutMs);

      const disposable = vscode.languages.onDidChangeDiagnostics((e) => {
        const matchedUri = e.uris.find((u) => u.fsPath === uri.fsPath);
        if (matchedUri) {
          eventCount++;
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
   *
   * If custom LSP is enabled, auto-installs required LSP package before diagnostics.
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
    const logger = LoggerService.getInstance();

    if (this.isNonCodeFile(pathValue)) {
      return { diagnostics: [] };
    }

    // Check if custom LSP is enabled and process accordingly
    const customLSPService = CustomLSPService.getInstance();
    const customLSPResult =
      await customLSPService.processFileForCustomLSP(pathValue);

    if (customLSPResult.shouldUseCustom && !customLSPResult.lspReady) {
      logger.warn("[DiagnosticsService] ⚠️ Custom LSP not ready", {
        path: pathValue,
        languageId: customLSPResult.languageId,
      });
      return {
        diagnostics: [],
        skippedReason: `Custom LSP for ${customLSPResult.languageId} is being installed. Please try again in a moment.`,
      };
    }

    const openResult = await this.ensureFileOpened(uri);
    if (!openResult.success) {
      logger.warn(
        "[DiagnosticsService] ⚠️ File not opened, returning skipped",
        {
          path: pathValue,
        },
      );
      return {
        diagnostics: [],
        skippedReason: `File quá lớn (>${DiagnosticsService.MAX_FILE_SIZE_BYTES / 1024}KB), đã skip diagnostics để tránh crash máy.`,
      };
    }

    const gotDiagnostics = await this.waitForDiagnostics(
      uri,
      pathValue,
      openResult.alreadyOpen,
      maxTimeoutMs,
    );

    if (!gotDiagnostics) {
      logger.warn("[DiagnosticsService] ⚠️ No diagnostics received (timeout)", {
        path: pathValue,
      });

      // Fallback: Use existing diagnostics if any
      const fallbackDiagnostics = vscode.languages.getDiagnostics(uri);
      if (fallbackDiagnostics.length > 0) {
        return {
          diagnostics: this.filterDiagnostics(fallbackDiagnostics),
        };
      }

      return {
        diagnostics: [],
        skippedReason:
          "Không lấy được diagnostics (timeout — Language Server không phản hồi kịp).",
      };
    }

    const allDiagnostics = vscode.languages.getDiagnostics(uri);
    const filteredDiagnostics = this.filterDiagnostics(allDiagnostics);

    return {
      diagnostics: filteredDiagnostics,
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
