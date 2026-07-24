/**
 *? Usage:
 *    Điều phối thực thi grep của AI agent: validate permission, sau đó gọi GrepCapability.
 *
 *? Function:
 *    executeGrep(): Xác thực quyền rồi thực thi grep, trả về AgentExecutionResult.
 */
// CAPABILITIES
import { GrepCapability } from "./capabilities/GrepCapability";

// TYPES
import {
  AgentAction,
  AgentExecutionResult,
  AgentPermissions,
} from "../types/Agent";

// VALIDATORS
import { PermissionValidator } from "./validators/PermissionValidator";

export class AgentManager {
  private validator: PermissionValidator;
  private grepCapability: GrepCapability;

  constructor(permissions: AgentPermissions, workspaceRoot: string) {
    this.validator = new PermissionValidator(permissions, workspaceRoot);
    this.grepCapability = new GrepCapability(workspaceRoot);
  }

  public async executeGrep(
    action: AgentAction,
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

    // Step 2: Execute grep
    try {
      return await this.grepCapability.execute(action);
    } catch (error) {
      console.error(`[Zen][AgentManager] ❌ Grep execution failed:`, {
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
}
