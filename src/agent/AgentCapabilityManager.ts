import { PermissionValidator } from "./validators/PermissionValidator";
import {
  FileReadCapability,
  FileEditCapability,
  FileAddCapability,
  CommandExecutor,
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

  constructor(permissions: AgentPermissions, workspaceRoot: string) {
    this.validator = new PermissionValidator(permissions, workspaceRoot);
    this.fileReadCapability = new FileReadCapability();
    this.fileEditCapability = new FileEditCapability();
    this.fileAddCapability = new FileAddCapability();
    this.commandExecutor = new CommandExecutor(workspaceRoot);
  }

  public async executeAction(
    action: AgentAction
  ): Promise<AgentExecutionResult> {
    // Step 1: Validate permissions
    const validation = this.validator.validate(action);

    if (!validation.allowed) {
      return {
        success: false,
        error: validation.reason || "Permission denied",
        timestamp: Date.now(),
      };
    }

    // Step 2: Execute action based on type
    try {
      switch (action.type) {
        case "read":
          return await this.fileReadCapability.execute(action);
        case "edit":
          return await this.fileEditCapability.execute(action);
        case "add":
          return await this.fileAddCapability.execute(action);
        case "execute":
          return await this.commandExecutor.execute(action);
        default:
          return {
            success: false,
            error: "Unknown action type",
            timestamp: Date.now(),
          };
      }
    } catch (error) {
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
