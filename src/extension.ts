import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { ContextManager } from "./context/ContextManager";
import { GlobalStorageManager } from "./storage-manager";
import { ShikiService } from "./services/ShikiService";
import { ZenChatViewProvider } from "./providers/ZenChatViewProvider";
import { CheckpointManager } from "./utils/CheckpointManager";

let activeProvider: ZenChatViewProvider | null = null;

export async function activate(extContext: vscode.ExtensionContext) {
  // Initialize Managers
  const storageManager = new GlobalStorageManager(extContext);
  await storageManager.initialize();
  await storageManager.migrateFromGlobalState();

  const contextManager = new ContextManager();

  // Initialize ShikiService with extension URI for asset resolution
  ShikiService.getInstance().setExtensionUri(extContext.extensionUri);

  // Create provider with dependencies
  const provider = new ZenChatViewProvider(
    extContext.extensionUri,
    contextManager,
    storageManager,
  );
  provider.setExtensionContext(extContext);

  // Also pass context to ProcessManager and restore persistent terminals
  provider.getProcessManager().setExtensionContext(extContext);
  provider.getProcessManager().restoreState();

  provider.initializeAgentManager();
  activeProvider = provider;

  // Pre-warm Shiki trong background (không block activate)
  // Khi user mở panel lần đầu, Shiki sẽ đã được khởi tạo xong
  ShikiService.getInstance().initialize().catch(() => {
    // Silent fail — Shiki sẽ tự khởi tạo lại khi cần
  });

  extContext.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      ZenChatViewProvider.viewType,
      provider,
    ),
  );

  // Register Commands
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

  const refreshProjectStructureCommand = vscode.commands.registerCommand(
    "zen.refreshProjectStructure",
    () => {
      provider.postMessageToWebview({ command: "refreshProjectStructure" });
    },
  );

  const clearOldStorageCommand = vscode.commands.registerCommand(
    "zen.clearOldStorage",
    async () => {
      try {
        vscode.window.showInformationMessage(
          "Zen: no legacy storage to clear.",
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

  const addToContextCommand = vscode.commands.registerCommand(
    "zen.addToContext",
    async (uri: vscode.Uri, uris?: vscode.Uri[]) => {
      const selectedUris = uris && uris.length > 0 ? uris : [uri];
      for (const selectedUri of selectedUris) {
        try {
          const stat = await vscode.workspace.fs.stat(selectedUri);
          const isFolder = stat.type === vscode.FileType.Directory;
          provider.postMessageToWebview({
            command: "addAttachedItem",
            uri: selectedUri.fsPath,
            itemType: isFolder ? "folder" : "file",
          });
        } catch (e) {
          provider.postMessageToWebview({
            command: "addAttachedItem",
            uri: selectedUri.fsPath,
          });
        }
      }
    },
  );

  // Register file change listeners for checkpointing
  const checkpointManager = CheckpointManager.getInstance();

  const onDidCreateFilesDisposable = vscode.workspace.onDidCreateFiles((event) => {
    for (const file of event.files) {
      checkpointManager.createCheckpoint(file.fsPath, "create");
    }
  });

  const onWillDeleteFilesDisposable = vscode.workspace.onWillDeleteFiles((event) => {
    const collectFiles = (dirPath: string, filesList: string[]) => {
      try {
        const stats = fs.statSync(dirPath);
        if (stats.isFile()) {
          filesList.push(dirPath);
        } else if (stats.isDirectory()) {
          const entries = fs.readdirSync(dirPath);
          for (const entry of entries) {
            collectFiles(path.join(dirPath, entry), filesList);
          }
        }
      } catch {}
    };

    for (const file of event.files) {
      const filesList: string[] = [];
      collectFiles(file.fsPath, filesList);
      for (const f of filesList) {
        // Create checkpoint synchronously before the delete is finalized
        checkpointManager.createCheckpoint(f, "delete");
      }
    }
  });

  // Add all commands to subscriptions
  extContext.subscriptions.push(
    openChatCommand,
    settingsCommand,
    historyCommand,
    newChatCommand,
    refreshProjectStructureCommand,
    clearOldStorageCommand,
    addToContextCommand,
    onDidCreateFilesDisposable,
    onWillDeleteFilesDisposable,
  );
}

export function deactivate() {
  activeProvider = null;
}
