import * as vscode from "vscode";

export class ShikiService {
  private static instance: ShikiService;
  private highlighter: any = null;
  private currentDynamicThemeName: string | null = null;
  private currentDynamicThemeId: string | null = null;
  private currentDynamicThemeKind: string | null = null; // 'dark' | 'light'
  private initializationPromise: Promise<void> | null = null;

  private constructor() {}

  public static getInstance(): ShikiService {
    if (!ShikiService.instance) {
      ShikiService.instance = new ShikiService();
    }
    return ShikiService.instance;
  }

  public async setCustomTheme(
    themeJson: any,
    originalThemeId?: string,
  ): Promise<void> {
    await this.initialize();
    if (!this.highlighter) return;

    try {
      // Use a versioned name to ensure the highlighter recognizes it as a new/updated theme
      // and overwrites any internal caches.
      const themeVersion = Date.now();
      const themeName = `zen-dynamic-theme-${themeVersion}`;
      themeJson.name = themeName;

      await this.highlighter.loadTheme(themeJson);
      this.currentDynamicThemeName = themeName;
      this.currentDynamicThemeId = originalThemeId || null;
      this.currentDynamicThemeKind = themeJson.type || "dark";

      console.log(
        `[ShikiService] Custom dynamic theme (v${themeVersion}) [${this.currentDynamicThemeId}] [${this.currentDynamicThemeKind}] loaded successfully`,
      );
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
          themes: ["dark-plus", "nord", "monokai", "dracula", "github-light"],
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
    requestedThemeId?: string,
  ): Promise<string> {
    await this.initialize();
    if (!this.highlighter) return `<pre><code>${code}</code></pre>`;

    // Determine if we should use the dynamic theme
    let useDynamic = !!this.currentDynamicThemeName;

    // IMPORTANT: Verify that the dynamic theme matches the requested UI context
    if (useDynamic) {
      // 1. Check kind mismatch (Dark/Light)
      if (themeKind !== undefined) {
        const requestedIsDark =
          themeKind === vscode.ColorThemeKind.Dark ||
          themeKind === vscode.ColorThemeKind.HighContrast;
        const dynamicIsDark = this.currentDynamicThemeKind === "dark";

        if (requestedIsDark !== dynamicIsDark) {
          console.warn(
            `[ShikiService] Theme kind mismatch: Requested ${
              requestedIsDark ? "Dark" : "Light"
            } but dynamic theme is ${
              dynamicIsDark ? "Dark" : "Light"
            }. Falling back to default Shiki themes.`,
          );
          useDynamic = false;
        }
      }

      // 2. Check ID mismatch (Stale theme detection)
      // If the frontend specifically requested a theme ID (e.g., 'Nord'),
      // but our dynamic theme is still something else (e.g., 'Abyss'), it's stale.
      if (useDynamic && requestedThemeId && this.currentDynamicThemeId) {
        if (requestedThemeId !== this.currentDynamicThemeId) {
          console.warn(
            `[ShikiService] Theme ID stale: Requested '${requestedThemeId}' but dynamic theme is '${this.currentDynamicThemeId}'. Falling back.`,
          );
          useDynamic = false;
        }
      }
    }

    // Use dynamic theme if available and kind matches, otherwise fallback to defaults
    const theme = useDynamic
      ? (this.currentDynamicThemeName as string)
      : themeKind === vscode.ColorThemeKind.Light
        ? "github-light"
        : "dark-plus";

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
