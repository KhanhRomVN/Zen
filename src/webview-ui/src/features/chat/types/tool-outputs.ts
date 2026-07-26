export interface ToolOutput {
  output: string;
  isError: boolean;
  terminalId?: string;
  originalError?: string; // Preserve original error message from validation
  diagnostics?: Array<{
    severity: string;
    message: string;
    line: number;
    column: number;
    source?: string;
    code?: string | number;
  }>;
  version?: number;
}

export type ToolOutputs = Record<string, ToolOutput>;
