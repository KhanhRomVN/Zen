/**
 * ------------------------------------------------------------------
 * Skill Install Handler
 * ------------------------------------------------------------------
 * Quản lý skill đã cài đặt của Zen trong `~/.khanhromvn-zen/skills/`.
 *
 * Mỗi skill = 1 thư mục `{slug}/` chứa toàn bộ nội dung gói skill tải từ
 * mcp.directory (luôn có `SKILL.md` ở gốc; có thể kèm scripts/, references/,
 * assets/...) cùng file metadata `{slug}.json`.
 * Skill cài theo kiểu cũ (file `{slug}.json` đơn lẻ) vẫn được đọc để tương thích.
 *
 * Commands (từ webview qua postMessage):
 * - listInstalledSkills : đọc metadata của mọi skill → trả về mảng object
 * - installSkill        : tải zip, giải nén vào skills/{slug}/, ghi {slug}.json
 * - uninstallSkill      : xóa thư mục skills/{slug}/ (và file .json cũ nếu có)
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── VSCode ──
import * as vscode from "vscode";

// ── Node ──
import * as path from "path";
import * as fs from "fs";

// ── Third-party ──
import * as JSZip from "jszip";

// ── Services ──
import { PathService } from "../../services/PathService";

// ─── Constants ──────────────────────────────────────────────────────────
const DOWNLOAD_BASE_URL = "https://mcp.directory/api/skills/download";
const DOWNLOAD_TIMEOUT_MS = 60000;
const SKILL_ENTRY_FILE = "SKILL.md";

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

  /** Chuẩn hoá slug thành tên thư mục/file an toàn. */
  private toSafeName(slug: string): string {
    const safe = slug.replace(/[^a-zA-Z0-9._-]/g, "_");
    return /^\.+$/.test(safe) ? "_" : safe;
  }

  /** Thư mục của 1 skill: skills/{slug}/ */
  public getSkillDir(slug: string): string {
    return path.join(this.getSkillsDir(), this.toSafeName(slug));
  }

  /** Đường dẫn để mở trong OS file manager: SKILL.md nếu có (để hiện nội dung thư mục), ngược lại thư mục skill. */
  public getRevealPath(slug: string): string {
    const dir = this.getSkillDir(slug);
    const entry = path.join(dir, SKILL_ENTRY_FILE);
    return fs.existsSync(entry) ? entry : dir;
  }

  private readJsonFile(filePath: string): any | null {
    try {
      const parsed = JSON.parse(fs.readFileSync(filePath, "utf8"));
      return parsed && typeof parsed === "object" ? parsed : null;
    } catch (err: any) {
      console.error(
        `[SkillInstallHandler] failed to read ${filePath}:`,
        err.message,
      );
      return null;
    }
  }

  /**
   * Đọc metadata toàn bộ skill đã cài. File .json đơn lẻ (kiểu cũ) được đọc
   * trước, thư mục skill cùng tên sẽ ghi đè. Bỏ qua mục lỗi thay vì throw.
   */
  private readInstalledSkills(): any[] {
    this.ensureSkillsDir();
    const dir = this.getSkillsDir();
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    const byName = new Map<string, any>();

    for (const e of entries) {
      if (!e.isFile() || !e.name.endsWith(".json")) continue;
      const data = this.readJsonFile(path.join(dir, e.name));
      if (data) byName.set(e.name.slice(0, -5), data);
    }

    for (const e of entries) {
      if (!e.isDirectory() || e.name.startsWith(".")) continue;
      const metaFile = path.join(dir, e.name, `${e.name}.json`);
      if (!fs.existsSync(metaFile)) continue;
      const data = this.readJsonFile(metaFile);
      if (data) byName.set(e.name, data);
    }

    return Array.from(byName.values());
  }

  private async downloadZip(id: number | string): Promise<Buffer> {
    const res = await fetch(
      `${DOWNLOAD_BASE_URL}/${encodeURIComponent(String(id))}`,
      {
        redirect: "follow",
        signal: AbortSignal.timeout(DOWNLOAD_TIMEOUT_MS),
      },
    );
    if (!res.ok) {
      throw new Error(`Download failed: HTTP ${res.status}`);
    }
    return Buffer.from(await res.arrayBuffer());
  }

  /**
   * Giải nén zip vào targetDir. Gốc của skill là thư mục chứa SKILL.md nông nhất
   * (zip có thể bọc trong 1 thư mục cha như `skill/`); chỉ giữ các file nằm dưới gốc đó.
   */
  private async extractZip(buffer: Buffer, targetDir: string): Promise<void> {
    const zip = await JSZip.loadAsync(buffer);
    const files = Object.values(zip.files).filter(
      (f) => !f.dir && !f.name.startsWith("__MACOSX/"),
    );

    const entry = files
      .filter(
        (f) =>
          path.posix.basename(f.name).toLowerCase() ===
          SKILL_ENTRY_FILE.toLowerCase(),
      )
      .sort((a, b) => a.name.split("/").length - b.name.split("/").length)[0];
    if (!entry) {
      throw new Error(`Skill archive does not contain ${SKILL_ENTRY_FILE}`);
    }

    const prefix = entry.name.slice(
      0,
      entry.name.length - path.posix.basename(entry.name).length,
    );
    const root = path.resolve(targetDir);

    for (const f of files) {
      if (!f.name.startsWith(prefix)) continue;
      const dest = path.resolve(root, f.name.slice(prefix.length));
      if (!dest.startsWith(root + path.sep)) continue;
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(dest, await f.async("nodebuffer"));
    }
  }

  /** Tải + giải nén vào thư mục tạm rồi đổi tên, tránh để lại skill dở dang khi lỗi. */
  private async installSkillPackage(skill: any): Promise<void> {
    if (skill.id === undefined || skill.id === null) {
      throw new Error("installSkill requires a skill with id");
    }
    this.ensureSkillsDir();
    const buffer = await this.downloadZip(skill.id);

    const safe = this.toSafeName(skill.slug);
    const finalDir = this.getSkillDir(skill.slug);
    const tmpDir = `${finalDir}.tmp-${Date.now()}`;

    try {
      fs.mkdirSync(tmpDir, { recursive: true });
      await this.extractZip(buffer, tmpDir);
      fs.writeFileSync(
        path.join(tmpDir, `${safe}.json`),
        JSON.stringify(skill, null, 2),
        "utf8",
      );
      fs.rmSync(finalDir, { recursive: true, force: true });
      fs.renameSync(tmpDir, finalDir);
    } catch (err) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      throw err;
    }
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
          await this.installSkillPackage(skill);
          data = { slug: skill.slug, installed: true };
          break;
        }

        case "uninstallSkill": {
          const slug = message.slug;
          if (!slug) {
            throw new Error("uninstallSkill requires a slug");
          }
          fs.rmSync(this.getSkillDir(slug), { recursive: true, force: true });
          fs.rmSync(
            path.join(this.getSkillsDir(), `${this.toSafeName(slug)}.json`),
            { force: true },
          );
          data = { slug, installed: false };
          break;
        }

        case "readSkillContent": {
          const slug = message.slug;
          if (!slug) {
            throw new Error("readSkillContent requires a slug");
          }
          const entryFile = path.join(this.getSkillDir(slug), SKILL_ENTRY_FILE);
          data = fs.existsSync(entryFile)
            ? fs.readFileSync(entryFile, "utf8")
            : null;
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