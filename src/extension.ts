import * as vscode from "vscode";
import { ContextManager } from "./context/ContextManager";
import { GlobalStorageManager } from "./storage-manager";
import { ProjectStructureManager } from "./context/ProjectStructureManager";
import { ShikiService } from "./services/ShikiService";
import { ZenChatViewProvider } from "./providers/ZenChatViewProvider";

let activeProvider: ZenChatViewProvider | null = null;

export async function activate(extContext: vscode.ExtensionContext) {
  // Initialize Managers
  const storageManager = new GlobalStorageManager(extContext);
  await storageManager.initialize();
  await storageManager.migrateFromGlobalState();

  const contextManager = new ContextManager();

  // Initialize ShikiService with extension URI for asset resolution
  ShikiService.getInstance().setExtensionUri(extContext.extensionUri);

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

  // Also pass context to ProcessManager and restore persistent terminals
  provider.getProcessManager().setExtensionContext(extContext);
  provider.getProcessManager().restoreState();

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

  // Add all commands to subscriptions
  extContext.subscriptions.push(
    openChatCommand,
    settingsCommand,
    historyCommand,
    newChatCommand,
    refreshProjectStructureCommand,
    clearOldStorageCommand,
    addToContextCommand,
  );
}

export function deactivate() {
  activeProvider = null;
}
