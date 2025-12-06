import * as fs from "fs";
import * as path from "path";
import { AgentAction, AgentExecutionResult } from "../types/AgentTypes";

export class FileAddCapability {
  async execute(action: AgentAction): Promise<AgentExecutionResult> {
    try {
      if (!action.path) {
        throw new Error("Missing file path");
      }

      if (action.content === undefined) {
        throw new Error("Missing content");
      }

      // Check if file already exists
      if (fs.existsSync(action.path)) {
        throw new Error("File already exists");
      }

      // Create directories if needed
      const dir = path.dirname(action.path);
      await fs.promises.mkdir(dir, { recursive: true });

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
