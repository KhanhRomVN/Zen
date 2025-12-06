import { INTRODUCTION } from "./core/introduction";
import { OBJECTIVE } from "./core/objective";
import { TOOL_USE } from "./core/toolUse";
import { TOOL_EXAMPLES } from "./examples/toolExamples";
import { PLAN_VS_ACT } from "./modes/planVsAct";
import { CLARIFICATION_RULES } from "./rules/clarificationRules";
import { EDITING_RULES } from "./rules/editingRules";
import { GENERAL_RULES } from "./rules/generalRules";
import { WRAPPING_RULES } from "./rules/wrappingRules";
import { SYSTEM_INFO } from "./system/systemInfo";
import { CODE_OPERATIONS } from "./tools/codeOperations";
import { COMMUNICATION } from "./tools/communication";
import { EXECUTION } from "./tools/execution";
import { FILE_OPERATIONS } from "./tools/fileOperations";
import { MCP_TOOLS } from "./tools/mcpTools";

// Export tất cả các module prompts
export { INTRODUCTION } from "./core/introduction";
export { TOOL_USE } from "./core/toolUse";
export { OBJECTIVE } from "./core/objective";

export { FILE_OPERATIONS } from "./tools/fileOperations";
export { CODE_OPERATIONS } from "./tools/codeOperations";
export { EXECUTION } from "./tools/execution";
export { MCP_TOOLS } from "./tools/mcpTools";
export { COMMUNICATION } from "./tools/communication";

export { EDITING_RULES } from "./rules/editingRules";
export { WRAPPING_RULES } from "./rules/wrappingRules";
export { CLARIFICATION_RULES } from "./rules/clarificationRules";
export { GENERAL_RULES } from "./rules/generalRules";

export { PLAN_VS_ACT } from "./modes/planVsAct";
export { TOOL_EXAMPLES } from "./examples/toolExamples";
export { SYSTEM_INFO } from "./system/systemInfo";

export const combinePrompts = (): string => {
  return [
    INTRODUCTION,
    TOOL_USE,
    OBJECTIVE,
    FILE_OPERATIONS,
    CODE_OPERATIONS,
    EXECUTION,
    MCP_TOOLS,
    COMMUNICATION,
    EDITING_RULES,
    WRAPPING_RULES,
    CLARIFICATION_RULES,
    GENERAL_RULES,
    PLAN_VS_ACT,
    TOOL_EXAMPLES,
    SYSTEM_INFO,
  ].join("\n\n====\n\n");
};

// Export mặc định
export const DEFAULT_RULE_PROMPT = combinePrompts();
