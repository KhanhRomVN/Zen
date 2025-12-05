import * as fs from "fs";
import * as path from "path";
import * as os from "os";

export interface GlobalServerState {
  port: number;
  pid: number;
  timestamp: number;
  instanceCount: number;
}

export class GlobalStateManager {
  private static STATE_FILE_PATH = path.join(
    os.tmpdir(),
    "zen-extension-server-state.json"
  );

  /**
   * Đọc server state từ file
   */
  public static readState(): GlobalServerState | null {
    try {
      if (!fs.existsSync(this.STATE_FILE_PATH)) {
        return null;
      }

      const content = fs.readFileSync(this.STATE_FILE_PATH, "utf8");
      const state = JSON.parse(content) as GlobalServerState;

      // Validate state
      if (!this.isProcessRunning(state.pid)) {
        // Process đã chết, xóa state file
        this.clearState();
        return null;
      }

      return state;
    } catch (error) {
      console.error("[GlobalStateManager] Error reading state:", error);
      return null;
    }
  }

  /**
   * Ghi server state vào file
   */
  public static writeState(state: GlobalServerState): void {
    try {
      fs.writeFileSync(
        this.STATE_FILE_PATH,
        JSON.stringify(state, null, 2),
        "utf8"
      );
    } catch (error) {
      console.error("[GlobalStateManager] Error writing state:", error);
    }
  }

  /**
   * Increment instance count
   */
  public static incrementInstanceCount(): void {
    const state = this.readState();
    if (state) {
      state.instanceCount++;
      state.timestamp = Date.now();
      this.writeState(state);
    }
  }

  /**
   * Decrement instance count
   */
  public static decrementInstanceCount(): number {
    const state = this.readState();
    if (state) {
      state.instanceCount = Math.max(0, state.instanceCount - 1);
      state.timestamp = Date.now();
      this.writeState(state);
      return state.instanceCount;
    }
    return 0;
  }

  /**
   * Xóa state file
   */
  public static clearState(): void {
    try {
      if (fs.existsSync(this.STATE_FILE_PATH)) {
        fs.unlinkSync(this.STATE_FILE_PATH);
      }
    } catch (error) {
      console.error("[GlobalStateManager] Error clearing state:", error);
    }
  }

  /**
   * Check if process đang chạy
   */
  private static isProcessRunning(pid: number): boolean {
    try {
      // Send signal 0 để check process existence (không kill process)
      process.kill(pid, 0);
      return true;
    } catch (error) {
      return false;
    }
  }
}
