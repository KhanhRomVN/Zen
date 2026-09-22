/**
 * ------------------------------------------------------------------
 * Rule Handler
 * ------------------------------------------------------------------
 * Nhận message từ webview để liệt kê và tạo Rule (xem RuleService).
 *
 * Commands (từ webview qua postMessage):
 * - listRules  : đọc toàn bộ rule từ rules.json
 * - createRule : tạo 1 rule mới { name, content }
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── VSCode ──
import * as vscode from "vscode";

// ── Services ──
import { RuleService } from "../../services/RuleService";

// ─── Class ──────────────────────────────────────────────────────────────
export class RuleHandler {
  private readonly ruleService = new RuleService();

  public async handleRuleOperation(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    const { requestId, command } = message;

    try {
      let data: any;

      switch (command) {
        case "listRules": {
          data = this.ruleService.list();
          break;
        }
        case "createRule": {
          const { name, content } = message;
          if (!name || !content) {
            throw new Error("createRule requires name and content");
          }
          data = this.ruleService.create(name, content);
          break;
        }
        default:
          throw new Error(`Unknown rule command: ${command}`);
      }

      webviewView.webview.postMessage({
        command: `${command}Response`,
        requestId,
        data,
      });
    } catch (err: any) {
      console.error("[RuleHandler] error:", err.message);
      webviewView.webview.postMessage({
        command: `${command}Response`,
        requestId,
        error: err.message || "Rule operation failed",
      });
    }
  }
}