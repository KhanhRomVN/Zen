/**
 *? Usage:
 *    Gửi input đến terminal đang chạy.
 *
 *? Function:
 *    handleTerminalInput(): Gửi input đến terminal đang chạy.
 */
import { TerminalManager } from "../../managers/TerminalManager";

export class TerminalInputHandler {
  constructor(private terminalManager: TerminalManager) {}

  public handleTerminalInput(message: any) {
    this.terminalManager.sendInput(message.terminalId, message.data);
  }
}
