/**
 * ------------------------------------------------------------------
 * Agents Md Handler
 * ------------------------------------------------------------------
 * Đọc AGENTS.md ở root workspace để nhúng vào system prompt.
 * Nếu root là root project (có .git, package.json...) mà chưa có
 * AGENTS.md thì tự tạo file rỗng.
 *
 * Main functions:
 * - getAgentsMdSnapshot() : Trả về nội dung AGENTS.md ("" nếu rỗng/không có)
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";

import { LoggerService } from "../../services/LoggerService";

const ROOT_MARKERS = [
  ".git",
  "package.json",
  "pyproject.toml",
  "Cargo.toml",
  "go.mod",
  "pom.xml",
];

export class AgentsMdHandler {
  public static getAgentsMdSnapshot(): string {
    try {
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) return "";
      const rootPath = workspaceFolder.uri.fsPath;
      const filePath = path.join(rootPath, "AGENTS.md");
      if (!fs.existsSync(filePath)) {
        const isProjectRoot = ROOT_MARKERS.some((m) =>
          fs.existsSync(path.join(rootPath, m)),
        );
        if (isProjectRoot) fs.writeFileSync(filePath, "", "utf8");
        return "";
      }
      return fs.readFileSync(filePath, "utf8");
    } catch (e: any) {
      LoggerService.getInstance().error("[AgentsMdHandler] read failed", {
        error: e?.message,
      });
      return "";
    }
  }
}