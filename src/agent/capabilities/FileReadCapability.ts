import * as fs from "fs";
import * as path from "path";
import { AgentAction, AgentExecutionResult } from "../types/AgentTypes";

export class FileReadCapability {
  async execute(action: AgentAction): Promise<AgentExecutionResult> {
    try {
      if (!action.path) {
        throw new Error("Missing file path");
      }

      const content = await fs.promises.readFile(action.path, "utf-8");

      return {
        success: true,
        data: {
          path: action.path,
          content: content,
          size: Buffer.byteLength(content, "utf-8"),
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
