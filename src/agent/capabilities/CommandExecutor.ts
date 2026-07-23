// * CommandExecutor.ts - Thực thi lệnh shell trong workspace với timeout và giới hạn buffer.
import { exec } from "child_process";
import { promisify } from "util";
import { AgentAction, AgentExecutionResult } from "../../types";

const execAsync = promisify(exec);

// * Thực thi lệnh shell an toàn: timeout 30s, giới hạn buffer 10MB, trả về stdout/stderr.
export class CommandExecutor {
  private workspaceRoot: string;

  // * Nhận đường dẫn gốc của workspace để chạy lệnh trong đúng thư mục.
  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }

  // * Thực thi một lệnh shell. Trả về kết quả thành công kèm stdout/stderr, hoặc lỗi nếu thất bại.
  async execute(action: AgentAction): Promise<AgentExecutionResult> {
    try {
      if (!action.command) {
        throw new Error("Missing command");
      }

      const { stdout, stderr } = await execAsync(action.command, {
        cwd: this.workspaceRoot,
        timeout: 30000, // 30 seconds timeout
        maxBuffer: 1024 * 1024 * 10, // 10MB
      });

      return {
        success: true,
        data: {
          command: action.command,
          stdout: stdout,
          stderr: stderr,
        },
        timestamp: Date.now(),
      };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || String(error),
        data: {
          command: action.command,
          stdout: error.stdout || "",
          stderr: error.stderr || "",
        },
        timestamp: Date.now(),
      };
    }
  }
}