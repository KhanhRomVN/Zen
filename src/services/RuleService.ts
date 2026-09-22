/**
 * ------------------------------------------------------------------
 * Rule Service
 * ------------------------------------------------------------------
 * Quản lý danh sách Rule của người dùng, lưu trong file JSON duy nhất
 * tại ~/.khanhromvn-zen/rules.json (mảng các Rule). Mỗi Rule gồm tên
 * và nội dung markdown do người dùng tự soạn.
 *
 * Main functions:
 * - list()   : Đọc toàn bộ rule đã lưu
 * - create() : Tạo rule mới, thêm vào rules.json
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Node ──
import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

// ── Services ──
import { PathService } from "./PathService";

// ─── Interfaces ─────────────────────────────────────────────────────────
export interface Rule {
  id: string;
  name: string;
  content: string;
  createdAt: number;
}

// ─── Class ──────────────────────────────────────────────────────────────
export class RuleService {
  private readonly pathService = PathService.getInstance();

  /** Đường dẫn file lưu toàn bộ rule: ~/.khanhromvn-zen/rules.json */
  private getRulesFilePath(): string {
    return path.join(this.pathService.getContextRoot(), "rules.json");
  }

  /** Đọc toàn bộ rule đã lưu. Trả về mảng rỗng nếu chưa có file hoặc file lỗi. */
  public list(): Rule[] {
    const filePath = this.getRulesFilePath();
    if (!fs.existsSync(filePath)) {
      return [];
    }
    try {
      const raw = fs.readFileSync(filePath, "utf8");
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err: any) {
      console.error("[RuleService] failed to read rules.json:", err.message);
      return [];
    }
  }

  /** Tạo rule mới và ghi lại toàn bộ danh sách vào rules.json. */
  public create(name: string, content: string): Rule {
    const rules = this.list();
    const rule: Rule = {
      id: crypto.randomBytes(6).toString("hex"),
      name,
      content,
      createdAt: Date.now(),
    };
    rules.push(rule);

    const dir = this.pathService.getContextRoot();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(
      this.getRulesFilePath(),
      JSON.stringify(rules, null, 2),
      "utf8",
    );
    return rule;
  }
}