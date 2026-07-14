import * as vscode from "vscode";
import { FileLockManager } from "../../managers/FileLockManager";
import { GlobalStorageManager } from "../../storage/GlobalStorageManager";
import { ConversationHistoryHandler } from "./conversation/ConversationHistoryHandler";
import { ConversationStateHandler } from "./conversation/ConversationStateHandler";
import { ConversationLogHandler } from "./conversation/ConversationLogHandler";

export class ConversationHandler {
  private historyHandler: ConversationHistoryHandler;
  private stateHandler: ConversationStateHandler;
  private logHandler: ConversationLogHandler;

  constructor(
    private fileLockManager: FileLockManager,
    private storageManager?: GlobalStorageManager,
  ) {
    this.historyHandler = new ConversationHistoryHandler(fileLockManager, storageManager);
    this.stateHandler = new ConversationStateHandler(fileLockManager);
    this.logHandler = new ConversationLogHandler(fileLockManager);
  }

  // ── History ──
  public async handleGetHistory(message: any, webviewView: vscode.WebviewView) {
    return this.historyHandler.handleGetHistory(message, webviewView);
  }
  public async handleGetConversation(message: any, webviewView: vscode.WebviewView) {
    return this.historyHandler.handleGetConversation(message, webviewView);
  }
  public async handleDeleteConversation(message: any, webviewView: vscode.WebviewView) {
    return this.historyHandler.handleDeleteConversation(message, webviewView);
  }
  public async handleDeleteAllConversations(message: any, webviewView: vscode.WebviewView) {
    return this.historyHandler.handleDeleteAllConversations(message, webviewView);
  }
  public async handleRenameConversationLog(message: any, webviewView: vscode.WebviewView) {
    return this.historyHandler.handleRenameConversationLog(message, webviewView);
  }
  public async handleOpenConversationFolder(message: any) {
    return this.historyHandler.handleOpenConversationFolder(message);
  }
  public async handleSendMessage(message: any, webviewView: vscode.WebviewView) {
    return this.historyHandler.handleSendMessage(message, webviewView);
  }

  // ── State ──
  public async handleSaveConversationState(message: any) {
    return this.stateHandler.handleSaveConversationState(message);
  }
  public async handleRevertConversation(message: any, webviewView: vscode.WebviewView) {
    return this.stateHandler.handleRevertConversation(message, webviewView);
  }
  public async handleRollbackConversationLog(message: any) {
    return this.stateHandler.handleRollbackConversationLog(message);
  }

  // ── Log ──
  public async handleLogConversation(message: any) {
    return this.logHandler.handleLogConversation(message);
  }
  public async handleLogChat(message: any) {
    return this.logHandler.handleLogChat(message);
  }
  public async handleCreateEmptyChatLog(message: any) {
    return this.logHandler.handleCreateEmptyChatLog(message);
  }
}