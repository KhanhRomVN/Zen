import { PermissionValidator } from "./validators/PermissionValidator";
import {
  FileReadCapability,
  FileEditCapability,
  FileAddCapability,
  CommandExecutor,
  grepCapability,
} from "./capabilities";
import {
  AgentPermissions,
  AgentAction,
  AgentExecutionResult,
  ValidationResult,
} from "./types/AgentTypes";

export class AgentCapabilityManager {
  private validator: PermissionValidator;
  private fileReadCapability: FileReadCapability;
  private fileEditCapability: FileEditCapability;
  private fileAddCapability: FileAddCapability;
  private commandExecutor: CommandExecutor;
  private grepCapability: grepCapability;

  constructor(permissions: AgentPermissions, workspaceRoot: string) {
    this.validator = new PermissionValidator(permissions, workspaceRoot);
    this.fileReadCapability = new FileReadCapability();
    this.fileEditCapability = new FileEditCapability();
    this.fileAddCapability = new FileAddCapability();
    this.commandExecutor = new CommandExecutor(workspaceRoot);
    this.grepCapability = new grepCapability(workspaceRoot);
  }

  public async executeAction(
    action: AgentAction,
  ): Promise<AgentExecutionResult> {
    // Step 1: Validate permissions
    const validation = this.validator.validate(action);

    if (!validation.allowed) {
      console.warn(`[Zen][AgentCapabilityManager] 🚫 Permission denied:`, {
        type: action.type,
        reason: validation.reason,
      });
      return {
        success: false,
        error: validation.reason || "Permission denied",
        timestamp: Date.now(),
      };
    }

    // Step 2: Execute action based on type
    try {
      let result: AgentExecutionResult;

      switch (action.type) {
        case "read":
          result = await this.fileReadCapability.execute(action);
          break;
        case "edit":
          result = await this.fileEditCapability.execute(action);
          break;
        case "add":
          result = await this.fileAddCapability.execute(action);
          break;
        case "execute":
          result = await this.commandExecutor.execute(action);
          break;
        case "grep":
          result = await this.grepCapability.execute(action);
          break;
        default:
          result = {
            success: false,
            error: "Unknown action type",
            timestamp: Date.now(),
          };
      }

      return result;
    } catch (error) {
      console.error(`[Zen][AgentCapabilityManager] ❌ Execution failed:`, {
        type: action.type,
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
        timestamp: Date.now(),
      };
    }
  }

  public validateAction(action: AgentAction): ValidationResult {
    return this.validator.validate(action);
  }

  public updatePermissions(newPermissions: AgentPermissions): void {
    this.validator.updatePermissions(newPermissions);
  }
}
