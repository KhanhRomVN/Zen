/**
 * ------------------------------------------------------------------
 * Diagnostics Service
 * ------------------------------------------------------------------
 * Dịch vụ tập trung xử lý diagnostics từ language server.
 * Dùng chung bởi ReadFileHandler, ReplaceInFileHandler, WriteToFileHandler,
 * RevertFileHandler, FileMiscHandler.
 *
 * Main functions:
 * - getDiagnostics()              : Mở file (nếu cần) → chờ diagnostics ổn định → trả về danh sách error/warning
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── VSCode ──
import * as vscode from "vscode";

// ── Services ──
import { LoggerService } from "./LoggerService";

// ─── Class ──────────────────────────────────────────────────────────────
export class DiagnosticsService {
  private static instance: DiagnosticsService;
  private firstDiagnosticsCallPerFile: Set<string> = new Set();

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

  /**
   * Kiểm tra xem có phải lần đầu tiên lấy diagnostics cho file extension này không.
   * Dùng để điều chỉnh timeout cho phù hợp với LSP cold start.
   */
  private isFirstCallForExtension(pathValue: string): boolean {
    const ext = pathValue.substring(pathValue.lastIndexOf("."));
    if (this.firstDiagnosticsCallPerFile.has(ext)) {
      return false;
    }
    this.firstDiagnosticsCallPerFile.add(ext);
    return true;
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
      const existingDiagnostics = vscode.languages.getDiagnostics(uri);
      const isDirty = doc?.isDirty ?? false;

      // Chỉ dùng cache nếu file không dirty và đã có diagnostics
      if (!isDirty && existingDiagnostics.length > 0) {
        return true;
      }
    }

    // File mới mở → đợi LSP phân tích
    return new Promise<boolean>((resolve) => {
      // Timeout dài hơn cho lần đầu tiên của mỗi loại file extension (LSP cold start)
      const isFirstCall = this.isFirstCallForExtension(pathValue);
      const fallbackTimeout = isFirstCall ? 30000 : 10000;
      const stableWaitTime = 4000;
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
    retryCount: number = 0,
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
    needsManualCheck?: boolean;
  }> {
    const logger = LoggerService.getInstance();

    if (this.isNonCodeFile(pathValue)) {
      return { diagnostics: [] };
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
        retryCount,
      });

      // Fallback 1: Đọc diagnostics hiện có (có thể đã có từ lần trước hoặc LSP đã phân tích nhưng chưa fire event)
      const fallbackDiagnostics = vscode.languages.getDiagnostics(uri);
      if (fallbackDiagnostics.length > 0) {
        logger.info(
          "[DiagnosticsService] ✅ Found existing diagnostics despite timeout",
          {
            path: pathValue,
            count: fallbackDiagnostics.length,
          },
        );
        return {
          diagnostics: this.filterDiagnostics(fallbackDiagnostics),
        };
      }

      // Fallback 2: Retry 1 lần duy nhất (LSP có thể cần thêm thời gian)
      if (retryCount === 0) {
        logger.info(
          "[DiagnosticsService] 🔄 Retrying diagnostics (LSP might need more time)...",
          { path: pathValue },
        );
        await new Promise((r) => setTimeout(r, 2000)); // Đợi thêm 2s
        return this.getDiagnostics(uri, pathValue, maxTimeoutMs, 1);
      }

      // Fallback 3: Không lấy được sau retry → báo AI cần check thủ công
      return {
        diagnostics: [],
        skippedReason:
          "⚠️ LSP TIMEOUT sau 2 lần thử — Language Server không phản hồi. " +
          "Có thể do: (1) LSP đang khởi động, (2) File quá phức tạp, (3) LSP crashed. " +
          "🔧 HÀNH ĐỘNG: Sử dụng read_file() để đọc nội dung file và kiểm tra syntax thủ công.",
        needsManualCheck: true,
      };
    }

    const allDiagnostics = vscode.languages.getDiagnostics(uri);
    const filteredDiagnostics = this.filterDiagnostics(allDiagnostics);

    return {
      diagnostics: filteredDiagnostics,
    };
  }
}
