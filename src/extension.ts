import * as vscode from "vscode";
import { ContextManager } from "./context/ContextManager";
import { GlobalStorageManager } from "./storage/GlobalStorageManager";
import { ZenChatViewProvider } from "./providers/ZenChatViewProvider";
import { ZenDiffProvider } from "./providers/ZenDiffProvider";

let activeProvider: ZenChatViewProvider | null = null;

export async function activate(extContext: vscode.ExtensionContext) {
  // Initialize Managers
  const storageManager = new GlobalStorageManager(extContext);
  await storageManager.initialize();
  await storageManager.migrateFromGlobalState();

  const contextManager = new ContextManager();

  const provider = new ZenChatViewProvider(
    extContext.extensionUri,
    contextManager,
    storageManager,
  );
  provider.setExtensionContext(extContext);

  // Also pass context to ProcessManager and restore persistent terminals
  provider.getProcessManager().setExtensionContext(extContext);
  provider.getProcessManager().stopAll(); // clean up any leftover processes from previous session

  provider.initializeAgentManager();
  activeProvider = provider;

  extContext.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      ZenChatViewProvider.viewType,
      provider,
    ),
    ZenDiffProvider.register(extContext),
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

  const accountsCommand = vscode.commands.registerCommand("zen.openAccounts", () => {
    provider.postMessageToWebview({ command: "showAccounts" });
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

  // Add all commands to subscriptions
  extContext.subscriptions.push(
    openChatCommand,
    settingsCommand,
    historyCommand,
    accountsCommand,
    newChatCommand,
    refreshProjectStructureCommand,
    clearOldStorageCommand,
    addToContextCommand,
  );
}

export function deactivate() {
  activeProvider?.getProcessManager().dispose();
  activeProvider = null;
}
