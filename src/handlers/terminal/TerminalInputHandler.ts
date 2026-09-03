/**
 * ------------------------------------------------------------------
 * Terminal Input Handler
 * ------------------------------------------------------------------
 * Gửi input đến terminal đang chạy.
 *
 * Main functions:
 * - handleTerminalInput() : Gửi input đến terminal đang chạy
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Managers ──
import { TerminalManager } from "../../managers/TerminalManager";

// ─── Class ──────────────────────────────────────────────────────────────
export class TerminalInputHandler {
  constructor(private terminalManager: TerminalManager) {}

  public handleTerminalInput(message: any) {
    this.terminalManager.sendInput(message.terminalId, message.data);
  }
}
