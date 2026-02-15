/**
 * Simple Syntax Highlighter Service
 * Provides basic code syntax highlighting using regex patterns
 * No external dependencies - works perfectly in VSCode webview
 */
class SyntaxHighlighterService {
  private currentTheme: "dark" | "light" = "dark";

  // Default color scheme (VS Code Tomorrow Night) - used as fallback
  private readonly defaultDarkColors = {
    background: "#1e1e1e",
    foreground: "#d4d4d4",
    comment: "#608b4e",
    string: "#ce9178",
    number: "#b5cea8",
    keyword: "#569cd6",
    function: "#dcdcaa",
    class: "#4ec9b0",
    operator: "#d4d4d4",
    punctuation: "#d4d4d4",
    variable: "#9cdcfe",
    property: "#9cdcfe",
    constant: "#4fc1ff",
    regex: "#d16969",
  };

  /**
   * Get VSCode theme colors from CSS variables
   */
  private getVSCodeThemeColors() {
    try {
      const root = document.documentElement;
      const style = getComputedStyle(root);

      // Helper to get CSS variable with fallback
      const getColor = (varName: string, fallback: string): string => {
        const value = style.getPropertyValue(varName).trim();
        return value || fallback;
      };

      const colors = {
        background: getColor(
          "--vscode-editor-background",
          this.defaultDarkColors.background
        ),
        foreground: getColor(
          "--vscode-editor-foreground",
          this.defaultDarkColors.foreground
        ),
        comment: getColor(
          "--vscode-editorLineNumber-foreground",
          this.defaultDarkColors.comment
        ),
        string: this.defaultDarkColors.string, // No direct VSCode variable
        number: this.defaultDarkColors.number, // No direct VSCode variable
        keyword: this.defaultDarkColors.keyword, // No direct VSCode variable
        function: this.defaultDarkColors.function, // No direct VSCode variable
        class: this.defaultDarkColors.class, // No direct VSCode variable
        operator: getColor(
          "--vscode-editor-foreground",
          this.defaultDarkColors.operator
        ),
        punctuation: getColor(
          "--vscode-editor-foreground",
          this.defaultDarkColors.punctuation
        ),
        variable: this.defaultDarkColors.variable, // No direct VSCode variable
        property: this.defaultDarkColors.property, // No direct VSCode variable
        constant: this.defaultDarkColors.constant, // No direct VSCode variable
        regex: this.defaultDarkColors.regex, // No direct VSCode variable
      };

      return colors;
    } catch (error) {
      return this.defaultDarkColors;
    }
  }

  /**
   * Get current color scheme (VSCode theme or default)
   */
  private get darkColors() {
    return this.getVSCodeThemeColors();
  }

  /**
   * Initialize highlighter (no-op, kept for API compatibility)
   */
  async initialize(theme: "dark" | "light" = "dark"): Promise<void> {
    this.currentTheme = theme;
    return Promise.resolve();
  }

  /**
   * Highlight code with syntax highlighting
   */
  async highlightCode(code: string, language: string): Promise<string> {
    try {
      const validLang = this.validateLanguage(language);
      const highlighted = this.highlightByLanguage(code, validLang);
      return this.createStyledPre(highlighted);
    } catch (error) {
      console.error("[SyntaxHighlighter] Failed to highlight code:", error);
      return this.createStyledPre(this.escapeHtml(code));
    }
  }

  /**
   * Highlight code based on language
   */
  private highlightByLanguage(code: string, language: string): string {
    const colors = this.darkColors;

    // Escape HTML first
    let html = this.escapeHtml(code);

    // Apply language-specific highlighting
    switch (language) {
      case "typescript":
      case "javascript":
      case "tsx":
      case "jsx":
        html = this.highlightJavaScript(html, colors);
        break;
      case "python":
        html = this.highlightPython(html, colors);
        break;
      case "json":
        html = this.highlightJSON(html, colors);
        break;
      case "css":
        html = this.highlightCSS(html, colors);
        break;
      case "markup":
      case "html":
        html = this.highlightHTML(html, colors);
        break;
      default:
        // Generic highlighting for other languages
        html = this.highlightGeneric(html, colors);
    }

    return html;
  }

  /**
   * Highlight JavaScript/TypeScript
   */
  private highlightJavaScript(
    code: string,
    colors: typeof this.darkColors
  ): string {
    // Comments (must be first to avoid interfering with other patterns)
    code = code.replace(
      /(\/\/.*$|\/\*[\s\S]*?\*\/)/gm,
      `<span style="color: ${colors.comment}">$1</span>`
    );

    // Strings
    code = code.replace(
      /(&quot;(?:[^&]|&(?!quot;))*&quot;|&#039;(?:[^&]|&(?!#039;))*&#039;|`(?:[^`\\]|\\.)*`)/g,
      `<span style="color: ${colors.string}">$1</span>`
    );

    // Numbers
    code = code.replace(
      /\b(\d+\.?\d*)\b/g,
      `<span style="color: ${colors.number}">$1</span>`
    );

    // Keywords
    const keywords = [
      "const",
      "let",
      "var",
      "function",
      "return",
      "if",
      "else",
      "for",
      "while",
      "do",
      "switch",
      "case",
      "break",
      "continue",
      "class",
      "extends",
      "import",
      "export",
      "from",
      "default",
      "async",
      "await",
      "try",
      "catch",
      "finally",
      "throw",
      "new",
      "this",
      "super",
      "static",
      "public",
      "private",
      "protected",
      "interface",
      "type",
      "enum",
      "namespace",
      "declare",
      "module",
      "as",
      "typeof",
      "instanceof",
      "in",
      "of",
      "void",
      "null",
      "undefined",
      "true",
      "false",
    ];

    keywords.forEach((keyword) => {
      const regex = new RegExp(`\\b(${keyword})\\b`, "g");
      code = code.replace(
        regex,
        `<span style="color: ${colors.keyword}">$1</span>`
      );
    });

    // Function calls
    code = code.replace(
      /\b([a-zA-Z_$][\w$]*)\s*(?=\()/g,
      `<span style="color: ${colors.function}">$1</span>`
    );

    return code;
  }

  /**
   * Highlight Python
   */
  private highlightPython(
    code: string,
    colors: typeof this.darkColors
  ): string {
    // Comments
    code = code.replace(
      /(#.*$)/gm,
      `<span style="color: ${colors.comment}">$1</span>`
    );

    // Strings
    code = code.replace(
      /(&quot;(?:[^&]|&(?!quot;))*&quot;|&#039;(?:[^&]|&(?!#039;))*&#039;)/g,
      `<span style="color: ${colors.string}">$1</span>`
    );

    // Numbers
    code = code.replace(
      /\b(\d+\.?\d*)\b/g,
      `<span style="color: ${colors.number}">$1</span>`
    );

    // Keywords
    const keywords = [
      "def",
      "class",
      "return",
      "if",
      "elif",
      "else",
      "for",
      "while",
      "in",
      "import",
      "from",
      "as",
      "try",
      "except",
      "finally",
      "raise",
      "with",
      "lambda",
      "yield",
      "async",
      "await",
      "True",
      "False",
      "None",
      "and",
      "or",
      "not",
      "is",
      "pass",
      "break",
      "continue",
      "global",
      "nonlocal",
    ];

    keywords.forEach((keyword) => {
      const regex = new RegExp(`\\b(${keyword})\\b`, "g");
      code = code.replace(
        regex,
        `<span style="color: ${colors.keyword}">$1</span>`
      );
    });

    // Function definitions
    code = code.replace(
      /\bdef\s+([a-zA-Z_]\w*)/g,
      `<span style="color: ${colors.keyword}">def</span> <span style="color: ${colors.function}">$1</span>`
    );

    return code;
  }

  /**
   * Highlight JSON
   */
  private highlightJSON(code: string, colors: typeof this.darkColors): string {
    // Property names
    code = code.replace(
      /&quot;([^&]+)&quot;\s*:/g,
      `<span style="color: ${colors.property}">&quot;$1&quot;</span>:`
    );

    // String values
    code = code.replace(
      /:\s*&quot;([^&]*)&quot;/g,
      `: <span style="color: ${colors.string}">&quot;$1&quot;</span>`
    );

    // Numbers
    code = code.replace(
      /:\s*(\d+\.?\d*)/g,
      `: <span style="color: ${colors.number}">$1</span>`
    );

    // Booleans and null
    code = code.replace(
      /\b(true|false|null)\b/g,
      `<span style="color: ${colors.keyword}">$1</span>`
    );

    return code;
  }

  /**
   * Highlight CSS
   */
  private highlightCSS(code: string, colors: typeof this.darkColors): string {
    // Comments
    code = code.replace(
      /(\/\*[\s\S]*?\*\/)/g,
      `<span style="color: ${colors.comment}">$1</span>`
    );

    // Selectors
    code = code.replace(
      /^([.#]?[a-zA-Z][\w-]*)\s*\{/gm,
      `<span style="color: ${colors.class}">$1</span> {`
    );

    // Properties
    code = code.replace(
      /([a-zA-Z-]+)\s*:/g,
      `<span style="color: ${colors.property}">$1</span>:`
    );

    // Values
    code = code.replace(
      /:\s*([^;{]+);/g,
      `: <span style="color: ${colors.string}">$1</span>;`
    );

    return code;
  }

  /**
   * Highlight HTML
   */
  private highlightHTML(code: string, colors: typeof this.darkColors): string {
    // Tags
    code = code.replace(
      /(&lt;\/?)([\w-]+)/g,
      `$1<span style="color: ${colors.keyword}">$2</span>`
    );

    // Attributes
    code = code.replace(
      /\s([\w-]+)=/g,
      ` <span style="color: ${colors.property}">$1</span>=`
    );

    // Attribute values
    code = code.replace(
      /=&quot;([^&]*)&quot;/g,
      `=<span style="color: ${colors.string}">&quot;$1&quot;</span>`
    );

    return code;
  }

  /**
   * Generic highlighting for other languages
   */
  private highlightGeneric(
    code: string,
    colors: typeof this.darkColors
  ): string {
    // Comments
    code = code.replace(
      /(\/\/.*$|\/\*[\s\S]*?\*\/|#.*$)/gm,
      `<span style="color: ${colors.comment}">$1</span>`
    );

    // Strings
    code = code.replace(
      /(&quot;(?:[^&]|&(?!quot;))*&quot;|&#039;(?:[^&]|&(?!#039;))*&#039;)/g,
      `<span style="color: ${colors.string}">$1</span>`
    );

    // Numbers
    code = code.replace(
      /\b(\d+\.?\d*)\b/g,
      `<span style="color: ${colors.number}">$1</span>`
    );

    return code;
  }

  /**
   * Create styled pre element
   */
  private createStyledPre(content: string): string {
    const colors = this.darkColors;
    // Don't set background - let it be transparent so parent can control it
    return `<pre style="color: ${colors.foreground}; padding: 12px; margin: 0; overflow-x: auto; font-family: 'Consolas', 'Monaco', 'Courier New', monospace; font-size: 13px; line-height: 1.5; background: transparent;"><code>${content}</code></pre>`;
  }

  /**
   * Update theme (dark/light)
   */
  async updateTheme(theme: "dark" | "light"): Promise<void> {
    this.currentTheme = theme;
    return Promise.resolve();
  }

  /**
   * Validate and normalize language identifier
   */
  private validateLanguage(lang: string): string {
    const langMap: Record<string, string> = {
      ts: "typescript",
      tsx: "tsx",
      js: "javascript",
      jsx: "jsx",
      py: "python",
      html: "markup",
      xml: "markup",
      css: "css",
      json: "json",
    };

    const normalized = lang.toLowerCase();
    return langMap[normalized] || normalized;
  }

  /**
   * Escape HTML special characters
   */
  private escapeHtml(text: string): string {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#039;",
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
  }

  /**
   * Detect language from file path
   */
  detectLanguage(filePath: string): string {
    const ext = filePath.split(".").pop()?.toLowerCase() || "";
    return ext || "text";
  }
}

// Export singleton instance
export const syntaxHighlighter = new SyntaxHighlighterService();
