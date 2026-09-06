// ===== BASE PARAMS =====
export interface BaseToolParams {
  file_path?: string;
  path?: string;
  folder_path?: string;
}

export interface FindFilesResult {
  fileName: string;
  matches: string[];
}

// ===== RUN COMMAND =====
export interface RunCommandParams {
  command: string;
  terminal_id?: string;
  cwd?: string;
  folder_path?: string;
  folderPath?: string;
}

// ===== GIT STATUS =====
export interface GitStatusItem {
  status: string;
  path: string;
  staged?: boolean;
  added?: number;
  deleted?: number;
  isUnpushedCommit?: boolean;
}

export interface GitStatusParams {
  items?: GitStatusItem[] | string;
  branch?: string;
  raw?: string;
}

export interface GitStatusBlockProps {
  statusItems: GitStatusItem[];
  onConfirm: () => void;
  onCancel: () => void;
  isProcessing?: boolean;
}

// ===== COMMIT MESSAGE =====
export interface CommitMessageParams {
  message?: string;
  content?: string;
}

export interface CommitMessageBlockProps {
  message: string;
  branch?: string;
  isCommitted?: boolean;
  isRejected?: boolean;
  isProcessing?: boolean;
  onAccept?: () => void;
  onReject?: () => void;
}

// ===== GIT DIFF =====
export interface GitDiffParams extends BaseToolParams {}

export interface GitDiffBlockProps {
  filePath: string;
  diffContent: string;
  added: number;
  deleted: number;
  statusColor: string;
  isPartial: boolean;
  branch?: string;
  onFileClick?: (path: string) => void;
}

// ===== CODE =====
export interface CodeBlock {
  content: string;
  language?: string;
}

// ===== MARKDOWN =====
export interface MarkdownBlockProps {
  content: string;
}

// ===== THINKING =====
export interface ThinkingBlock {
  content: string;
}

// ===== QUESTION =====
export interface QuestionBlock {
  options: string[];
  title?: string;
  optional?: boolean;
  questions?: any[]; // Avoid circular dependency with message types
}
