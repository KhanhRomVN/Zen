/**
 * ClaudeRawLogger
 * Ghi raw response từ Claude provider ra file log để debug.
 * Raw = nội dung chưa qua ClaudeContentProcessor.
 */

const LOG_FILE_KEY = "zen-claude-raw-log-enabled";

export class ClaudeRawLogger {
  private static buffer: string[] = [];
  private static sessionId: string = "";

  /** Bật/tắt logging qua localStorage */
  static isEnabled(): boolean {
    return localStorage.getItem(LOG_FILE_KEY) === "true";
  }

  static enable(): void {
    localStorage.setItem(LOG_FILE_KEY, "true");
  }

  static disable(): void {
    localStorage.setItem(LOG_FILE_KEY, "false");
  }

  /** Gọi mỗi lần nhận raw chunk từ SSE stream */
  static logChunk(providerId: string | undefined, chunk: string): void {
    if (!this.isEnabled()) return;
    if (providerId !== "claude") return;

    if (!this.sessionId) {
      this.sessionId = new Date().toISOString().replace(/[:.]/g, "-");
    }

    const timestamp = new Date().toISOString();
    const entry = `[${timestamp}] CHUNK (${chunk.length} chars):\n${chunk}\n---`;
    this.buffer.push(entry);

    // Auto-flush mỗi 50 chunks để tránh mất dữ liệu nếu crash
    if (this.buffer.length >= 50) {
      this.flush();
    }
  }

  /** Gọi khi stream kết thúc để flush toàn bộ */
  static logStreamEnd(
    providerId: string | undefined,
    fullContent: string,
  ): void {
    if (!this.isEnabled()) return;
    if (providerId !== "claude") return;

    const timestamp = new Date().toISOString();
    const entry = `\n[${timestamp}] === FULL RAW CONTENT (${fullContent.length} chars) ===\n${fullContent}\n=== END ===\n`;
    this.buffer.push(entry);
    this.flush();
  }

  /** Dump buffer ra console dưới dạng downloadable blob */
  private static flush(): void {
    if (this.buffer.length === 0) return;

    const header = `=== Claude Raw Response Log (Session: ${this.sessionId}) ===\n\n`;
    const body = this.buffer.join("\n");
    const fullLog = header + body;

    // Tạo downloadable blob URL
    const blob = new Blob([fullLog], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const filename = `claude-raw-${this.sessionId}.log`;

    // Tự động trigger download
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.style.display = "none";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.buffer = [];
  }
}
