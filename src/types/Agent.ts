export interface AgentPermissions {
  readProjectFile: boolean;
  readAllFile: boolean;
  editProjectFiles: boolean;
  editAddFile: boolean;
  executeSafeCommand: boolean;
  executeAllCommands: boolean;
}

export interface AgentAction {
  type: "read" | "edit" | "execute" | "add" | "grep";
  path?: string;
  content?: string;
  command?: string;
  search_term?: string;
  file_path?: string;
  folder_path?: string;
  requestId: string;
  timestamp: number;
}

export interface ValidationResult {
  allowed: boolean;
  reason?: string;
  requiresConfirmation?: boolean;
}

export interface AgentExecutionResult {
  success: boolean;
  data?: any;
  error?: string;
  timestamp: number;
}