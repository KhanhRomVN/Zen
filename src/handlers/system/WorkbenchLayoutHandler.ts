/**
 * ------------------------------------------------------------------
 * Workbench Layout Handler
 * ------------------------------------------------------------------
 * Điều khiển layout của VS Code workbench theo yêu cầu từ webview,
 * hiện tại: maximize/restore secondary sidebar (auxiliary bar).
 *
 * Main functions:
 * - handleToggleMaximizedSidebar() : Bật/tắt maximize secondary sidebar
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── VSCode ──
import * as vscode from "vscode";

// ─── Class ──────────────────────────────────────────────────────────────
export class WorkbenchLayoutHandler {
  /**
   * Bật/tắt maximize secondary sidebar. Lệnh chỉ có ở VS Code bản mới,
   * bản cũ sẽ reject → hiện cảnh báo thay vì lỗi im lặng.
   */
  public async handleToggleMaximizedSidebar() {
    try {
      await vscode.commands.executeCommand(
        "workbench.action.toggleMaximizedAuxiliaryBar",
      );
    } catch (error) {
      vscode.window.showWarningMessage(
        "Zen: this VS Code version does not support maximizing the secondary sidebar. Please update VS Code.",
      );
    }
  }
}