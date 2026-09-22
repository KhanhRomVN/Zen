/**
 * ------------------------------------------------------------------
 * Rule Service (webview)
 * ------------------------------------------------------------------
 * Giao tiếp với extension host để liệt kê và tạo Rule. Dữ liệu được
 * lưu tập trung trong file `~/.khanhromvn-zen/rules.json` (xem
 * RuleService phía extension host).
 *
 * API:
 * - listRules()            : đọc toàn bộ rule đã lưu
 * - createRule(name, text) : tạo 1 rule mới
 * ------------------------------------------------------------------
 */

import { messageDispatcher, extensionService } from "./ExtensionService";

export interface Rule {
  id: string;
  name: string;
  content: string;
  createdAt: number;
}

const REQUEST_TIMEOUT_MS = 10000;

function requestExtension(
  command: "listRules" | "createRule",
  payload: Record<string, any> = {},
): Promise<any> {
  return new Promise((resolve, reject) => {
    const requestId = `${command}-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 8)}`;

    messageDispatcher.register(
      requestId,
      (message: any) => {
        if (message.error) {
          reject(new Error(message.error));
        } else {
          resolve(message.data);
        }
      },
      REQUEST_TIMEOUT_MS,
      () => reject(new Error(`${command} timeout after ${REQUEST_TIMEOUT_MS}ms`)),
    );

    extensionService.postMessage({ command, requestId, ...payload });
  });
}

/** Đọc toàn bộ rule đã lưu từ extension host. */
export async function listRules(): Promise<Rule[]> {
  const data = await requestExtension("listRules");
  return Array.isArray(data) ? (data as Rule[]) : [];
}

/** Tạo 1 rule mới, trả về rule vừa tạo (kèm id do extension host sinh ra). */
export async function createRule(
  name: string,
  content: string,
): Promise<Rule> {
  return requestExtension("createRule", { name, content });
}