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
  diagnosticsMessage?: string; // Message about diagnostics status (timeout, incomplete, etc.)
  version?: number;
  oldContent?: string; // For revert_file: content before revert (used for diff view)
  newContent?: string; // For revert_file: content after revert (used for diff view)
  revertedFromVersion?: number; // For revert_file: version before revert (e.g., 2 in "2 → 1")
  revertedToVersion?: number; // For revert_file: version after revert (e.g., 1 in "2 → 1")
}

export type ToolOutputs = Record<string, ToolOutput>;
