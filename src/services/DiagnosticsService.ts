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

      logger.info("[DiagnosticsService] 🔍 ensureFileOpened check", {
        file: uri.fsPath,
        isAlreadyOpen,
      });

      // Kiểm tra kích thước file trước khi mở editor
      const stat = await vscode.workspace.fs.stat(uri);
      logger.info("[DiagnosticsService] 📏 File size check", {
        file: uri.fsPath,
        sizeBytes: stat.size,
        thresholdBytes: DiagnosticsService.MAX_FILE_SIZE_BYTES,
        willSkip: stat.size > DiagnosticsService.MAX_FILE_SIZE_BYTES,
      });

      if (stat.size > DiagnosticsService.MAX_FILE_SIZE_BYTES) {
        logger.info(
          "[DiagnosticsService] File too large, skipping diagnostics",
          {
            file: uri.fsPath,
            sizeBytes: stat.size,
            thresholdBytes: DiagnosticsService.MAX_FILE_SIZE_BYTES,
          },
        );
        return { success: false, alreadyOpen: false };
      }

      if (isAlreadyOpen) {
        // File đã mở → LSP đã có diagnostics cached
        // Không cần dummy edit/undo, sẽ dùng diagnostics hiện có
        logger.info("[DiagnosticsService] ✅ File already open, will use cached diagnostics", {
          file: uri.fsPath,
        });

        return { success: true, alreadyOpen: true };
      }

      logger.info("[DiagnosticsService] 📂 Opening document...", {
        file: uri.fsPath,
      });

      const doc = await vscode.workspace.openTextDocument(uri);

      logger.info("[DiagnosticsService] 📄 Document opened, showing in editor...", {
        file: uri.fsPath,
        languageId: doc.languageId,
        lineCount: doc.lineCount,
      });

      await vscode.window.showTextDocument(doc, {
        preview: true,
        preserveFocus: true,
        viewColumn: vscode.ViewColumn.Active,
      });

      logger.info("[DiagnosticsService] ✅ File opened successfully", {
        file: uri.fsPath,
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

      logger.info("[DiagnosticsService] 📦 Checking cached diagnostics for already-open file", {
        path: pathValue,
        cachedCount: cachedDiagnostics.length,
        isDirty,
      });

      // Chỉ dùng cache nếu file không dirty (không có thay đổi chưa phân tích)
      if (!isDirty) {
        logger.info("[DiagnosticsService] ✅ Using cached diagnostics (file not dirty)", {
          path: pathValue,
          diagnosticCount: cachedDiagnostics.length,
        });
        return true;
      }

      // File dirty → đợi LSP phân tích lại
      logger.info("[DiagnosticsService] ⏳ File is dirty, waiting for fresh diagnostics...", {
        path: pathValue,
        cachedCount: cachedDiagnostics.length,
      });
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

      logger.info("[DiagnosticsService] ⏳ Waiting for diagnostics (newly opened file)...", {
        path: pathValue,
        fallbackTimeout,
        maxTimeoutMs,
        stableWaitTime,
      });

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
        } else {
          logger.info(
            `[DiagnosticsService] ✅ Diagnostics received successfully`,
            {
              path: pathValue,
              elapsedTime,
              eventCount,
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
        logger.warn(
          "[DiagnosticsService] 🚨 Max timeout triggered",
          {
            path: pathValue,
            elapsedTime: Date.now() - startTime,
            hasReceivedEvent,
            eventCount,
          },
        );
        finish(true);
      }, maxTimeoutMs);

      const disposable = vscode.languages.onDidChangeDiagnostics((e) => {
        logger.info(
          "[DiagnosticsService] 🔔 onDidChangeDiagnostics event fired",
          {
            eventUris: e.uris.map(u => u.fsPath),
            targetUri: uri.fsPath,
            matches: e.uris.some(u => u.fsPath === uri.fsPath),
          },
        );

        const matchedUri = e.uris.find((u) => u.fsPath === uri.fsPath);
        if (matchedUri) {
          eventCount++;
          const currentDiagnostics = vscode.languages.getDiagnostics(matchedUri);
          logger.info(
            "[DiagnosticsService] 📊 Diagnostic event received for target file",
            {
              path: pathValue,
              eventCount,
              elapsedTime: Date.now() - startTime,
              isFirstEvent: !hasReceivedEvent,
              diagnosticCount: currentDiagnostics.length,
              diagnosticSummary: currentDiagnostics.map(d => ({
                severity: d.severity,
                message: d.message.substring(0, 100),
                source: d.source,
              })),
            },
          );

          if (!hasReceivedEvent) {
            hasReceivedEvent = true;
            clearTimeout(fallbackHandle);
            logger.info(
              "[DiagnosticsService] 🎯 First diagnostic event — clearing fallback timeout",
              {
                path: pathValue,
                elapsedTime: Date.now() - startTime,
              },
            );
          }
          if (stableTimeout) clearTimeout(stableTimeout);
          stableTimeout = setTimeout(() => {
            logger.info(
              "[DiagnosticsService] 🏁 Diagnostics stabilized — finishing",
              {
                path: pathValue,
                totalEvents: eventCount,
                totalElapsedTime: Date.now() - startTime,
              },
            );
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

    logger.info("[DiagnosticsService] 🚀 getDiagnostics started", {
      path: pathValue,
      uri: uri.fsPath,
      maxTimeoutMs,
      workspaceFolders: vscode.workspace.workspaceFolders?.map(f => f.uri.fsPath),
      activeTextEditor: vscode.window.activeTextEditor?.document.uri.fsPath,
    });

    if (this.isNonCodeFile(pathValue)) {
      logger.info("[DiagnosticsService] ⏭️ Skipping non-code file", {
        path: pathValue,
      });
      return { diagnostics: [] };
    }

    // 🆕 Check if custom LSP is enabled and process accordingly
    const customLSPService = CustomLSPService.getInstance();
    const customLSPResult = await customLSPService.processFileForCustomLSP(pathValue);

    logger.info("[DiagnosticsService] 🔧 Custom LSP check result", {
      shouldUseCustom: customLSPResult.shouldUseCustom,
      lspReady: customLSPResult.lspReady,
      languageId: customLSPResult.languageId,
      packageName: customLSPResult.packageName,
    });

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

    // Check existing diagnostics first
    const existingDiagnostics = vscode.languages.getDiagnostics(uri);
    logger.info("[DiagnosticsService] 📋 Existing diagnostics before opening", {
      path: pathValue,
      count: existingDiagnostics.length,
    });

    const openResult = await this.ensureFileOpened(uri);
    if (!openResult.success) {
      logger.warn("[DiagnosticsService] ⚠️ File not opened, returning skipped", {
        path: pathValue,
      });
      return {
        diagnostics: [],
        skippedReason: `File quá lớn (>${DiagnosticsService.MAX_FILE_SIZE_BYTES / 1024}KB), đã skip diagnostics để tránh crash máy.`,
      };
    }

    logger.info("[DiagnosticsService] ✅ File opened, waiting for diagnostics...", {
      path: pathValue,
      alreadyOpen: openResult.alreadyOpen,
      usingCustomLSP: customLSPResult.shouldUseCustom,
      currentlyOpenDocuments: vscode.workspace.textDocuments.map(d => ({
        uri: d.uri.fsPath,
        languageId: d.languageId,
        isDirty: d.isDirty,
      })),
    });

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
        logger.info("[DiagnosticsService] 💡 Using existing diagnostics as fallback", {
          path: pathValue,
          count: fallbackDiagnostics.length,
        });
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

    logger.info("[DiagnosticsService] 🎉 getDiagnostics completed", {
      path: pathValue,
      usingCustomLSP: customLSPResult.shouldUseCustom,
      totalDiagnostics: allDiagnostics.length,
      filteredCount: filteredDiagnostics.length,
      errors: filteredDiagnostics.filter(d => d.severity === 'Error').length,
      warnings: filteredDiagnostics.filter(d => d.severity === 'Warning').length,
      allDiagnosticsDetails: allDiagnostics.map(d => ({
        severity: d.severity,
        message: d.message,
        source: d.source,
        code: d.code,
        line: d.range.start.line + 1,
      })),
    });

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
