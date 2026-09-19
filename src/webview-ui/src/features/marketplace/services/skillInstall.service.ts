/**
 * ------------------------------------------------------------------
 * Skill Install Service
 * ------------------------------------------------------------------
 * Giao tiếp với extension host để quản lý danh sách skill đã cài.
 * Dữ liệu được lưu file JSON trong `~/.khanhromvn-zen/skills/`.
 *
 * API:
 * - listInstalledSkills() : đọc toàn bộ skill đã cài
 * - installSkill(skill)   : lưu 1 skill vào đĩa
 * - uninstallSkill(slug)  : xoá skill khỏi đĩa
 * ------------------------------------------------------------------
 */

import type { SkillSummary, SkillDetail } from "../types/skill.types";
import {
  messageDispatcher,
  extensionService,
} from "../../../services/ExtensionService";

const REQUEST_TIMEOUT_MS = 10000;

/** Kiểu dữ liệu skill đã cài — union giữa summary và detail. */
export type InstalledSkill = SkillSummary | SkillDetail;

/**
 * Gửi lệnh tới extension host và chờ response theo requestId.
 */
function requestExtension(
  command: "listInstalledSkills" | "installSkill" | "uninstallSkill",
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

/** Đọc toàn bộ skill đã cài từ extension host. */
export async function listInstalledSkills(): Promise<InstalledSkill[]> {
  const data = await requestExtension("listInstalledSkills");
  return Array.isArray(data) ? (data as InstalledSkill[]) : [];
}

/** Lưu 1 skill vào thư mục skills/. */
export async function installSkill(
  skill: SkillSummary | SkillDetail,
): Promise<void> {
  await requestExtension("installSkill", { skill });
}

/** Xoá skill khỏi thư mục skills/ theo slug. */
export async function uninstallSkill(slug: string): Promise<void> {
  await requestExtension("uninstallSkill", { slug });
}