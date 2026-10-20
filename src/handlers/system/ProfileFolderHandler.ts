/**
 * ------------------------------------------------------------------
 * Profile Folder Handler
 * ------------------------------------------------------------------
 * Liệt kê profile trong Chromium Profile Folder và dò thư mục user-data
 * mặc định của Chrome/Chromium theo từng hệ điều hành.
 *
 * Main functions:
 * - handleListChromiumProfiles() : Đọc thư mục cấp 1. Nếu là user-data-dir của Chrome
 *                                  (có "Local State") thì đọc thêm Preferences để lấy nhãn (email)
 * - handleGetChromeProfileDirs() : Trả về các thư mục Chrome/Chromium mặc định đang tồn tại
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── Node ──
import * as fs from "fs";
import * as os from "os";
import * as path from "path";

// ── VSCode ──
import * as vscode from "vscode";

// ─── Constants ──────────────────────────────────────────────────────────
type KeyPath = (string | number)[];

const LABEL_KEY_PATHS: KeyPath[] = [
  ["account_info", 0, "email"],
  ["signin", "allowed_username"],
  ["google", "services", "last_signed_in"],
  ["google", "services", "last_gaia_account", "email"],
  ["profile", "last_used"],
];

const PREFERENCES_FILES = ["Preferences", path.join("Default", "Preferences")];

const AVATAR_PIC_PATHS: KeyPath[] = [
  ["account_info", 0, "picture_url"],
  ["account_info", 0, "last_downloaded_image_url_with_size"],
];

const IGNORED_CHROME_FOLDERS = new Set(["Guest Profile", "System Profile"]);

// ─── Helpers ────────────────────────────────────────────────────────────
const pickLabel = (prefs: any): string | undefined => {
  for (const keyPath of LABEL_KEY_PATHS) {
    let value = prefs;
    for (const key of keyPath) {
      value = value?.[key];
    }
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
};

const pickAvatar = (prefs: any): string | undefined => {
  for (const keyPath of AVATAR_PIC_PATHS) {
    let value = prefs;
    for (const key of keyPath) {
      value = value?.[key];
    }
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return undefined;
};

interface ProfileReadResult {
  folder: string;
  label?: string;
  avatar?: string;
  hasPreferences: boolean;
}

const readProfile = async (
  basePath: string,
  folder: string,
): Promise<ProfileReadResult> => {
  for (const file of PREFERENCES_FILES) {
    try {
      const raw = await fs.promises.readFile(
        path.join(basePath, folder, file),
        "utf8",
      );
      const parsed = JSON.parse(raw);
      return {
        folder,
        label: pickLabel(parsed),
        avatar: pickAvatar(parsed),
        hasPreferences: true,
      };
    } catch {
      // File không tồn tại hoặc không phải JSON hợp lệ → thử đường dẫn kế tiếp
    }
  }
  return { folder, hasPreferences: false };
};

const getChromeUserDataDirs = (): { label: string; path: string }[] => {
  const home = os.homedir();
  let candidates: { label: string; path: string }[];

  switch (process.platform) {
    case "win32": {
      const local =
        process.env.LOCALAPPDATA || path.join(home, "AppData", "Local");
      candidates = [
        {
          label: "Google Chrome",
          path: path.join(local, "Google", "Chrome", "User Data"),
        },
        {
          label: "Chromium",
          path: path.join(local, "Chromium", "User Data"),
        },
      ];
      break;
    }
    case "darwin": {
      const support = path.join(home, "Library", "Application Support");
      candidates = [
        { label: "Google Chrome", path: path.join(support, "Google", "Chrome") },
        { label: "Chromium", path: path.join(support, "Chromium") },
      ];
      break;
    }
    default: {
      const config = process.env.XDG_CONFIG_HOME || path.join(home, ".config");
      candidates = [
        { label: "Google Chrome", path: path.join(config, "google-chrome") },
        { label: "Chromium", path: path.join(config, "chromium") },
      ];
    }
  }

  return candidates.filter((c) => fs.existsSync(c.path));
};

// ─── Class ──────────────────────────────────────────────────────────────
export class ProfileFolderHandler {
  /**
   * Thư mục thường: chỉ readdir đúng 1 cấp (không đệ quy, không đọc file) để tránh lag.
   * User-data-dir của Chrome: đọc thêm Preferences của từng profile để lấy nhãn.
   * Kết quả trả qua `chromiumProfilesResult` gồm `folders` và `profiles`.
   */
  public async handleListChromiumProfiles(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    const isDefaultChrome = !(typeof message.path === "string" && message.path.trim());
    const basePath: string | undefined = isDefaultChrome
      ? getChromeUserDataDirs()[0]?.path
      : message.path;

    if (!basePath) {
      webviewView.webview.postMessage({
        command: "chromiumProfilesResult",
        requestId: message.requestId,
        folders: [],
        profiles: [],
        is_default_chrome: isDefaultChrome,
        error: "Không tìm thấy thư mục profile Chrome mặc định",
      });
      return;
    }

    try {
      const entries = await fs.promises.readdir(basePath, {
        withFileTypes: true,
      });
      const names = entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

      if (!fs.existsSync(path.join(basePath, "Local State"))) {
        // Không phải user-data-dir của Chrome → trả folder thuần, không có label/avatar
        webviewView.webview.postMessage({
          command: "chromiumProfilesResult",
          requestId: message.requestId,
          folders: names,
          profiles: names.map((folder) => ({ folder })),
          is_default_chrome: isDefaultChrome,
        });
        return;
      }

      let profiles = (
        await Promise.all(
          names
            .filter((name) => !IGNORED_CHROME_FOLDERS.has(name))
            .map((name) => readProfile(basePath, name)),
        )
      ).filter((p) => p.hasPreferences);

      // Fallback Chrome mặc định: ẩn profile không đọc được email
      if (isDefaultChrome) {
        profiles = profiles.filter((p) => !!p.label);
      }

      webviewView.webview.postMessage({
        command: "chromiumProfilesResult",
        requestId: message.requestId,
        folders: profiles.map((p) => p.folder),
        profiles: profiles.map(({ folder, label, avatar }) => ({ folder, label, avatar })),
        is_default_chrome: isDefaultChrome,
      });
    } catch (error: any) {
      console.error("[ProfileFolderHandler] readdir error:", error);
      webviewView.webview.postMessage({
        command: "chromiumProfilesResult",
        requestId: message.requestId,
        folders: [],
        profiles: [],
        is_default_chrome: isDefaultChrome,
        error: error?.message || "Không đọc được Chromium Profile Folder",
      });
    }
  }

  public async handleGetChromeProfileDirs(
    message: any,
    webviewView: vscode.WebviewView,
  ) {
    webviewView.webview.postMessage({
      command: "chromeProfileDirsResult",
      requestId: message.requestId,
      dirs: getChromeUserDataDirs(),
    });
  }
}