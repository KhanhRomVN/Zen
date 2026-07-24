/**
 *? Usage:
 *    Gửi input đến terminal đang chạy.
 *
 *? Function:
 *    handleTerminalInput(): Gửi input đến terminal đang chạy.
 */
import { ProcessManager } from "../../managers/ProcessManager";

export class TerminalInputHandler {
  constructor(private processManager: ProcessManager) {}

  public handleTerminalInput(message: any) {
    this.processManager.sendInput(message.terminalId, message.data);
  }
}