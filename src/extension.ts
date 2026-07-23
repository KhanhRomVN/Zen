// * extension.ts - Entry point của Zen extension. Khởi tạo storage, providers, và đăng ký tất cả commands cho VS Code.
import * as vscode from "vscode";
import { GlobalStorageManager } from "./storage/GlobalStorageManager";
import { ZenChatViewProvider } from "./providers/ZenChatViewProvider";
import { ZenDiffProvider } from "./providers/ZenDiffProvider";

let activeProvider: ZenChatViewProvider | null = null;

// * Kích hoạt extension: khởi tạo GlobalStorageManager, ZenChatViewProvider, đăng ký webview provider và tất cả commands.
export async function activate(extContext: vscode.ExtensionContext) {
  // Initialize Managers
  const storageManager = new GlobalStorageManager(extContext);
  await storageManager.initialize();
  await storageManager.migrateFromGlobalState();

  const providerStart = Date.now();
  const provider = new ZenChatViewProvider(
    extContext.extensionUri,
    storageManager,
  );
  provider.getProcessManager().stopAll(); // clean up any leftover processes from previous session

  provider.initializeAgentManager();
  activeProvider = provider;
  const providerDuration = Date.now() - providerStart;

  const registrationStart = Date.now();
  extContext.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      ZenChatViewProvider.viewType,
      provider,
    ),
    ZenDiffProvider.register(extContext),
  );
  const registrationDuration = Date.now() - registrationStart;

  // Register Commands
  const commandsStart = Date.now();
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

  const accountsCommand = vscode.commands.registerCommand(
    "zen.openAccounts",
    () => {
      provider.postMessageToWebview({ command: "showAccounts" });
    },
  );

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

// * Dọn dẹp khi extension bị vô hiệu hóa: hủy ProcessManager và xóa tham chiếu provider.
export function deactivate() {
  activeProvider?.getProcessManager().dispose();
  activeProvider = null;
}
