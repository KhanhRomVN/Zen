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

      await fs.promises.writeFile(action.path, action.content, "utf-8");

      return {
        success: true,
        data: {
          path: action.path,
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
