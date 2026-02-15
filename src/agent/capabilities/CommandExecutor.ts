import { exec } from "child_process";
import { promisify } from "util";
import { AgentAction, AgentExecutionResult } from "../types/AgentTypes";

const execAsync = promisify(exec);

export class CommandExecutor {
  private workspaceRoot: string;

  constructor(workspaceRoot: string) {
    this.workspaceRoot = workspaceRoot;
  }

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
