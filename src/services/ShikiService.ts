import * as vscode from "vscode";

export class ShikiService {
  private static instance: ShikiService;
  private highlighter: any = null;
  private currentDynamicThemeName: string | null = null;
  private initializationPromise: Promise<void> | null = null;

  private constructor() {}

  public static getInstance(): ShikiService {
    if (!ShikiService.instance) {
      ShikiService.instance = new ShikiService();
    }
    return ShikiService.instance;
  }

  public async setCustomTheme(themeJson: any): Promise<void> {
    await this.initialize();
    if (!this.highlighter) return;

    try {
      // Assign a unique name to the dynamic theme
      const themeName = "zen-dynamic-theme";
      themeJson.name = themeName;

      await this.highlighter.loadTheme(themeJson);
      this.currentDynamicThemeName = themeName;
      console.log("[ShikiService] Custom dynamic theme loaded successfully");
    } catch (error) {
      console.error("[ShikiService] Failed to load custom theme:", error);
    }
  }

  public async initialize(): Promise<void> {
    if (this.highlighter) return;
    if (this.initializationPromise) return this.initializationPromise;

    this.initializationPromise = (async () => {
      try {
        // Use dynamic import for ESM compatibility in CJS environment
        const { createHighlighter } = await import("shiki");

        this.highlighter = await createHighlighter({
          themes: ["dark-plus", "nord", "monokai", "dracula"],
          langs: [
            "javascript",
            "typescript",
            "python",
            "json",
            "css",
            "html",
            "markdown",
            "shellscript",
            "yaml",
            "sql",
            "cpp",
            "c",
            "java",
            "go",
            "rust",
            "php",
          ],
        });
        console.log(
          "[ShikiService] Initialized successfully with createHighlighter",
        );
      } catch (error) {
        console.error("[ShikiService] Initialization failed:", error);
        this.initializationPromise = null;
      }
    })();

    return this.initializationPromise;
  }

  public async highlight(
    code: string,
    language: string,
    themeKind?: vscode.ColorThemeKind,
  ): Promise<string> {
    await this.initialize();
    if (!this.highlighter) return `<pre><code>${code}</code></pre>`;

    // Use dynamic theme if available, otherwise fallback to defaults
    const theme =
      this.currentDynamicThemeName ||
      (themeKind === vscode.ColorThemeKind.Light ? "nord" : "dark-plus");

    try {
      return this.highlighter.codeToHtml(code, {
        lang: language,
        theme: theme,
      });
    } catch (error) {
      console.warn(
        `[ShikiService] Highlighting failed for ${language}, falling back to plaintext:`,
        error,
      );
      try {
        return this.highlighter.codeToHtml(code, {
          lang: "plaintext",
          theme: theme,
        });
      } catch (e) {
        return `<pre><code>${code}</code></pre>`;
      }
    }
  }

  /**
   * Maps VS Code theme names to Shiki themes if they matches exactly,
   * or returns a sensible default.
   */
  public async highlightWithTheme(
    code: string,
    language: string,
    themeName: string,
  ): Promise<string> {
    await this.initialize();
    if (!this.highlighter) return `<pre><code>${code}</code></pre>`;

    // Attempt to use the provided theme name
    let shikiTheme = themeName.toLowerCase().replace(/\s+/g, "-");

    // Check if theme is loaded
    const loadedThemes = this.highlighter.getLoadedThemes();
    if (!loadedThemes.includes(shikiTheme)) {
      shikiTheme = "dark-plus"; // Default
    }

    try {
      return this.highlighter.codeToHtml(code, {
        lang: language,
        theme: shikiTheme,
      });
    } catch (error) {
      return this.highlight(code, language);
    }
  }
}
