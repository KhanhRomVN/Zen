import * as vscode from "vscode";
import { state } from "./models/models";
import {
  ServiceContainer,
  IFolderTreeService,
} from "./infrastructure/di/ServiceContainer";
import { FolderProvider } from "./providers/FolderProvider";
import { registerAllCommands } from "./commands";
import { ClipboardProvider } from "./providers/ClipboardProvider";
import { Logger } from "./utils/common/logger";
import { FileWatcher } from "./utils/folder/fileWatcher";
import { PublicAPIImpl } from "./api/PublicAPIImpl";
import { CopyPathWithCodeAPI } from "./api/PublicAPI";

// Import clipboard services
import { ClipboardService } from "./domain/clipboard/services/ClipboardService";
import { ClipboardDetector } from "./utils/clipboard/clipboardDetector";

// SOLUTION: Import the function to set tree view reference
import { setFolderTreeView } from "./commands/folder/FolderCommands";

let clipboardMonitoringInterval: NodeJS.Timeout | undefined;
let clipboardDetector: ClipboardDetector | undefined;

export function activate(context: vscode.ExtensionContext) {
  try {
    // Initialize logger
    Logger.initialize();

    // Initialize service container with clean architecture
    const container = ServiceContainer.getInstance();
    container.initialize(context);

    // Initialize public API
    const publicAPI = new PublicAPIImpl(container);
    context.subscriptions.push(publicAPI);

    // Initialize file watcher for tracking deleted files
    const fileWatcher = FileWatcher.init(context);

    // Initialize status bar item
    state.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    state.statusBarItem.hide();
    context.subscriptions.push(state.statusBarItem);

    // Create folder tree view using clean architecture
    const folderTreeService =
      container.resolve<IFolderTreeService>("IFolderTreeService");
    const treeDataProvider = new FolderProvider(folderTreeService);

    // Create tree view and set reference in provider
    const treeView = vscode.window.createTreeView("folderManager", {
      treeDataProvider,
      showCollapseAll: true,
      canSelectMany: false,
    });

    // Set tree view reference in provider to manage expansion state
    treeDataProvider.setTreeView(treeView);

    // SOLUTION: Also set tree view reference in FolderCommands for expand/collapse operations
    setFolderTreeView(treeView);

    // Create clipboard provider
    const clipboardProvider = new ClipboardProvider();
    const clipboardTreeView = vscode.window.createTreeView(
      "clipboard-detection",
      {
        treeDataProvider: clipboardProvider,
        showCollapseAll: false,
      }
    );

    // Complete the dependency injection chain (pass both providers)
    container.registerUIServices(treeDataProvider, clipboardProvider);

    // Set initial context
    vscode.commands.executeCommand(
      "setContext",
      "copyPathWithCode.viewMode",
      "workspace"
    );
    vscode.commands.executeCommand(
      "setContext",
      "copyPathWithCode.hasClipboardFiles",
      state.clipboardFiles.length > 0
    );

    // Initialize clipboard detection using the existing ClipboardDetector class
    clipboardDetector = ClipboardDetector.init(context);

    // Start clipboard integrity monitoring
    startClipboardMonitoring(container);

    // Register ALL commands through the centralized system
    registerAllCommands(context, treeDataProvider, clipboardProvider);

    // Add tree views to subscriptions for proper cleanup
    context.subscriptions.push(treeView);
    context.subscriptions.push(clipboardTreeView);

    // Cleanup
    context.subscriptions.push({
      dispose: () => {
        if (clipboardDetector) {
          clipboardDetector.dispose();
        }
        fileWatcher.dispose();
        container.dispose();
        if (clipboardMonitoringInterval) {
          clearInterval(clipboardMonitoringInterval);
          clipboardMonitoringInterval = undefined;
        }
      },
    });

    // Export public API for other extensions
    return publicAPI as CopyPathWithCodeAPI;
  } catch (error) {
    Logger.error("Failed to activate extension", error);
    vscode.window.showErrorMessage(
      `Failed to activate Copy Path with Code: ${
        error instanceof Error ? error.message : "Unknown error"
      }`
    );
  }
}

function startClipboardMonitoring(container: ServiceContainer) {
  // Monitor clipboard integrity every 2 seconds
  clipboardMonitoringInterval = setInterval(async () => {
    try {
      const clipboardService =
        container.resolve<ClipboardService>("ClipboardService");
      const copiedFiles = clipboardService.getCopiedFiles();

      if (copiedFiles.length > 0) {
        const integrityOk = await clipboardService.checkClipboardIntegrity();

        // FIXED: Force statusbar update when integrity check clears files
        if (!integrityOk) {
          // Update status bar immediately after files are cleared
          container.updateClipboardStatusBar?.();

          // Also refresh clipboard view
          vscode.commands.executeCommand(
            "copy-path-with-code.refreshClipboardView"
          );
        }
      }
    } catch (error) {
      Logger.error("Error during clipboard monitoring", error);
    }
  }, 2000);
}

export function deactivate() {
  try {
    // Clear state arrays
    state.copiedFiles.length = 0;
    state.clipboardFiles.length = 0;
    // tempClipboard removed - no longer needed

    // Clear clipboard monitoring interval
    if (clipboardMonitoringInterval) {
      clearInterval(clipboardMonitoringInterval);
      clipboardMonitoringInterval = undefined;
    }

    // Dispose clipboard detector
    if (clipboardDetector) {
      clipboardDetector.dispose();
      clipboardDetector = undefined;
    }

    // Hide status bar item
    if (state.statusBarItem) {
      state.statusBarItem.hide();
      state.statusBarItem.dispose();
      state.statusBarItem = undefined;
    }

    // Clean up service container
    const container = ServiceContainer.getInstance();
    container.dispose();

    // Dispose logger
    Logger.dispose();
  } catch (error) {
    console.error("Error during extension deactivation:", error);
  }
}
