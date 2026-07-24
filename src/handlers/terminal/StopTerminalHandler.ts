/**
 *? Usage:
 *    Đóng terminal (không gửi response).
 *
 *? Function:
 *    handleStopTerminal(): Đóng terminal (không gửi response).
 */
import { ProcessManager } from "../../managers/ProcessManager";

export class StopTerminalHandler {
  constructor(private processManager: ProcessManager) {}

  public handleStopTerminal(message: any) {
    this.processManager.close(message.terminalId);
  }
}