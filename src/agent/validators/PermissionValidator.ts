/**
 *? Usage:
 *    Xác thực quyền của agent trước khi thực thi action (read/edit/add/execute/grep). Gọi SecurityValidator để kiểm tra bảo mật trước.
 *
 *? Function:
 *    validate()         : Kiểm tra quyền cho một action, trả về ValidationResult.
 *    updatePermissions(): Cập nhật bộ quyền mới.
 */
import * as path from "path";

// TYPES
import { AgentAction, AgentPermissions, ValidationResult } from "../../types";

// VALIDATORS
import { SecurityValidator } from "./SecurityValidator";

export class PermissionValidator {
  private permissions: AgentPermissions;
  private workspaceRoot: string;

  constructor(permissions: AgentPermissions, workspaceRoot: string) {
    this.permissions = permissions;
    this.workspaceRoot = workspaceRoot;
  }

  public validate(action: AgentAction): ValidationResult {
    // Perform strict security validation before checking user permission settings
    if (action.path) {
      const securityCheck = SecurityValidator.validatePath(
        action.path,
        action.type !== "read",
      );
      if (!securityCheck.safe) {
        return { allowed: false, reason: securityCheck.reason };
      }
    }

    if (action.command) {
      const securityCheck = SecurityValidator.validateCommand(action.command);
      if (!securityCheck.safe) {
        return { allowed: false, reason: securityCheck.reason };
      }
    }

    switch (action.type) {
      case "read":
        return this.validateRead(action);
      case "edit":
        return this.validateEdit(action);
      case "add":
        return this.validateAdd(action);
      case "execute":
        return this.validateExecute(action);
      case "grep":
        return this.validateSmartSearch(action);
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

  private validateSmartSearch(action: AgentAction): ValidationResult {
    if (!action.search_term) {
      // More detailed error message
      const hasPattern = !!(action as any).pattern;
      const hasQuery = !!(action as any).query;

      if (hasPattern || hasQuery) {
        return {
          allowed: false,
          reason:
            "search_term field is required (found pattern/query but search_term is missing or empty)",
        };
      }

      return {
        allowed: false,
        reason:
          "search_term is required but was not provided or is empty. Check XML parsing or pattern extraction.",
      };
    }

    const hasFilePath = !!action.file_path;
    const hasFolderPath = !!action.folder_path;

    if (!hasFilePath && !hasFolderPath) {
      return {
        allowed: false,
        reason:
          "Either file_path or folder_path must be provided (both are missing)",
      };
    }

    if (hasFilePath && hasFolderPath) {
      return {
        allowed: false,
        reason: "Provide only one of file_path or folder_path, not both",
      };
    }

    // Resolve relative paths against workspaceRoot before permission check.
    // Relative paths like ".", "src", etc. are always relative to the workspace.
    const rawPath = (action.file_path || action.folder_path)!;
    const resolvedPath = path.isAbsolute(rawPath)
      ? rawPath
      : path.resolve(this.workspaceRoot, rawPath);

    return this.validateRead({ ...action, path: resolvedPath });
  }

  public updatePermissions(newPermissions: AgentPermissions): void {
    this.permissions = newPermissions;
  }
}
