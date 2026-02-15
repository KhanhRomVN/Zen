import * as path from "path";
import {
  AgentPermissions,
  AgentAction,
  ValidationResult,
} from "../types/AgentTypes";

export class PermissionValidator {
  private permissions: AgentPermissions;
  private workspaceRoot: string;

  constructor(permissions: AgentPermissions, workspaceRoot: string) {
    this.permissions = permissions;
    this.workspaceRoot = workspaceRoot;
  }

  public validate(action: AgentAction): ValidationResult {
    switch (action.type) {
      case "read":
        return this.validateRead(action);
      case "edit":
        return this.validateEdit(action);
      case "add":
        return this.validateAdd(action);
      case "execute":
        return this.validateExecute(action);
      default:
        return { allowed: false, reason: "Unknown action type" };
    }
  }

  private validateRead(action: AgentAction): ValidationResult {
    if (!action.path) {
      return { allowed: false, reason: "Missing file path" };
    }

    const isProjectFile = this.isProjectFile(action.path);

    if (isProjectFile && this.permissions.readProjectFile) {
      return { allowed: true };
    }

    if (!isProjectFile && this.permissions.readAllFile) {
      return { allowed: true };
    }

    return {
      allowed: false,
      reason: `Permission denied: Cannot read ${
        isProjectFile ? "project" : "external"
      } files`,
    };
  }

  private validateEdit(action: AgentAction): ValidationResult {
    if (!action.path) {
      return { allowed: false, reason: "Missing file path" };
    }

    const isProjectFile = this.isProjectFile(action.path);

    if (!isProjectFile) {
      return {
        allowed: false,
        reason: "Cannot edit files outside project",
      };
    }

    if (this.permissions.editProjectFiles) {
      return { allowed: true };
    }

    return {
      allowed: false,
      reason: "Permission denied: Cannot edit project files",
    };
  }

  private validateAdd(action: AgentAction): ValidationResult {
    if (!action.path) {
      return { allowed: false, reason: "Missing file path" };
    }

    const isProjectFile = this.isProjectFile(action.path);

    if (!isProjectFile) {
      return {
        allowed: false,
        reason: "Cannot add files outside project",
      };
    }

    if (this.permissions.editAddFile) {
      return { allowed: true };
    }

    return {
      allowed: false,
      reason: "Permission denied: Cannot add new files",
    };
  }

  private validateExecute(action: AgentAction): ValidationResult {
    if (!action.command) {
      return { allowed: false, reason: "Missing command" };
    }

    const isSafeCommand = this.isSafeCommand(action.command);

    if (isSafeCommand && this.permissions.executeSafeCommand) {
      return { allowed: true };
    }

    if (this.permissions.executeAllCommands) {
      return {
        allowed: true,
        requiresConfirmation: !isSafeCommand,
      };
    }

    return {
      allowed: false,
      reason: `Permission denied: Cannot execute ${
        isSafeCommand ? "safe" : "unsafe"
      } commands`,
    };
  }

  private isProjectFile(filePath: string): boolean {
    const normalizedPath = path.normalize(filePath);
    const normalizedRoot = path.normalize(this.workspaceRoot);
    return normalizedPath.startsWith(normalizedRoot);
  }

  private isSafeCommand(command: string): boolean {
    const safeCommands = [
      "git status",
      "git log",
      "git diff",
      "npm list",
      "npm outdated",
      "ls",
      "pwd",
      "echo",
      "cat",
      "grep",
    ];

    const commandLower = command.toLowerCase().trim();
    return safeCommands.some((safe) => commandLower.startsWith(safe));
  }

  public updatePermissions(newPermissions: AgentPermissions): void {
    this.permissions = newPermissions;
  }
}
