import * as fs from "fs";
import * as path from "path";
import { AgentAction, AgentExecutionResult } from "../types/AgentTypes";

export class FileEditCapability {
  async execute(action: AgentAction): Promise<AgentExecutionResult> {
    try {
      if (!action.path) {
        throw new Error("Missing file path");
      }

      if (action.content === undefined) {
        throw new Error("Missing content");
      }

      // Create backup before editing
      const backupPath = `${action.path}.backup`;
      if (fs.existsSync(action.path)) {
        await fs.promises.copyFile(action.path, backupPath);
      }

      await fs.promises.writeFile(action.path, action.content, "utf-8");

      return {
        success: true,
        data: {
          path: action.path,
          backupPath: backupPath,
          size: Buffer.byteLength(action.content, "utf-8"),
        },
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      };
    }
  }
}
