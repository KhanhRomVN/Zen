/**
 * Type definition for tool execution outputs
 * Includes optional diagnostics for tools that support them (e.g., read_file)
 */
export interface ToolOutput {
  output: string;
  isError: boolean;
  terminalId?: string;
  diagnostics?: Array<{
    severity: string;
    message: string;
    line: number;
    column: number;
    source?: string;
    code?: string | number;
  }>;
}

export type ToolOutputs = Record<string, ToolOutput>;
