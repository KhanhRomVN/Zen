/**
 * ------------------------------------------------------------------
 * Custom LSP Service
 * ------------------------------------------------------------------
 * Quản lý custom LSP servers: auto-install, check installed, detect
 * language.
 *
 * Main functions:
 * - detectLanguage()         : Detect language từ file extension
 * - getLSPServerInfo()       : Lấy thông tin LSP server theo language ID
 * - isLSPInstalled()         : Kiểm tra LSP package đã được cài đặt chưa
 * - autoInstallLSP()         : Tự động cài đặt LSP package nếu chưa có
 * - processFileForCustomLSP(): Xử lý file để lấy trạng thái LSP sẵn sàng
 * ------------------------------------------------------------------
 */

// ─── Imports ────────────────────────────────────────────────────────────
// ── VSCode ──
import * as vscode from "vscode";

// ── Node ──
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

// ── Services ──
import { LoggerService } from "./LoggerService";

// ── Storage ──
import { GlobalStorageManager } from "../storage/GlobalStorageManager";

// ─── Interfaces ─────────────────────────────────────────────────────────
export interface LSPServerInfo {
  id: string;
  name: string;
  language: string;
  npmPackage: string;
  description: string;
}

// ─── Class ──────────────────────────────────────────────────────────────
export class CustomLSPService {
  private static instance: CustomLSPService;
  private logger: LoggerService;
  private lspDir: string;
  private storageManager: GlobalStorageManager | undefined;

  private constructor() {
    this.logger = LoggerService.getInstance();
    this.lspDir = path.join(os.homedir(), ".khanhromvn-zen", "lsp");
    this.ensureLSPDir();
  }

  public static getInstance(): CustomLSPService {
    if (!CustomLSPService.instance) {
      CustomLSPService.instance = new CustomLSPService();
    }
    return CustomLSPService.instance;
  }

  public setStorageManager(manager: GlobalStorageManager): void {
    this.storageManager = manager;
  }

  private ensureLSPDir(): void {
    if (!fs.existsSync(this.lspDir)) {
      fs.mkdirSync(this.lspDir, { recursive: true });
      this.logger.info("[CustomLSPService] Created LSP directory", {
        path: this.lspDir,
      });
    }
  }

  /**
   * Detect language from file extension
   */
  public detectLanguage(filename: string): string {
    const ext = filename.split(".").pop()?.toLowerCase() || "";

    const extMap: Record<string, string> = {
      ts: "typescript",
      tsx: "typescript",
      js: "javascript",
      jsx: "javascript",
      mjs: "javascript",
      cjs: "javascript",
      py: "python",
      pyw: "python",
      rs: "rust",
      go: "go",
      css: "css",
      scss: "css",
      sass: "css",
      less: "css",
      html: "html",
      htm: "html",
      json: "json",
      yaml: "yaml",
      yml: "yaml",
    };

    return extMap[ext] || "";
  }

  /**
   * Get LSP server info by language ID
   */
  public getLSPServerInfo(languageId: string): LSPServerInfo | null {
    const lspServers: Record<string, LSPServerInfo> = {
      typescript: {
        id: "typescript",
        name: "TypeScript Language Server",
        language: "TypeScript / JavaScript",
        npmPackage: "typescript-language-server",
        description: "IntelliSense for .ts / .tsx / .js / .jsx",
      },
      javascript: {
        id: "javascript",
        name: "TypeScript Language Server",
        language: "JavaScript",
        npmPackage: "typescript-language-server",
        description: "IntelliSense for .js / .jsx",
      },
      python: {
        id: "python",
        name: "Pyright",
        language: "Python",
        npmPackage: "pyright",
        description: "Fast type checker for Python",
      },
      rust: {
        id: "rust",
        name: "Rust Analyzer",
        language: "Rust",
        npmPackage: "rust-analyzer",
        description: "Rust language support",
      },
      go: {
        id: "go",
        name: "Gopls",
        language: "Go",
        npmPackage: "gopls",
        description: "Official Go language server",
      },
      css: {
        id: "css",
        name: "CSS Language Server",
        language: "CSS / SCSS / Less",
        npmPackage: "vscode-langservers-extracted",
        description: "Auto-complete for CSS",
      },
      html: {
        id: "html",
        name: "HTML Language Server",
        language: "HTML",
        npmPackage: "vscode-langservers-extracted",
        description: "Auto-complete for HTML",
      },
      json: {
        id: "json",
        name: "JSON Language Server",
        language: "JSON",
        npmPackage: "vscode-langservers-extracted",
        description: "Schema validation for JSON",
      },
      yaml: {
        id: "yaml",
        name: "YAML Language Server",
        language: "YAML",
        npmPackage: "yaml-language-server",
        description: "Schema validation for YAML",
      },
    };

    return lspServers[languageId] || null;
  }

  /**
   * Check if LSP package is installed
   */
  public isLSPInstalled(packageName: string): boolean {
    const packageDir = path.join(this.lspDir, packageName);
    const nodeModulesExists = fs.existsSync(
      path.join(packageDir, "node_modules"),
    );
    this.logger.info("[CustomLSPService] Check LSP installed", {
      packageName,
      packageDir,
      nodeModulesExists,
    });
    return nodeModulesExists;
  }

  /**
   * Auto-install LSP package if not installed
   */
  public async autoInstallLSP(
    packageName: string,
  ): Promise<{ success: boolean; message: string }> {
    this.logger.info("[CustomLSPService] Starting auto-install", {
      packageName,
    });

    if (this.isLSPInstalled(packageName)) {
      this.logger.info("[CustomLSPService] Package already installed", {
        packageName,
      });
      return {
        success: true,
        message: `${packageName} already installed`,
      };
    }

    const packageDir = path.join(this.lspDir, packageName);

    try {
      // Create package directory
      if (!fs.existsSync(packageDir)) {
        fs.mkdirSync(packageDir, { recursive: true });
      }

      // Create package.json
      const packageJson = {
        name: `zen-lsp-${packageName}`,
        version: "1.0.0",
        private: true,
        dependencies: {
          [packageName]: "latest",
        },
      };

      fs.writeFileSync(
        path.join(packageDir, "package.json"),
        JSON.stringify(packageJson, null, 2),
      );

      this.logger.info("[CustomLSPService] Created package.json", {
        packageDir,
      });

      // Show progress notification
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Installing ${packageName}...`,
          cancellable: false,
        },
        async (progress) => {
          progress.report({ increment: 0 });

          // Run npm install
          const { exec } = require("child_process");
          await new Promise<void>((resolve, reject) => {
            exec(
              "npm install --no-save",
              { cwd: packageDir },
              (error: Error | null, stdout: string, stderr: string) => {
                if (error) {
                  this.logger.error("[CustomLSPService] npm install failed", {
                    error: error.message,
                    stderr,
                  });
                  reject(error);
                } else {
                  this.logger.info("[CustomLSPService] npm install success", {
                    stdout: stdout.substring(0, 200),
                  });
                  resolve();
                }
              },
            );
          });

          progress.report({ increment: 100 });
        },
      );

      vscode.window.showInformationMessage(
        `✓ Installed ${packageName} successfully`,
      );

      return {
        success: true,
        message: `${packageName} installed successfully`,
      };
    } catch (error: any) {
      this.logger.error("[CustomLSPService] Install failed", {
        packageName,
        error: error.message,
      });

      vscode.window.showErrorMessage(
        `Failed to install ${packageName}: ${error.message}`,
      );

      return {
        success: false,
        message: `Failed to install ${packageName}: ${error.message}`,
      };
    }
  }

  /**
   * Check if custom LSP is enabled in settings
   */
  public async isCustomLSPEnabled(): Promise<boolean> {
    try {
      if (!this.storageManager) {
        this.logger.warn(
          "[CustomLSPService] StorageManager not initialized, custom LSP disabled",
        );
        return false;
      }
      const raw = await this.storageManager.get("zen_use_custom_lsp");
      const enabled = raw === "true";
      this.logger.info("[CustomLSPService] Check custom LSP enabled", {
        enabled,
      });
      return enabled;
    } catch {
      return false;
    }
  }

  /**
   * Process file for custom LSP diagnostic
   * Auto-install LSP if needed, then return ready status
   */
  public async processFileForCustomLSP(
    filePath: string,
  ): Promise<{
    shouldUseCustom: boolean;
    lspReady: boolean;
    languageId: string;
    packageName?: string;
  }> {
    const logger = this.logger;

    // Check if custom LSP is enabled
    const customEnabled = await this.isCustomLSPEnabled();
    if (!customEnabled) {
      logger.info(
        "[CustomLSPService] Custom LSP disabled, using VSCode LSP",
        { filePath },
      );
      return {
        shouldUseCustom: false,
        lspReady: false,
        languageId: "",
      };
    }

    // Detect language
    const languageId = this.detectLanguage(filePath);
    if (!languageId) {
      logger.info("[CustomLSPService] No language detected", { filePath });
      return {
        shouldUseCustom: false,
        lspReady: false,
        languageId: "",
      };
    }

    // Get LSP info
    const lspInfo = this.getLSPServerInfo(languageId);
    if (!lspInfo) {
      logger.info("[CustomLSPService] No LSP info for language", {
        languageId,
      });
      return {
        shouldUseCustom: false,
        lspReady: false,
        languageId,
      };
    }

    // Check if installed
    const installed = this.isLSPInstalled(lspInfo.npmPackage);
    if (!installed) {
      logger.info("[CustomLSPService] LSP not installed, auto-installing", {
        packageName: lspInfo.npmPackage,
      });

      const result = await this.autoInstallLSP(lspInfo.npmPackage);
      return {
        shouldUseCustom: true,
        lspReady: result.success,
        languageId,
        packageName: lspInfo.npmPackage,
      };
    }

    logger.info("[CustomLSPService] Custom LSP ready", {
      languageId,
      packageName: lspInfo.npmPackage,
    });

    return {
      shouldUseCustom: true,
      lspReady: true,
      languageId,
      packageName: lspInfo.npmPackage,
    };
  }
}
