import type { ToolOutput } from "./tool-outputs";
import { extensionService, messageDispatcher } from "@/services/ExtensionService";

// Common diagnostic type
export interface Diagnostic {
  severity: string;
  message: string;
  line: number;
  column: number;
  source?: string;
  code?: string | number;
}

// Executor context - shared state and dependencies
export interface ExecutorContext {
  setToolOutputs: React.Dispatch<
    React.SetStateAction<Record<string, ToolOutput>>
  >;
  conversationIdRef?: React.MutableRefObject<string>;
  getToolTimeout: (actionType: string) => number;
  extensionService: typeof extensionService;
  messageDispatcher: typeof messageDispatcher;
  // Optional fields for run_command and other special executors
  pendingToolResolvers?: Map<string, (result: string | null) => void>;
  commandStartTimes?: Map<string, number>;
  earlyCommandResults?: Map<string, any>;
  /** Response number of the assistant message that triggered this tool execution (1-based). Used for revert tracking. */
  responseNumber?: number;
}

// Base executor interface
export interface ToolExecutor {
  execute(
    action: any,
    context: ExecutorContext,
    options?: ExecutorOptions
  ): Promise<string | null>;
}

// Executor options
export interface ExecutorOptions {
  skipDiagnostics?: boolean;
  bypassIgnore?: boolean;
}