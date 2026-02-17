import * as vscode from "vscode";

export class ShikiService {
  private static instance: ShikiService;
  private highlighter: any = null;
  private currentDynamicThemeName: string | null = null;
  private currentDynamicThemeId: string | null = null;
  private currentDynamicThemeKind: string | null = null; // 'dark' | 'light'
  private extensionUri: vscode.Uri | null = null;
  private initializationPromise: Promise<void> | null = null;

  private constructor() {}

  public static getInstance(): ShikiService {
    if (!ShikiService.instance) {
      ShikiService.instance = new ShikiService();
    }
    return ShikiService.instance;
  }

  public setExtensionUri(uri: vscode.Uri) {
    this.extensionUri = uri;
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

      // Successfully loaded
      this.currentDynamicThemeName = themeName;
      this.currentDynamicThemeId = originalThemeId || null;
      this.currentDynamicThemeKind = themeJson.type || "dark";
    } catch (error) {
      console.error("[ShikiService] Failed to load custom theme:", error);
      // Even if loading fails, update the ID to the one being requested
      // to avoid continuous "stale theme" warnings if the reason was JSON corruption.
      // But clearing name will force fallback to defaults.
      this.currentDynamicThemeName = null;
      this.currentDynamicThemeId = originalThemeId || null;
    }
  }

  public async initialize(): Promise<void> {
    if (this.highlighter) return;
    if (this.initializationPromise) return this.initializationPromise;

    this.initializationPromise = (async () => {
      try {
        // Use dynamic import for ESM compatibility in CJS environment
        const { createHighlighter, loadWasm } = await import("shiki");

        // [Fix] Ensure assets (WASM, languages, themes) are loaded from the correct location
        if (this.extensionUri) {
          // In production/bundled mode, we copied assets to 'dist/'
          const onigWasmUri = vscode.Uri.joinPath(
            this.extensionUri,
            "dist",
            "onig.wasm",
          );
          try {
            const wasmBytes = await vscode.workspace.fs.readFile(onigWasmUri);
            await loadWasm(wasmBytes);
          } catch (error) {
            console.error(
              "[ShikiService] Failed to load WASM manually:",
              error,
            );
          }
        }

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
    lineHighlights?: {
      startLine: number;
      endLine: number;
      type: "added" | "removed";
    }[],
    startLineNumber: number = 1,
  ): Promise<string> {
    await this.initialize();
    if (!this.highlighter) return `<pre><code>${code}</code></pre>`;

    // Determine if we should use the dynamic theme
    let useDynamic = !!this.currentDynamicThemeName;

    // Verify dynamic theme (kind/id)
    if (useDynamic) {
      if (themeKind !== undefined) {
        const requestedIsDark =
          themeKind === vscode.ColorThemeKind.Dark ||
          themeKind === vscode.ColorThemeKind.HighContrast;
        const dynamicIsDark = this.currentDynamicThemeKind === "dark";

        if (requestedIsDark !== dynamicIsDark) {
          useDynamic = false;
        }
      }

      if (useDynamic && requestedThemeId && this.currentDynamicThemeId) {
        if (requestedThemeId !== this.currentDynamicThemeId) {
          useDynamic = false;
        }
      }
    }

    const theme = useDynamic
      ? (this.currentDynamicThemeName as string)
      : themeKind === vscode.ColorThemeKind.Light
        ? "github-light"
        : "dark-plus";

    try {
      // 🆕 Create Transformers
      const transformers = [];

      // 1. Line Numbers Transformer
      transformers.push({
        name: "zen-line-numbers",
        line(node: any, line: number) {
          const actualLine = line + startLineNumber - 1;
          node.properties["data-line"] = actualLine;
          // Inject line number span
          node.children.unshift({
            type: "element",
            tagName: "span",
            properties: { className: ["line-number"] },
            children: [{ type: "text", value: actualLine.toString() }],
          });
        },
      });

      // 2. Diff Highlighting Transformer
      if (lineHighlights && lineHighlights.length > 0) {
        console.log(
          `[ShikiService] Applying diff highlights:`,
          JSON.stringify(lineHighlights),
        );
        transformers.push({
          name: "zen-diff-highlights",
          line(node: any, line: number) {
            // Shiki transformer 'line' is 1-indexed
            const h = lineHighlights.find(
              (lh) => line >= lh.startLine && line <= lh.endLine,
            );
            if (h) {
              const className =
                h.type === "added" ? "diff-line-added" : "diff-line-removed";

              // Ensure we don't duplicate classes and apply to the line node
              if (!node.properties) node.properties = {};

              // [Fix] Handle potential 'class' vs 'className' conflict
              // If Shiki sets 'class' (string), convert it to 'className' (array) to avoid duplicate attributes
              if (node.properties.class) {
                if (typeof node.properties.class === "string") {
                  const existing = node.properties.class.split(" ");
                  if (!node.properties.className)
                    node.properties.className = [];
                  node.properties.className.push(...existing);
                }
                delete node.properties.class;
              }

              if (!node.properties.className) node.properties.className = [];
              if (!node.properties.className.includes(className)) {
                node.properties.className.push(className);
              }
            }
          },
        });
      }

      // 3. Clean structure transformer
      transformers.push({
        name: "zen-clean-structure",
        pre(node: any) {
          // Remove inline background-color from shiki's pre tag
          if (node.properties.style) {
            delete node.properties.style;
          }
        },
        code(node: any) {
          // Filter out empty text nodes (newlines) between line spans
          // which cause extra spacing in some rendering modes
          node.children = node.children.filter((child: any) => {
            if (child.type === "text" && child.value === "\n") {
              return false;
            }
            return true;
          });
        },
      });

      const html = await this.highlighter.codeToHtml(code, {
        lang: language,
        theme: theme,
        transformers,
      });
      return html;
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
