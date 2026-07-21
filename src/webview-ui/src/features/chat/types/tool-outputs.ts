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
