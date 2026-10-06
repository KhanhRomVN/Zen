/**
 * ------------------------------------------------------------------
 * Memory Handler
 * ------------------------------------------------------------------
 * Quản lý file memory.md per-project tại:
 *   ~/.khanhromvn-zen/projects/{projectHash}/memory.md
 *
 * Hai thao tác:
 * - handleReadMemory()    : Đọc toàn bộ nội dung memory.md (trả "" nếu chưa có)
 * - handleUpdateMemory()  : Replace old_content → new_content trong memory.md.
 *                           Nếu file chưa tồn tại, tự động tạo rỗng rồi áp dụng replace.
 *                           Lần đầu tiên (file trống) cho phép new_content rỗng để khởi tạo.
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

import { LoggerService } from "../../services/LoggerService";
import { PathService } from "../../services/PathService";

export class MemoryHandler {
  private pathService: PathService;
  private _queue: Promise<void> = Promise.resolve();

  constructor() {
    this.pathService = PathService.getInstance();
  }

  private getMemoryFilePath(): string | null {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (!workspaceFolder) return null;
    return this.pathService.getMemoryFilePath(workspaceFolder.uri.fsPath);
  }

  private ensureParentDir(filePath: string): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private readMemoryContent(filePath: string): string {
    try {
      if (!fs.existsSync(filePath)) return "";
      return fs.readFileSync(filePath, "utf8");
    } catch (e: any) {
      LoggerService.getInstance().error("[MemoryHandler] read failed", {
        error: e.message,
      });
      return "";
    }
  }

  private writeMemoryContent(filePath: string, content: string): void {
    this.ensureParentDir(filePath);
    fs.writeFileSync(filePath, content, "utf8");
  }

  private enqueue<T>(operation: () => Promise<T>): Promise<T> {
    const logger = LoggerService.getInstance();
    this._queue = this._queue
      .then(() => operation())
      .catch((err) => {
        logger.error("[MemoryHandler] queue error", { error: err.message });
        throw err;
      }) as Promise<void>;
    return this._queue as Promise<T>;
  }

  // ── Read Memory ──
  public async handleReadMemory(
    message: any,
    webviewView: vscode.WebviewView,
  ): Promise<void> {
    await this.enqueue(async () => {
      const filePath = this.getMemoryFilePath();
      if (!filePath) {
        webviewView.webview.postMessage({
          command: "readMemoryResult",
          requestId: message.requestId,
          error: "No workspace folder open.",
        });
        return;
      }
      const content = this.readMemoryContent(filePath);
      webviewView.webview.postMessage({
        command: "readMemoryResult",
        requestId: message.requestId,
        path: filePath,
        content,
        exists: fs.existsSync(filePath),
      });
    }).catch(() => {});
  }

  // ── Update Memory ──
  public async handleUpdateMemory(
    message: any,
    webviewView: vscode.WebviewView,
  ): Promise<void> {
    await this.enqueue(async () => {
      const filePath = this.getMemoryFilePath();
      if (!filePath) {
        webviewView.webview.postMessage({
          command: "updateMemoryResult",
          requestId: message.requestId,
          error: "No workspace folder open.",
        });
        return;
      }

      const oldContent: string = message.old_content ?? "";
      const newContent: string = message.new_content ?? "";

      let current = this.readMemoryContent(filePath);
      const isFirstInit = !fs.existsSync(filePath) && current.length === 0;

      // Trường hợp khởi tạo lần đầu: file chưa có hoặc rỗng.
      // Cho phép old_content rỗng + new_content bất kỳ (kể cả rỗng).
      if (isFirstInit) {
        if (oldContent !== "") {
          webviewView.webview.postMessage({
            command: "updateMemoryResult",
            requestId: message.requestId,
            error:
              "Memory file is empty/new — old_content must be \"\" for the first write.",
          });
          return;
        }
        this.writeMemoryContent(filePath, newContent);
        webviewView.webview.postMessage({
          command: "updateMemoryResult",
          requestId: message.requestId,
          path: filePath,
          success: true,
          created: true,
          content: newContent,
        });
        return;
      }

      // File đã có nội dung — thực hiện replace đúng semantics của replace_in_file.
      if (oldContent === "") {
        webviewView.webview.postMessage({
          command: "updateMemoryResult",
          requestId: message.requestId,
          error:
            "old_content cannot be empty when memory already has content — supply the exact snippet to replace.",
        });
        return;
      }

      const idx = current.indexOf(oldContent);
      if (idx === -1) {
        webviewView.webview.postMessage({
          command: "updateMemoryResult",
          requestId: message.requestId,
          error: "old_content not found in memory file.",
        });
        return;
      }

      const updated =
        current.slice(0, idx) + newContent + current.slice(idx + oldContent.length);

      if (updated === current) {
        webviewView.webview.postMessage({
          command: "updateMemoryResult",
          requestId: message.requestId,
          error: "No change made.",
        });
        return;
      }

      this.writeMemoryContent(filePath, updated);
      webviewView.webview.postMessage({
        command: "updateMemoryResult",
        requestId: message.requestId,
        path: filePath,
        success: true,
        created: false,
        content: updated,
      });
    }).catch(() => {});
  }

  // ── Save Memory (toàn bộ nội dung, dùng bởi Settings UI editor) ──
  public async handleSaveMemory(
    message: any,
    webviewView: vscode.WebviewView,
  ): Promise<void> {
    await this.enqueue(async () => {
      const filePath = this.getMemoryFilePath();
      if (!filePath) {
        webviewView.webview.postMessage({
          command: "saveMemoryResult",
          requestId: message.requestId,
          error: "No workspace folder open.",
        });
        return;
      }
      const content: string = typeof message.content === "string" ? message.content : "";
      try {
        this.writeMemoryContent(filePath, content);
        webviewView.webview.postMessage({
          command: "saveMemoryResult",
          requestId: message.requestId,
          path: filePath,
          success: true,
          content,
        });
      } catch (e: any) {
        webviewView.webview.postMessage({
          command: "saveMemoryResult",
          requestId: message.requestId,
          error: e?.message || "Failed to write memory file.",
        });
      }
    }).catch(() => {});
  }

  /**
   * Đọc trực tiếp nội dung memory.md (không qua IPC) — dùng cho PromptBuilder
   * khi cần nhúng "# Memory" vào system prompt mỗi lượt gửi.
   */
  public static getMemorySnapshot(): string {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) return "";
      const svc = PathService.getInstance();
      const fp = svc.getMemoryFilePath(workspaceFolder.uri.fsPath);
      if (!fs.existsSync(fp)) return "";
      return fs.readFileSync(fp, "utf8");
    } catch {
      return "";
    }
  }
}