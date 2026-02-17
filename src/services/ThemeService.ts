import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs/promises";

export class ThemeService {
  /**
   * Trích xuất JSON của theme đang hoạt động trong VS Code.
   */
  public static async getActiveThemeJson(): Promise<any> {
    const colorTheme = vscode.workspace
      .getConfiguration("workbench")
      .get<string>("colorTheme");
    if (!colorTheme) {
      return null;
    }

    // Tìm extension chứa theme này
    let themeEntry: any = null;
    let extensionPath: string = "";

    for (const ext of vscode.extensions.all) {
      const themes = ext.packageJSON?.contributes?.themes;
      if (Array.isArray(themes)) {
        const found = themes.find(
          (t: any) => t.label === colorTheme || t.id === colorTheme,
        );
        if (found) {
          themeEntry = found;
          extensionPath = ext.extensionPath;
          break;
        }
      }
    }

    if (!themeEntry || !extensionPath) {
      console.warn(
        `[ThemeService] Could not find theme entry for: ${colorTheme}`,
      );
      return null;
    }

    const absolutePath = path.join(extensionPath, themeEntry.path);
    return await this.loadThemeFile(absolutePath);
  }

  /**
   * Đọc file theme và xử lý đệ quy nếu có 'include'.
   */
  private static async loadThemeFile(filePath: string): Promise<any> {
    try {
      const content = await fs.readFile(filePath, "utf8");
      // Loại bỏ comment để parse JSON (JSONC support)
      const stripped = content.replace(
        /\\"|"(?:\\"|[^"])*"|(\/\*[\s\S]*?\*\/|\/\/[^\n]*)/g,
        (m, g) => (g ? "" : m),
      );
      const theme = JSON.parse(stripped);

      // Xử lý kế thừa theme (ví dụ: themes thường include 'settings.json' hoặc theme cha)
      if (theme.include) {
        const includedPath = path.resolve(
          path.dirname(filePath),
          theme.include,
        );
        const includedTheme = await this.loadThemeFile(includedPath);
        if (includedTheme) {
          return this.mergeThemes(includedTheme, theme);
        }
      }

      return theme;
    } catch (e) {
      console.error(`[ThemeService] Error loading theme file ${filePath}:`, e);
      return null;
    }
  }

  /**
   * Gộp hai theme JSON (ghi đè các thuộc tính của base bằng secondary)
   */
  private static mergeThemes(base: any, secondary: any): any {
    return {
      ...base,
      ...secondary,
      colors: { ...(base.colors || {}), ...(secondary.colors || {}) },
      tokenColors: [
        ...(Array.isArray(base.tokenColors) ? base.tokenColors : []),
        ...(Array.isArray(secondary.tokenColors) ? secondary.tokenColors : []),
      ],
      semanticTokenColors: {
        ...(base.semanticTokenColors || {}),
        ...(secondary.semanticTokenColors || {}),
      },
    };
  }
}
