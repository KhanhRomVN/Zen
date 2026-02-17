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

    // Thử tìm kiếm chính xác trước, sau đó thử tìm theo label
    for (const ext of vscode.extensions.all) {
      const themes = ext.packageJSON?.contributes?.themes;
      if (Array.isArray(themes)) {
        // Một số theme ID có thể khác với Label hiển thị
        const found = themes.find(
          (t: any) =>
            t.id === colorTheme ||
            t.label === colorTheme ||
            // Handle cases where the extension's internal ID is prefix with extension id
            (ext.id && t.id === `${ext.id}.${colorTheme}`),
        );
        if (found) {
          themeEntry = found;
          extensionPath = ext.extensionPath;
          break;
        }
      }
    }

    // Một số theme mặc định (Default Dark+, etc) đôi khi khó tìm qua extensions.all
    // nhưng thường nằm trong extensions hệ thống (ví dụ: vscode.theme-defaults)

    if (!themeEntry || !extensionPath) {
      console.warn(
        `[ThemeService] Could not find theme entry for: ${colorTheme}`,
      );
      return null;
    }

    const absolutePath = path.join(extensionPath, themeEntry.path);
    const themeJson = await this.loadThemeFile(absolutePath);

    if (themeJson) {
      // 🆕 Áp dụng các tùy chỉnh từ settings.json (colorCustomizations & tokenColorCustomizations)
      const config = vscode.workspace.getConfiguration();
      const colorCustomizations =
        config.get<any>("workbench.colorCustomizations") || {};
      const tokenColorCustomizations =
        config.get<any>("editor.tokenColorCustomizations") || {};

      // 1. Áp dụng colorCustomizations
      // Rule: Customizations cho chính theme này ([themeName]) sẽ ghi đè global
      const activeColors = {
        ...(colorCustomizations || {}),
        ...(colorCustomizations[`[${colorTheme}]`] || {}),
      };

      if (Object.keys(activeColors).length > 0) {
        themeJson.colors = { ...(themeJson.colors || {}), ...activeColors };
      }

      // 2. Áp dụng tokenColorCustomizations
      // Shiki theme format là tokenColors: [{ scope: [], settings: {} }]
      const activeTokenCustomizations = {
        ...(tokenColorCustomizations || {}),
        ...(tokenColorCustomizations[`[${colorTheme}]`] || {}),
      };

      if (activeTokenCustomizations.textMateRules) {
        themeJson.tokenColors = [
          ...(themeJson.tokenColors || []),
          ...activeTokenCustomizations.textMateRules,
        ];
      }

      // VS Code cũng cho phép chỉnh trực tiếp các scope cơ bản (comments, functions, etc.)
      const basicScopes = [
        "comments",
        "functions",
        "keywords",
        "numbers",
        "strings",
        "types",
        "variables",
      ];
      basicScopes.forEach((scope) => {
        if (activeTokenCustomizations[scope]) {
          // Map basic scopes to common TextMate scopes
          const scopeMap: Record<string, string[]> = {
            comments: ["comment", "punctuation.definition.comment"],
            functions: ["entity.name.function", "support.function"],
            keywords: ["keyword", "storage.type", "storage.modifier"],
            numbers: ["constant.numeric"],
            strings: ["string"],
            types: ["entity.name.type", "support.type"],
            variables: ["variable", "support.variable"],
          };

          themeJson.tokenColors.push({
            scope: scopeMap[scope] || [scope],
            settings:
              typeof activeTokenCustomizations[scope] === "string"
                ? { foreground: activeTokenCustomizations[scope] }
                : activeTokenCustomizations[scope],
          });
        }
      });

      // Bổ sung thông tin kind (nếu chưa có trong file JSON)
      if (!themeJson.type && themeEntry.uiTheme) {
        themeJson.type = themeEntry.uiTheme.includes("vs-dark")
          ? "dark"
          : "light";
      }
    }

    return themeJson;
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
