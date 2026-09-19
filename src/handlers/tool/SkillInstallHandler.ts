/**
 * ------------------------------------------------------------------
 * Skill Install Handler
 * ------------------------------------------------------------------
 * Quản lý danh sách skill đã cài đặt của Zen, lưu trữ dưới dạng file
 * JSON trong thư mục `~/.khanhromvn-zen/skills/`.
 *
 * Mỗi skill = 1 file `{slug}.json` chứa toàn bộ metadata (SkillSummary
 * hoặc SkillDetail). Việc tách file giúp dễ đọc, dễ backup, và có thể
 * mở rộng lưu nội dung markdown của skill về sau.
 *
 * Commands (từ webview qua postMessage):
 * - listInstalledSkills : đọc toàn bộ file trong skills/ → trả về mảng object
 * - installSkill        : ghi 1 skill vào skills/{slug}.json
 * - uninstallSkill      : xóa skills/{slug}.json
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── VSCode ──
import * as vscode from "vscode";

// ── Node ──
import * as path from "path";
import * as fs from "fs";

// ── Services ──
import { PathService } from "../../services/PathService";

// ─── Class ──────────────────────────────────────────────────────────────
export class SkillInstallHandler {
  private readonly pathService = PathService.getInstance();

  /** Đường dẫn thư mục lưu skill: ~/.khanhromvn-zen/skills */
  private getSkillsDir(): string {
    return path.join(this.pathService.getContextRoot(), "skills");
  }

  /** Đảm bảo thư mục skills tồn tại trước khi đọc/ghi. */
  private ensureSkillsDir(): void {
    const dir = this.getSkillsDir();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Chuẩn hoá slug thành tên file an toàn (loại bỏ ký tự không hợp lệ).
   * Slug từ API đã dạng kebab-case nên chủ yếu để phòng thủ.
   */
  private slugToFile(slug: string): string {
    const safe = slug.replace(/[^a-zA-Z0-9._-]/g, "_");
    return path.join(this.getSkillsDir(), `${safe}.json`);
  }

  /**
   * Đọc toàn bộ skill đã cài — trả về mảng object metadata.
   * Bỏ qua file lỗi/không parse được thay vì throw.
   */
  private readInstalledSkills(): any[] {
    this.ensureSkillsDir();
    const dir = this.getSkillsDir();
    const files = fs.readdirSync(dir).filter((f) => f.endsWith(".json"));

    const skills: any[] = [];
    for (const file of files) {
      try {
        const raw = fs.readFileSync(path.join(dir, file), "utf8");
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") {
          skills.push(parsed);
        }
      } catch (err: any) {
        console.error(
          `[SkillInstallHandler] failed to read ${file}:`,
          err.message,
        );
      }
    }
    return skills;
  }

  public async handleSkillInstall(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    const { requestId, command } = message;

    try {
      let data: any;

      switch (command) {
        case "listInstalledSkills": {
          data = this.readInstalledSkills();
          break;
        }

        case "installSkill": {
          const skill = message.skill;
          if (!skill?.slug) {
            throw new Error("installSkill requires a skill with slug");
          }
          this.ensureSkillsDir();
          const filePath = this.slugToFile(skill.slug);
          fs.writeFileSync(filePath, JSON.stringify(skill, null, 2), "utf8");
          data = { slug: skill.slug, installed: true };
          break;
        }

        case "uninstallSkill": {
          const slug = message.slug;
          if (!slug) {
            throw new Error("uninstallSkill requires a slug");
          }
          const filePath = this.slugToFile(slug);
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
          }
          data = { slug, installed: false };
          break;
        }

        default:
          throw new Error(`Unknown skill install command: ${command}`);
      }

      webviewView.webview.postMessage({
        command: `${command}Response`,
        requestId,
        data,
      });
    } catch (err: any) {
      console.error("[SkillInstallHandler] error:", err.message);
      webviewView.webview.postMessage({
        command: `${command}Response`,
        requestId,
        error: err.message || "Skill install operation failed",
      });
    }
  }
}