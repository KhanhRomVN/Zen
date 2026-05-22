import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { AgentAction, AgentExecutionResult } from "../types/AgentTypes";

export class FileReadCapability {
  async execute(action: AgentAction): Promise<AgentExecutionResult> {
    try {
      if (!action.path) {
        throw new Error("Missing file path");
      }

      const workspaceRoot =
        vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "";
      const candidates = path.isAbsolute(action.path)
        ? [action.path, path.join(workspaceRoot, action.path)]
        : [path.join(workspaceRoot, action.path), action.path];

      let content: string | undefined;
      let lastError: unknown;
      for (const candidate of candidates) {
        try {
          content = await fs.promises.readFile(candidate, "utf-8");
          break;
        } catch (e) {
          lastError = e;
        }
      }

      if (content === undefined) throw lastError;

      return {
        success: true,
        data: {
          path: action.path,
          content,
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
