/**
 *? Usage:
 *    Dừng lệnh đang chạy (theo actionId hoặc terminalId).
 *
 *? Function:
 *    handleStopCommand(): Dừng lệnh đang chạy (theo actionId hoặc terminalId).
 */
import { ProcessManager } from "../../managers/ProcessManager";

export class StopCommandHandler {
  constructor(private processManager: ProcessManager) {}

  public async handleStopCommand(message: any) {
    if (message.actionId === "all") {
      this.processManager.stopAll();
    } else if (message.terminalId) {
      this.processManager.stop(message.terminalId);
    } else {
      const target = this.processManager
        .list()
        .find((t) => t.activeActionId === message.actionId);
      if (target) {
        this.processManager.stop(target.id);
      }
    }
  }
}