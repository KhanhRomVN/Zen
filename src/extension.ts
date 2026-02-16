import * as vscode from "vscode";
import * as os from "os";
import * as crypto from "crypto";
import * as path from "path";
import * as fs from "fs";
import { ContextManager } from "./context/ContextManager";
import { AgentCapabilityManager } from "./agent/AgentCapabilityManager";
import { AgentPermissions } from "./agent/types/AgentTypes";
import { GlobalStorageManager } from "./storage-manager";
import { ProjectStructureManager } from "./context/ProjectStructureManager";
import { FuzzyMatcher } from "./utils/FuzzyMatcher";
import * as cp from "child_process";

class ProcessManager {
  private processes = new Map<
    string,
    {
      process: cp.ChildProcess;
      output: string;
      error: string;
      resolve: (result: { output: string; error: string | null }) => void;
    }
  >();

  start(
    actionId: string,
    command: string,
    cwd: string,
  ): Promise<{ output: string; error: string | null }> {
    return new Promise((resolve) => {
      // Use exec to support shell syntax (e.g. pipes, &&) easily, but we want stream access
      // cp.exec returns a ChildProcess, so we can access stdout/stderr streams.
      const child = cp.exec(
        command,
        { cwd, maxBuffer: 1024 * 1024 * 50 }, // 50MB buffer
        (err, stdout, stderr) => {
          // This callback runs on completion
          if (!this.processes.has(actionId)) return; // Already handled (detached/killed)

          // Standard completion
          this.processes.delete(actionId);
          resolve({
            output: stdout || "",
            error: err ? err.message : null,
          });
        },
      );

      // Collect real-time output for partial capture
      let accumulatedOutput = "";
      child.stdout?.on("data", (data) => {
        accumulatedOutput += data;
        if (this.processes.has(actionId)) {
          this.processes.get(actionId)!.output = accumulatedOutput;
        }
      });
      child.stderr?.on("data", (data) => {
        accumulatedOutput += data; // Combine for simplicity or separate? User wanted logs.
        if (this.processes.has(actionId)) {
          this.processes.get(actionId)!.output = accumulatedOutput;
        }
      });

      this.processes.set(actionId, {
        process: child,
        output: "", // Will be updated by listeners
        error: "",
        resolve,
      });
    });
  }

  stop(
    actionId: string,
    kill: boolean,
  ): { output: string; error: string | null } | null {
    const entry = this.processes.get(actionId);
    if (!entry) return null;

    this.processes.delete(actionId);

    if (kill) {
      // kill the process tree? exec spawns a shell.
      // simple kill might not kill children.
      // For now, simple kill.
      try {
        entry.process.kill();
      } catch (e) {
        // ignore
      }
    } else {
      // Detach: We just stop tracking it.
      // If we want it to truly persist in background independently of VSCode, we'd need 'detached: true' and 'ref: false' in spawn.
      // But execution via 'exec' is attached to shell.
      // For "Detach" as "Stop waiting", we essentially just resolve early.
      // The process might die if the extension host closes or if it fills up buffers if we stop listening?
      // We leave the process running (it is still attached to extension host).
      entry.process.stdout?.pause();
      entry.process.stderr?.pause();
      entry.process.unref();
    }

    // Force resolve the promise loop?
    // The promise returned by start() is waiting for resolve().
    // We should call it!
    entry.resolve({
      output: entry.output,
      error: kill ? "Process killed by user" : "Process detached by user",
    });

    return {
      output: entry.output,
      error: null,
    };
  }
}

class FileLockManager {
  private locks = new Map<string, Promise<void>>();

  async acquire(key: string): Promise<() => void> {
    let release: () => void;

    // Create the task that the NEXT requestor will wait for
    const task = new Promise<void>((resolve) => {
      release = resolve;
    });

    // Get the current tail of the queue
    const prev = this.locks.get(key) || Promise.resolve();

    // Update the tail. We catch errors on 'prev' so strict serialization continues even if a previous task failed.
    const nextFn = () => task;
    this.locks.set(key, prev.then(nextFn, nextFn));

    // Wait for the previous task to complete
    await prev.catch(() => {});

    return release!;
  }
}

const processManager = new ProcessManager();

export class ZenChatViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "zen-chat";

  private _view?: vscode.WebviewView;
  public _contextManager: ContextManager; // Made public or accessed via getter if cleaner, but public is easy for now
  private _agentManager?: AgentCapabilityManager;
  private _extensionContext?: vscode.ExtensionContext;
  private _storageManager?: GlobalStorageManager;
  private _projectStructureManager?: ProjectStructureManager;
  private _fileLockManager = new FileLockManager();

  constructor(
    private readonly _extensionUri: vscode.Uri,
    contextManager: ContextManager,
    storageManager: GlobalStorageManager,
    projectStructureManager: ProjectStructureManager,
  ) {
    this._contextManager = contextManager as ContextManager;
    this._storageManager = storageManager;
    this._projectStructureManager = projectStructureManager;
  }

  /**
   * Helper to send messages to the webview from outside
   */
  public postMessageToWebview(message: any) {
    if (this._view) {
      this._view.webview.postMessage(message);
    }
  }

  /**
   * Initialize agent manager
   */
  public initializeAgentManager(): void {
    // Initialize agent manager after port is set
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      const folderPath = workspaceFolder.uri.fsPath;
      vscode.commands.executeCommand(
        "setContext",
        "zen.workspaceFolderPath",
        folderPath,
      );

      const defaultPermissions: AgentPermissions = {
        readProjectFile: false,
        readAllFile: false,
        editProjectFiles: false,
        editAddFile: false,
        executeSafeCommand: false,
        executeAllCommands: false,
      };
      this._agentManager = new AgentCapabilityManager(
        defaultPermissions,
        folderPath,
      );
    }
  }

  private getSystemInfo(): any {
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const platform = process.platform;
    const homeDir = process.env.HOME || process.env.USERPROFILE || "~";
    const shell = process.env.SHELL || "/bin/bash";

    let osName = "Unknown";
    if (platform === "linux") {
      osName = "Linux";
    } else if (platform === "darwin") {
      osName = "macOS";
    } else if (platform === "win32") {
      osName = "Windows";
    }

    return {
      os: osName,
      ide: "Visual Studio Code",
      shell: shell,
      homeDir: homeDir,
      cwd: workspaceFolder?.uri.fsPath || homeDir,
    };
  }

  private getGitStatusText(status: number): string {
    // Git status codes from VS Code git API
    // 0 = INDEX_MODIFIED, 1 = INDEX_ADDED, 2 = INDEX_DELETED, etc.
    const statusMap: Record<number, string> = {
      0: "Modified",
      1: "Added",
      2: "Deleted",
      3: "Renamed",
      4: "Copied",
      5: "Untracked",
      6: "Ignored",
      7: "Modified",
      8: "Deleted",
      9: "Untracked",
    };
    return statusMap[status] || "Unknown";
  }

  private _getTempDir(workspaceFolderPath: string): string {
    const tempDir = os.tmpdir();
    // Create a unique hash for the workspace path to avoid collisions
    const hash = crypto
      .createHash("md5")
      .update(workspaceFolderPath)
      .digest("hex");
    const zenTempDir = path.join(tempDir, "zen-vscode", hash);
    return zenTempDir;
  }

  private getProjectContextKey(workspaceFolderPath: string): string {
    const hash = crypto
      .createHash("md5")
      .update(workspaceFolderPath)
      .digest("hex");
    return `project_context_${hash}`;
  }

  /**
   * Helper to get diagnostics (Errors/Warnings) for a file
   */
  private getDiagnosticsForFile(uri: vscode.Uri): string[] {
    const diagnostics = vscode.languages.getDiagnostics(uri);
    return diagnostics
      .filter(
        (d) =>
          d.severity === vscode.DiagnosticSeverity.Error ||
          d.severity === vscode.DiagnosticSeverity.Warning,
      )
      .map((d) => {
        const severity =
          d.severity === vscode.DiagnosticSeverity.Error ? "Error" : "Warning";
        return `[${severity}] Line ${d.range.start.line + 1}: ${d.message}`;
      });
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken,
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this._extensionUri, "src/webview-ui/dist"),
        vscode.Uri.joinPath(this._extensionUri, "src/webview-ui/public"),
        vscode.Uri.joinPath(this._extensionUri, "images"),
      ],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    this._updateTheme(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (message) => {
      if (message.command === "getProjectStructureBlacklist") {
        if (this._projectStructureManager) {
          const blacklist = await this._projectStructureManager.getBlacklist();
          webviewView.webview.postMessage({
            command: "projectStructureBlacklistResponse",
            blacklist,
          });
        }
      } else if (message.command === "confirmDelete") {
        // Show confirmation dialog for deleting conversation
        const result = await vscode.window.showWarningMessage(
          "Delete this conversation? This cannot be undone.",
          { modal: true },
          "Delete",
        );
        if (result === "Delete") {
          webviewView.webview.postMessage({
            command: "deleteConfirmed",
            conversationId: message.conversationId,
          });
        }
      } else if (message.command === "confirmClearAll") {
        // Show confirmation dialog for clearing all conversations
        const result = await vscode.window.showWarningMessage(
          "Delete ALL conversations? This cannot be undone.",
          { modal: true },
          "Delete All",
        );
        if (result === "Delete All") {
          webviewView.webview.postMessage({
            command: "clearAllConfirmed",
          });
        }
      } else if (message.command === "confirmClearChat") {
        // Show confirmation dialog for clearing current chat
        const result = await vscode.window.showWarningMessage(
          "Delete this conversation permanently? This cannot be undone.",
          { modal: true },
          "Delete",
        );
        if (result === "Delete") {
          webviewView.webview.postMessage({
            command: "clearChatConfirmed",
            conversationId: message.conversationId,
          });
        }
      } else if (message.command === "showError") {
        // Show error message to user
        vscode.window.showErrorMessage(message.message);
      } else if (message.command === "getFileStats") {
        // [New] Handle file stats request for line counts
        try {
          const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
          if (!workspaceFolder) return;

          const filePath = message.path;
          const absolutePath = vscode.Uri.joinPath(
            workspaceFolder.uri,
            filePath,
          );

          vscode.workspace.fs.readFile(absolutePath).then(
            (content) => {
              const textContent = Buffer.from(content).toString("utf8");
              const lines = textContent.split(/\r?\n/).length;
              webviewView.webview.postMessage({
                command: "fileStatsResult",
                path: filePath,
                lines,
                id: message.id, // Pass back correlation ID
              });
            },
            () => {
              // Ignore errors (file might not exist yet)
              webviewView.webview.postMessage({
                command: "fileStatsResult",
                path: filePath,
                lines: 0,
                id: message.id,
                error: true,
              });
            },
          );
        } catch (error) {
          // Silent fail
        }
      } else if (message.command === "readFile") {
        // Handle read file request from webview
        try {
          const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
          if (!workspaceFolder) {
            webviewView.webview.postMessage({
              command: "fileContent",
              requestId: message.requestId,
              error: "No workspace folder open",
            });
            return;
          }

          const filePath = message.path;
          const absolutePath = vscode.Uri.joinPath(
            workspaceFolder.uri,
            filePath,
          );

          vscode.workspace.fs.readFile(absolutePath).then(
            (content) => {
              let textContent = Buffer.from(content).toString("utf8");

              // Handle line slicing
              if (
                message.startLine !== undefined ||
                message.endLine !== undefined
              ) {
                const lines = textContent.split(/\r?\n/);
                const start = message.startLine || 0;
                const end =
                  message.endLine !== undefined
                    ? message.endLine + 1
                    : lines.length;
                textContent = lines.slice(start, end).join("\n");
              }

              const diagnostics = this.getDiagnosticsForFile(absolutePath);

              webviewView.webview.postMessage({
                command: "fileContent",
                requestId: message.requestId,
                path: filePath,
                content: textContent,
                diagnostics: diagnostics.length > 0 ? diagnostics : undefined,
              });
            },
            (error) => {
              webviewView.webview.postMessage({
                command: "fileContent",
                requestId: message.requestId,
                error: error.message || String(error),
              });
            },
          );
        } catch (error) {
          webviewView.webview.postMessage({
            command: "fileContent",
            requestId: message.requestId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      } else if (message.command === "writeFile") {
        // Handle write file request from webview
        try {
          const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
          if (!workspaceFolder) {
            webviewView.webview.postMessage({
              command: "writeFileResult",
              requestId: message.requestId,
              error: "No workspace folder open",
            });
            return;
          }

          const filePath = message.path;
          const content = message.content;
          const absolutePath = vscode.Uri.joinPath(
            workspaceFolder.uri,
            filePath,
          );

          const buffer = Buffer.from(content, "utf8");
          vscode.workspace.fs.writeFile(absolutePath, buffer).then(
            async () => {
              if (message.skipDiagnostics) {
                webviewView.webview.postMessage({
                  command: "writeFileResult",
                  requestId: message.requestId,
                  path: filePath,
                  success: true,
                });
                return;
              }

              // Wait for diagnostics to update
              try {
                await vscode.workspace.openTextDocument(absolutePath);
              } catch (e) {
                // Ignore
              }

              await new Promise((resolve) => setTimeout(resolve, 1500));
              const diagnostics = this.getDiagnosticsForFile(absolutePath);

              webviewView.webview.postMessage({
                command: "writeFileResult",
                requestId: message.requestId,
                path: filePath,
                success: true,
                diagnostics: diagnostics.length > 0 ? diagnostics : undefined,
              });
            },
            (error) => {
              webviewView.webview.postMessage({
                command: "writeFileResult",
                requestId: message.requestId,
                error: error.message || String(error),
              });
            },
          );
        } catch (error) {
          webviewView.webview.postMessage({
            command: "writeFileResult",
            requestId: message.requestId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      } else if (message.command === "replaceInFile") {
        // Handle replace in file request from webview
        try {
          const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
          if (!workspaceFolder) {
            webviewView.webview.postMessage({
              command: "replaceInFileResult",
              requestId: message.requestId,
              error: "No workspace folder open",
            });
            return;
          }

          const filePath = message.path;
          const diff = message.diff;
          const absolutePath = vscode.Uri.joinPath(
            workspaceFolder.uri,
            filePath,
          );

          // [New] Serialize replacements to prevent race conditions
          const releaseLock = await this._fileLockManager.acquire(
            absolutePath.fsPath,
          );

          let newContent: string | undefined; // Hoist newContent for later use

          try {
            // Read current file content
            const content = await vscode.workspace.fs.readFile(absolutePath);
            const currentContent = Buffer.from(content).toString("utf8");

            // Parse diff format with flexible whitespace handling
            // Supports both:
            // <<<<<<< SEARCH\n...\n=======\n...\n>>>>>>> REPLACE
            // <<<<<<< SEARCH\n\n...\n=======\n\n...\n> REPLACE
            const searchMatch = diff.match(
              /<<<<<<< SEARCH\s*\n([\s\S]*?)\n\s*=======\s*\n([\s\S]*?)(?:>>>>>>>|>)\s*REPLACE/,
            );

            if (!searchMatch) {
              webviewView.webview.postMessage({
                command: "replaceInFileResult",
                requestId: message.requestId,
                error: `Invalid diff format. Expected SEARCH/REPLACE format.\n\nReceived diff:\n${diff.substring(
                  0,
                  200,
                )}...`,
              });
              releaseLock();
              return;
            }

            // Helper to clean markdown artifacts (code fences)
            const cleanArtifacts = (text: string) => {
              return text.replace(/^```[a-zA-Z]*$/gm, "").trim();
            };

            const searchText = cleanArtifacts(searchMatch[1]);
            const replaceText = cleanArtifacts(searchMatch[2]);

            // Check if search text exists in file
            let searchIndex = currentContent.indexOf(searchText);
            let targetSearchText = searchText;

            if (searchIndex === -1) {
              // Try fuzzy match
              const fuzzyMatch = FuzzyMatcher.findMatch(
                currentContent,
                searchText,
              );
              if (fuzzyMatch) {
                // [New] Enforce 100% accuracy for fuzzy matches
                // score is (1 - similarity), so 0 means 100% similarity (normalized)
                if (fuzzyMatch.score > 1e-9) {
                  // Log fuzzy search details since it's an imperfect match
                  const accuracy = (1 - fuzzyMatch.score) * 100;
                  webviewView.webview.postMessage({
                    command: "replaceInFileResult",
                    requestId: message.requestId,
                    error: `Fuzzy search found a potential match but it was not 100% accurate (Accuracy: ${(
                      (1 - fuzzyMatch.score) *
                      100
                    ).toFixed(
                      2,
                    )}%). \n\nReplacement aborted for safety. Please provide the exact code block to replace.`,
                  });
                  releaseLock();
                  return;
                }

                targetSearchText = fuzzyMatch.originalText;
              }
            }

            if (searchIndex === -1 && targetSearchText === searchText) {
              webviewView.webview.postMessage({
                command: "replaceInFileResult",
                requestId: message.requestId,
                error: "Search text not found in file (even with fuzzy match)",
              });
              releaseLock();
              return;
            }

            newContent = currentContent.replace(targetSearchText, replaceText);

            if (newContent === currentContent) {
              webviewView.webview.postMessage({
                command: "replaceInFileResult",
                requestId: message.requestId,
                error: "Search text not found in file",
              });
              releaseLock();
              return;
            }

            // Write back to file
            const buffer = Buffer.from(newContent, "utf8");
            await vscode.workspace.fs.writeFile(absolutePath, buffer);
          } catch (error) {
            // Handle error inside lock
            webviewView.webview.postMessage({
              command: "replaceInFileResult",
              requestId: message.requestId,
              error: error instanceof Error ? error.message : String(error),
            });
            releaseLock(); // Release on error
            return;
          }

          // Release lock immediately after writing to allow next task to proceed
          releaseLock();

          // Wait for diagnostics to update (OUTSIDE LOCK)
          if (message.skipDiagnostics) {
            webviewView.webview.postMessage({
              command: "replaceInFileResult",
              requestId: message.requestId,
              path: filePath,
              success: true,
            });
            return;
          }

          try {
            // Force open document to ensure language server computes diagnostics
            await vscode.workspace.openTextDocument(absolutePath);
          } catch (e) {
            // Ignore error if cannot open
          }

          // Wait a bit for diagnostics to effectively update
          await new Promise((resolve) => setTimeout(resolve, 1500));
          const diagnostics = this.getDiagnosticsForFile(absolutePath);

          webviewView.webview.postMessage({
            command: "replaceInFileResult",
            requestId: message.requestId,
            path: filePath,
            success: true,
            diagnostics: diagnostics.length > 0 ? diagnostics : undefined,
            content: diagnostics.length > 0 ? newContent : undefined,
          });
        } catch (error) {
          webviewView.webview.postMessage({
            command: "replaceInFileResult",
            requestId: message.requestId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      } else if (message.command === "getProjectContext") {
        // [New] Handle getProjectContext request
        /* console.log(
          "[Extension] getProjectContext requested, requestId:",
          message.requestId
        ); */
        try {
          const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
          if (!workspaceFolder) {
            webviewView.webview.postMessage({
              command: "projectContextResult",
              requestId: message.requestId,
              error: "No workspace folder open",
            });
            return;
          }

          const rootPath = workspaceFolder.uri.fsPath;
          const workspaceMdPath = path.join(rootPath, "workspace.md");
          const rulesMdPath = path.join(rootPath, "workspace_rules.md");

          // [New] behaviors: Auto-create if not exists (Like Elara)
          try {
            await fs.promises.access(workspaceMdPath);
          } catch {
            const workspaceName = workspaceFolder.name;
            const template = `# ${workspaceName}\n\n## ℹ️ Information\n- **Project Name:** ${workspaceName}\n- **Main Language:** \n- **Tools:** \n- **Packages:** \n- **Services:** \n- **Goals:** \n- **Key Features:** \n\n## 📂 Directory Structure\n<!-- This section will be auto-generated by AI if needed -->\n`;
            await fs.promises.writeFile(workspaceMdPath, template, "utf-8");
          }

          try {
            await fs.promises.access(rulesMdPath);
          } catch {
            await fs.promises.writeFile(rulesMdPath, "", "utf-8");
          }

          const [workspaceContent, rulesContent, treeView] = await Promise.all([
            fs.promises
              .readFile(workspaceMdPath, "utf-8")
              .catch(() => undefined),
            fs.promises.readFile(rulesMdPath, "utf-8").catch(() => undefined),
            this._contextManager.getFileSystemAnalyzer().getFileTree(3),
          ]);

          webviewView.webview.postMessage({
            command: "projectContextResult",
            requestId: message.requestId,
            data: {
              workspace: workspaceContent,
              rules: rulesContent,
              treeView: treeView,
            },
          });
          /* console.log(
            "[Extension] getProjectContext sent response, requestId:",
            message.requestId
          ); */
        } catch (error) {
          webviewView.webview.postMessage({
            command: "projectContextResult",
            requestId: message.requestId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      } else if (message.command === "listFiles") {
        // Handle list files request from webview
        try {
          const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
          if (!workspaceFolder) {
            webviewView.webview.postMessage({
              command: "listFilesResult",
              requestId: message.requestId,
              error: "No workspace folder open",
            });
            return;
          }

          const dirPath = message.path;
          const recursiveParam = message.recursive;
          const typeParam = message.type || "all";
          const absolutePath = vscode.Uri.joinPath(
            workspaceFolder.uri,
            dirPath,
          );

          // Determine max depth
          let maxDepth = 1;
          if (recursiveParam === "true" || recursiveParam === true) {
            maxDepth = 20; // Default max depth for 'true'
          } else if (recursiveParam) {
            const parsed = parseInt(String(recursiveParam), 10);
            if (!isNaN(parsed) && parsed > 0) {
              maxDepth = parsed;
            }
          }

          // Get analyzer instance
          const fsAnalyzer = this._contextManager.getFileSystemAnalyzer();

          const walk = async (
            currentUri: vscode.Uri,
            currentDepth: number,
            rootPathLength: number,
          ): Promise<string[]> => {
            if (currentDepth > maxDepth) return [];

            const entries = await vscode.workspace.fs.readDirectory(currentUri);
            const results: string[] = [];

            // Parallelize file processing for speed
            const processedEntries = await Promise.all(
              entries.map(async ([name, type]) => {
                if (
                  name === "node_modules" ||
                  name === ".git" ||
                  name === "dist" ||
                  name === ".DS_Store"
                )
                  return null;

                const entryUri = vscode.Uri.joinPath(currentUri, name);
                const relativePath = entryUri.fsPath.substring(
                  rootPathLength + 1,
                ); // +1 for separator

                const isFile = type === vscode.FileType.File;
                const isDirectory = type === vscode.FileType.Directory;

                // Filter based on 'type'
                let include = false;
                if (typeParam === "only_file" && isFile) include = true;
                else if (typeParam === "only_folder" && isDirectory)
                  include = true;
                else if (typeParam === "all") include = true;

                if (!include) {
                  if (isDirectory && currentDepth < maxDepth) {
                    return { type: "dir_recurse", uri: entryUri };
                  }
                  return null;
                }

                let suffix = "";
                if (isFile) {
                  const lines = await fsAnalyzer.getFileLineCount(
                    entryUri.fsPath,
                  );
                  suffix = ` (${lines} lines)`;
                } else if (isDirectory) {
                  // countFilesRecursive is sync/fast enough for subdirs usually, or we can use it
                  const count = fsAnalyzer.countFilesRecursive(entryUri.fsPath);
                  suffix = ` (${count} files)`;
                }

                const resultStr = relativePath + suffix;

                if (isDirectory && currentDepth < maxDepth) {
                  return {
                    type: "dir_recurse_and_add",
                    uri: entryUri,
                    result: resultStr,
                  };
                }

                return { type: "add", result: resultStr };
              }),
            );

            // Process results and recursions
            for (const entry of processedEntries) {
              if (!entry) continue;

              if (entry.result) {
                results.push(entry.result);
              }

              if (
                (entry.type === "dir_recurse" ||
                  entry.type === "dir_recurse_and_add") &&
                entry.uri
              ) {
                const subResults = await walk(
                  entry.uri,
                  currentDepth + 1,
                  rootPathLength,
                );
                results.push(...subResults);
              }
            }

            return results;
          };

          // Start walking
          // Note: The 'path' param in list_files is expected to be relative to workspace?
          // If 'dirPath' is ".", joinPath works.
          // We need rootPathLength relative to the workspace folder + dirPath?
          // Actually, results usually expected relative to the 'path' argument? Or relative to workspace?
          // Standard: relative to the SEARCHED directory (dirPath).

          walk(absolutePath, 1, absolutePath.fsPath.length).then(
            (files) => {
              webviewView.webview.postMessage({
                command: "listFilesResult",
                requestId: message.requestId,
                path: dirPath,
                files: files.sort(),
              });
            },
            (error) => {
              webviewView.webview.postMessage({
                command: "listFilesResult",
                requestId: message.requestId,
                error: error.message || String(error),
              });
            },
          );
        } catch (error) {
          webviewView.webview.postMessage({
            command: "listFilesResult",
            requestId: message.requestId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      } else if (message.command === "searchFiles") {
        // Handle search files request from webview
        try {
          const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
          if (!workspaceFolder) {
            webviewView.webview.postMessage({
              command: "searchFilesResult",
              requestId: message.requestId,
              error: "No workspace folder open",
            });
            return;
          }

          const searchPath = message.path || ".";
          const regex = message.regex;
          if (!regex) {
            webviewView.webview.postMessage({
              command: "searchFilesResult",
              requestId: message.requestId,
              error: "No regex provided",
            });
            return;
          }

          // Use grep for content search
          // Command: grep -rI "regex" [path] -l
          // -r: recursive
          // -I: ignore binary
          // -l: only print filenames
          // -E: extended regex? User said "regex", so -P or -E might be better? Let's use basic grep first, or egrep if safer.
          // VS Code environment usually has git installed, so `git grep` is highly reliable if inside git repo.
          // But fallback to `grep` is safer for non-git.

          const cwd = workspaceFolder.uri.fsPath;
          const { exec } = require("child_process");

          // Construct command
          // Escape quotes in regex?
          // Using strict wrapping with single quotes for shell safety if possible, or double quotes.
          // A safer way is to use execFile/spawn but exec is easier for simple string command.
          // We need to be careful about injection. BUT parsed regex comes from AI.

          const safeRegex = regex.replace(/"/g, '\\"');
          const safePath = searchPath.replace(/"/g, '\\"');

          // Combine path relative to cwd
          const targetPath = path.join(".", safePath);

          // Using 'grep -rIlE' for recursive, ignore-binary, files-with-matches, extended-regex
          const cmd = `grep -rIlE "${safeRegex}" "${targetPath}"`;

          exec(
            cmd,
            { cwd, maxBuffer: 1024 * 1024 * 10 },
            (error: any, stdout: string, stderr: string) => {
              // Grep returns exit code 1 if no matches, which triggers error in exec.
              if (error && error.code === 1) {
                // No matches
                webviewView.webview.postMessage({
                  command: "searchFilesResult",
                  requestId: message.requestId,
                  path: searchPath,
                  results: [],
                });
                return;
              }
              if (error) {
                // Real error
                webviewView.webview.postMessage({
                  command: "searchFilesResult",
                  requestId: message.requestId,
                  error: stderr || error.message || "Grep execution failed",
                });
                return;
              }

              const results = stdout
                .trim()
                .split("\n")
                .filter((line) => line.length > 0);
              webviewView.webview.postMessage({
                command: "searchFilesResult",
                requestId: message.requestId,
                path: searchPath,
                results: results,
              });
            },
          );
        } catch (error) {
          webviewView.webview.postMessage({
            command: "searchFilesResult",
            requestId: message.requestId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      } else if (message.command === "validateFuzzyMatch") {
        // Handle validation request
        try {
          const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
          if (!workspaceFolder) return; // Silent or simplified return

          const filePath = message.path;
          const diff = message.diff;
          const absolutePath = vscode.Uri.joinPath(
            workspaceFolder.uri,
            filePath,
          );

          vscode.workspace.fs.readFile(absolutePath).then(
            (content) => {
              const currentContent = Buffer.from(content).toString("utf8");
              const searchMatch = diff.match(
                /<<<<<<< SEARCH\s*\n([\s\S]*?)\n\s*=======\s*\n([\s\S]*?)(?:>>>>>>>|>)\s*REPLACE/,
              );

              if (!searchMatch || !searchMatch[1]) {
                webviewView.webview.postMessage({
                  command: "validateFuzzyMatchResult",
                  id: message.id,
                  status: "invalid_format",
                });
                return;
              }

              // Helper to clean markdown artifacts (same as in replaceInFile)
              const cleanArtifacts = (text: string) => {
                return text.replace(/^```[a-zA-Z]*$/gm, "").trim();
              };

              const normalize = (text: string) => text.replace(/\r\n/g, "\n");

              const searchText = normalize(cleanArtifacts(searchMatch[1]));
              const currentContentNormalized = normalize(currentContent);
              const exactIndex = currentContentNormalized.indexOf(searchText);

              if (exactIndex !== -1) {
                // Calculate line number from character index
                const startLine = currentContentNormalized
                  .substring(0, exactIndex)
                  .split(/\r?\n/).length;
                webviewView.webview.postMessage({
                  command: "validateFuzzyMatchResult",
                  id: message.id,
                  status: "exact",
                  searchBlock: searchText,
                  foundBlock: searchText,
                  score: 1.0,
                  startLine: startLine,
                });
              } else {
                const fuzzyMatch = FuzzyMatcher.findMatch(
                  currentContent,
                  searchText,
                );
                if (fuzzyMatch) {
                  if (fuzzyMatch.score > 1e-9) {
                    // Log fuzzy search details for validation/preview ONLY if < 100%
                    const replaceText = cleanArtifacts(searchMatch[2]);
                    const accuracy = (1 - fuzzyMatch.score) * 100;
                    const removedLines =
                      fuzzyMatch.originalText.split(/\r?\n/).length;
                    const addedLines = replaceText.split(/\r?\n/).length;
                  }

                  webviewView.webview.postMessage({
                    command: "validateFuzzyMatchResult",
                    id: message.id,
                    status: "fuzzy",
                    score: fuzzyMatch.score,
                    searchBlock: searchText,
                    foundBlock: fuzzyMatch.originalText,
                    startLine: fuzzyMatch.startLine,
                  });
                } else {
                  webviewView.webview.postMessage({
                    command: "validateFuzzyMatchResult",
                    id: message.id,
                    status: "none",
                    searchBlock: searchText,
                    foundBlock: null,
                  });
                }
              }
            },
            () => {
              // File not found or other error
              webviewView.webview.postMessage({
                command: "validateFuzzyMatchResult",
                id: message.id,
                status: "error",
              });
            },
          );
        } catch (error) {
          // console.error("Fuzzy validation error:", error);
        }
      } else if (message.command === "getSystemInfo") {
        webviewView.webview.postMessage({
          command: "systemInfo",
          data: this.getSystemInfo(),
        });
      } else if (message.command === "updateAgentPermissions") {
        // Update agent permissions from webview
        if (this._agentManager && message.permissions) {
          this._agentManager.updatePermissions(message.permissions);
        }
      } else if (message.command === "executeAgentAction") {
        // Execute agent action from webview
        if (this._agentManager && message.action) {
          this._agentManager
            .executeAction(message.action)
            .then((result) => {
              webviewView.webview.postMessage({
                command: "agentActionResult",
                requestId: message.action.requestId,
                result: result,
              });
            })
            .catch((error) => {
              webviewView.webview.postMessage({
                command: "agentActionResult",
                requestId: message.action.requestId,
                result: {
                  success: false,
                  error: error.message || String(error),
                  timestamp: Date.now(),
                },
              });
            });
        }
      } else if (message.command === "storageGet") {
        // Handle storage.get from webview
        try {
          // const value = this._extensionContext!.globalState.get(message.key);
          const value = await this._storageManager?.get(message.key);
          webviewView.webview.postMessage({
            command: "storageGetResponse",
            requestId: message.requestId,
            key: message.key,
            value: value || null,
          });
        } catch (error) {
          webviewView.webview.postMessage({
            command: "storageGetResponse",
            requestId: message.requestId,
            key: message.key,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      } else if (message.command === "storageSet") {
        // Handle storage.set from webview
        try {
          await this._storageManager?.set(message.key, message.value);
          webviewView.webview.postMessage({
            command: "storageSetResponse",
            requestId: message.requestId,
            success: true,
          });
        } catch (error) {
          webviewView.webview.postMessage({
            command: "storageSetResponse",
            requestId: message.requestId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      } else if (message.command === "storageDelete") {
        // Handle storage.delete from webview
        try {
          await this._storageManager?.delete(message.key);
          webviewView.webview.postMessage({
            command: "storageDeleteResponse",
            requestId: message.requestId,
            success: true,
          });
        } catch (error) {
          webviewView.webview.postMessage({
            command: "storageDeleteResponse",
            requestId: message.requestId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      } else if (message.command === "storageList") {
        // Handle storage.list from webview
        try {
          const filteredKeys = await this._storageManager?.list(message.prefix);
          webviewView.webview.postMessage({
            command: "storageListResponse",
            requestId: message.requestId,
            keys: filteredKeys,
          });
        } catch (error) {
          webviewView.webview.postMessage({
            command: "storageListResponse",
            requestId: message.requestId,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      } else if (message.command === "sendMessage") {
        // Handle send message request from webview (e.g., from followup options)
        const text = message.text;
        if (text && webviewView) {
          // Send the message back to webview to be processed as user input
          webviewView.webview.postMessage({
            command: "userMessage",
            text: text,
          });
        }
      } else if (message.command === "openDiffView") {
        // Handle open diff view request from webview
        try {
          const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
          if (!workspaceFolder) {
            vscode.window.showErrorMessage("No workspace folder open");
            return;
          }

          const filePath = message.filePath;
          const newCode = message.newCode || "";

          // Handle both absolute and relative paths
          let actualFilePath: vscode.Uri;
          if (filePath.startsWith("/") || filePath.match(/^[a-zA-Z]:\\/)) {
            // Absolute path
            actualFilePath = vscode.Uri.file(filePath);
          } else {
            // Relative path
            actualFilePath = vscode.Uri.joinPath(workspaceFolder.uri, filePath);
          }

          // Create temp directory for new code preview
          const tmpDir = this._getTempDir(workspaceFolder.uri.fsPath);
          const tmpDirUri = vscode.Uri.file(tmpDir);

          // Ensure temp directory exists
          await vscode.workspace.fs.createDirectory(tmpDirUri).then(
            () => {},
            () => {}, // Ignore error if directory already exists
          );

          // Create temp file for new code with actual extension for syntax highlighting
          const basename = path.basename(filePath);
          const ext = path.extname(basename);
          const nameWithoutExt = path.basename(basename, ext);
          const newFile = vscode.Uri.file(
            path.join(tmpDir, `${nameWithoutExt}.checkpoint${ext}`),
          );

          await vscode.workspace.fs.writeFile(
            newFile,
            Buffer.from(newCode, "utf8"),
          );

          // Open diff view: actual file (left) vs checkpoint (right)
          await vscode.commands.executeCommand(
            "vscode.diff",
            actualFilePath,
            newFile,
            `${basename} (Current ↔ Checkpoint)`,
          );
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to open diff view: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      } else if (message.command === "openFile") {
        // Handle open file request from webview
        try {
          const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
          if (!workspaceFolder) {
            vscode.window.showErrorMessage("No workspace folder open");
            return;
          }

          const filePath = message.path;
          const absolutePath = vscode.Uri.joinPath(
            workspaceFolder.uri,
            filePath,
          );

          // Open file in editor
          vscode.workspace.openTextDocument(absolutePath).then(
            (document) => {
              vscode.window.showTextDocument(document);
            },
            (error) => {
              vscode.window.showErrorMessage(
                `Failed to open file: ${error.message || String(error)}`,
              );
            },
          );
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to open file: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      } else if (message.command === "executeCommand") {
        // Handle execute command request from webview
        try {
          const command = message.commandText;
          if (!command) {
            vscode.window.showErrorMessage("No command provided");
            return;
          }

          const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
          if (!workspaceFolder) {
            vscode.window.showErrorMessage("No workspace folder open");
            return;
          }

          const cwd = workspaceFolder.uri.fsPath;

          // Execute command using ProcessManager
          processManager
            .start(message.actionId, command, cwd)
            .then((result) => {
              // Send result back to webview
              if (webviewView) {
                webviewView.webview.postMessage({
                  command: "commandExecuted",
                  commandText: command,
                  actionId: message.actionId,
                  output: result.output.trim(),
                  error: result.error,
                });
              }
            });

          // Show notification
          vscode.window.showInformationMessage(`Executing command: ${command}`);
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to execute command: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      } else if (message.command === "stopCommand") {
        // Handle stop/detach command request
        try {
          // stop() resolves the start() promise, which triggers commandExecuted.
          processManager.stop(message.actionId, message.kill);
        } catch (error) {
          // console.error("Failed to stop command:", error);
        }
      } else if (message.command === "confirmRevert") {
        // Handle confirm revert request - show VS Code confirmation dialog
        try {
          const checkpoint = message.checkpoint;
          if (!checkpoint || !checkpoint.filePath) {
            vscode.window.showErrorMessage("Invalid checkpoint data");
            return;
          }

          const fileName = checkpoint.filePath.split("/").pop();
          const confirmed = await vscode.window.showWarningMessage(
            `Revert ${fileName} to checkpoint?`,
            { modal: true },
            "Revert",
          );

          if (confirmed === "Revert") {
            // User confirmed, proceed with revert
            const fileUri = vscode.Uri.file(checkpoint.filePath);
            const content = Buffer.from(checkpoint.preEditContent, "utf8");
            await vscode.workspace.fs.writeFile(fileUri, content);

            // Show success message
            vscode.window.showInformationMessage(
              `✅ Reverted ${fileName} to checkpoint`,
            );

            // Send success to webview with actionId
            if (webviewView) {
              webviewView.webview.postMessage({
                command: "revertSuccess",
                filePath: checkpoint.filePath,
                actionId: checkpoint.actionId,
                messageId: checkpoint.messageId, // Send messageId to remove subsequent messages
              });
            }
          }
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to revert: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );

          if (webviewView) {
            webviewView.webview.postMessage({
              command: "revertError",
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      } else if (message.command === "openPreview") {
        // Handle open preview request from webview
        try {
          const content = message.content;
          const language = message.language || "markdown"; // Default to markdown

          const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
          if (!workspaceFolder) {
            vscode.window.showErrorMessage("No workspace folder open");
            return;
          }

          // Create untitled document with content
          const document = await vscode.workspace.openTextDocument({
            content: content,
            language: language,
          });

          await vscode.window.showTextDocument(document);
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to open preview: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      } else if (message.command === "openTempImage") {
        // Handle open temp image request from webview
        try {
          const content = message.content; // Base64 data url
          const filename = message.filename || "image.png";

          const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
          if (!workspaceFolder) {
            vscode.window.showErrorMessage("No workspace folder open");
            return;
          }

          // Create temp directory
          const tmpDir = this._getTempDir(workspaceFolder.uri.fsPath);
          const tmpDirUri = vscode.Uri.file(tmpDir);

          await vscode.workspace.fs.createDirectory(tmpDirUri).then(
            () => {},
            () => {}, // Ignore error if exists
          );

          // Remove data:image/xxx;base64, prefix
          const base64Data = content.replace(/^data:image\/\w+;base64,/, "");
          const buffer = Buffer.from(base64Data, "base64");

          // Create temp file
          const tempFilePath = path.join(
            tmpDir,
            `temp-${Date.now()}-${filename}`,
          );
          const tempFileUri = vscode.Uri.file(tempFilePath);

          await vscode.workspace.fs.writeFile(tempFileUri, buffer);

          // Open image
          await vscode.commands.executeCommand("vscode.open", tempFileUri);
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to open image: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      } else if (message.command === "revertToCheckpoint") {
        // Handle revert to checkpoint request from webview
        try {
          const checkpoint = message.checkpoint;
          if (
            !checkpoint ||
            !checkpoint.filePath ||
            !checkpoint.preEditContent
          ) {
            vscode.window.showErrorMessage("Invalid checkpoint data");
            return;
          }

          const fileUri = vscode.Uri.file(checkpoint.filePath);

          // Write checkpoint content back to file (use preEditContent)
          const content = Buffer.from(checkpoint.preEditContent, "utf8");
          await vscode.workspace.fs.writeFile(fileUri, content);

          // Show success message
          vscode.window.showInformationMessage(
            `✅ Reverted ${checkpoint.filePath.split("/").pop()} to checkpoint`,
          );

          // Send success to webview
          if (webviewView) {
            webviewView.webview.postMessage({
              command: "revertSuccess",
              filePath: checkpoint.filePath,
            });
          }
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to revert: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );

          if (webviewView) {
            webviewView.webview.postMessage({
              command: "revertError",
              error: error instanceof Error ? error.message : String(error),
            });
          }
        }
      } else if (message.command === "createCheckpoint") {
        // Handle create checkpoint request from webview
        try {
          const { filePath, conversationId, toolType, actionId, messageId } =
            message;
          if (!filePath) {
            // console.error("[Extension] No file path provided for checkpoint");
            return;
          }

          // Resolve file path (handle both absolute and relative paths)
          const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
          if (!workspaceFolder) {
            // console.error("[Extension] No workspace folder open");
            return;
          }

          // If path is relative, make it absolute using workspace folder
          let absolutePath = filePath;
          if (!filePath.startsWith("/") && !filePath.match(/^[a-zA-Z]:\\/)) {
            absolutePath = vscode.Uri.joinPath(
              workspaceFolder.uri,
              filePath,
            ).fsPath;
          }

          const fileUri = vscode.Uri.file(absolutePath);

          // Read current file content (pre-edit)
          const fileContent = await vscode.workspace.fs.readFile(fileUri);
          const contentString = Buffer.from(fileContent).toString("utf8");

          // Create checkpoint object with pre-edit content
          const checkpoint = {
            id: `checkpoint-${Date.now()}`,
            conversationId: conversationId || "",
            filePath: absolutePath,
            preEditContent: contentString, // Store as pre-edit content
            postEditContent: undefined, // Will be filled after tool completes
            timestamp: Date.now(),
            toolType: toolType || "unknown",
            isComplete: false, // Not complete yet
            actionId: actionId, // Store actionId from webview
            messageId: messageId, // Store messageId from webview
          };

          // Send checkpoint to webview
          if (webviewView) {
            webviewView.webview.postMessage({
              command: "checkpointCreated",
              checkpoint: checkpoint,
            });
          }

          // Schedule post-edit checkpoint creation (after tool completes)
          // Increased delay to 5 seconds to ensure tool has completed
          setTimeout(async () => {
            try {
              const updatedContent =
                await vscode.workspace.fs.readFile(fileUri);
              const updatedString =
                Buffer.from(updatedContent).toString("utf8");

              // Update checkpoint with post-edit content
              const updatedCheckpoint = {
                ...checkpoint,
                postEditContent: updatedString,
                isComplete: true,
              };

              // Send updated checkpoint to webview
              if (webviewView) {
                webviewView.webview.postMessage({
                  command: "checkpointUpdated",
                  checkpoint: updatedCheckpoint,
                });
              }
            } catch (error) {
              /* console.error(
                "[Extension] Failed to update checkpoint with post-edit content:",
                error,
              ); */
            }
          }, 5000); // 5 seconds delay
        } catch (error) {
          // console.error("[Extension] Failed to create checkpoint:", error);
          // Don't show error notification for file not found (tool might create it)
          if (
            error instanceof vscode.FileSystemError &&
            error.code === "FileNotFound"
          ) {
          } else {
            vscode.window.showErrorMessage(
              `Failed to create checkpoint: ${
                error instanceof Error ? error.message : String(error)
              }`,
            );
          }
        }
      } else if (message.command === "getGitChanges") {
        // Handle get git changes request from webview
        try {
          const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
          if (!workspaceFolder) {
            webviewView.webview.postMessage({
              command: "gitChangesResponse",
              error: "No workspace folder open",
              changes: [],
            });
            return;
          }

          // Get git extension
          const gitExtension = vscode.extensions.getExtension("vscode.git");
          if (!gitExtension) {
            webviewView.webview.postMessage({
              command: "gitChangesResponse",
              error: "Git extension not found",
              changes: [],
            });
            return;
          }

          // Activate git extension if not already activated
          if (!gitExtension.isActive) {
            await gitExtension.activate();
          }

          const git = gitExtension.exports.getAPI(1);
          if (!git) {
            webviewView.webview.postMessage({
              command: "gitChangesResponse",
              error: "Git API not available",
              changes: [],
            });
            return;
          }

          const repository = git.repositories[0];
          if (!repository) {
            webviewView.webview.postMessage({
              command: "gitChangesResponse",
              error: "No git repository found",
              changes: [],
            });
            return;
          }

          // Get changes from git status
          const changes = [];
          const { exec } = require("child_process");
          const util = require("util");
          const execPromise = util.promisify(exec);

          // Get staged changes
          for (const change of repository.state.indexChanges) {
            const relativePath = change.uri.fsPath.replace(
              workspaceFolder.uri.fsPath + "/",
              "",
            );

            // Get diff for staged file
            let diff = "";
            try {
              const { stdout } = await execPromise(
                `git diff --cached -- "${relativePath}"`,
                { cwd: workspaceFolder.uri.fsPath, maxBuffer: 1024 * 1024 * 5 },
              );
              diff = stdout;
            } catch (error) {}

            changes.push({
              status: this.getGitStatusText(change.status),
              path: relativePath,
              diff: diff || "",
            });
          }

          // Get unstaged changes
          for (const change of repository.state.workingTreeChanges) {
            const relativePath = change.uri.fsPath.replace(
              workspaceFolder.uri.fsPath + "/",
              "",
            );

            // Get diff for unstaged file
            let diff = "";
            try {
              const { stdout } = await execPromise(
                `git diff -- "${relativePath}"`,
                { cwd: workspaceFolder.uri.fsPath, maxBuffer: 1024 * 1024 * 5 },
              );
              diff = stdout;
            } catch (error) {}

            changes.push({
              status: this.getGitStatusText(change.status),
              path: relativePath,
              diff: diff || "",
            });
          }

          // Send response
          webviewView.webview.postMessage({
            command: "gitChangesResponse",
            changes: changes,
            error: null,
          });
        } catch (error) {
          // console.error("[Extension] Error getting git changes:", error);
          webviewView.webview.postMessage({
            command: "gitChangesResponse",
            error: error instanceof Error ? error.message : String(error),
            changes: [],
          });
        }
      } else if (message.command === "requestContext") {
        // Handle context request from webview
        let projectContext = null;

        // 1. Try to fetch Project Context first
        if (this._storageManager) {
          try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (workspaceFolder) {
              const key = this.getProjectContextKey(workspaceFolder.uri.fsPath);
              const projectContextStr = await this._storageManager.get(key);
              if (projectContextStr) {
                projectContext = JSON.parse(projectContextStr);
              }
            }
          } catch (e) {
            // console.error("Error fetching project context for prompt:", e);
          }
        }

        // 2. Generate Context with Project Context injected
        this._contextManager
          .generateContext(message.task, message.isFirstRequest, projectContext)
          .then((context) => {
            webviewView.webview.postMessage({
              command: "contextResponse",
              requestId: message.requestId,
              context: context,
            });
          })
          .catch((error) => {
            webviewView.webview.postMessage({
              command: "contextResponse",
              requestId: message.requestId,
              error: error.message || String(error),
            });
          });
      } else if (message.command === "getWorkspaceFiles") {
        // Handle get workspace files request from webview
        try {
          const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
          if (!workspaceFolder) {
            webviewView.webview.postMessage({
              command: "workspaceFilesResponse",
              files: [],
              error: "No workspace folder open",
            });
            return;
          }

          // Find all files in workspace (including filtered ones for display)
          vscode.workspace.findFiles("**/*").then(
            async (files) => {
              try {
                // Get file stats and sort by last modified
                const fileStats = await Promise.all(
                  files.map(async (file) => {
                    try {
                      const stat = await vscode.workspace.fs.stat(file);
                      const relativePath =
                        vscode.workspace.asRelativePath(file);
                      return {
                        path: relativePath,
                        lastModified: stat.mtime,
                        type: "file" as const,
                        size: stat.size,
                      };
                    } catch (error) {
                      return null;
                    }
                  }),
                );

                // Filter out nulls and sort by last modified (most recent first)
                const validFiles = fileStats
                  .filter((f) => f !== null)
                  .sort((a, b) => b!.lastModified - a!.lastModified);

                webviewView.webview.postMessage({
                  command: "workspaceFilesResponse",
                  files: validFiles,
                });
              } catch (error) {
                webviewView.webview.postMessage({
                  command: "workspaceFilesResponse",
                  files: [],
                  error: error instanceof Error ? error.message : String(error),
                });
              }
            },
            (error: any) => {
              webviewView.webview.postMessage({
                command: "workspaceFilesResponse",
                files: [],
                error: error.message || String(error),
              });
            },
          );
        } catch (error) {
          webviewView.webview.postMessage({
            command: "workspaceFilesResponse",
            files: [],
            error: error instanceof Error ? error.message : String(error),
          });
        }
      } else if (message.command === "getWorkspaceFolders") {
        // Handle get workspace folders request from webview
        try {
          const folders = vscode.workspace.workspaceFolders;
          if (folders && folders.length > 0) {
            webviewView.webview.postMessage({
              command: "workspaceFoldersResponse",
              folders: folders.map((f) => ({
                name: f.name,
                path: f.uri.fsPath, // Use absolute path for IndexingDrawer
                type: "folder",
              })),
            });
          } else {
            webviewView.webview.postMessage({
              command: "workspaceFoldersResponse",
              folders: [],
              error: "No workspace folder open",
            });
          }
        } catch (error) {
          webviewView.webview.postMessage({
            command: "workspaceFoldersResponse",
            folders: [],
            error: error instanceof Error ? error.message : String(error),
          });
        }
      } else if (message.command === "openWorkspaceFile") {
        // Handle open workspace file request from webview
        try {
          const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
          if (!workspaceFolder) {
            vscode.window.showErrorMessage("No workspace folder open");
            return;
          }

          const filePath = message.path;
          const absolutePath = vscode.Uri.joinPath(
            workspaceFolder.uri,
            filePath,
          );

          // Open file in editor
          vscode.workspace.openTextDocument(absolutePath).then(
            (document) => {
              vscode.window.showTextDocument(document);
            },
            (error) => {
              vscode.window.showErrorMessage(
                `Failed to open file: ${error.message || String(error)}`,
              );
            },
          );
        } catch (error) {
          vscode.window.showErrorMessage(
            `Failed to open file: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
        }
      } else if (message.command === "openProjectStructure") {
        // Handle open project structure request from webview
        vscode.commands.executeCommand("zen-project-structure.focus");
      } else if (message.command === "saveProjectContext") {
        try {
          const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
          if (workspaceFolder && this._storageManager) {
            const key = this.getProjectContextKey(workspaceFolder.uri.fsPath);
            await this._storageManager.set(
              key,
              JSON.stringify(message.context),
            );
            // Send confirmation? Not strictly needed for now as UI did optimistic update
          }
        } catch (error) {
          // console.error("Failed to save project context:", error);
        }
      } else if (message.command === "loadProjectContext") {
        try {
          const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
          if (workspaceFolder && this._storageManager) {
            const key = this.getProjectContextKey(workspaceFolder.uri.fsPath);
            const contextStr = await this._storageManager.get(key);
            if (contextStr) {
              webviewView.webview.postMessage({
                command: "projectContextResponse",
                context: JSON.parse(contextStr),
              });
            } else {
              webviewView.webview.postMessage({
                command: "projectContextResponse",
                context: null,
              });
            }
          }
        } catch (error) {
          // console.error("Failed to load project context:", error);
        }
      }
    });

    const themeChangeDisposable = vscode.window.onDidChangeActiveColorTheme(
      () => {
        this._updateTheme(webviewView.webview);
      },
    );

    // File system watcher for automatic refresh of ProjectStructureDrawer
    const fileWatcher = vscode.workspace.createFileSystemWatcher("**/*");
    let refreshTimeout: NodeJS.Timeout | null = null;

    const refreshWorkspaceFiles = () => {
      // Debounce to avoid excessive updates during bulk operations
      if (refreshTimeout) {
        clearTimeout(refreshTimeout);
      }

      refreshTimeout = setTimeout(async () => {
        try {
          const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
          if (!workspaceFolder) {
            return;
          }

          // Refresh files
          const files = await vscode.workspace.findFiles("**/*");
          const fileStats = await Promise.all(
            files.map(async (file) => {
              try {
                const stat = await vscode.workspace.fs.stat(file);
                const relativePath = vscode.workspace.asRelativePath(file);
                return {
                  path: relativePath,
                  lastModified: stat.mtime,
                  type: "file" as const,
                  size: stat.size,
                };
              } catch (error) {
                return null;
              }
            }),
          );

          const validFiles = fileStats
            .filter((f) => f !== null)
            .sort((a, b) => b!.lastModified - a!.lastModified);

          webviewView.webview.postMessage({
            command: "workspaceFilesResponse",
            files: validFiles,
          });

          // Refresh folders
          const folders = vscode.workspace.workspaceFolders;
          if (folders && folders.length > 0) {
            webviewView.webview.postMessage({
              command: "workspaceFoldersResponse",
              folders: folders.map((f) => ({
                name: f.name,
                path: f.uri.fsPath,
                type: "folder",
              })),
            });
          }
        } catch (error) {
          // console.error("[Extension] Error refreshing workspace files:", error);
        }
      }, 300); // 300ms debounce
    };

    fileWatcher.onDidCreate(refreshWorkspaceFiles);
    fileWatcher.onDidDelete(refreshWorkspaceFiles);
    fileWatcher.onDidChange(refreshWorkspaceFiles);

    // Thêm disposable vào context subscriptions nếu có (cho VS Code API tương thích)
    const ctx = context as any;
    if (ctx.subscriptions && Array.isArray(ctx.subscriptions)) {
      ctx.subscriptions.push(themeChangeDisposable);
      ctx.subscriptions.push(fileWatcher);
    }
  }

  private _getHtmlForWebview(webview: vscode.Webview) {
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._extensionUri,
        "src/webview-ui/dist",
        "webview.js",
      ),
    );

    const imagesUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "images"),
    );

    // Monaco Editor Assets - Now served from dist/vs (setup by webpack)
    const monacoBaseUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, "src/webview-ui/dist/vs"),
    );

    // We don't need manual loader/editor URIs here anymore as React handles it,
    // but we keep monacoCssUri for global styles if needed, though usually built-in.
    const monacoCssUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._extensionUri,
        "src/webview-ui/dist/vs/editor/editor.main.css",
      ),
    );

    const nonce = this.getNonce();

    // 🆕 Get workspace folder path
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    const folderPath = workspaceFolder?.uri.fsPath || null;

    return `<!DOCTYPE html>
<html lang="en">
<head>
 <meta charset="UTF-8">
 <meta name="viewport" content="width=device-width, initial-scale=1.0">
 <meta http-equiv="Content-Security-Policy" content="default-src 'none'; connect-src http://localhost:* ws://localhost:*; style-src ${
   webview.cspSource
 } 'unsafe-inline'; img-src ${webview.cspSource} data: https:; font-src ${
   webview.cspSource
 }; script-src 'nonce-${nonce}' ${
   webview.cspSource
 } 'unsafe-eval'; worker-src blob: data: vscode-resource: https: http:;">
 <title>Zen Chat</title>
 <link rel="stylesheet" type="text/css" href="${monacoCssUri}">
 <script nonce="${nonce}">
 // 🆕 Inject workspace folder path into global scope
 window.__zenWorkspaceFolderPath = ${JSON.stringify(folderPath)};
 window.__zenImagesUri = "${imagesUri}";
 window.__zenMonacoVsUri = "${monacoBaseUri}";
 </script>
 <style>
 
 /* VS Code sẽ tự động inject CSS variables vào webview */
 /* Chúng ta sử dụng các variables này trực tiếp */
 
 :root {
 /* Map các variables custom của chúng ta sang VS Code variables */
 --primary-bg: var(--vscode-editor-background, #1e1e1e);
 --secondary-bg: var(--vscode-sideBar-background, #252526);
 --tertiary-bg: var(--vscode-panel-background, #2d2d30);
 --hover-bg: var(--vscode-list-hoverBackground, #2a2d2e);
 --primary-text: var(--vscode-foreground, #cccccc);
 --secondary-text: var(--vscode-descriptionForeground, #858585);
 --accent-text: var(--vscode-textLink-foreground, #4fc3f7);
 --border-color: var(--vscode-panel-border, #3e3e42);
 --input-bg: var(--vscode-input-background, #3c3c3c);
 --button-primary: var(--vscode-button-background, #0e639c);
 --button-primary-hover: var(--vscode-button-hoverBackground, #1177bb);
 --button-secondary: var(--vscode-button-secondaryBackground, var(--vscode-sideBar-background, #2d2d30));
 --button-secondary-hover: var(--vscode-button-secondaryHoverBackground, #3e3e42);
 }
 
</style>
</head>
<body>
 <div id="root">
</div>
 <script nonce="${nonce}" src="${scriptUri}">
</script>
</body>
</html>`;
  }

  private getNonce(): string {
    let text = "";
    const possible =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  private _updateTheme(webview: vscode.Webview) {
    // Lấy theme hiện tại
    const theme = vscode.window.activeColorTheme;
    const themeKind = theme.kind;

    // VS Code tự động inject CSS variables vào webview
    // Chúng ta chỉ cần gửi theme kind để webview biết loại theme nào đang được sử dụng
    webview.postMessage({
      command: "updateTheme",
      theme: themeKind,
    });
  }

  public setExtensionContext(extCtx: vscode.ExtensionContext): void {
    this._extensionContext = extCtx;
    this._storageManager = new GlobalStorageManager(extCtx);
    this._storageManager.initialize().then(() => {
      this._storageManager?.migrateFromGlobalState();
    });
  }
}

let activeProvider: ZenChatViewProvider | null = null;

export async function activate(extContext: vscode.ExtensionContext) {
  // Initialize Managers
  const storageManager = new GlobalStorageManager(extContext);
  await storageManager.initialize();
  await storageManager.migrateFromGlobalState();

  const contextManager = new ContextManager();

  const projectStructureManager = new ProjectStructureManager(
    extContext.extensionUri,
    contextManager,
  );
  await projectStructureManager.initialize();

  // Create provider with dependencies
  const provider = new ZenChatViewProvider(
    extContext.extensionUri,
    contextManager,
    storageManager,
    projectStructureManager,
  );
  provider.setExtensionContext(extContext);
  provider.initializeAgentManager();
  activeProvider = provider;

  // Setup callback to notify webview when blacklist changes
  projectStructureManager.setOnChange(async () => {
    const blacklist = await projectStructureManager.getBlacklist();
    provider.postMessageToWebview({
      command: "projectStructureBlacklistResponse",
      blacklist,
    });
  });

  extContext.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      ZenChatViewProvider.viewType,
      provider,
    ),
  );

  const openChatCommand = vscode.commands.registerCommand(
    "zen.openChat",
    () => {
      vscode.commands.executeCommand("workbench.view.extension.zen-container");
    },
  );

  const settingsCommand = vscode.commands.registerCommand(
    "zen.settings",
    () => {
      provider.postMessageToWebview({ command: "showSettings" });
    },
  );

  const historyCommand = vscode.commands.registerCommand("zen.history", () => {
    provider.postMessageToWebview({ command: "showHistory" });
  });

  const newChatCommand = vscode.commands.registerCommand("zen.newChat", () => {
    provider.postMessageToWebview({ command: "newChat" });
  });

  const clearOldStorageCommand = vscode.commands.registerCommand(
    "zen.clearOldStorage",
    async () => {
      try {
        await storageManager.delete("zen-blacklist");
        vscode.window.showInformationMessage(
          "✅ Cleared old blacklist storage. Please reload the extension.",
        );
      } catch (error) {
        vscode.window.showErrorMessage(
          `Failed to clear storage: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
      }
    },
  );

  extContext.subscriptions.push(
    openChatCommand,
    settingsCommand,
    historyCommand,
    newChatCommand,
    clearOldStorageCommand,
  );
}

export function deactivate() {
  activeProvider = null;
}
