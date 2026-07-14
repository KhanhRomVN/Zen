import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { AgentAction, AgentExecutionResult } from "../../types";

export class FileEditCapability {
  async execute(action: AgentAction): Promise<AgentExecutionResult> {
    try {
      if (!action.path) {
        throw new Error("Missing file path");
      }

      if (action.content === undefined) {
        throw new Error("Missing content");
      }

      const workspaceRoot =
        vscode.workspace.workspaceFolders?.[0]?.uri.fsPath ?? "";
      const candidates = path.isAbsolute(action.path)
        ? [action.path, path.join(workspaceRoot, action.path)]
        : [path.join(workspaceRoot, action.path), action.path];

      let targetPath: string | undefined;
      let lastError: unknown;
      for (const candidate of candidates) {
        try {
          // Check if file exists for edit
          await fs.promises.access(candidate, fs.constants.F_OK);
          targetPath = candidate;
          break;
        } catch (e) {
          lastError = e;
        }
      }

      if (!targetPath) {
        // If no existing file found, use the first candidate (prefer workspace-relative)
        targetPath = candidates[0] || action.path;
        // Ensure directory exists
        const dir = path.dirname(targetPath);
        await fs.promises.mkdir(dir, { recursive: true });
      }

      await fs.promises.writeFile(targetPath, action.content, "utf-8");

      return {
        success: true,
        data: {
          path: targetPath,
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
