/**
 *? Usage:
 *    Tạo file mới trong workspace (từ chối nếu file đã tồn tại). Tự động tạo thư mục cha.
 *
 *? Function:
 *    execute(): Kiểm tra file chưa tồn tại, tạo thư mục nếu cần, ghi nội dung từ action.content.
 */
import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";

// TYPES
import { AgentAction, AgentExecutionResult } from "../../types";

export class FileWriteCapability {
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
      for (const candidate of candidates) {
        try {
          // Check if file already exists
          await fs.promises.access(candidate, fs.constants.F_OK);
          // File exists, but we need to create new file, so throw error
          throw new Error(`File already exists: ${candidate}`);
        } catch (e: any) {
          if (e.message && e.message.includes("already exists")) {
            throw e;
          }
          // File doesn't exist, use this candidate
          targetPath = candidate;
          break;
        }
      }

      if (!targetPath) {
        // If all candidates exist (shouldn't happen), use first candidate
        targetPath = candidates[0] || action.path;
        if (fs.existsSync(targetPath)) {
          throw new Error(`File already exists: ${targetPath}`);
        }
      }

      // Create directories if needed
      const dir = path.dirname(targetPath);
      await fs.promises.mkdir(dir, { recursive: true });

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
