/**
 * ------------------------------------------------------------------
 * Skill Workspace State Handler
 * ------------------------------------------------------------------
 * Lưu trạng thái tạm (toggle on/off + groups) của skill marketplace
 * theo từng workspace, dùng VSCode workspaceState API.
 *
 * Đặc điểm:
 * - Không ghi ra file config cho user (chỉ VSCode quản lý trong state DB)
 * - Tự động persist qua restart VSCode
 * - Tự động scope theo workspace folder đang mở
 *
 * Commands (từ webview qua postMessage):
 * - loadSkillWorkspaceState : trả về state hiện tại của workspace
 * - saveSkillWorkspaceState : ghi đè toàn bộ state
 * ------------------------------------------------------------------
 */

import * as vscode from "vscode";

/** Trạng thái tạm của skill marketplace theo workspace. */
export interface SkillWorkspaceState {
  /** Map slug → trạng thái bật/tắt cho workspace hiện tại. */
  toggles: Record<string, boolean>;
  /** Danh sách group do user tạo; skill không thuộc group nào sẽ vào "Other". */
  groups: Array<{ name: string; slugs: string[]; icon?: string }>;
  /** Map groupName → collapsed. */
  collapsedGroups: Record<string, boolean>;
}

const DEFAULT_STATE: SkillWorkspaceState = {
  toggles: {},
  groups: [],
  collapsedGroups: {},
};

export class SkillWorkspaceStateHandler {
  constructor(private readonly context: vscode.ExtensionContext) {}

  /** Key storage — scope theo workspace root để an toàn khi multi-root. */
  private getKey(): string {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const root = workspaceFolder?.uri.fsPath || "__no_workspace__";
    return `zen-skill-workspace-state:${root}`;
  }

  public async handleSkillWorkspaceState(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    const { requestId, command } = message;

    try {
      let data: any;

      switch (command) {
        case "loadSkillWorkspaceState": {
          const stored = this.context.workspaceState.get<SkillWorkspaceState>(
            this.getKey(),
          );
          data = stored ?? DEFAULT_STATE;
          break;
        }

        case "saveSkillWorkspaceState": {
          const state = message.state;
          if (!state || typeof state !== "object") {
            throw new Error(
              "saveSkillWorkspaceState requires a valid state object",
            );
          }
          await this.context.workspaceState.update(this.getKey(), state);
          data = { ok: true };
          break;
        }

        default:
          throw new Error(
            `Unknown skill workspace state command: ${command}`,
          );
      }

      webviewView.webview.postMessage({
        command: `${command}Response`,
        requestId,
        data,
      });
    } catch (err: any) {
      console.error("[SkillWorkspaceStateHandler] error:", err.message);
      webviewView.webview.postMessage({
        command: `${command}Response`,
        requestId,
        error: err.message || "Skill workspace state operation failed",
      });
    }
  }
}